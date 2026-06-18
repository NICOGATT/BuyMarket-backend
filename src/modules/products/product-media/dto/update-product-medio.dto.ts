import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

export class UpdateProductMediaDto {
  @IsOptional()
  @IsBoolean()
  isCover?: boolean;

  @IsOptional()
  @IsNumber()
  order?: number;
}