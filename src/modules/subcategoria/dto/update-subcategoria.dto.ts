import { PartialType } from '@nestjs/mapped-types';
import { CreateSubCategoryDto } from './create-subcategoria.dto';

export class UpdateSubCategoryDto extends PartialType(
  CreateSubCategoryDto,
) {}