import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { FraudStatus, AccountStatus, TaskTriggerType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { ReferralService } from '../referral/referral.service';
import { TasksService } from '../tasks/tasks.service';

@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly referralService: ReferralService,
    private readonly tasksService: TasksService,
  ) {}

  async checkAdEligibility(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.accountStatus !== AccountStatus.active) {
      return { eligible: false, reason: 'Account is not active.' };
    }
    if (user.fraudStatus === FraudStatus.blocked) {
      return { eligible: false, reason: 'Account is fraud-blocked.' };
    }

    const lastAdjoeReward = await this.prisma.transaction.findFirst({
      where: { userId, type: 'adjoe_reward', status: 'completed' },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastAdjoeReward) {
      return { eligible: false, reason: 'No gameplay reward found yet. Play a game first.' };
    }

    const alreadyClaimed = await this.prisma.transaction.findFirst({
      where: {
        userId,
        type: 'ad_reward',
        metadata: { path: ['adjoe_tx_id'], equals: lastAdjoeReward.id },
      },
    });

    if (alreadyClaimed) {
      return {
        eligible: false,
        reason: 'Ad reward already claimed for your last game reward. Play more to unlock again.',
      };
    }

    const potentialReward = parseFloat((lastAdjoeReward.amount.toNumber() * 0.1).toFixed(4));

    // Record that the user opened the ad screen (non-blocking)
    // Saved as ad_impression so we can track: opens vs claims, daily frequency, fraud
    this.prisma.transaction.create({
      data: {
        userId,
        amount: 0,
        type: 'ad_impression',
        status: 'completed',
        referenceId: lastAdjoeReward.id,
        metadata: {
          adjoe_tx_id: lastAdjoeReward.id,
          potential_reward: potentialReward,
        },
      },
    }).catch((err) => this.logger.error('Ad impression record failed', err));

    return {
      eligible: true,
      instant: true,
      potentialReward,
      basedOnAdjoeAmount: lastAdjoeReward.amount.toNumber(),
      label: 'DAILY REWARD',
      description: 'Watch Ad & Earn',
    };
  }

  async claimAdReward(userId: string) {
    // ── 1. Load user ──────────────────────────────────────────────────────────
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.accountStatus !== AccountStatus.active) {
      throw new ForbiddenException('Account is not active.');
    }
    if (user.fraudStatus === FraudStatus.blocked) {
      throw new ForbiddenException('Account is fraud-blocked.');
    }

    // ── 2. Find last Adjoe reward (ad button only valid after an Adjoe earn) ──
    const lastAdjoeReward = await this.prisma.transaction.findFirst({
      where: { userId, type: 'adjoe_reward', status: 'completed' },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastAdjoeReward) {
      throw new BadRequestException(
        'No Adjoe reward found. Watch an ad only after earning from gameplay.',
      );
    }

    // ── 3. Prevent watching an ad twice for the same Adjoe reward ─────────────
    const alreadyClaimed = await this.prisma.transaction.findFirst({
      where: {
        userId,
        type: 'ad_reward',
        metadata: {
          path: ['adjoe_tx_id'],
          equals: lastAdjoeReward.id,
        },
      },
    });

    if (alreadyClaimed) {
      throw new BadRequestException(
        'Ad reward already claimed for your last Adjoe earning. Play more to unlock again.',
      );
    }

    // ── 4. Calculate reward: +10% of last Adjoe reward ────────────────────────
    const adReward = parseFloat(
      (lastAdjoeReward.amount.toNumber() * 0.1).toFixed(4),
    );

    // ── 5. Credit then immediately release to available (INSTANT) ────────────
    const tx = await this.walletService.credit({
      userId,
      amount: adReward,
      type: 'ad_reward',
      metadata: {
        adjoe_tx_id: lastAdjoeReward.id,
        base_adjoe_amount: lastAdjoeReward.amount.toNumber(),
        bonus_percentage: '10',
      },
    });

    await this.walletService.releasePending(tx.id);

    this.logger.log(`Ad reward: $${adReward} instantly credited to user=${userId}`);

    // Trigger referral commissions (non-blocking)
    this.referralService
      .processCommissions(userId, adReward, tx.id)
      .catch((err) => this.logger.error('Ad: referral commission failed', err));

    // Task evaluation: count total ad_reward transactions (non-blocking)
    this.prisma.transaction.count({ where: { userId, type: 'ad_reward', status: 'completed' } })
      .then((count) => this.tasksService.evaluate(userId, TaskTriggerType.ad_views, count + 1))
      .catch((err) => this.logger.error('Task evaluate (ad_views) failed', err));

    return {
      reward: adReward,
      instant: true,
      transactionId: tx.id,
      message: `+$${adReward} instantly added to your balance.`,
    };
  }
}
