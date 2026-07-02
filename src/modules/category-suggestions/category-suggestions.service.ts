import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  CategorySuggestion,
  CategorySuggestionStatus,
} from './entities/category-suggestion.entity';
import { Category } from '../categories/entities/category.entity';
import { CreateCategorySuggestionDto } from './dto/create-category-suggestion.dto';

@Injectable()
export class CategorySuggestionsService {
  constructor(
    @InjectRepository(CategorySuggestion)
    private readonly suggestionsRepository: Repository<CategorySuggestion>,

    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
  ) {}

  async create(createDto: CreateCategorySuggestionDto, user: any) {
    const suggestion = this.suggestionsRepository.create({
      name: createDto.name.trim(),
      description: createDto.description?.trim() || undefined,
      user,
      status: CategorySuggestionStatus.PENDING,
    });

    return this.suggestionsRepository.save(suggestion);
  }

  async findPending() {
    return this.suggestionsRepository.find({
      where: {
        status: 'pending' as any,
      },
      relations: ['user'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async approve(id: string) {
    const suggestion =
      await this.suggestionsRepository.findOne({
        where: { id },
      });

    if (!suggestion) {
      throw new NotFoundException(
        'Sugerencia no encontrada',
      );
    }

    const category = this.categoriesRepository.create({
      name: suggestion.name,
      description: suggestion.description,
    });

    await this.categoriesRepository.save(category);

    suggestion.status = CategorySuggestionStatus.APPROVED;

    await this.suggestionsRepository.save(suggestion);

    return {
      message: 'Categoría aprobada',
      category,
    };
  }

  async reject(id: string) {
    const suggestion =
      await this.suggestionsRepository.findOne({
        where: { id },
      });

    if (!suggestion) {
      throw new NotFoundException(
        'Sugerencia no encontrada',
      );
    }

    suggestion.status = CategorySuggestionStatus.REJECTED;

    await this.suggestionsRepository.save(suggestion);

    return {
      message: 'Categoría rechazada',
    };
  }
}
