import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CategorySuggestion } from './entities/category-suggestion.entity';
import { Category } from '../categories/entities/category.entity';

@Injectable()
export class CategorySuggestionsService {
  constructor(
    @InjectRepository(CategorySuggestion)
    private readonly suggestionsRepository: Repository<CategorySuggestion>,

    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
  ) {}

  async create(createDto: any, user: any) {
    const suggestion = this.suggestionsRepository.create({
      ...createDto,
      user,
      status: 'pending',
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

    suggestion.status = 'approved' as any;

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

    suggestion.status = 'rejected' as any;

    await this.suggestionsRepository.save(suggestion);

    return {
      message: 'Categoría rechazada',
    };
  }
}