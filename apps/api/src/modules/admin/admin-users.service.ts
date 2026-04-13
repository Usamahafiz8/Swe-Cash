import { Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { AdminListQueryDto, AdjustBalanceDto, UpdateUserStatusDto } from './dto/admin-actions.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  async listUsers(query: AdminListQueryDto) {
    const { page = 1, limit = 20, search, country, status } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }] }
        : {}),
      ...(country ? { country } : {}),
      ...(status ? { accountStatus: status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true, name: true, email: true, country: true,
          accountStatus: true, fraudStatus: true,
          createdAt: true, lastLoginAt: true,
          wallet: { select: { availableBalance: true, lifetimeEarnings: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    const data = items.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      country: u.country,
      status: u.accountStatus as string,
      walletBalance: u.wallet?.availableBalance ?? 0,
      lifetimeEarnings: u.wallet?.lifetimeEarnings ?? 0,
      createdAt: u.createdAt,
    }));

    return { data, total, page, limit };
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallet: true,
        devices: { orderBy: { createdAt: 'desc' }, take: 10 },
        fraudLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
        payouts: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!user) throw new NotFoundException('User not found.');

    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return { ...user, transactions };
  }

  async updateStatus(userId: string, dto: UpdateUserStatusDto, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    await this.prisma.user.update({
      where: { id: userId },
      data: { accountStatus: dto.status },
    });

    // Log the admin action in fraud_logs for audit trail
    await this.prisma.fraudLog.create({
      data: {
        userId,
        eventType: 'admin_status_change',
        detectedValue: dto.status,
        actionTaken: `status_set_to_${dto.status}`,
        reviewedByAdmin: true,
        adminVerdict: `${dto.reason} (by admin ${adminId})`,
      },
    });

    return { message: `User status updated to ${dto.status}.` };
  }

  async adjustBalance(userId: string, dto: AdjustBalanceDto, adminId: string) {
    const absAmount = Math.abs(dto.amount);
    const isCredit = dto.amount > 0;

    if (isCredit) {
      await this.walletService.credit({
        userId,
        amount: absAmount,
        type: 'bonus',
        metadata: { admin_id: adminId, reason: dto.reason },
      });
      // Auto-release bonus to available immediately
      const ledger = await this.prisma.transaction.findFirst({
        where: { userId, type: 'bonus' },
        orderBy: { createdAt: 'desc' },
      });
      if (ledger) await this.walletService.releasePending(ledger.id);
    } else {
      await this.walletService.debit({
        userId,
        amount: absAmount,
        type: 'bonus',
        metadata: { admin_id: adminId, reason: dto.reason },
      });
    }

    return { message: `Balance adjusted by ${dto.amount > 0 ? '+' : ''}${dto.amount}.` };
  }
}
