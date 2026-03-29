import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { NotificationTarget } from '@prisma/client';

export class SendNotificationDto {
  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsEnum(NotificationTarget)
  targetType: NotificationTarget;

  @IsOptional()
  @IsString()
  targetValue?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string; // ISO string — if provided, schedules for future delivery
}
