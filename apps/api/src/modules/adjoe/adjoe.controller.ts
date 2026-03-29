import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AdjoeService } from './adjoe.service';
import { AdjoeCallbackDto } from './dto/adjoe-callback.dto';

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
  handleCallback(@Body() dto: AdjoeCallbackDto) {
    return this.adjoeService.handleCallback(dto);
  }
}
