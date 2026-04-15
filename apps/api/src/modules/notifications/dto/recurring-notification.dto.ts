import { IsString, IsEnum, IsOptional, IsIn, Matches, Min, Max, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationTarget } from '@prisma/client';

export type FrequencyType = 'daily' | 'weekly' | 'monthly' | 'custom';

export class CreateRecurringNotificationDto {
  @ApiProperty({ example: 'Daily Reward Reminder' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Don\'t forget to play today and earn your rewards!' })
  @IsString()
  body: string;

  @ApiProperty({ enum: NotificationTarget, example: NotificationTarget.all })
  @IsEnum(NotificationTarget)
  target: NotificationTarget;

  @ApiPropertyOptional({ example: 'SE' })
  @IsOptional()
  @IsString()
  targetValue?: string;

  @ApiProperty({ enum: ['daily', 'weekly', 'monthly', 'custom'], example: 'daily' })
  @IsIn(['daily', 'weekly', 'monthly', 'custom'])
  frequency: FrequencyType;

  // For daily/weekly/monthly: hour in UTC (0-23)
  @ApiPropertyOptional({ description: 'Hour to send (UTC, 0-23). Required for daily/weekly/monthly.', example: 9 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  hour?: number;

  // For weekly: day of week (0=Sun … 6=Sat)
  @ApiPropertyOptional({ description: 'Day of week for weekly frequency (0=Sun, 6=Sat)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  // For monthly: day of month (1-28)
  @ApiPropertyOptional({ description: 'Day of month for monthly frequency (1-28)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  dayOfMonth?: number;

  // For custom: raw cron expression
  @ApiPropertyOptional({ description: 'Raw cron expression for custom frequency', example: '0 9 * * 1,5' })
  @IsOptional()
  @IsString()
  cronExpr?: string;
}
