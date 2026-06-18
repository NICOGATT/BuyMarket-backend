import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SubCategoryAttribute } from './entities/subcategoria-attribute.entity'; 
import { SubCategory } from '../entities/subcategoria.entity';

import { CreateSubCategoryAttributeDto } from './dto/create-subcategoria-attribute.dto';
import { UpdateSubcategoriaAttributeDto } from './dto/update-subcategoria-attribute.dto'; 

@Injectable()
export class SubCategoryAttributesService {
  constructor(
    @InjectRepository(SubCategoryAttribute)
    private readonly attributeRepository: Repository<SubCategoryAttribute>,

    @InjectRepository(SubCategory)
    private readonly subCategoryRepository: Repository<SubCategory>,
  ) {}

  async create(dto: CreateSubCategoryAttributeDto) {
    const subCategory = await this.subCategoryRepository.findOne({
      where: { id: dto.subCategoryId },
    });

    if (!subCategory) {
      throw new NotFoundException('Subcategoría no encontrada');
    }

    const attribute = this.attributeRepository.create({
      name: dto.name,
      type: dto.type,
      required: dto.required ?? false,
      subCategory,
    });

    return this.attributeRepository.save(attribute);
  }

  async findAll() {
    return this.attributeRepository.find({
      relations: {
        subCategory: true,
      },
    });
  }

  async findOne(id: string) {
    const attribute = await this.attributeRepository.findOne({
      where: { id },
      relations: {
        subCategory: true,
      },
    });

    if (!attribute) {
      throw new NotFoundException('Atributo no encontrado');
    }

    return attribute;
  }

  async findBySubCategory(subCategoryId: string) {
    return this.attributeRepository.find({
      where: {
        subCategory: {
          id: subCategoryId,
        },
      },
      relations: {
        subCategory: true,
      },
    });
  }

  async update(
    id: string,
    dto: UpdateSubcategoriaAttributeDto,
  ) {
    const attribute = await this.findOne(id);

    if (dto.name !== undefined) {
      attribute.name = dto.name;
    }

    if (dto.type !== undefined) {
      attribute.type = dto.type;
    }

    if (dto.required !== undefined) {
      attribute.required = dto.required;
    }

    if (dto.options !== undefined) {
      attribute.options = dto.options;
    }

    if (dto.subCategoryId !== undefined) {
      const subCategory = await this.subCategoryRepository.findOne({
        where: { id: dto.subCategoryId },
      });

      if (!subCategory) {
        throw new NotFoundException('Subcategoría no encontrada');
      }

      attribute.subCategory = subCategory;
    }

    return this.attributeRepository.save(attribute);
  }

  async remove(id: string) {
    const attribute = await this.findOne(id);

    await this.attributeRepository.remove(attribute);

    return {
      message: 'Atributo eliminado correctamente',
    };
  }
}