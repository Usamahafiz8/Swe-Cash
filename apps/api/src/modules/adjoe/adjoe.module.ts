import { Module } from '@nestjs/common';
import { AdjoeController } from './adjoe.controller';
import { AdjoeService } from './adjoe.service';
import { WalletModule } from '../wallet/wallet.module';
import { ReferralModule } from '../referral/referral.module';

@Module({
  imports: [WalletModule, ReferralModule],
  controllers: [AdjoeController],
  providers: [AdjoeService],
})
export class AdjoeModule {}
