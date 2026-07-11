import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import {
  AccountStatus,
  PayoutStatus,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      include: { wallet: true },
    });
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto = {}) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });
    if (!user) throw new NotFoundException('User not found.');

    const available = user.wallet?.availableBalance.toNumber() ?? 0;
    const pending = user.wallet?.pendingBalance.toNumber() ?? 0;

    // Deletion is never refused outright — App Store 5.1.1(v) requires it to always be
    // completable. The only pause is when the user could genuinely have cashed out, and
    // then only to make the trade-off explicit; retrying with the flag always succeeds.
    // Anything under the payout minimum is unwithdrawable dust (e.g. the $0.03 signup
    // bonus) and is written off without asking, since there is no way for them to claim it.
    if (available >= this.settings.minPayoutThreshold && !dto.forfeitBalance) {
      throw new BadRequestException(
        `You have $${available.toFixed(2)} available to withdraw. Request a payout first, or ` +
          `retry with forfeitBalance=true to delete your account and give up that balance.`,
      );
    }

    // Money already debited for an in-flight payout is excluded from `available`, so it is
    // not forfeited here. That payout carries its own PayPal address and settles normally
    // against the anonymised record.
    const inFlight = await this.prisma.payout.findFirst({
      where: { userId, status: { in: [PayoutStatus.pending, PayoutStatus.approved] } },
    });

    const forfeited = available + pending;
    const suffix = `${Date.now()}_${randomBytes(4).toString('hex')}`;

    await this.prisma.$transaction(async (tx) => {
      if (forfeited > 0) {
        await tx.$queryRaw`SELECT id FROM wallets WHERE user_id = ${userId} FOR UPDATE`;

        // Ledger entry before the balance change, matching WalletService's ordering.
        await tx.transaction.create({
          data: {
            userId,
            amount: forfeited,
            type: TransactionType.account_closure_forfeit,
            status: TransactionStatus.completed,
            metadata: {
              source: 'account_deletion',
              availableForfeited: available,
              pendingForfeited: pending,
            },
          },
        });

        await tx.wallet.update({
          where: { userId },
          data: { availableBalance: 0, pendingBalance: 0 },
        });
      }

      // Anonymise PII. Wallet, transactions and payouts survive for the financial audit trail.
      // The suffix is random rather than a slice of the user id, so the unique constraints on
      // email / googleId / referralCode cannot collide.
      await tx.user.update({
        where: { id: userId },
        data: {
          name: 'Deleted User',
          email: `deleted_${suffix}@deleted.invalid`,
          googleId: `deleted_${suffix}`,
          profileImageUrl: null,
          country: null,
          deviceId: null,
          gaid: null,
          fcmToken: null,
          accountStatus: AccountStatus.banned,
          referralCode: `DEL-${suffix}`,
        },
      });
    });

    this.logger.log(
      `Account deleted: user=${userId} forfeited=$${forfeited.toFixed(4)}` +
        (inFlight ? ` (payout ${inFlight.id} still settling)` : ''),
    );

    return {
      message: 'Account deleted successfully. Financial records are retained as required by law.',
      forfeitedBalance: forfeited,
    };
  }
}
