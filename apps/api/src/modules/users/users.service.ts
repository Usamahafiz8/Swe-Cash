import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });
    if (!user) throw new NotFoundException('User not found.');

    // Block deletion if user has unclaimed balance — they should withdraw first
    const available = user.wallet?.availableBalance.toNumber() ?? 0;
    if (available > 0) {
      throw new BadRequestException(
        `You have $${available.toFixed(2)} in your balance. Please withdraw before deleting your account.`,
      );
    }

    // Block deletion if a payout is in-flight
    const pendingPayout = await this.prisma.payout.findFirst({
      where: { userId, status: { in: ['pending', 'approved'] } },
    });
    if (pendingPayout) {
      throw new BadRequestException(
        'You have a payout in progress. Please wait for it to complete before deleting your account.',
      );
    }

    // Anonymise all PII — keep wallet + transactions for financial audit trail
    const ts = Date.now();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: 'Deleted User',
        email: `deleted_${ts}_${userId.slice(0, 8)}@deleted.invalid`,
        googleId: `deleted_${ts}_${userId.slice(0, 8)}`,
        profileImageUrl: null,
        deviceId: null,
        gaid: null,
        fcmToken: null,
        accountStatus: 'banned',
        referralCode: `DEL-${userId.slice(0, 8)}`,
      },
    });

    return { message: 'Account deleted successfully. Financial records are retained as required by law.' };
  }
}
