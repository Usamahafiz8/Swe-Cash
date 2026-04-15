import { Module } from '@nestjs/common';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';
import { WalletModule } from '../wallet/wallet.module';
import { ReferralModule } from '../referral/referral.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [WalletModule, ReferralModule, TasksModule],
  controllers: [AdsController],
  providers: [AdsService],
})
export class AdsModule {}
