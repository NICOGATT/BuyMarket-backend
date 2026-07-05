import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import {
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
