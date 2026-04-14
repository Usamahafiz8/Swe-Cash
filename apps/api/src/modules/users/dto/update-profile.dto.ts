import { IsOptional, IsString, Length } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'ISO 3166-1 alpha-2 country code', example: 'SE' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @ApiPropertyOptional({ description: 'Firebase FCM token for push notifications' })
  @IsOptional()
  @IsString()
  fcmToken?: string;

  @ApiPropertyOptional({ description: 'Preferred display currency (ISO 4217)', example: 'EUR' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  preferredCurrency?: string;
}
