import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { FraudStatus, AccountStatus, PayoutStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { SettingsService } from '../settings/settings.service';
import { FraudService } from '../fraud/fraud.service';
import { ReferralService } from '../referral/referral.service';
import { RequestPayoutDto } from './dto/request-payout.dto';

export const PAYOUT_QUEUE = 'payout-queue';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly settings: SettingsService,
    private readonly fraudService: FraudService,
    private readonly referralService: ReferralService,
    @InjectQueue(PAYOUT_QUEUE) private readonly payoutQueue: Queue,
  ) {}

  // ─── User: Request Payout ────────────────────────────────────────────────

  async requestPayout(userId: string, dto: RequestPayoutDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { wallet: true },
    });

    if (user.accountStatus !== AccountStatus.active) {
      throw new ForbiddenException('Account is not active.');
    }
    if (user.fraudStatus === FraudStatus.blocked) {
      throw new ForbiddenException('Account is fraud-blocked. Payouts are frozen.');
    }
    if (user.fraudStatus === FraudStatus.suspicious) {
      throw new ForbiddenException('Account has a pending fraud review. Payouts are held.');
    }

    const isHammering = await this.fraudService.checkPayoutHammering(userId);
    if (isHammering) {
      throw new ForbiddenException('Too many payout requests. Account temporarily frozen.');
    }

    const minThreshold = this.settings.minPayoutThreshold;
    if (dto.amount < minThreshold) {
      throw new BadRequestException(`Minimum payout is $${minThreshold}.`);
    }

    const available = user.wallet!.availableBalance.toNumber();
    if (dto.amount > available) {
      throw new BadRequestException(`Insufficient balance. Available: $${available.toFixed(4)}.`);
    }

    const activePayout = await this.prisma.payout.findFirst({
      where: { userId, status: { in: [PayoutStatus.pending, PayoutStatus.approved] } },
    });
    if (activePayout) {
      throw new BadRequestException('You already have a payout in progress.');
    }

    // Create payout record first so we have its ID
    const payout = await this.prisma.payout.create({
      data: { userId, amount: dto.amount, paypalEmail: dto.paypalEmail, status: PayoutStatus.pending },
    });

    // Debit wallet — use payout.id as referenceId so we can find the ledger entry later
    await this.walletService.debit({
      userId,
      amount: dto.amount,
      type: 'payout_request',
      referenceId: payout.id,
    });

    this.logger.log(`Payout requested: user=${userId} amount=${dto.amount} payout=${payout.id}`);

    const autoEnabled = this.settings.payoutAutoApproveEnabled;
    const autoLimit = this.settings.payoutAutoApproveLimit;

    if (autoEnabled && dto.amount <= autoLimit) {
      await this.approvePayout(payout.id, 'auto');
    }

    return {
      payoutId: payout.id,
      amount: dto.amount,
      status: autoEnabled && dto.amount <= autoLimit ? PayoutStatus.approved : PayoutStatus.pending,
      message:
        autoEnabled && dto.amount <= autoLimit
          ? 'Payout approved and queued for processing.'
          : 'Payout submitted. Pending admin approval.',
    };
  }

  // ─── Admin: Approve ───────────────────────────────────────────────────────

  async approvePayout(payoutId: string, approvedBy: string) {
    const payout = await this.prisma.payout.findUniqueOrThrow({ where: { id: payoutId } });

    if (payout.status !== PayoutStatus.pending) {
      throw new BadRequestException(`Payout is already ${payout.status}.`);
    }

    await this.prisma.payout.update({
      where: { id: payoutId },
      data: { status: PayoutStatus.approved },
    });

    await this.payoutQueue.add(
      'process-payout',
      { payoutId: payout.id, userId: payout.userId, amount: payout.amount.toNumber(), paypalEmail: payout.paypalEmail },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: false },
    );

    this.logger.log(`Payout approved: payout=${payoutId} by=${approvedBy}`);
    return payout;
  }

  // ─── Admin: Reject ────────────────────────────────────────────────────────

  async rejectPayout(payoutId: string, adminNote: string) {
    const payout = await this.prisma.payout.findUniqueOrThrow({ where: { id: payoutId } });

    if (!([PayoutStatus.pending, PayoutStatus.frozen] as PayoutStatus[]).includes(payout.status)) {
      throw new BadRequestException(`Cannot reject a payout with status ${payout.status}.`);
    }

    const ledger = await this.findLedgerEntry(payoutId);

    await this.prisma.payout.update({
      where: { id: payoutId },
      data: { status: PayoutStatus.rejected, adminNote },
    });

    await this.walletService.restoreDebit(ledger.id);

    this.logger.log(`Payout rejected: payout=${payoutId} reason="${adminNote}"`);
    return payout;
  }

  // ─── Admin: Freeze ────────────────────────────────────────────────────────

  async freezePayout(payoutId: string, adminNote: string) {
    return this.prisma.payout.update({
      where: { id: payoutId },
      data: { status: PayoutStatus.frozen, adminNote },
    });
  }

  // ─── Queue Processor: Complete ────────────────────────────────────────────

  async completePayout(payoutId: string, paypalBatchId: string) {
    const payout = await this.prisma.payout.findUniqueOrThrow({ where: { id: payoutId } });
    const ledger = await this.findLedgerEntry(payoutId);

    await this.prisma.payout.update({
      where: { id: payoutId },
      data: { status: PayoutStatus.completed, paypalPayoutId: paypalBatchId, processedAt: new Date() },
    });

    await this.walletService.completeDebit(ledger.id, paypalBatchId);

    // Referral activation gate — fires only on first ever completed payout
    const completedCount = await this.prisma.payout.count({
      where: { userId: payout.userId, status: PayoutStatus.completed },
    });
    if (completedCount === 1) {
      await this.referralService.activateForUser(payout.userId);
      this.logger.log(`Referral chain activated: user=${payout.userId}`);
    }

    this.logger.log(`Payout completed: payout=${payoutId} paypal=${paypalBatchId}`);
  }

  // ─── Queue Processor: Fail ────────────────────────────────────────────────

  async failPayout(payoutId: string, reason: string) {
    const ledger = await this.findLedgerEntry(payoutId);

    await this.prisma.payout.update({
      where: { id: payoutId },
      data: { status: PayoutStatus.rejected, adminNote: reason },
    });

    await this.walletService.restoreDebit(ledger.id);
    this.logger.error(`Payout failed: payout=${payoutId} — balance restored. Reason: ${reason}`);
  }

  // ─── User: History ────────────────────────────────────────────────────────

  async getHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { userId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payout.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.payout.count({ where }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ─── Admin: List Payouts ──────────────────────────────────────────────────

  async adminListPayouts(filters: {
    status?: PayoutStatus;
    minAmount?: number;
    maxAmount?: number;
    page?: number;
    limit?: number;
  }) {
    const { status, minAmount, maxAmount, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where = {
      ...(status ? { status } : {}),
      ...(minAmount !== undefined || maxAmount !== undefined
        ? { amount: { ...(minAmount ? { gte: minAmount } : {}), ...(maxAmount ? { lte: maxAmount } : {}) } }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payout.findMany({ where, include: { user: { select: { name: true, email: true, country: true } } }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.payout.count({ where }),
    ]);
    const statusMap: Record<string, string> = { approved: 'processing', rejected: 'failed' };
    const data = items.map((p) => ({
      id: p.id,
      userId: p.userId,
      userEmail: p.user?.email ?? '',
      amount: p.amount.toNumber(),
      paypalEmail: p.paypalEmail,
      status: statusMap[p.status] ?? p.status,
      adminNote: p.adminNote ?? undefined,
      createdAt: p.createdAt,
    }));
    return { data, total, page, limit };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async findLedgerEntry(payoutId: string) {
    const entry = await this.prisma.transaction.findFirst({
      where: { referenceId: payoutId, type: 'payout_request' },
    });
    if (!entry) throw new NotFoundException(`Ledger entry not found for payout=${payoutId}`);
    return entry;
  }
}
