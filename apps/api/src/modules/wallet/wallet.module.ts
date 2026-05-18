import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { CurrencyModule } from '../currency/currency.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [CurrencyModule, SettingsModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
