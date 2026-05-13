import { Controller, Post, Body, Req, Get, UseGuards, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiOkResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
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

  @Get('google')
  @ApiExcludeEndpoint()
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // Passport redirects to Google — no body needed
  }

  @Get('google/callback')
  @ApiExcludeEndpoint()
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      'unknown';

    const profile = req.user as any;
    const result = await this.authService.googleOAuthLogin(profile, ipAddress);

    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>SweCash — Auth Result</title>
  <style>
    body{background:#0f1117;color:#e2e8f0;font-family:system-ui,sans-serif;padding:32px}
    h2{color:#34d399;margin-bottom:16px}
    pre{background:#1e2433;border:1px solid #2d3748;border-radius:8px;padding:20px;font-size:0.85rem;white-space:pre-wrap;word-break:break-all;color:#86efac;max-height:80vh;overflow-y:auto}
    .copy-btn{background:#3b82f6;color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:0.9rem;font-weight:600;margin-bottom:12px}
    .copy-btn:hover{opacity:0.85}
  </style>
</head>
<body>
  <h2>✓ Google Auth Successful</h2>
  <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('raw').textContent).then(()=>this.textContent='Copied!')">Copy JSON</button>
  <pre id="raw">${JSON.stringify(result, null, 2)}</pre>
</body>
</html>`);
  }
}
