import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

class CreateProductAttributeValueDto {
  @IsUUID()
  attributeId!: string;

  @IsString()
  @IsNotEmpty()
  value!: string;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  @IsPositive()
  price!: number;

  @IsNumber()
  @Min(0)
  stock!: number;

  @IsUUID()
  seller!: string;

  @IsUUID()
  subCategoryId!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  mediaIds?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductAttributeValueDto)
  @IsOptional()
  attributes?: CreateProductAttributeValueDto[];

  @IsUUID()
  @IsOptional()
  pickupAddressId?: string;
}