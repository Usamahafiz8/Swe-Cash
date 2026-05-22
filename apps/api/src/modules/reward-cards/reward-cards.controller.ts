import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { RewardCardsService } from './reward-cards.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Reward Cards')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('reward/cards')
export class RewardCardsController {
  constructor(private readonly rewardCardsService: RewardCardsService) {}

  @Get()
  @ApiOperation({ summary: 'List all active PayPal reward cards — use these amounts for POST /payout/request' })
  @ApiOkResponse({ description: 'Array of { id, amount, badge } — badge is "TOP VALUE" or null' })
  listCards() {
    return this.rewardCardsService.listActive();
  }
}
