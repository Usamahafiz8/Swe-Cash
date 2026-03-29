import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AdminRole } from '@prisma/client';

export interface AdminJwtPayload {
  sub: string;
  email: string;
  role: AdminRole;
  isAdmin: true;
}

export interface RequestAdmin {
  id: string;
  email: string;
  role: AdminRole;
}

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: AdminJwtPayload): Promise<RequestAdmin> {
    if (!payload.isAdmin) {
      throw new UnauthorizedException('Admin access required.');
    }
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
