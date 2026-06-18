import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto) {
    const category =
      this.categoriesRepository.create(createCategoryDto);

    return this.categoriesRepository.save(category);
  }

  async findAll() {
    return this.categoriesRepository.find({
      relations: ['products'],
      order: {
        name: 'ASC',
      },
    });
  }

  async findOne(id: string) {
    const category = await this.categoriesRepository.findOne({
      where: { id },
      relations: ['products'],
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    return category;
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ) {
    const category = await this.findOne(id);

    Object.assign(category, updateCategoryDto);

    return this.categoriesRepository.save(category);
  }

  async remove(id: string) {
    const category = await this.findOne(id);

    await this.categoriesRepository.remove(category);

    return {
      message: 'Categoría eliminada',
    };
  }

  async uploadImages(
    id: string,
    iconUrl?: string,
    bannerUrl?: string,
  ) {
    const category = await this.findOne(id);

    if (iconUrl) {
      category.icon = iconUrl;
    }

    if (bannerUrl) {
      category.banner = bannerUrl;
    }

    return this.categoriesRepository.save(category);
  }

  
}
