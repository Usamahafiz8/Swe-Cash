import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { ReferralService } from './referral.service';
import { ApplyCodeDto } from './dto/apply-code.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Referral')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('referral')
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Post('apply-code')
  @ApiOperation({ summary: 'Apply a referral code (one-time, links 3-level commission chain)' })
  @ApiOkResponse({ description: 'Referral code applied successfully' })
  applyCode(@CurrentUser() user: RequestUser, @Body() dto: ApplyCodeDto) {
    return this.referralService.applyCode(user.id, dto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get referral stats — direct count, commissions by level' })
  @ApiOkResponse({ description: 'Referral statistics' })
  getStats(@CurrentUser() user: RequestUser) {
    return this.referralService.getStats(user.id);
  }
}
