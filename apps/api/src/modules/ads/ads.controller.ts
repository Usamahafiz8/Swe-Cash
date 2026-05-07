import { Controller, Get, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiResponse } from '@nestjs/swagger';
import { AdsService } from './ads.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Ads')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('reward')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Get('ad/eligibility')
  @ApiOperation({ summary: 'Check if user can claim an ad reward right now' })
  @ApiOkResponse({ description: '{ eligible: boolean, potentialReward?, reason? }' })
  checkAdEligibility(@CurrentUser() user: RequestUser) {
    return this.adsService.checkAdEligibility(user.id);
  }

  @Post('ad')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Claim ad reward (+10% of last Adjoe reward) after watching a rewarded ad' })
  @ApiOkResponse({ description: 'Reward amount credited to pending balance' })
  claimAdReward(@CurrentUser() user: RequestUser) {
    return this.adsService.claimAdReward(user.id);
  }
}
