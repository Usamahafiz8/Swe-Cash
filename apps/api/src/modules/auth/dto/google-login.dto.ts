import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GoogleLoginDto {
  @ApiProperty({ description: 'Google ID token from the mobile client' })
  @IsString()
  idToken: string;

  @ApiPropertyOptional({ description: 'Unique device identifier' })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ description: 'Google Advertising ID (GAID)' })
  @IsOptional()
  @IsString()
  gaid?: string;

  @ApiPropertyOptional({ description: 'Firebase Cloud Messaging token for push notifications' })
  @IsOptional()
  @IsString()
  fcmToken?: string;

  @ApiPropertyOptional({ description: 'ISO 3166-1 alpha-2 country code (e.g. SE, US)' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Flag true if device is detected as emulator' })
  @IsOptional()
  @IsBoolean()
  emulator?: boolean;
}
