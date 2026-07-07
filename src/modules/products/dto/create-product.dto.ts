import {
  IsArray,
  IsBoolean,
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

class CreateProductVariantDto {
  @IsString()
  @IsNotEmpty()
  size!: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsNumber()
  @IsPositive()
  price!: number;

  @IsNumber()
  @Min(0)
  stock!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductAttributeValueDto)
  @IsOptional()
  attributes?: CreateProductAttributeValueDto[];
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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  @IsOptional()
  variants?: CreateProductVariantDto[];

  @IsUUID()
  @IsOptional()
  pickupAddressId?: string;

  @IsString()
  @IsOptional()
  horarioDisponible?: string;
}
