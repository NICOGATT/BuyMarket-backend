import { PartialType } from '@nestjs/mapped-types';
import { CreateCategorySuggestionDto } from './create-category-suggestion.dto';

export class UpdateCategorySuggestionDto extends PartialType(CreateCategorySuggestionDto) {}
