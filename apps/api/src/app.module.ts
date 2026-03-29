import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { AdjoeModule } from './modules/adjoe/adjoe.module';
import { AdsModule } from './modules/ads/ads.module';
import { ReferralModule } from './modules/referral/referral.module';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { FraudModule } from './modules/fraud/fraud.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT'),
          password: config.get('REDIS_PASSWORD'),
          tls: config.get('REDIS_TLS') === 'true' ? {} : undefined,
        },
      }),
    }),

    PrismaModule,
    AuthModule,
    UsersModule,
    WalletModule,
    AdjoeModule,
    AdsModule,
    ReferralModule,
    PayoutsModule,
    FraudModule,
    NotificationsModule,
    SettingsModule,
    AdminModule,
  ],
})
export class AppModule {}
