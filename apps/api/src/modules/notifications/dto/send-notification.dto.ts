import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationTarget } from '@prisma/client';

export class SendNotificationDto {
  @ApiProperty({ example: 'Weekly reward boost!' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Play today and earn 2x rewards until midnight.' })
  @IsString()
  body: string;

  @ApiProperty({ enum: NotificationTarget, description: 'Who to send to', example: NotificationTarget.all })
  @IsEnum(NotificationTarget)
  target: NotificationTarget;

  @ApiPropertyOptional({ description: 'Required when target is country or activity_level', example: 'SE' })
  @IsOptional()
  @IsString()
  targetValue?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 datetime to schedule the notification', example: '2026-05-01T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}
