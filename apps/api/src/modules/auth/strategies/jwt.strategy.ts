import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AccountStatus, FraudStatus } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  fraudStatus: FraudStatus;
  accountStatus: AccountStatus;
}

export interface RequestUser {
  id: string;
  email: string;
  fraudStatus: FraudStatus;
  accountStatus: AccountStatus;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    return {
      id: payload.sub,
      email: payload.email,
      fraudStatus: payload.fraudStatus,
      accountStatus: payload.accountStatus,
    };
  }
}
