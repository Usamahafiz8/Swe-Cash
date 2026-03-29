import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  idToken: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  gaid?: string;

  @IsOptional()
  @IsString()
  fcmToken?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsBoolean()
  emulator?: boolean;
}
