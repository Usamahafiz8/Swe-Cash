import { Controller, Get, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdjoeService } from './adjoe.service';
import { AdjoeCallbackDto } from './dto/adjoe-callback.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Adjoe')
@Controller('adjoe')
export class AdjoeController {
  constructor(private readonly adjoeService: AdjoeService) {}

  // ─── Unity: SDK Initialisation ────────────────────────────────────────────

  @Get('init')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('user-jwt')
  @ApiOperation({ summary: 'Get Adjoe SDK init params — call this once after login before showing the game list' })
  @ApiOkResponse({
    description: '{ publisherSubId, sdkHash } — pass both to AdjoeSDK.init() in Unity',
  })
  getSdkConfig(@CurrentUser() user: RequestUser) {
    return this.adjoeService.getSdkConfig(user.id);
  }

  // ─── Adjoe Server: S2S Postback ───────────────────────────────────────────

  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Adjoe S2S postback — reward credit callback (public, token-secured)' })
  @ApiOkResponse({ description: 'Always returns { ok: true } to suppress Adjoe retries' })
  handleCallback(@Body() dto: AdjoeCallbackDto) {
    return this.adjoeService.handleCallback(dto);
  }
}
