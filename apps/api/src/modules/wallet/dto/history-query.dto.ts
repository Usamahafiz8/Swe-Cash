import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum HistoryStatusFilter {
  all      = 'all',
  pending  = 'pending',
  approved = 'approved',
  rejected = 'rejected',
}

export class HistoryQueryDto {
  @ApiPropertyOptional({ enum: HistoryStatusFilter, default: HistoryStatusFilter.all })
  @IsOptional()
  @IsEnum(HistoryStatusFilter)
  status?: HistoryStatusFilter = HistoryStatusFilter.all;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
