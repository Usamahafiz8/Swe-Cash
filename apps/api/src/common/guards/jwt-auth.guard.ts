import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AccountStatus } from '@prisma/client';
import { RequestUser } from '../../modules/auth/strategies/jwt.strategy';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<T extends RequestUser>(
    err: unknown,
    user: T,
    info: unknown,
    context: ExecutionContext,
  ): T {
    if (err || !user) {
      throw new UnauthorizedException('Invalid or expired token.');
    }
    if (user.accountStatus === AccountStatus.banned) {
      throw new ForbiddenException('Account permanently banned.');
    }
    if (user.accountStatus === AccountStatus.suspended) {
      throw new ForbiddenException('Account suspended. Contact support.');
    }
    return user;
  }
}
