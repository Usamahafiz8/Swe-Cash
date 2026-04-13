import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApplyCodeDto {
  @ApiProperty({ description: '8-character referral code (uppercase)', example: 'AB12CD34' })
  @IsString()
  @Length(8, 8)
  code: string;
}
