import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ReferralService } from './referral.service';
import { ApplyCodeDto } from './dto/apply-code.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard)
@Controller('referral')
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Post('apply-code')
  applyCode(@CurrentUser() user: RequestUser, @Body() dto: ApplyCodeDto) {
    return this.referralService.applyCode(user.id, dto);
  }

  @Get('stats')
  getStats(@CurrentUser() user: RequestUser) {
    return this.referralService.getStats(user.id);
  }
}
