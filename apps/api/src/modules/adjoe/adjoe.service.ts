import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FraudStatus, TaskTriggerType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { ReferralService } from '../referral/referral.service';
import { TasksService } from '../tasks/tasks.service';
import { AdjoeCallbackDto } from './dto/adjoe-callback.dto';

@Injectable()
export class AdjoeService {
  private readonly logger = new Logger(AdjoeService.name);
  private readonly s2sToken: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly referralService: ReferralService,
    private readonly tasksService: TasksService,
    private readonly config: ConfigService,
  ) {
    this.s2sToken = config.get<string>('ADJOE_S2S_TOKEN', '');
  }

  /**
   * Handles Adjoe S2S postback.
   * Always returns { ok: true } — even on validation failures —
   * so Adjoe does not trigger its retry mechanism.
   */
  async handleCallback(dto: AdjoeCallbackDto): Promise<{ ok: true }> {
    // ── 1. Validate S2S token ────────────────────────────────────────────────
    if (!this.validateToken(dto.token)) {
      this.logger.warn(`Adjoe: invalid token on tx=${dto.transaction_id}`);
      return { ok: true };
    }

    // ── 2. Deduplicate ───────────────────────────────────────────────────────
    const existing = await this.prisma.transaction.findFirst({
      where: { referenceId: dto.transaction_id },
    });
    if (existing) {
      this.logger.log(`Adjoe: duplicate tx=${dto.transaction_id} — skipped`);
      return { ok: true };
    }

    // ── 3. Resolve user ──────────────────────────────────────────────────────
    const user = await this.prisma.user.findUnique({
      where: { id: dto.publisher_sub_id },
    });
    if (!user) {
      this.logger.warn(`Adjoe: unknown user=${dto.publisher_sub_id} tx=${dto.transaction_id}`);
      return { ok: true };
    }

    // ── 4. Fraud gate ────────────────────────────────────────────────────────
    if (user.fraudStatus === FraudStatus.blocked) {
      this.logger.warn(`Adjoe: blocked user=${user.id} tx=${dto.transaction_id}`);
      return { ok: true };
    }

    // ── 5. Credit reward ─────────────────────────────────────────────────────
    try {
      const ledgerEntry = await this.walletService.credit({
        userId: user.id,
        amount: dto.reward,
        type: 'adjoe_reward',
        referenceId: dto.transaction_id,
        metadata: {
          app_id: dto.app_id ?? null,
          gaid: dto.gaid ?? null,
          currency: dto.currency ?? 'USD',
        },
      });

      this.logger.log(`Adjoe: credited $${dto.reward} to user=${user.id} tx=${dto.transaction_id}`);

      // Trigger referral commissions (non-blocking)
      this.referralService
        .processCommissions(user.id, dto.reward, ledgerEntry.id)
        .catch((err) => this.logger.error('Adjoe: referral commission failed', err));

      // Task evaluation: adjoe_earnings and earning_milestone (non-blocking)
      this.prisma.wallet.findUnique({ where: { userId: user.id }, select: { lifetimeEarnings: true } })
        .then(async (wallet) => {
          const totalAdjoeEarnings = await this.prisma.transaction.aggregate({
            where: { userId: user.id, type: 'adjoe_reward', status: 'completed' },
            _sum: { amount: true },
          });
          const adjoeTotal = totalAdjoeEarnings._sum.amount?.toNumber() ?? 0;
          const lifetimeTotal = wallet?.lifetimeEarnings.toNumber() ?? 0;
          await Promise.all([
            this.tasksService.evaluate(user.id, TaskTriggerType.adjoe_earnings, adjoeTotal),
            this.tasksService.evaluate(user.id, TaskTriggerType.earning_milestone, lifetimeTotal),
          ]);
        })
        .catch((err) => this.logger.error('Task evaluate (adjoe) failed', err));
    } catch (err) {
      // Log for manual recovery — do NOT rethrow (Adjoe must receive 200)
      this.logger.error(`Adjoe: credit failed tx=${dto.transaction_id}`, err);
    }

    return { ok: true };
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private validateToken(incomingToken: string): boolean {
    if (!this.s2sToken) {
      this.logger.warn('ADJOE_S2S_TOKEN not configured — skipping validation');
      return true; // allow during dev when token not yet set
    }
    return incomingToken === this.s2sToken;
  }
}
