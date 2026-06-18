import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CategorySuggestionsService } from './category-suggestions.service';
import { CategorySuggestionsController } from './category-suggestions.controller';

import { CategorySuggestion } from './entities/category-suggestion.entity';
import { Category } from '../categories/entities/category.entity';
import { User } from '../users/entity/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CategorySuggestion,
      Category,
      User,
    ]),
  ],
  controllers: [CategorySuggestionsController],
  providers: [CategorySuggestionsService],
})
export class CategorySuggestionsModule {}