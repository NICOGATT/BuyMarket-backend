import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  AttributeAppliesTo,
  AttributeUsage,
  SubCategoryAttribute,
} from './entities/subcategoria-attribute.entity';
import {
  getDefaultUsageForAppliesTo,
  normalizeSubCategoryAttributeAppliesTo,
  normalizeSubCategoryAttributesAppliesTo,
} from './attribute-applies-to.util';
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

  private normalizeAppliesTo(attribute: SubCategoryAttribute) {
    return normalizeSubCategoryAttributeAppliesTo(attribute);
  }

  private normalizeAppliesToList(attributes: SubCategoryAttribute[]) {
    return normalizeSubCategoryAttributesAppliesTo(attributes);
  }

  private assertAppliesTo(appliesTo?: AttributeAppliesTo) {
    if (!appliesTo) {
      throw new BadRequestException('appliesTo es obligatorio');
    }
  }

  private getUsage(appliesTo: AttributeAppliesTo, usage?: AttributeUsage) {
    return usage ?? getDefaultUsageForAppliesTo(appliesTo);
  }

  private assertUsageMatchesAppliesTo(
    appliesTo: AttributeAppliesTo,
    usage: AttributeUsage,
  ) {
    if (
      appliesTo === AttributeAppliesTo.PRODUCT &&
      usage !== AttributeUsage.PRODUCT_ATTRIBUTE
    ) {
      throw new BadRequestException(
        'Los atributos de producto solo pueden usar PRODUCT_ATTRIBUTE',
      );
    }

    if (
      appliesTo === AttributeAppliesTo.VARIANT &&
      usage === AttributeUsage.PRODUCT_ATTRIBUTE
    ) {
      throw new BadRequestException(
        'Los atributos de variante no pueden usar PRODUCT_ATTRIBUTE',
      );
    }
  }

  async create(dto: CreateSubCategoryAttributeDto) {
    this.assertAppliesTo(dto.appliesTo);
    const usage = this.getUsage(dto.appliesTo, dto.usage);
    this.assertUsageMatchesAppliesTo(dto.appliesTo, usage);

    const subCategory = await this.subCategoryRepository.findOne({
      where: { id: dto.subCategoryId },
    });

    if (!subCategory) {
      throw new NotFoundException('Subcategoria no encontrada');
    }

    const attribute = this.attributeRepository.create({
      name: dto.name,
      type: dto.type,
      required: dto.required ?? false,
      appliesTo: dto.appliesTo,
      appliesToVariant: dto.appliesTo === AttributeAppliesTo.VARIANT,
      usage,
      options: dto.options,
      subCategory,
    });

    return this.normalizeAppliesTo(await this.attributeRepository.save(attribute));
  }

  async findAll() {
    const attributes = await this.attributeRepository.find({
      relations: {
        subCategory: true,
      },
    });

    return this.normalizeAppliesToList(attributes);
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

    return this.normalizeAppliesTo(attribute);
  }

  async findBySubCategory(subCategoryId: string) {
    const attributes = await this.attributeRepository.find({
      where: {
        subCategory: {
          id: subCategoryId,
        },
      },
      relations: {
        subCategory: true,
      },
    });

    return this.normalizeAppliesToList(attributes);
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

    if (dto.appliesTo !== undefined) {
      attribute.appliesTo = dto.appliesTo;
      attribute.appliesToVariant = dto.appliesTo === AttributeAppliesTo.VARIANT;
    }

    attribute.usage = this.getUsage(attribute.appliesTo, dto.usage);
    this.assertUsageMatchesAppliesTo(attribute.appliesTo, attribute.usage);

    if (dto.options !== undefined) {
      attribute.options = dto.options;
    }

    if (dto.subCategoryId !== undefined) {
      const subCategory = await this.subCategoryRepository.findOne({
        where: { id: dto.subCategoryId },
      });

      if (!subCategory) {
        throw new NotFoundException('Subcategoria no encontrada');
      }

      attribute.subCategory = subCategory;
    }

    return this.normalizeAppliesTo(await this.attributeRepository.save(attribute));
  }

  async remove(id: string) {
    const attribute = await this.findOne(id);

    await this.attributeRepository.remove(attribute);

    return {
      message: 'Atributo eliminado correctamente',
    };
  }
}
