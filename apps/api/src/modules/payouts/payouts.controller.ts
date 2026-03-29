import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';
import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

class HistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

@UseGuards(JwtAuthGuard)
@Controller('payout')
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Post('request')
  requestPayout(@CurrentUser() user: RequestUser, @Body() dto: RequestPayoutDto) {
    return this.payoutsService.requestPayout(user.id, dto);
  }

  @Get('history')
  getHistory(@CurrentUser() user: RequestUser, @Query() query: HistoryQueryDto) {
    return this.payoutsService.getHistory(user.id, query.page, query.limit);
  }
}
