import { Module } from '@nestjs/common';
import { FraudService } from './fraud.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  providers: [FraudService],
  exports: [FraudService],
})
export class FraudModule {}
