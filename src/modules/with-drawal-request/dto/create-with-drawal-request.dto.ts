import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateWithdrawalRequestDto {
  @IsNumber()
  @Min(1)
  amount!: number;

  @ValidateIf(o => !o.cbu)
  @IsString()
  alias?: string;

  @ValidateIf(o => !o.alias)
  @IsString()
  cbu?: string;
}