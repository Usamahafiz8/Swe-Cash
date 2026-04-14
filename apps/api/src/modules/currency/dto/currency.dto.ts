import { IsString, IsNumber, IsBoolean, IsOptional, Length, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCurrencyDto {
  @ApiProperty({ description: 'ISO 4217 code', example: 'EUR' })
  @IsString()
  @Length(3, 3)
  code: string;

  @ApiProperty({ example: 'Euro' })
  @IsString()
  name: string;

  @ApiProperty({ example: '€' })
  @IsString()
  symbol: string;

  @ApiProperty({ description: '1 USD = X of this currency', example: 0.92 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  rateToUsd: number;
}

export class UpdateCurrencyDto {
  @ApiPropertyOptional({ example: 'Euro' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '€' })
  @IsOptional()
  @IsString()
  symbol?: string;

  @ApiPropertyOptional({ description: '1 USD = X of this currency', example: 0.95 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  rateToUsd?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
