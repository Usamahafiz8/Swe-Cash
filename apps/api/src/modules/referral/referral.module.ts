import { Module } from '@nestjs/common';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';
import { WalletModule } from '../wallet/wallet.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [WalletModule, SettingsModule],
  controllers: [ReferralController],
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralModule {}
