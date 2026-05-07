import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { CountriesService } from './countries.service';

@ApiTags('Countries (Public)')
@Controller('countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get('check')
  @ApiOperation({ summary: 'Check if a country code is allowed to register and/or request payouts' })
  @ApiQuery({ name: 'code', description: 'ISO 3166-1 alpha-2 country code', example: 'SE' })
  @ApiOkResponse({
    description: '{ available: boolean, payoutEnabled: boolean, message?: string }',
  })
  check(@Query('code') code: string) {
    return this.countriesService.check(code);
  }

  @Get()
  @ApiOperation({ summary: 'List all enabled (non-restricted) countries — used for Unity country picker' })
  @ApiOkResponse({ description: 'Array of { code, name, payoutEnabled }' })
  list() {
    return this.countriesService.listAvailable();
  }
}
