import { IsString, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Adjoe S2S postback payload.
 * Fields based on standard Adjoe postback format.
 * Update field names once Adjoe shares exact payload docs.
 */
export class AdjoeCallbackDto {
  @IsString()
  token: string;

  @IsString()
  transaction_id: string;

  @IsString()
  publisher_sub_id: string; // maps to our user ID

  @Type(() => Number)
  @IsNumber()
  reward: number; // reward amount in USD

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  app_id?: string;

  @IsOptional()
  @IsString()
  gaid?: string;
}
