import { Module } from '@nestjs/common';
import { AdjoeController } from './adjoe.controller';
import { AdjoeService } from './adjoe.service';
import { WalletModule } from '../wallet/wallet.module';
import { ReferralModule } from '../referral/referral.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [WalletModule, ReferralModule, TasksModule],
  controllers: [AdjoeController],
  providers: [AdjoeService],
})
export class AdjoeModule {}
