import {
  Injectable,
  Logger,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { FraudStatus, AccountStatus, TaskTriggerType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { ReferralService } from '../referral/referral.service';
import { TasksService } from '../tasks/tasks.service';
import { SettingsService } from '../settings/settings.service';
import { AdjoeCallbackQuery } from './dto/adjoe-callback.dto';

@Injectable()
export class AdjoeService {
  private readonly logger = new Logger(AdjoeService.name);

  /** Env fallback for the coin→USD rate. Primary source is the admin-editable
   *  `adjoe_coin_to_usd` setting; this is used only when that setting is unset/0. */
  private readonly coinToUsd: number;
  /** Which query param carries our user id (Adjoe echoes back what we set at SDK init). */
  private readonly userIdParam: string;
  /** Enforce the `sid` signature. Off during bring-up until Adjoe's formula is confirmed. */
  private readonly verifySignature: boolean;
  /** Shared secret Adjoe signs the postback with. */
  private readonly s2sSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly referralService: ReferralService,
    private readonly tasksService: TasksService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {
    this.coinToUsd = Number(config.get<string>('ADJOE_COIN_TO_USD', '')) || 0;
    this.userIdParam = config.get<string>('ADJOE_USER_ID_PARAM', 'user_uuid');
    this.verifySignature = config.get<string>('ADJOE_VERIFY_SIGNATURE', 'false') === 'true';
    this.s2sSecret = config.get<string>('ADJOE_S2S_TOKEN', '');
  }

  // ─── Unity SDK Init ──────────────────────────────────────────────────────────

  async getSdkConfig(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, fraudStatus: true, accountStatus: true },
    });

    if (user.accountStatus !== AccountStatus.active) {
      throw new ForbiddenException('Account is not active.');
    }
    if (user.fraudStatus === FraudStatus.blocked) {
      throw new ForbiddenException('Account is fraud-blocked.');
    }

    return {
      publisherSubId: user.id,
      sdkHash: this.config.get<string>('ADJOE_SDK_HASH', ''),
    };
  }

  // ─── S2S Postback ─────────────────────────────────────────────────────────────

  /**
   * Handles Adjoe's S2S reward postback (GET + query params).
   *
   * Response policy:
   *   - Handled / non-retryable cases (bad signature, unknown user, duplicate,
   *     missing fields) → return { ok: true } so Adjoe stops retrying.
   *   - Transient / our-fault cases (coin rate not configured, credit threw) →
   *     throw 5xx so Adjoe re-delivers later and the reward is not lost.
   */
  async handleCallback(query: AdjoeCallbackQuery): Promise<{ ok: true }> {
    const transId = query.trans_uuid?.trim();
    const rawUser = query[this.userIdParam]?.trim();
    const coins = Number(query.coin_amount);

    // ── 1. Basic shape ────────────────────────────────────────────────────────
    if (!transId || !rawUser || !Number.isFinite(coins)) {
      this.logger.warn(
        `Adjoe: malformed callback — trans=${transId} ${this.userIdParam}=${rawUser} coins=${query.coin_amount}`,
      );
      return { ok: true };
    }

    // ── 2. Signature ──────────────────────────────────────────────────────────
    if (!this.verifyCallbackSignature(query)) {
      this.logger.warn(`Adjoe: signature rejected tx=${transId}`);
      return { ok: true };
    }

    // ── 3. Deduplicate (Adjoe retries the same trans_uuid) ─────────────────────
    const existing = await this.prisma.transaction.findFirst({
      where: { referenceId: transId },
    });
    if (existing) {
      // Recovery: a prior delivery credited but a retry arrived before the
      // pending→available release completed. Finish it now so a reward can never
      // get stuck in pending (there is no other path that releases adjoe rewards).
      if (existing.status === 'pending') {
        await this.walletService
          .releasePending(existing.id)
          .catch((err) => this.logger.error(`Adjoe: re-release failed tx=${transId}`, err as Error));
      }
      this.logger.log(`Adjoe: duplicate tx=${transId} — skipped`);
      return { ok: true };
    }

    // ── 4. Resolve user ───────────────────────────────────────────────────────
    const user = await this.prisma.user.findUnique({ where: { id: rawUser } });
    if (!user) {
      this.logger.warn(
        `Adjoe: unknown user (${this.userIdParam}=${rawUser}) tx=${transId} — ` +
          `check the Adjoe dashboard macro maps our user id to this param`,
      );
      return { ok: true };
    }
    if (user.fraudStatus === FraudStatus.blocked) {
      this.logger.warn(`Adjoe: blocked user=${user.id} tx=${transId}`);
      return { ok: true };
    }

    // ── 5. Coins → USD ────────────────────────────────────────────────────────
    // Rate is admin-editable live from the dashboard (Settings → adjoe_coin_to_usd);
    // falls back to the ADJOE_COIN_TO_USD env var only when the setting is unset/0.
    const coinToUsd = this.settings.adjoeCoinToUsd || this.coinToUsd;
    if (coinToUsd <= 0) {
      // Config missing — do NOT guess a value for real money. Ask Adjoe to retry.
      this.logger.error(
        `Adjoe: coin→USD rate not configured — cannot price ${coins} coins (tx=${transId}). ` +
          `Reward NOT credited; Adjoe will retry. Set the "adjoe_coin_to_usd" setting ` +
          `(admin dashboard) or the ADJOE_COIN_TO_USD env var to enable payouts.`,
      );
      throw new ServiceUnavailableException('Reward pricing not configured.');
    }
    const usd = Number((coins * coinToUsd).toFixed(4));
    if (usd <= 0) {
      this.logger.warn(`Adjoe: non-positive reward (${coins} coins → $${usd}) tx=${transId} — skipped`);
      return { ok: true };
    }

    // ── 6. Credit, then release to available immediately ──────────────────────
    // Consistent with ad_reward / task / bonus, which all auto-release. This
    // system's fraud gate is at PAYOUT time, not reward time — there is no
    // transaction-approval endpoint, so a reward left in `pending` would be stuck
    // forever: never withdrawable, never unlocking the Watch-Ad button, never
    // firing earning-milestone tasks (all of which require status 'completed').
    try {
      const ledgerEntry = await this.walletService.credit({
        userId: user.id,
        amount: usd,
        type: 'adjoe_reward',
        referenceId: transId,
        metadata: {
          coin_amount: coins,
          coin_to_usd: coinToUsd,
          currency: query.currency ?? 'USD',
          placement: query.placement ?? null,
          adjoe_user_uuid: query.user_uuid ?? null,
        },
      });

      // Move pending → available now. If this throws, the catch below returns 5xx
      // and Adjoe redelivers; the dedup branch then finishes the release.
      await this.walletService.releasePending(ledgerEntry.id);

      this.logger.log(
        `Adjoe: credited $${usd} (${coins} coins) to user=${user.id} tx=${transId} — released to available`,
      );

      // Referral commissions (non-blocking)
      this.referralService
        .processCommissions(user.id, usd, ledgerEntry.id)
        .catch((err) => this.logger.error('Adjoe: referral commission failed', err));

      // Task evaluation: adjoe_earnings + earning_milestone (non-blocking)
      this.prisma.wallet
        .findUnique({ where: { userId: user.id }, select: { lifetimeEarnings: true } })
        .then(async (wallet) => {
          const totalAdjoe = await this.prisma.transaction.aggregate({
            where: { userId: user.id, type: 'adjoe_reward', status: 'completed' },
            _sum: { amount: true },
          });
          const adjoeTotal = totalAdjoe._sum.amount?.toNumber() ?? 0;
          const lifetimeTotal = wallet?.lifetimeEarnings.toNumber() ?? 0;
          await Promise.all([
            this.tasksService.evaluate(user.id, TaskTriggerType.adjoe_earnings, adjoeTotal),
            this.tasksService.evaluate(user.id, TaskTriggerType.earning_milestone, lifetimeTotal),
          ]);
        })
        .catch((err) => this.logger.error('Task evaluate (adjoe) failed', err));
    } catch (err) {
      // Transient failure — let Adjoe retry rather than drop the reward.
      this.logger.error(`Adjoe: credit failed tx=${transId} — asking Adjoe to retry`, err as Error);
      throw new ServiceUnavailableException('Could not record reward.');
    }

    return { ok: true };
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  /**
   * Verifies Adjoe's `sid` signature.
   *
   * Formula confirmed by reproducing 5/5 real Adjoe postback signatures from
   * production traffic:
   *   sid = sha1(trans_uuid + user_uuid + currency + coin_amount + s2s_token)
   * concatenated with no separator, lower-case hex. (Adjoe's documented order
   * also allows device_id + sdk_app_id before the token; this integration's
   * postback template omits them, so they contribute empty strings.)
   *
   * When ADJOE_VERIFY_SIGNATURE is off, the callback is still accepted but the
   * match result is logged, so a real callback can confirm the token in prod
   * before enforcement is switched on.
   */
  private verifyCallbackSignature(query: AdjoeCallbackQuery): boolean {
    const received = query.sid?.trim().toLowerCase();

    const expected = createHash('sha1')
      .update(
        `${query.trans_uuid ?? ''}${query.user_uuid ?? ''}` +
          `${query.currency ?? ''}${query.coin_amount ?? ''}${this.s2sSecret}`,
      )
      .digest('hex');

    const ok = !!received && received === expected;

    if (!this.verifySignature) {
      this.logger.warn(
        `Adjoe: signature enforcement OFF — tx=${query.trans_uuid} match=${ok} ` +
          `(received=${received} expected=${expected}). Set ADJOE_VERIFY_SIGNATURE=true to enforce.`,
      );
      return true;
    }

    if (!ok) {
      this.logger.warn(
        `Adjoe: sid mismatch tx=${query.trans_uuid} received=${received} expected=${expected}`,
      );
    }
    return ok;
  }
}
