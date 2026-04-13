import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { NotificationTarget } from '@prisma/client';

export class SendNotificationDto {
  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsEnum(NotificationTarget)
  target: NotificationTarget;

  @IsOptional()
  @IsString()
  targetValue?: string;

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}
