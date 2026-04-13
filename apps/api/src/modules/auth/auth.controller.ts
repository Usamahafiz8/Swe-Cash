import { Controller, Post, Body, Req } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('google-login')
  @ApiOperation({ summary: 'Login or register via Google ID token' })
  @ApiOkResponse({ description: 'JWT token + user profile' })
  googleLogin(@Body() dto: GoogleLoginDto, @Req() req: Request) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      'unknown';

    return this.authService.googleLogin(dto, ipAddress);
  }
}
