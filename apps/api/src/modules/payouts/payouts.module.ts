import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PayoutsController } from './payouts.controller';
import { PayoutsService, PAYOUT_QUEUE } from './payouts.service';
import { PaypalService } from './paypal.service';
import { PayoutProcessor } from './queues/payout.processor';
import { WalletModule } from '../wallet/wallet.module';
import { SettingsModule } from '../settings/settings.module';
import { FraudModule } from '../fraud/fraud.module';
import { ReferralModule } from '../referral/referral.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: PAYOUT_QUEUE }),
    WalletModule,
    SettingsModule,
    FraudModule,
    ReferralModule,
  ],
  controllers: [PayoutsController],
  providers: [PayoutsService, PaypalService, PayoutProcessor],
  exports: [PayoutsService],
})
export class PayoutsModule {}
