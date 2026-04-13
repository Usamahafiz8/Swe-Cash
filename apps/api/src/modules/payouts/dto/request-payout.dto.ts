import { IsEmail, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class RequestPayoutDto {
  @ApiProperty({ description: 'Payout amount in USD (min $0.01)', example: 5.00 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'PayPal email address to receive payment', example: 'user@example.com' })
  @IsEmail()
  paypalEmail: string;
}
