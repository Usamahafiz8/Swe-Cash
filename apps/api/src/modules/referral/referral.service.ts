import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { SettingsService } from '../settings/settings.service';
import { TasksService } from '../tasks/tasks.service';
import { TaskTriggerType } from '@prisma/client';
import { ApplyCodeDto } from './dto/apply-code.dto';

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly settings: SettingsService,
    private readonly tasksService: TasksService,
  ) {}

  // ─── Apply Referral Code ──────────────────────────────────────────────────

  async applyCode(userId: string, dto: ApplyCodeDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.referredByUserId) {
      throw new BadRequestException('You have already applied a referral code.');
    }

    if (user.referralCode === dto.code.toUpperCase()) {
      throw new BadRequestException('You cannot use your own referral code.');
    }

    // Find the referrer
    const referrer = await this.prisma.user.findUnique({
      where: { referralCode: dto.code.toUpperCase() },
    });
    if (!referrer) {
      throw new NotFoundException('Referral code not found.');
    }

    // Link the referral and build the 3-level chain
    await this.prisma.$transaction(async (tx) => {
      // Set referred_by on the new user
      await tx.user.update({
        where: { id: userId },
        data: { referredByUserId: referrer.id },
      });

      // Build chain: Level 1 = referrer, Level 2 = referrer's referrer, Level 3 = their referrer
      const chain = await this.buildChain(referrer.id);

      for (const { referrerId, level } of chain) {
        await tx.referral.upsert({
          where: {
            referrerUserId_referredUserId_level: {
              referrerUserId: referrerId,
              referredUserId: userId,
              level,
            },
          },
          update: {},
          create: {
            referrerUserId: referrerId,
            referredUserId: userId,
            level,
            isActive: false, // activates after referred user's first payout approval
          },
        });
      }
    });

    this.logger.log(`Referral applied: user=${userId} referred_by=${referrer.id}`);

    // Task evaluation: referral_count — count how many users referrer has referred (non-blocking)
    this.prisma.referral.count({ where: { referrerUserId: referrer.id, level: 1 } })
      .then((count) => this.tasksService.evaluate(referrer.id, TaskTriggerType.referral_count, count))
      .catch((err) => this.logger.error('Task evaluate (referral_count) failed', err));

    return { message: 'Referral code applied successfully.' };
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  async getStats(userId: string) {
    const [directReferrals, commissions] = await Promise.all([
      this.prisma.referral.count({
        where: { referrerUserId: userId, level: 1 },
      }),
      this.prisma.referral.findMany({
        where: { referrerUserId: userId },
        select: { level: true, totalCommissionEarned: true, isActive: true },
      }),
    ]);

    const totalCommission = commissions.reduce(
      (sum, r) => sum + r.totalCommissionEarned.toNumber(),
      0,
    );

    return {
      directReferrals,
      totalCommissionEarned: totalCommission,
      activeReferrals: commissions.filter((r) => r.isActive).length,
      byLevel: [1, 2, 3].map((level) => ({
        level,
        count: commissions.filter((r) => r.level === level).length,
        earned: commissions
          .filter((r) => r.level === level)
          .reduce((s, r) => s + r.totalCommissionEarned.toNumber(), 0),
      })),
    };
  }

  // ─── Activate Chain (called by PayoutsService on first payout approval) ───

  async activateForUser(referredUserId: string) {
    const updated = await this.prisma.referral.updateMany({
      where: { referredUserId, isActive: false },
      data: { isActive: true },
    });
    this.logger.log(
      `Referral chain activated for user=${referredUserId} (${updated.count} records)`,
    );
  }

  // ─── Commission Processing (called after every reward credit) ────────────

  async processCommissions(referredUserId: string, rewardAmount: number, sourceTxId: string) {
    // Only process if there are active referrals for this user
    const activeReferrals = await this.prisma.referral.findMany({
      where: { referredUserId, isActive: true },
    });

    if (activeReferrals.length === 0) return;

    const rates = [
      this.settings.referralCommissionL1,
      this.settings.referralCommissionL2,
      this.settings.referralCommissionL3,
    ];

    for (const referral of activeReferrals) {
      const rate = rates[referral.level - 1];
      if (!rate) continue;

      const commission = parseFloat((rewardAmount * rate).toFixed(4));
      if (commission <= 0) continue;

      try {
        await this.walletService.credit({
          userId: referral.referrerUserId,
          amount: commission,
          type: 'referral_reward',
          referenceId: sourceTxId,
          metadata: {
            referred_user_id: referredUserId,
            level: referral.level,
            base_amount: rewardAmount,
            rate,
          },
        });

        // Update running total on referral record
        await this.prisma.referral.update({
          where: { id: referral.id },
          data: { totalCommissionEarned: { increment: commission } },
        });

        this.logger.log(
          `Commission: $${commission} to user=${referral.referrerUserId} level=${referral.level} from user=${referredUserId}`,
        );
      } catch (err) {
        this.logger.error(
          `Commission failed for referral=${referral.id}`,
          err,
        );
      }
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async buildChain(
    startUserId: string,
  ): Promise<Array<{ referrerId: string; level: number }>> {
    const chain: Array<{ referrerId: string; level: number }> = [];
    let currentId: string | null = startUserId;
    let level = 1;

    while (currentId && level <= 3) {
      chain.push({ referrerId: currentId, level });
      const parentRecord: { referredByUserId: string | null } | null =
        await this.prisma.user.findUnique({
          where: { id: currentId },
          select: { referredByUserId: true },
        });
      currentId = parentRecord?.referredByUserId ?? null;
      level++;
    }

    return chain;
  }
}
