import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';

import { Category } from '../categories/entities/category.entity';
import {
  AttributeAppliesTo,
  AttributeType,
  AttributeUsage,
  SubCategoryAttribute,
} from './subcategoria-attributes/entities/subcategoria-attribute.entity';
import { SubCategory } from './entities/subcategoria.entity';
import { SubCategoriesService } from './subcategoria.service';

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

describe('SubCategoriesService', () => {
  let service: SubCategoriesService;
  let subCategoryRepository: MockRepository<SubCategory>;
  let categoryRepository: MockRepository<Category>;

  const category = {
    id: 'category-1',
    name: 'Mascotas',
  } as Category;

  const subCategory = {
    id: 'subcategory-1',
    name: 'Abrigos para perro',
    category,
    attributes: [
      {
        id: 'attribute-1',
        name: 'Talle',
        type: AttributeType.SELECT,
        required: true,
        appliesTo: undefined,
        appliesToVariant: true,
        usage: AttributeUsage.VARIANT_ATTRIBUTE,
        options: ['S', 'M'],
      },
      {
        id: 'attribute-2',
        name: 'Marca',
        type: AttributeType.TEXT,
        required: false,
        appliesTo: undefined,
        appliesToVariant: false,
        usage: AttributeUsage.PRODUCT_ATTRIBUTE,
      },
    ] as unknown as SubCategoryAttribute[],
  } as SubCategory;

  beforeEach(async () => {
    subCategoryRepository = createMockRepository<SubCategory>();
    categoryRepository = createMockRepository<Category>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubCategoriesService,
        {
          provide: getRepositoryToken(SubCategory),
          useValue: subCategoryRepository,
        },
        {
          provide: getRepositoryToken(Category),
          useValue: categoryRepository,
        },
      ],
    }).compile();

    service = module.get<SubCategoriesService>(SubCategoriesService);
  });

  it('deberia estar definido con sus dependencias mockeadas', () => {
    expect(service).toBeDefined();
  });

  it('findOne devuelve atributos con appliesTo normalizado', async () => {
    subCategoryRepository.findOne?.mockResolvedValue({
      ...subCategory,
      attributes: subCategory.attributes.map(attribute => ({ ...attribute })),
    });

    const result = await service.findOne(subCategory.id);

    expect(subCategoryRepository.findOne).toHaveBeenCalledWith({
      where: { id: subCategory.id },
      relations: {
        category: true,
        attributes: true,
      },
    });
    expect(result.attributes).toEqual([
      expect.objectContaining({
        name: 'Talle',
        appliesTo: AttributeAppliesTo.VARIANT,
        appliesToVariant: true,
        usage: AttributeUsage.VARIANT_ATTRIBUTE,
      }),
      expect.objectContaining({
        name: 'Marca',
        appliesTo: AttributeAppliesTo.PRODUCT,
        appliesToVariant: false,
        usage: AttributeUsage.PRODUCT_ATTRIBUTE,
      }),
    ]);
  });

  it('findAll normaliza appliesTo en cada subcategoria', async () => {
    subCategoryRepository.find?.mockResolvedValue([
      {
        ...subCategory,
        attributes: subCategory.attributes.map(attribute => ({ ...attribute })),
      },
    ]);

    const result = await service.findAll();

    expect(result[0].attributes[0]).toEqual(
      expect.objectContaining({
        name: 'Talle',
        appliesTo: AttributeAppliesTo.VARIANT,
      }),
    );
  });

  it('findByCategory normaliza appliesTo en cada subcategoria', async () => {
    subCategoryRepository.find?.mockResolvedValue([
      {
        ...subCategory,
        attributes: subCategory.attributes.map(attribute => ({ ...attribute })),
      },
    ]);

    const result = await service.findByCategory(category.id);

    expect(subCategoryRepository.find).toHaveBeenCalledWith({
      where: {
        category: {
          id: category.id,
        },
      },
      relations: {
        category: true,
        attributes: true,
      },
    });
    expect(result[0].attributes[0]).toEqual(
      expect.objectContaining({
        name: 'Talle',
        appliesTo: AttributeAppliesTo.VARIANT,
      }),
    );
  });

  it('findOne lanza NotFoundException si la subcategoria no existe', async () => {
    subCategoryRepository.findOne?.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
