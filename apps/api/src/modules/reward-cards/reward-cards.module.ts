import { Module } from '@nestjs/common';
import { RewardCardsController } from './reward-cards.controller';
import { RewardCardsService } from './reward-cards.service';

@Module({
  controllers: [RewardCardsController],
  providers:   [RewardCardsService],
  exports:     [RewardCardsService],
})
export class RewardCardsModule {}
