import {
  IsString, IsEnum, IsNumber, IsIn, IsOptional,
  IsBoolean, IsInt, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskTriggerType } from '@prisma/client';

export class CreateTaskDto {
  @ApiProperty({ example: 'Watch 5 Ads' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Watch 5 rewarded ads to earn a bonus.' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ example: '🎬' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ enum: TaskTriggerType, example: TaskTriggerType.ad_views })
  @IsEnum(TaskTriggerType)
  triggerType: TaskTriggerType;

  @ApiProperty({ description: 'Target value to complete the task', example: 5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  triggerValue: number;

  @ApiProperty({ description: 'USD reward on completion', example: 0.10 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  rewardAmount: number;

  @ApiProperty({ enum: ['none', 'daily', 'weekly', 'monthly'], example: 'none' })
  @IsIn(['none', 'daily', 'weekly', 'monthly'])
  repeatInterval: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateTaskDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() icon?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0.0001) triggerValue?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0.0001) rewardAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsIn(['none', 'daily', 'weekly', 'monthly']) repeatInterval?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
}
