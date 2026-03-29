import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AdminController } from './admin.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminUsersService } from './admin-users.service';
import { AdminJwtStrategy } from './guards/admin-jwt.strategy';
import { WalletModule } from '../wallet/wallet.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { FraudModule } from '../fraud/fraud.module';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '30d') },
      }),
    }),
    WalletModule,
    PayoutsModule,
    FraudModule,
    SettingsModule,
    NotificationsModule,
  ],
  controllers: [AdminController],
  providers: [AdminAuthService, AdminUsersService, AdminJwtStrategy],
})
export class AdminModule {}
