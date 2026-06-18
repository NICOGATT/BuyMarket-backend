import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ProductMediaType } from '../entities/product-media.entity';

export class CreateProductMediaDto {
  @IsString()
  url!: string;

  @IsEnum(ProductMediaType)
  @IsOptional()
  type?: ProductMediaType;
}