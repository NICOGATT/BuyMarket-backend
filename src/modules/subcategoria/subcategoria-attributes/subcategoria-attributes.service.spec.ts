import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';

import { SubCategory } from '../entities/subcategoria.entity';
import {
  AttributeAppliesTo,
  AttributeType,
  AttributeUsage,
  SubCategoryAttribute,
} from './entities/subcategoria-attribute.entity';
import { SubCategoryAttributesService } from './subcategoria-attributes.service';

type MockRepository<T extends ObjectLiteral = any> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockRepository = <T extends ObjectLiteral = any>(): MockRepository<T> => ({
  create: jest.fn(data => data),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
  save: jest.fn(data => data),
});

describe('SubCategoryAttributesService', () => {
  let service: SubCategoryAttributesService;
  let attributeRepository: MockRepository<SubCategoryAttribute>;
  let subCategoryRepository: MockRepository<SubCategory>;

  beforeEach(async () => {
    attributeRepository = createMockRepository<SubCategoryAttribute>();
    subCategoryRepository = createMockRepository<SubCategory>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubCategoryAttributesService,
        {
          provide: getRepositoryToken(SubCategoryAttribute),
          useValue: attributeRepository,
        },
        {
          provide: getRepositoryToken(SubCategory),
          useValue: subCategoryRepository,
        },
      ],
    }).compile();

    service = module.get<SubCategoryAttributesService>(
      SubCategoryAttributesService,
    );
  });

  it('deberia estar definido con sus dependencias mockeadas', () => {
    expect(service).toBeDefined();
  });

  it('crea un atributo de variante guardando appliesTo, options y usage', async () => {
    const subCategory = { id: 'subcategory-1' } as SubCategory;
    const dto = {
      name: 'Talle',
      type: AttributeType.SELECT,
      required: true,
      appliesTo: AttributeAppliesTo.VARIANT,
      usage: AttributeUsage.VARIANT_SIZE,
      options: ['S', 'M', 'L'],
      subCategoryId: subCategory.id,
    };

    subCategoryRepository.findOne?.mockResolvedValue(subCategory);
    attributeRepository.save?.mockImplementation(data => Promise.resolve(data));

    const result = await service.create(dto);

    expect(attributeRepository.create).toHaveBeenCalledWith({
      name: dto.name,
      type: dto.type,
      required: true,
      appliesTo: AttributeAppliesTo.VARIANT,
      appliesToVariant: true,
      usage: AttributeUsage.VARIANT_SIZE,
      options: dto.options,
      subCategory,
    });
    expect(result).toEqual(
      expect.objectContaining({
        options: dto.options,
        appliesTo: AttributeAppliesTo.VARIANT,
        appliesToVariant: true,
        usage: AttributeUsage.VARIANT_SIZE,
      }),
    );
  });

  it('crea un atributo de producto con appliesToVariant en false', async () => {
    const subCategory = { id: 'subcategory-1' } as SubCategory;

    subCategoryRepository.findOne?.mockResolvedValue(subCategory);

    await service.create({
      name: 'Marca',
      type: AttributeType.TEXT,
      appliesTo: AttributeAppliesTo.PRODUCT,
      subCategoryId: subCategory.id,
    });

    expect(attributeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appliesTo: AttributeAppliesTo.PRODUCT,
        appliesToVariant: false,
        usage: AttributeUsage.PRODUCT_ATTRIBUTE,
      }),
    );
  });

  it('usa VARIANT_ATTRIBUTE como usage por defecto para atributos de variante', async () => {
    const subCategory = { id: 'subcategory-1' } as SubCategory;

    subCategoryRepository.findOne?.mockResolvedValue(subCategory);

    await service.create({
      name: 'Largo de lomo',
      type: AttributeType.TEXT,
      appliesTo: AttributeAppliesTo.VARIANT,
      subCategoryId: subCategory.id,
    });

    expect(attributeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appliesTo: AttributeAppliesTo.VARIANT,
        appliesToVariant: true,
        usage: AttributeUsage.VARIANT_ATTRIBUTE,
      }),
    );
  });

  it('rechaza usage de variante para atributos de producto', async () => {
    await expect(
      service.create({
        name: 'Marca',
        type: AttributeType.TEXT,
        appliesTo: AttributeAppliesTo.PRODUCT,
        usage: AttributeUsage.VARIANT_COLOR,
        subCategoryId: 'subcategory-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(subCategoryRepository.findOne).not.toHaveBeenCalled();
    expect(attributeRepository.create).not.toHaveBeenCalled();
  });

  it('rechaza PRODUCT_ATTRIBUTE para atributos de variante', async () => {
    await expect(
      service.create({
        name: 'Largo de lomo',
        type: AttributeType.TEXT,
        appliesTo: AttributeAppliesTo.VARIANT,
        usage: AttributeUsage.PRODUCT_ATTRIBUTE,
        subCategoryId: 'subcategory-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(subCategoryRepository.findOne).not.toHaveBeenCalled();
    expect(attributeRepository.create).not.toHaveBeenCalled();
  });

  it('rechaza crear un atributo sin appliesTo', async () => {
    await expect(
      service.create({
        name: 'Marca',
        type: AttributeType.TEXT,
        subCategoryId: 'subcategory-1',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(subCategoryRepository.findOne).not.toHaveBeenCalled();
    expect(attributeRepository.create).not.toHaveBeenCalled();
  });

  it('lanza NotFoundException si la subcategoria no existe', async () => {
    subCategoryRepository.findOne?.mockResolvedValue(null);

    await expect(
      service.create({
        name: 'Marca',
        type: AttributeType.TEXT,
        appliesTo: AttributeAppliesTo.PRODUCT,
        subCategoryId: 'missing',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
