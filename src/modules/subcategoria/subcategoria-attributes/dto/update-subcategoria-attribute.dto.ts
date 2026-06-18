import { PartialType } from '@nestjs/mapped-types';
import { CreateSubCategoryAttributeDto } from './create-subcategoria-attribute.dto';

export class UpdateSubcategoriaAttributeDto extends PartialType(
  CreateSubCategoryAttributeDto,
) {}
