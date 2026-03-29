import { Controller, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AdsService } from './ads.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard)
@Controller('reward')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Post('ad')
  @HttpCode(HttpStatus.OK)
  claimAdReward(@CurrentUser() user: RequestUser) {
    return this.adsService.claimAdReward(user.id);
  }
}
