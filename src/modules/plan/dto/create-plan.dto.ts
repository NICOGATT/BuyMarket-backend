import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreatePlanDto {
  @IsString()
  name!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercentage!: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}