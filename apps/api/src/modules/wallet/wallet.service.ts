import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { TransactionType, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrencyService } from '../currency/currency.service';
import { SettingsService } from '../settings/settings.service';
import { TransactionsQueryDto } from './dto/transactions-query.dto';
import { HistoryQueryDto, HistoryStatusFilter } from './dto/history-query.dto';

export interface CreditParams {
  userId: string;
  amount: number;
  type: TransactionType;
  referenceId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface DebitParams {
  userId: string;
  amount: number;
  type: TransactionType;
  referenceId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyService: CurrencyService,
    private readonly settings: SettingsService,
  ) {}

  // ─── Public Read ────────────────────────────────────────────────────────────

  async getWallet(userId: string) {
    const [wallet, user] = await Promise.all([
      this.prisma.wallet.findUnique({ where: { userId } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { preferredCurrency: true } }),
    ]);
    if (!wallet) throw new NotFoundException('Wallet not found.');

    const currency = user?.preferredCurrency ?? 'USD';
    const convert = (usd: number) => this.currencyService.convert(usd, currency);

    const available = wallet.availableBalance.toNumber();
    const pending   = wallet.pendingBalance.toNumber();
    const lifetime  = wallet.lifetimeEarnings.toNumber();
    const payouts   = wallet.lifetimePayouts.toNumber();

    const target = this.settings.minPayoutThreshold;
    const targetProgress = Math.min(Math.floor((available / target) * 100), 100);

    return {
      // Raw USD values always included
      availableBalanceUsd: available,
      pendingBalanceUsd:   pending,
      lifetimeEarningsUsd: lifetime,
      lifetimePayoutsUsd:  payouts,
      // Target reward progress toward minimum payout threshold
      targetRewardUsd:      target,
      targetRewardProgress: targetProgress,
      // Converted to user's preferred currency
      currency,
      symbol:              this.currencyService.getSymbol(currency),
      availableBalance:    convert(available).amount,
      pendingBalance:      convert(pending).amount,
      lifetimeEarnings:    convert(lifetime).amount,
      lifetimePayouts:     convert(payouts).amount,
    };
  }

  // ─── User-to-User Transfer ────────────────────────────────────────────────

  async transfer(senderId: string, recipientCode: string, amount: number) {
    if (amount <= 0) throw new BadRequestException('Transfer amount must be positive.');

    const [sender, recipient] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: senderId },
        include: { wallet: true },
      }),
      this.prisma.user.findUnique({
        where: { referralCode: recipientCode.toUpperCase() },
        select: { id: true, name: true, referralCode: true },
      }),
    ]);

    if (!sender) throw new NotFoundException('Sender not found.');
    if (!recipient) throw new NotFoundException('Recipient referral code not found.');
    if (sender.id === recipient.id) throw new BadRequestException('Cannot transfer to yourself.');

    const available = sender.wallet?.availableBalance.toNumber() ?? 0;
    if (amount > available) {
      throw new BadRequestException(`Insufficient balance. Available: $${available.toFixed(4)}.`);
    }

    const referenceId = `transfer-${Date.now()}`;

    await this.prisma.$transaction(async (tx) => {
      // Lock both wallets to prevent race conditions
      await tx.$queryRaw`
        SELECT id FROM wallets WHERE user_id IN (${senderId}, ${recipient.id}) FOR UPDATE
      `;

      // Debit sender
      await tx.transaction.create({
        data: {
          userId: senderId,
          amount,
          type: 'transfer_out',
          status: 'completed',
          referenceId,
          metadata: { recipient_id: recipient.id, recipient_code: recipientCode.toUpperCase() },
        },
      });
      await tx.wallet.update({
        where: { userId: senderId },
        data: { availableBalance: { decrement: amount } },
      });

      // Credit recipient instantly
      await tx.transaction.create({
        data: {
          userId: recipient.id,
          amount,
          type: 'transfer_in',
          status: 'completed',
          referenceId,
          metadata: { sender_id: senderId, sender_name: sender.name },
        },
      });
      await tx.wallet.update({
        where: { userId: recipient.id },
        data: {
          availableBalance: { increment: amount },
          lifetimeEarnings: { increment: amount },
        },
      });
    });

    this.logger.log(`Transfer: $${amount} from user=${senderId} to user=${recipient.id}`);

    return {
      amount,
      recipient: { name: recipient.name, referralCode: recipient.referralCode },
      message: `$${amount} transferred to ${recipient.name}.`,
    };
  }

  async getTransactions(userId: string, query: TransactionsQueryDto) {
    const { type, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = { userId, ...(type ? { type } : {}) };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  // ─── Unified Activity History ─────────────────────────────────────────────

  async getHistory(userId: string, query: HistoryQueryDto) {
    const { status = HistoryStatusFilter.all, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    // Map UI tab → DB status filters
    const txStatuses: TransactionStatus[] = status === 'all'
      ? [TransactionStatus.pending, TransactionStatus.completed, TransactionStatus.rejected]
      : status === 'pending'  ? [TransactionStatus.pending]
      : status === 'approved' ? [TransactionStatus.completed]
      : [TransactionStatus.rejected];

    const payoutStatuses = status === 'all'
      ? ['pending', 'approved', 'completed', 'rejected', 'frozen']
      : status === 'pending'  ? ['pending', 'frozen']
      : status === 'approved' ? ['approved', 'completed']
      : ['rejected'];

    // Exclude internal/noise transaction types from the history feed
    const excludedTypes: TransactionType[] = [
      TransactionType.payout_request,
      TransactionType.payout_completed,
      TransactionType.payout_rejected,
      TransactionType.ad_impression,
    ];

    const [txItems, txTotal, payoutItems, payoutTotal] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId, status: { in: txStatuses }, type: { notIn: excludedTypes } },
        orderBy: { createdAt: 'desc' },
        take: limit + skip,
      }),
      this.prisma.transaction.count({
        where: { userId, status: { in: txStatuses }, type: { notIn: excludedTypes } },
      }),
      this.prisma.payout.findMany({
        where: { userId, status: { in: payoutStatuses as any } },
        orderBy: { createdAt: 'desc' },
        take: limit + skip,
      }),
      this.prisma.payout.count({
        where: { userId, status: { in: payoutStatuses as any } },
      }),
    ]);

    // Normalise both into a unified shape
    const LABELS: Partial<Record<TransactionType, string>> = {
      adjoe_reward:    'ADJOE - GAME',
      ad_reward:       'Watch Ad & Earn',
      referral_reward: 'Referral Bonus',
      bonus:           'Bonus Reward',
      transfer_in:     'Transfer Received',
      transfer_out:    'Transfer Sent',
    };

    const normalised = [
      ...txItems.map((t) => ({
        id:          t.id,
        source:      'transaction' as const,
        type:        t.type,
        label:       LABELS[t.type] ?? t.type,
        amount:      t.amount.toNumber(),
        sign:        t.type === TransactionType.transfer_out ? '-' : '+',
        status:      t.status === 'completed' ? 'approved' : t.status,
        statusLabel: t.status === 'completed' ? 'Approved' : t.status.charAt(0).toUpperCase() + t.status.slice(1),
        date:        t.createdAt,
        metadata:    t.metadata,
      })),
      ...payoutItems.map((p) => ({
        id:          p.id,
        source:      'payout' as const,
        type:        'payout',
        label:       'PayPal Payout',
        amount:      p.amount.toNumber(),
        sign:        '-',
        status:      ['approved', 'completed'].includes(p.status) ? 'approved' : p.status,
        statusLabel: ['approved', 'completed'].includes(p.status) ? 'Approved'
                     : p.status === 'frozen' ? 'Pending'
                     : p.status.charAt(0).toUpperCase() + p.status.slice(1),
        date:        p.createdAt,
        metadata:    { paypalEmail: p.paypalEmail },
      })),
    ]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(skip, skip + limit);

    return {
      items: normalised,
      total: txTotal + payoutTotal,
      page,
      limit,
      pages: Math.ceil((txTotal + payoutTotal) / limit),
    };
  }

  // ─── Core Financial Operations ───────────────────────────────────────────────
  //
  // RULES (from spec):
  //  1. Wrap every balance change in a DB transaction
  //  2. Write the ledger entry FIRST — if ledger write fails, wallet is NOT touched
  //  3. Use SELECT FOR UPDATE to prevent race conditions
  //  4. available_balance must never go below 0
  //  5. No balance column updated without a corresponding transactions row

  /**
   * Credits a reward to pending_balance + lifetime_earnings.
   * All incoming rewards land in pending first — admin approval moves them to available.
   */
  async credit(params: CreditParams) {
    const { userId, amount, type, referenceId, metadata } = params;

    if (amount <= 0) throw new BadRequestException('Credit amount must be positive.');

    return this.prisma.$transaction(async (tx) => {
      // RULE 3: Lock the wallet row for this transaction
      const [wallet] = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM wallets WHERE user_id = ${userId} FOR UPDATE
      `;
      if (!wallet) throw new NotFoundException('Wallet not found.');

      // RULE 2: Write ledger entry first
      const ledgerEntry = await tx.transaction.create({
        data: {
          userId,
          amount,
          type,
          status: TransactionStatus.pending,
          referenceId: referenceId ?? null,
          metadata: (metadata ?? {}) as object,
        },
      });

      // RULE 1 + 5: Update wallet balances in same transaction
      await tx.wallet.update({
        where: { userId },
        data: {
          pendingBalance: { increment: amount },
          lifetimeEarnings: { increment: amount },
        },
      });

      this.logger.log(`Credit: user=${userId} amount=${amount} type=${type} tx=${ledgerEntry.id}`);
      return ledgerEntry;
    });
  }

  /**
   * Releases a pending amount to available_balance (triggered by admin approval).
   * Moves pending → available and marks the transaction as completed.
   */
  async releasePending(transactionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const ledgerEntry = await tx.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!ledgerEntry) throw new NotFoundException('Transaction not found.');
      if (ledgerEntry.status !== TransactionStatus.pending) {
        throw new BadRequestException('Transaction is not in pending status.');
      }

      const amount = ledgerEntry.amount.toNumber();

      // Lock wallet
      await tx.$queryRaw`
        SELECT id FROM wallets WHERE user_id = ${ledgerEntry.userId} FOR UPDATE
      `;

      // Write status change first (RULE 2 equivalent for status transitions)
      await tx.transaction.update({
        where: { id: transactionId },
        data: { status: TransactionStatus.completed },
      });

      // Move pending → available
      await tx.wallet.update({
        where: { userId: ledgerEntry.userId },
        data: {
          pendingBalance: { decrement: amount },
          availableBalance: { increment: amount },
        },
      });

      this.logger.log(`ReleasePending: tx=${transactionId} amount=${amount}`);
      return ledgerEntry;
    });
  }

  /**
   * Debits available_balance for a payout request.
   * Reserves the funds immediately to prevent double-spend.
   * Returns the payout_request ledger entry.
   */
  async debit(params: DebitParams) {
    const { userId, amount, type, referenceId, metadata } = params;

    if (amount <= 0) throw new BadRequestException('Debit amount must be positive.');

    return this.prisma.$transaction(async (tx) => {
      // Lock wallet
      const [walletRaw] = await tx.$queryRaw<{ available_balance: number }[]>`
        SELECT available_balance FROM wallets WHERE user_id = ${userId} FOR UPDATE
      `;
      if (!walletRaw) throw new NotFoundException('Wallet not found.');

      // RULE 4: Guard against going below zero
      if (walletRaw.available_balance < amount) {
        throw new BadRequestException('Insufficient available balance.');
      }

      // RULE 2: Ledger entry first
      const ledgerEntry = await tx.transaction.create({
        data: {
          userId,
          amount,
          type,
          status: TransactionStatus.pending,
          referenceId: referenceId ?? null,
          metadata: (metadata ?? {}) as object,
        },
      });

      // RULE 5: Deduct from available
      await tx.wallet.update({
        where: { userId },
        data: { availableBalance: { decrement: amount } },
      });

      this.logger.log(`Debit: user=${userId} amount=${amount} type=${type} tx=${ledgerEntry.id}`);
      return ledgerEntry;
    });
  }

  /**
   * Restores a previously debited amount back to available_balance.
   * Used when a payout is rejected or PayPal call fails.
   */
  async restoreDebit(transactionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const ledgerEntry = await tx.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!ledgerEntry) throw new NotFoundException('Transaction not found.');
      if (ledgerEntry.status !== TransactionStatus.pending) {
        throw new BadRequestException('Cannot restore a non-pending transaction.');
      }

      const amount = ledgerEntry.amount.toNumber();

      // Lock wallet
      await tx.$queryRaw`
        SELECT id FROM wallets WHERE user_id = ${ledgerEntry.userId} FOR UPDATE
      `;

      await tx.transaction.update({
        where: { id: transactionId },
        data: { status: TransactionStatus.rejected },
      });

      await tx.wallet.update({
        where: { userId: ledgerEntry.userId },
        data: { availableBalance: { increment: amount } },
      });

      this.logger.log(`RestoreDebit: tx=${transactionId} amount=${amount} restored`);
      return ledgerEntry;
    });
  }

  /**
   * Finalises a completed payout: marks transaction completed + increments lifetime_payouts.
   */
  async completeDebit(transactionId: string, paypalPayoutId: string) {
    return this.prisma.$transaction(async (tx) => {
      const ledgerEntry = await tx.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!ledgerEntry) throw new NotFoundException('Transaction not found.');

      const amount = ledgerEntry.amount.toNumber();

      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.completed,
          referenceId: paypalPayoutId,
        },
      });

      await tx.wallet.update({
        where: { userId: ledgerEntry.userId },
        data: { lifetimePayouts: { increment: amount } },
      });

      this.logger.log(`CompleteDebit: tx=${transactionId} paypal=${paypalPayoutId}`);
      return ledgerEntry;
    });
  }
}
