import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import {
  AttributeAppliesTo,
  AttributeType,
  AttributeUsage,
} from '../entities/subcategoria-attribute.entity';

export class CreateSubCategoryAttributeDto {
  @IsString()
  name!: string;

  @IsEnum(AttributeType)
  type!: AttributeType;

  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @IsEnum(AttributeAppliesTo)
  @IsNotEmpty()
  appliesTo!: AttributeAppliesTo;

  @IsBoolean()
  @IsOptional()
  appliesToVariant?: boolean;

  @IsEnum(AttributeUsage)
  @IsOptional()
  usage?: AttributeUsage;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  options?: string[];

  @IsUUID()
  subCategoryId!: string;
}

