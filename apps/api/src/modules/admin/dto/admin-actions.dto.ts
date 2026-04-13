import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  IsEmail,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountStatus, PayoutStatus } from '@prisma/client';

export class UpdateUserStatusDto {
  @ApiProperty({ enum: AccountStatus, example: AccountStatus.suspended })
  @IsEnum(AccountStatus)
  status: AccountStatus;

  @ApiProperty({ example: 'Suspicious activity detected' })
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class AdjustBalanceDto {
  @ApiProperty({ description: 'Positive = credit, negative = debit', example: 1.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  amount: number;

  @ApiProperty({ example: 'Manual correction for campaign issue' })
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class PayoutActionDto {
  @ApiPropertyOptional({ example: 'Rejected — unverified PayPal account' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}

export class UpdateSettingDto {
  @ApiProperty({ example: '5.00' })
  @IsString()
  value: string;
}

export class AdminListQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'john' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'SE' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ enum: AccountStatus })
  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;
}

export class AdminPayoutListQueryDto {
  @ApiPropertyOptional({ enum: PayoutStatus })
  @IsOptional()
  @IsEnum(PayoutStatus)
  status?: PayoutStatus;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minAmount?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxAmount?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

export class CreateAdminDto {
  @ApiProperty({ example: 'ops@swecash.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Operations Manager' })
  @IsString()
  name: string;
}
