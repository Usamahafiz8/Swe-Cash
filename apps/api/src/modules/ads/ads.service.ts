import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { FraudStatus, AccountStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { ReferralService } from '../referral/referral.service';

@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly referralService: ReferralService,
  ) {}

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

    // ── 5. Credit ─────────────────────────────────────────────────────────────
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

    this.logger.log(`Ad reward: $${adReward} credited to user=${userId}`);

    // Trigger referral commissions (non-blocking)
    this.referralService
      .processCommissions(userId, adReward, tx.id)
      .catch((err) => this.logger.error('Ad: referral commission failed', err));

    return {
      reward: adReward,
      transactionId: tx.id,
      message: `+$${adReward} added to your pending balance.`,
    };
  }
}
