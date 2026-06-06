import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsUUID,
  Min,
} from 'class-validator';

export class AddProductDto {
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Min(1)
  quantity?: number;
}