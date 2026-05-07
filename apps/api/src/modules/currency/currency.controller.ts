import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { CurrencyService } from './currency.service';

@ApiTags('Currencies (Public)')
@Controller('currencies')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get()
  @ApiOperation({ summary: 'List all enabled currencies (no auth required) — used by Unity currency picker' })
  @ApiOkResponse({ description: 'Array of enabled currencies with code, name, symbol, rateToUsd' })
  async listEnabled() {
    return this.currencyService.listEnabled();
  }
}
