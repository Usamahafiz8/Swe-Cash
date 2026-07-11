import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AccountStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../modules/auth/strategies/jwt.strategy';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Verifies signature + expiry and populates request.user via handleRequest().
    await (super.canActivate(context) as Promise<boolean>);

    const request = context.switchToHttp().getRequest<{ user: RequestUser }>();
    const user = request.user;

    // The accountStatus baked into the JWT is a snapshot from login time, and tokens live
    // for 30 days. A ban, suspension or account deletion that happened after the token was
    // issued only exists in the database, so status must be read from there on every request
    // — otherwise a deleted user keeps full access until their token expires.
    const current = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { accountStatus: true, fraudStatus: true },
    });
    if (!current) {
      throw new UnauthorizedException('Account no longer exists.');
    }
    if (current.accountStatus === AccountStatus.banned) {
      throw new ForbiddenException('Account permanently banned.');
    }
    if (current.accountStatus === AccountStatus.suspended) {
      throw new ForbiddenException('Account suspended. Contact support.');
    }

    user.accountStatus = current.accountStatus;
    user.fraudStatus = current.fraudStatus;
    return true;
  }

  handleRequest<T extends RequestUser>(err: unknown, user: T): T {
    if (err || !user) {
      throw new UnauthorizedException('Invalid or expired token.');
    }
    return user;
  }
}
