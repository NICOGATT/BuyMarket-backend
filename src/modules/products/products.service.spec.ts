import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';

import { Category } from '../categories/entities/category.entity';
import { SubCategory } from '../subcategoria/entities/subcategoria.entity';
import { UserRole } from '../users/entity/user.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductAttributeValue } from './entity/product-attributes-value.entity';
import { Product } from './entity/product.entity';
import { ProductMedia } from './product-media/entities/product-media.entity';
import { ProductsService } from './products.service';

type MockRepository<T extends ObjectLiteral = ObjectLiteral> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockRepository = <T extends ObjectLiteral = ObjectLiteral>(): MockRepository<T> => ({
  create: jest.fn(),
  find: jest.fn(),
  findBy: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

describe('ProductsService', () => {
  let service: ProductsService;
  let productRepository: MockRepository<Product>;
  let categoryRepository: MockRepository<Category>;
  let productMediaRepository: MockRepository<ProductMedia>;
  let productAttributeValueRepository: MockRepository<ProductAttributeValue>;
  let subCategoryRepository: MockRepository<SubCategory>;

  const category = {
    id: '8ce13fc5-7868-499e-bc30-9d62a63c8b13',
    name: 'Tecnologia',
  } as Category;

  const seller = {
    id: 'bdb0526e-0ee2-473d-8daa-a6e63c811f8f',
    firstName: 'Nico',
    lastName: 'Gatti',
    email: 'nico@test.com',
    role: UserRole.SELLER,
  };

  const subCategory = {
    id: '207d27a1-6b0f-40a2-9f3f-d77dd72079f0',
    name: 'Notebooks',
    category,
    attributes: [],
    products: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  } as SubCategory;

  const productId = '4d2bfba0-173c-4d60-8e5b-aee88ac25f77';

  const createProductDto: CreateProductDto = {
    title: 'Notebook gamer',
    description: 'Notebook con RTX',
    price: 1500,
    stock: 4,
    seller: seller.id,
    subCategoryId: subCategory.id,
  };

  const productToSave = {
    title: createProductDto.title,
    description: createProductDto.description,
    price: createProductDto.price,
    stock: createProductDto.stock,
    category,
    subCategory,
    seller: {
      id: seller.id,
    },
  } as unknown as Product;

  const savedProduct = {
    ...productToSave,
    id: productId,
  } as Product;

  const product = {
    ...savedProduct,
    seller,
    media: [],
    attributeValues: [],
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  } as unknown as Product;

  beforeEach(async () => {
    productRepository = createMockRepository<Product>();
    categoryRepository = createMockRepository<Category>();
    productMediaRepository = createMockRepository<ProductMedia>();
    productAttributeValueRepository =
      createMockRepository<ProductAttributeValue>();
    subCategoryRepository = createMockRepository<SubCategory>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: productRepository,
        },
        {
          provide: getRepositoryToken(Category),
          useValue: categoryRepository,
        },
        {
          provide: getRepositoryToken(ProductMedia),
          useValue: productMediaRepository,
        },
        {
          provide: getRepositoryToken(ProductAttributeValue),
          useValue: productAttributeValueRepository,
        },
        {
          provide: getRepositoryToken(SubCategory),
          useValue: subCategoryRepository,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  it('deberia estar definido con todos sus repositorios mockeados', () => {
    expect(service).toBeDefined();
    expect(productRepository).toBeDefined();
    expect(categoryRepository).toBeDefined();
    expect(productMediaRepository).toBeDefined();
    expect(productAttributeValueRepository).toBeDefined();
    expect(subCategoryRepository).toBeDefined();
  });

  describe('create', () => {
    it('crea un producto correctamente para un vendedor y subcategoria existentes', async () => {
      subCategoryRepository.findOne?.mockResolvedValue(subCategory);
      productRepository.create?.mockReturnValue(productToSave);
      productRepository.save?.mockResolvedValue(savedProduct);
      productRepository.findOne?.mockResolvedValue(product);

      const result = await service.create(createProductDto);

      expect(subCategoryRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: createProductDto.subCategoryId,
        },
        relations: {
          category: true,
          attributes: true,
        },
      });
      expect(productRepository.create).toHaveBeenCalledWith({
        title: createProductDto.title,
        description: createProductDto.description,
        price: createProductDto.price,
        stock: createProductDto.stock,
        category,
        subCategory,
        seller: {
          id: createProductDto.seller,
        },
      });
      expect(productRepository.save).toHaveBeenCalledWith(productToSave);
      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { id: savedProduct.id },
        relations: {
          category: true,
          subCategory: true,
          media: true,
          attributeValues: {
            attribute: true,
          },
        },
      });
      expect(result).toEqual(product);
    });

    it('lanza NotFoundException si la subcategoria/categoria no existe', async () => {
      subCategoryRepository.findOne?.mockResolvedValue(null);

      await expect(service.create(createProductDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(productRepository.create).not.toHaveBeenCalled();
      expect(productRepository.save).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si falta un atributo obligatorio', async () => {
      const requiredAttribute = {
        id: '5c0f9c97-0970-4770-98c9-68788e458ced',
        name: 'Memoria RAM',
        required: true,
      };

      subCategoryRepository.findOne?.mockResolvedValue({
        ...subCategory,
        attributes: [requiredAttribute],
      });
      productRepository.create?.mockReturnValue(productToSave);
      productRepository.save?.mockResolvedValue(savedProduct);

      await expect(service.create(createProductDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(productAttributeValueRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('devuelve un array de productos', async () => {
      productRepository.find?.mockResolvedValue([product]);

      const result = await service.findAll();

      expect(productRepository.find).toHaveBeenCalledWith({
        relations: {
          category: true,
          subCategory: true,
          media: true,
          attributeValues: {
            attribute: true,
          },
        },
        order: {
          createdAt: 'DESC',
        },
      });
      expect(result).toEqual([product]);
    });
  });

  describe('findOne', () => {
    it('devuelve un producto por id si existe', async () => {
      productRepository.findOne?.mockResolvedValue(product);

      const result = await service.findOne(productId);

      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { id: productId },
        relations: {
          category: true,
          subCategory: true,
          media: true,
          attributeValues: {
            attribute: true,
          },
        },
      });
      expect(result).toEqual(product);
    });

    it('lanza NotFoundException si el producto no existe', async () => {
      productRepository.findOne?.mockResolvedValue(null);

      await expect(service.findOne(productId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('actualiza un producto y devuelve el producto actualizado', async () => {
      const updateProductDto: UpdateProductDto = {
        title: 'Notebook gamer actualizada',
        price: 1400,
        seller: seller.id,
      };
      const updatedProduct = {
        ...product,
        title: updateProductDto.title,
        price: updateProductDto.price,
      } as Product;

      productRepository.update?.mockResolvedValue({ affected: 1 });
      productRepository.findOne?.mockResolvedValue(updatedProduct);

      const result = await service.update(productId, updateProductDto);

      expect(productRepository.update).toHaveBeenCalledWith(productId, {
        title: updateProductDto.title,
        price: updateProductDto.price,
        seller: {
          id: seller.id,
        },
      });
      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { id: productId },
        relations: {
          category: true,
          subCategory: true,
          media: true,
          attributeValues: {
            attribute: true,
          },
        },
      });
      expect(result).toEqual(updatedProduct);
    });

    it('lanza NotFoundException si el producto actualizado no existe', async () => {
      productRepository.update?.mockResolvedValue({ affected: 0 });
      productRepository.findOne?.mockResolvedValue(null);

      await expect(service.update(productId, { title: 'Nuevo titulo' })).rejects
        .toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('elimina un producto existente con remove', async () => {
      productRepository.findOne?.mockResolvedValue(product);
      productRepository.remove?.mockResolvedValue(product);

      const result = await service.remove(productId);

      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { id: productId },
        relations: {
          category: true,
          subCategory: true,
          media: true,
          attributeValues: {
            attribute: true,
          },
        },
      });
      expect(productRepository.remove).toHaveBeenCalledWith(product);
      expect(result).toEqual(product);
    });

    it('lanza NotFoundException si el producto a eliminar no existe', async () => {
      productRepository.findOne?.mockResolvedValue(null);

      await expect(service.remove(productId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(productRepository.remove).not.toHaveBeenCalled();
    });
  });
});
