import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  IsEmail,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AccountStatus, PayoutStatus } from '@prisma/client';

export class UpdateUserStatusDto {
  @IsEnum(AccountStatus)
  status: AccountStatus;

  @IsString()
  @MaxLength(500)
  reason: string;
}

export class AdjustBalanceDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  amount: number; // positive = credit, negative = debit

  @IsString()
  @MaxLength(500)
  reason: string;
}

export class PayoutActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}

export class UpdateSettingDto {
  @IsString()
  value: string;
}

export class AdminListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;
}

export class AdminPayoutListQueryDto {
  @IsOptional()
  @IsEnum(PayoutStatus)
  status?: PayoutStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

export class CreateAdminDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  name: string;
}

// re-export for convenience
import { MinLength } from 'class-validator';
