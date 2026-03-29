import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestAdmin } from './admin-jwt.strategy';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestAdmin => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as RequestAdmin;
  },
);
