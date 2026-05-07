import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CountriesService {
  constructor(private readonly prisma: PrismaService) {}

  async check(code: string) {
    if (!code || code.trim().length !== 2) {
      throw new BadRequestException('Provide a valid ISO 3166-1 alpha-2 country code (e.g. SE, US).');
    }

    const normalised = code.trim().toUpperCase();
    const country = await this.prisma.country.findUnique({ where: { code: normalised } });

    // Unknown country — treat as available but payout-disabled (not explicitly blocked)
    if (!country) {
      return {
        available: true,
        payoutEnabled: false,
        message: 'Country not explicitly configured. Registration allowed; payouts not available.',
      };
    }

    if (country.isRestricted) {
      return {
        available: false,
        payoutEnabled: false,
        message: 'This app is not available in your region.',
      };
    }

    if (!country.isEnabled) {
      return {
        available: false,
        payoutEnabled: false,
        message: 'This app is not available in your region.',
      };
    }

    return {
      available: true,
      payoutEnabled: country.payoutEnabled,
      ...(country.payoutEnabled
        ? {}
        : { message: 'Registration allowed. Payouts are not yet available in your country.' }),
    };
  }

  async listAvailable() {
    return this.prisma.country.findMany({
      where: { isEnabled: true, isRestricted: false },
      select: { code: true, name: true, payoutEnabled: true },
      orderBy: { name: 'asc' },
    });
  }
}
