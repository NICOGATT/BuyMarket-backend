import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { SubCategory } from './entities/subcategoria.entity';
import { Category } from '../categories/entities/category.entity';

import { CreateSubCategoryDto } from './dto/create-subcategoria.dto';
import { UpdateSubCategoryDto } from './dto/update-subcategoria.dto';

@Injectable()
export class SubCategoriesService {
  constructor(
    @InjectRepository(SubCategory)
    private readonly subCategoryRepository: Repository<SubCategory>,

    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async create(createSubCategoryDto: CreateSubCategoryDto) {
    const category = await this.categoryRepository.findOne({
      where: {
        id: createSubCategoryDto.categoryId,
      },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    const subCategory = this.subCategoryRepository.create({
      name: createSubCategoryDto.name,
      category,
    });

    return this.subCategoryRepository.save(subCategory);
  }

  async findAll() {
    return this.subCategoryRepository.find({
      relations: {
        category: true,
      },
    });
  }

  async findOne(id: string) {
    const subCategory = await this.subCategoryRepository.findOne({
      where: { id },
      relations: {
        category: true,
      },
    });

    if (!subCategory) {
      throw new NotFoundException('Subcategoría no encontrada');
    }

    return subCategory;
  }

  async findByCategory(categoryId: string) {
    return this.subCategoryRepository.find({
      where: {
        category: {
          id: categoryId,
        },
      },
      relations: {
        category: true,
      },
    });
  }

  async update(
    id: string,
    updateSubCategoryDto: UpdateSubCategoryDto,
  ) {
    const subCategory = await this.findOne(id);

    if (updateSubCategoryDto.name) {
      subCategory.name = updateSubCategoryDto.name;
    }

    if (updateSubCategoryDto.categoryId) {
      const category = await this.categoryRepository.findOne({
        where: {
          id: updateSubCategoryDto.categoryId,
        },
      });

      if (!category) {
        throw new NotFoundException('Categoría no encontrada');
      }

      subCategory.category = category;
    }

    return this.subCategoryRepository.save(subCategory);
  }

  async remove(id: string) {
    const subCategory = await this.findOne(id);

    await this.subCategoryRepository.remove(subCategory);

    return {
      message: 'Subcategoría eliminada correctamente',
    };
  }
}