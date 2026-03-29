import { IsString, Length } from 'class-validator';

export class ApplyCodeDto {
  @IsString()
  @Length(8, 8)
  code: string;
}
