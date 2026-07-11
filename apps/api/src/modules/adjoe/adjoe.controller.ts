import { Controller, Get, Query, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdjoeService } from './adjoe.service';
import { AdjoeCallbackQuery } from './dto/adjoe-callback.dto';
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
  // Adjoe sends this as a GET with query-string params (NOT a POST body).
  // Public + signature-verified. The raw query is read untyped so the strict
  // global ValidationPipe (forbidNonWhitelisted) does not reject Adjoe's extra
  // params (ua_channel, ua_network, placement, …).

  @Get('callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Adjoe S2S reward postback (GET, query params). Public, signature-verified.' })
  @ApiQuery({ name: 'trans_uuid', required: true, description: 'Adjoe transaction UUID (dedup key)' })
  @ApiQuery({ name: 'coin_amount', required: true, description: 'Reward in Adjoe coins (converted to USD server-side)' })
  @ApiQuery({ name: 'user_uuid', required: false, description: 'Publisher user id echoed by Adjoe' })
  @ApiQuery({ name: 'sid', required: false, description: 'Adjoe SHA1 signature' })
  @ApiOkResponse({
    description:
      'Returns 200 for handled cases so Adjoe stops retrying; returns 5xx only on a transient server ' +
      'error (or when the coin→USD rate is not yet configured) so Adjoe re-delivers and no reward is lost.',
  })
  handleCallback(@Query() query: AdjoeCallbackQuery) {
    return this.adjoeService.handleCallback(query);
  }
}
