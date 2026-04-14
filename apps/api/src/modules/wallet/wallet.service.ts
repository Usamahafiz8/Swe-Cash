import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { TransactionType, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrencyService } from '../currency/currency.service';
import { TransactionsQueryDto } from './dto/transactions-query.dto';

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

    return {
      // Raw USD values always included
      availableBalanceUsd: available,
      pendingBalanceUsd:   pending,
      lifetimeEarningsUsd: lifetime,
      lifetimePayoutsUsd:  payouts,
      // Converted to user's preferred currency
      currency,
      symbol:              this.currencyService.getSymbol(currency),
      availableBalance:    convert(available).amount,
      pendingBalance:      convert(pending).amount,
      lifetimeEarnings:    convert(lifetime).amount,
      lifetimePayouts:     convert(payouts).amount,
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
