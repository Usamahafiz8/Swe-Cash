import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { AdjoeService } from './adjoe.service';
import { AdjoeCallbackDto } from './dto/adjoe-callback.dto';

@ApiTags('Adjoe (S2S)')
@Controller('adjoe')
export class AdjoeController {
  constructor(private readonly adjoeService: AdjoeService) {}

  /**
   * Public endpoint — no JWT guard.
   * Security is handled by S2S token validation inside the service.
   * Must always return HTTP 200 to prevent Adjoe retry storms.
   */
  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Adjoe S2S postback — reward credit callback (public, token-secured)' })
  @ApiOkResponse({ description: 'Always returns { ok: true } to suppress Adjoe retries' })
  handleCallback(@Body() dto: AdjoeCallbackDto) {
    return this.adjoeService.handleCallback(dto);
  }
}
