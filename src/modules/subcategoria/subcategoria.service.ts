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
import { normalizeSubCategoryAttributesAppliesTo } from './subcategoria-attributes/attribute-applies-to.util';

@Injectable()
export class SubCategoriesService {
  constructor(
    @InjectRepository(SubCategory)
    private readonly subCategoryRepository: Repository<SubCategory>,

    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  private normalizeAttributes<T extends SubCategory | SubCategory[]>(subCategories: T): T {
    const subCategoryList = Array.isArray(subCategories)
      ? subCategories
      : [subCategories];

    subCategoryList.forEach(subCategory => {
      subCategory.attributes = normalizeSubCategoryAttributesAppliesTo(
        subCategory.attributes,
      );
    });

    return subCategories;
  }

  async create(createSubCategoryDto: CreateSubCategoryDto) {
    const category = await this.categoryRepository.findOne({
      where: {
        id: createSubCategoryDto.categoryId,
      },
    });

    if (!category) {
      throw new NotFoundException('CategorÃ­a no encontrada');
    }

    const subCategory = this.subCategoryRepository.create({
      name: createSubCategoryDto.name,
      category,
    });

    return this.subCategoryRepository.save(subCategory);
  }

  async findAll() {
    const subCategories = await this.subCategoryRepository.find({
      relations: {
        category: true,
        attributes: true,
      },
    });

    return this.normalizeAttributes(subCategories);
  }

  async findOne(id: string) {
    const subCategory = await this.subCategoryRepository.findOne({
      where: { id },
      relations: {
        category: true,
        attributes: true,
      },
    });

    if (!subCategory) {
      throw new NotFoundException('SubcategorÃ­a no encontrada');
    }

    return this.normalizeAttributes(subCategory);
  }

  async findByCategory(categoryId: string) {
    const subCategories = await this.subCategoryRepository.find({
      where: {
        category: {
          id: categoryId,
        },
      },
      relations: {
        category: true,
        attributes: true,
      },
    });

    return this.normalizeAttributes(subCategories);
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
        throw new NotFoundException('CategorÃ­a no encontrada');
      }

      subCategory.category = category;
    }

    return this.subCategoryRepository.save(subCategory);
  }

  async remove(id: string) {
    const subCategory = await this.findOne(id);

    await this.subCategoryRepository.remove(subCategory);

    return {
      message: 'SubcategorÃ­a eliminada correctamente',
    };
  }
}
