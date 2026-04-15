import {
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { AccountStatus, FraudStatus, TaskTriggerType } from '@prisma/client';

const SIGNUP_BONUS = 0.03;
const IP_COLLISION_THRESHOLD = 3;

interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly tasksService: TasksService,
  ) {
    this.googleClient = new OAuth2Client(
      config.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  async googleLogin(dto: GoogleLoginDto, ipAddress: string) {
    // 1. Verify Google ID token
    const googleProfile = await this.verifyGoogleToken(dto.idToken);

    // 2. Find or create user
    let user = await this.prisma.user.findUnique({
      where: { googleId: googleProfile.sub },
      include: { wallet: true },
    });

    const isNewUser = !user;

    if (isNewUser) {
      user = await this.registerNewUser(googleProfile, dto, ipAddress);
    } else {
      user = await this.updateExistingUser(user!.id, dto, ipAddress);
    }

    // 3. Block suspended/banned users
    if (user.accountStatus === AccountStatus.banned) {
      throw new ForbiddenException('Your account has been permanently banned.');
    }
    if (user.accountStatus === AccountStatus.suspended) {
      throw new ForbiddenException(
        'Your account is suspended. Please contact support.',
      );
    }

    // 4. Issue JWT
    const token = this.issueToken(user);

    return {
      token,
      isNewUser,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profileImageUrl: user.profileImageUrl,
        country: user.country,
        referralCode: user.referralCode,
        accountStatus: user.accountStatus,
        fraudStatus: user.fraudStatus,
        wallet: user.wallet,
      },
    };
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private async verifyGoogleToken(idToken: string): Promise<GoogleProfile> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.config.get<string>('GOOGLE_CLIENT_ID'),
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        throw new UnauthorizedException('Invalid Google token payload.');
      }
      return {
        sub: payload.sub,
        email: payload.email,
        name: payload.name ?? payload.email,
        picture: payload.picture ?? '',
      };
    } catch {
      throw new UnauthorizedException('Google token verification failed.');
    }
  }

  private async registerNewUser(
    profile: GoogleProfile,
    dto: GoogleLoginDto,
    ipAddress: string,
  ) {
    const referralCode = randomBytes(4).toString('hex').toUpperCase();

    const user = await this.prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          googleId: profile.sub,
          name: profile.name,
          email: profile.email,
          profileImageUrl: profile.picture,
          country: dto.country ?? null,
          deviceId: dto.deviceId ?? null,
          gaid: dto.gaid ?? null,
          fcmToken: dto.fcmToken ?? null,
          referralCode,
          lastLoginAt: new Date(),
        },
      });

      // Create wallet
      await tx.wallet.create({
        data: {
          userId: newUser.id,
          availableBalance: SIGNUP_BONUS,
          pendingBalance: 0,
          lifetimeEarnings: SIGNUP_BONUS,
          lifetimePayouts: 0,
        },
      });

      // Ledger entry for signup bonus
      await tx.transaction.create({
        data: {
          userId: newUser.id,
          amount: SIGNUP_BONUS,
          type: 'bonus',
          status: 'completed',
          metadata: { source: 'signup_bonus' },
        },
      });

      // Log device + IP
      if (dto.deviceId || ipAddress) {
        await tx.device.create({
          data: {
            userId: newUser.id,
            deviceId: dto.deviceId ?? 'unknown',
            ipAddress,
          },
        });
      }

      return newUser;
    });

    // Run fraud checks after transaction (non-blocking to registration)
    await this.runRegistrationFraudChecks(user.id, dto, ipAddress);

    // Task evaluation: profile_complete if country provided (non-blocking)
    if (dto.country) {
      this.tasksService.evaluate(user.id, TaskTriggerType.profile_complete, 1)
        .catch((err) => this.logger.error('Task evaluate (profile_complete) failed', err));
    }

    // Re-fetch with wallet
    return this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { wallet: true },
    });
  }

  private async updateExistingUser(
    userId: string,
    dto: GoogleLoginDto,
    ipAddress: string,
  ) {
    const updateData: Record<string, unknown> = { lastLoginAt: new Date() };
    if (dto.deviceId) updateData.deviceId = dto.deviceId;
    if (dto.gaid) updateData.gaid = dto.gaid;
    if (dto.fcmToken) updateData.fcmToken = dto.fcmToken;
    if (dto.country) updateData.country = dto.country;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: { wallet: true },
    });

    // Log new device/IP if changed
    if (dto.deviceId) {
      await this.prisma.device.create({
        data: { userId, deviceId: dto.deviceId, ipAddress },
      });
    }

    // Handle emulator flag
    if (dto.emulator === true) {
      await this.flagUser(userId, 'emulator_detected', 'true', 'flagged_suspicious');
    }

    // Task evaluation: login_streak (non-blocking)
    this.tasksService.updateLoginStreak(userId)
      .then((streak) => this.tasksService.evaluate(userId, TaskTriggerType.login_streak, streak))
      .catch((err) => this.logger.error('Task evaluate (login_streak) failed', err));

    return user;
  }

  private async runRegistrationFraudChecks(
    userId: string,
    dto: GoogleLoginDto,
    ipAddress: string,
  ) {
    // Check: device ID already used by another account
    if (dto.deviceId) {
      const existingDevice = await this.prisma.user.findFirst({
        where: { deviceId: dto.deviceId, id: { not: userId } },
      });
      if (existingDevice) {
        await Promise.all([
          this.flagUser(userId, 'duplicate_device', dto.deviceId, 'flagged_suspicious'),
          this.flagUser(existingDevice.id, 'duplicate_device', dto.deviceId, 'flagged_suspicious'),
        ]);
      }
    }

    // Check: IP used by 3+ accounts in last 24 hours
    const recentFromIp = await this.prisma.device.groupBy({
      by: ['userId'],
      where: {
        ipAddress,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        userId: { not: userId },
      },
    });
    if (recentFromIp.length >= IP_COLLISION_THRESHOLD) {
      await this.flagUser(userId, 'ip_collision', ipAddress, 'flagged_suspicious');
    }

    // Handle emulator flag
    if (dto.emulator === true) {
      await this.flagUser(userId, 'emulator_detected', 'true', 'flagged_suspicious');
    }
  }

  private async flagUser(
    userId: string,
    eventType: string,
    detectedValue: string,
    actionTaken: string,
  ) {
    await this.prisma.$transaction([
      this.prisma.fraudLog.create({
        data: { userId, eventType, detectedValue, actionTaken },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { fraudStatus: FraudStatus.suspicious },
      }),
    ]);
  }

  private issueToken(user: { id: string; email: string; fraudStatus: FraudStatus; accountStatus: AccountStatus }) {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      fraudStatus: user.fraudStatus,
      accountStatus: user.accountStatus,
    });
  }
}
