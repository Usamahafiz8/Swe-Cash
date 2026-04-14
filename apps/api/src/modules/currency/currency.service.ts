import {
  Injectable,
  OnModuleInit,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCurrencyDto, UpdateCurrencyDto } from './dto/currency.dto';

const DEFAULT_CURRENCIES = [
  { code: 'USD', name: 'US Dollar',    symbol: '$',  rateToUsd: 1.0 },
  { code: 'EUR', name: 'Euro',         symbol: '€',  rateToUsd: 0.92 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', rateToUsd: 10.45 },
];

@Injectable()
export class CurrencyService implements OnModuleInit {
  private readonly logger = new Logger(CurrencyService.name);
  // In-memory cache: code → { symbol, rateToUsd }
  private cache = new Map<string, { symbol: string; rateToUsd: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seed();
    await this.reloadCache();
  }

  // ─── Cache ────────────────────────────────────────────────────────────────

  async reloadCache() {
    const currencies = await this.prisma.currency.findMany({ where: { isEnabled: true } });
    this.cache.clear();
    for (const c of currencies) {
      this.cache.set(c.code, { symbol: c.symbol, rateToUsd: c.rateToUsd.toNumber() });
    }
    this.logger.log(`Currency cache loaded (${currencies.length} enabled)`);
  }

  /**
   * Convert a USD amount to the target currency.
   * Returns the original USD amount if the currency is unknown.
   */
  convert(amountUsd: number, targetCode: string): { amount: number; symbol: string; code: string } {
    const entry = this.cache.get(targetCode);
    if (!entry || targetCode === 'USD') {
      return { amount: amountUsd, symbol: '$', code: 'USD' };
    }
    return {
      amount: parseFloat((amountUsd * entry.rateToUsd).toFixed(4)),
      symbol: entry.symbol,
      code: targetCode,
    };
  }

  getSymbol(code: string): string {
    return this.cache.get(code)?.symbol ?? '$';
  }

  // ─── Admin CRUD ───────────────────────────────────────────────────────────

  async listAll() {
    return this.prisma.currency.findMany({ orderBy: { code: 'asc' } });
  }

  async create(dto: CreateCurrencyDto) {
    const existing = await this.prisma.currency.findUnique({ where: { code: dto.code.toUpperCase() } });
    if (existing) throw new ConflictException(`Currency ${dto.code} already exists.`);

    const currency = await this.prisma.currency.create({
      data: {
        code: dto.code.toUpperCase(),
        name: dto.name,
        symbol: dto.symbol,
        rateToUsd: dto.rateToUsd,
      },
    });

    await this.reloadCache();
    this.logger.log(`Currency created: ${currency.code}`);
    return currency;
  }

  async update(code: string, dto: UpdateCurrencyDto) {
    const currency = await this.prisma.currency.findUnique({ where: { code: code.toUpperCase() } });
    if (!currency) throw new NotFoundException(`Currency ${code} not found.`);

    const updated = await this.prisma.currency.update({
      where: { code: code.toUpperCase() },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.symbol !== undefined && { symbol: dto.symbol }),
        ...(dto.rateToUsd !== undefined && { rateToUsd: dto.rateToUsd }),
        ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
      },
    });

    await this.reloadCache();
    return updated;
  }

  async remove(code: string) {
    if (code.toUpperCase() === 'USD') {
      throw new ConflictException('Cannot delete USD — it is the base currency.');
    }
    const currency = await this.prisma.currency.findUnique({ where: { code: code.toUpperCase() } });
    if (!currency) throw new NotFoundException(`Currency ${code} not found.`);

    await this.prisma.currency.delete({ where: { code: code.toUpperCase() } });
    await this.reloadCache();
    return { message: `Currency ${code} deleted.` };
  }

  // ─── Seed ─────────────────────────────────────────────────────────────────

  private async seed() {
    for (const c of DEFAULT_CURRENCIES) {
      await this.prisma.currency.upsert({
        where: { code: c.code },
        update: {},
        create: c,
      });
    }
    this.logger.log('Default currencies seeded (USD, EUR, SEK)');
  }
}
