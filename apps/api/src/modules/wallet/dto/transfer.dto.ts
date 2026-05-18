import { IsString, IsNumber, Min, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class TransferDto {
  @ApiProperty({ description: 'Referral code of the recipient', example: 'RP-MARCUS-77' })
  @IsString()
  @IsNotEmpty()
  recipientCode: string;

  @ApiProperty({ description: 'Amount in USD to transfer', example: 1.00 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;
}
