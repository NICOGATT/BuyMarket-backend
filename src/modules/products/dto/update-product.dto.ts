import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsUUID, ValidateNested } from 'class-validator';

import {
  CreateProductDto,
  CreateProductVariantDto,
} from './create-product.dto';

export class UpdateProductVariantDto extends CreateProductVariantDto {
  @IsUUID()
  @IsOptional()
  id?: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateProductVariantDto)
  @IsOptional()
  declare variants?: UpdateProductVariantDto[];
}
