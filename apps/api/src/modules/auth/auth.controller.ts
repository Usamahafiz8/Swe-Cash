import { Controller, Post, Body, Req, Get, Query, Res, BadRequestException } from '@nestjs/common';
import { Request, Response } from 'express';
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
  googleAuth(@Res() res: Response) {
    res.redirect(this.authService.getGoogleAuthUrl());
  }

  @Get('google/callback')
  @ApiExcludeEndpoint()
  async googleCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (error || !code) {
      throw new BadRequestException(error ?? 'Missing authorization code from Google.');
    }

    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      'unknown';

    const result = await this.authService.googleCodeLogin(code, ipAddress);

    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>SweCash — Auth Result</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0f1117;color:#e2e8f0;font-family:system-ui,sans-serif;padding:32px 16px}
    h2{color:#34d399;margin-bottom:6px;font-size:1.2rem}
    p{color:#64748b;font-size:0.82rem;margin-bottom:20px}
    .section{margin-bottom:20px}
    .label{font-size:0.75rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
    pre{background:#1e2433;border:1px solid #2d3748;border-radius:8px;padding:16px;font-size:0.8rem;white-space:pre-wrap;word-break:break-all;max-height:300px;overflow-y:auto}
    .google-token{color:#fbbf24}
    .swecash-token{color:#86efac}
    .btn{display:inline-block;padding:8px 16px;border-radius:6px;border:none;cursor:pointer;font-size:0.82rem;font-weight:600;margin-top:8px;margin-right:8px}
    .btn-yellow{background:#d97706;color:#fff}
    .btn-green{background:#065f46;color:#34d399}
  </style>
</head>
<body>
  <h2>✓ Google Auth Successful</h2>
  <p>Copy the Google ID Token to test <code>POST /api/v1/auth/google-login</code>. Use the SweCash JWT for authenticated endpoints.</p>

  <div class="section">
    <div class="label">Google ID Token (use as "idToken" in google-login)</div>
    <pre class="google-token" id="gtoken">${result.googleIdToken}</pre>
    <button class="btn btn-yellow" onclick="navigator.clipboard.writeText(document.getElementById('gtoken').textContent).then(()=>this.textContent='Copied!')">Copy Google ID Token</button>
  </div>

  <div class="section">
    <div class="label">SweCash JWT (use as Bearer token for authenticated endpoints)</div>
    <pre class="swecash-token" id="jwt">${result.token}</pre>
    <button class="btn btn-green" onclick="navigator.clipboard.writeText(document.getElementById('jwt').textContent).then(()=>this.textContent='Copied!')">Copy SweCash JWT</button>
  </div>

  <div class="section">
    <div class="label">Full Response</div>
    <pre>${JSON.stringify({ isNewUser: result.isNewUser, user: result.user }, null, 2)}</pre>
  </div>
</body>
</html>`);
  }
}
