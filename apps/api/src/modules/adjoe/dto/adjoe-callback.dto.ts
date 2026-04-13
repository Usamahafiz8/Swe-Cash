import { IsString, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdjoeCallbackDto {
  @ApiProperty({ description: 'S2S security token from Adjoe' })
  @IsString()
  token: string;

  @ApiProperty({ description: 'Unique transaction ID from Adjoe (used for deduplication)' })
  @IsString()
  transaction_id: string;

  @ApiProperty({ description: 'Our user ID passed as publisher_sub_id to Adjoe SDK' })
  @IsString()
  publisher_sub_id: string;

  @ApiProperty({ description: 'Reward amount in USD', example: 0.005 })
  @Type(() => Number)
  @IsNumber()
  reward: number;

  @ApiPropertyOptional({ description: 'Currency code', example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Adjoe app/campaign ID' })
  @IsOptional()
  @IsString()
  app_id?: string;

  @ApiPropertyOptional({ description: 'Google Advertising ID of the device' })
  @IsOptional()
  @IsString()
  gaid?: string;
}
