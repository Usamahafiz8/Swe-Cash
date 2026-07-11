import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DeleteAccountDto {
  @ApiPropertyOptional({
    description:
      'Confirms the user accepts forfeiting their balance. Only required when the available ' +
      'balance is at or above the minimum payout threshold — i.e. when they could have cashed ' +
      'out instead. Balances below the threshold are unwithdrawable and written off automatically.',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  forfeitBalance?: boolean;
}
