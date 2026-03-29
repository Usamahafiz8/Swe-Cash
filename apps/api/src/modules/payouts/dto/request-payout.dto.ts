import { IsEmail, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RequestPayoutDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsEmail()
  paypalEmail: string;
}
