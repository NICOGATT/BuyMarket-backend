import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';

import { Category } from '../categories/entities/category.entity';
import {
  AttributeAppliesTo,
  AttributeType,
  AttributeUsage,
} from '../subcategoria/subcategoria-attributes/entities/subcategoria-attribute.entity';
import { SubCategory } from '../subcategoria/entities/subcategoria.entity';
import { UserRole } from '../users/entity/user.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductAttributeValue } from './entity/product-attributes-value.entity';
import { ProductVariantAttributeValue } from './entity/product-variant-attribute-value.entity';
import { ProductVariant } from './entity/product-variant.entity';
import { Product, ProductApprovalStatus } from './entity/product.entity';
import { ProductMedia } from './product-media/entities/product-media.entity';
import { ProductsService } from './products.service';
import { UserAddress } from '../user-address/entities/user-address.entity';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';

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
  delete: jest.fn(),
});

describe('ProductsService', () => {
  let service: ProductsService;
  let productRepository: MockRepository<Product>;
  let categoryRepository: MockRepository<Category>;
  let productMediaRepository: MockRepository<ProductMedia>;
  let productAttributeValueRepository: MockRepository<ProductAttributeValue>;
  let productVariantRepository: MockRepository<ProductVariant>;
  let productVariantAttributeValueRepository: MockRepository<ProductVariantAttributeValue>;
  let subCategoryRepository: MockRepository<SubCategory>;
  let userAddressRepository: MockRepository<UserAddress>;

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
    productVariantRepository = createMockRepository<ProductVariant>();
    productVariantAttributeValueRepository =
      createMockRepository<ProductVariantAttributeValue>();
    subCategoryRepository = createMockRepository<SubCategory>();
    userAddressRepository = createMockRepository<UserAddress>();

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
          provide: getRepositoryToken(ProductVariant),
          useValue: productVariantRepository,
        },
        {
          provide: getRepositoryToken(ProductVariantAttributeValue),
          useValue: productVariantAttributeValueRepository,
        },
        {
          provide: getRepositoryToken(SubCategory),
          useValue: subCategoryRepository,
        },
        {
          provide: getRepositoryToken(UserAddress),
          useValue: userAddressRepository,
        },
        {
          provide: CloudinaryService,
          useValue: {
            uploadFile: jest.fn(),
          },
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
    expect(productVariantAttributeValueRepository).toBeDefined();
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
      expect(productRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: createProductDto.title,
          description: createProductDto.description,
          price: createProductDto.price,
          stock: createProductDto.stock,
          category,
          subCategory,
          seller: {
            id: createProductDto.seller,
          },
        }),
      );
      expect(productRepository.save).toHaveBeenCalledWith(productToSave);
      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { id: savedProduct.id },
        relations: {
          category: true,
          subCategory: true,
          seller: true,
          pickupAddress: true,
          media: true,
          variants: {
            attributes: {
              attribute: true,
            },
          },
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
        usage: AttributeUsage.PRODUCT_ATTRIBUTE,
        appliesTo: AttributeAppliesTo.PRODUCT,
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

    it('rechaza atributos select con valores fuera de options', async () => {
      const brandAttribute = {
        id: '5c0f9c97-0970-4770-98c9-68788e458ced',
        name: 'Marca',
        type: AttributeType.SELECT,
        usage: AttributeUsage.PRODUCT_ATTRIBUTE,
        appliesTo: AttributeAppliesTo.PRODUCT,
        required: false,
        options: ['Nike', 'Adidas'],
      };

      subCategoryRepository.findOne?.mockResolvedValue({
        ...subCategory,
        attributes: [brandAttribute],
      });
      productRepository.create?.mockReturnValue(productToSave);
      productRepository.save?.mockResolvedValue(savedProduct);

      await expect(
        service.create({
          ...createProductDto,
          attributes: [
            {
              attributeId: brandAttribute.id,
              value: 'Puma',
            },
          ],
        }),
      ).rejects.toThrow('El valor Puma no es valido para Marca');
      expect(productAttributeValueRepository.save).not.toHaveBeenCalled();
    });

    it('rechaza atributos de variante enviados como atributos generales', async () => {
      const variantAttribute = {
        id: 'length-attribute',
        name: 'Largo de lomo',
        type: AttributeType.TEXT,
        usage: AttributeUsage.VARIANT_ATTRIBUTE,
        appliesTo: AttributeAppliesTo.VARIANT,
        required: false,
      };

      subCategoryRepository.findOne?.mockResolvedValue({
        ...subCategory,
        attributes: [variantAttribute],
      });
      productRepository.create?.mockReturnValue(productToSave);
      productRepository.save?.mockResolvedValue(savedProduct);

      await expect(
        service.create({
          ...createProductDto,
          attributes: [
            {
              attributeId: variantAttribute.id,
              value: '20cm',
            },
          ],
        }),
      ).rejects.toThrow('El atributo Largo de lomo se usa para variantes');
      expect(productAttributeValueRepository.save).not.toHaveBeenCalled();
    });

    it('rechaza atributos de producto enviados dentro de variantes', async () => {
      const productAttribute = {
        id: 'brand-attribute',
        name: 'Marca',
        type: AttributeType.TEXT,
        usage: AttributeUsage.PRODUCT_ATTRIBUTE,
        appliesTo: AttributeAppliesTo.PRODUCT,
        required: false,
      };

      subCategoryRepository.findOne?.mockResolvedValue({
        ...subCategory,
        attributes: [productAttribute],
      });
      productRepository.create?.mockReturnValue(productToSave);
      productRepository.save?.mockResolvedValue(savedProduct);
      productVariantRepository.create?.mockImplementation(data => data);
      productVariantRepository.save?.mockResolvedValue({
        id: 'variant-1',
      });

      await expect(
        service.create({
          ...createProductDto,
          variants: [
            {
              size: 'M',
              price: 1200,
              stock: 2,
              attributes: [
                {
                  attributeId: productAttribute.id,
                  value: 'Nike',
                },
              ],
            },
          ],
        }),
      ).rejects.toThrow('El atributo Marca no se usa para variantes');
      expect(productVariantAttributeValueRepository.save).not.toHaveBeenCalled();
    });

    it('rechaza talle o color de variante fuera de options', async () => {
      const sizeAttribute = {
        id: 'size-attribute',
        name: 'Talle',
        type: AttributeType.SELECT,
        usage: AttributeUsage.VARIANT_SIZE,
        appliesTo: AttributeAppliesTo.VARIANT,
        required: true,
        options: ['S', 'M', 'L'],
      };
      const colorAttribute = {
        id: 'color-attribute',
        name: 'Color',
        type: AttributeType.SELECT,
        usage: AttributeUsage.VARIANT_COLOR,
        appliesTo: AttributeAppliesTo.VARIANT,
        required: true,
        options: ['Negro', 'Blanco'],
      };

      subCategoryRepository.findOne?.mockResolvedValue({
        ...subCategory,
        attributes: [sizeAttribute, colorAttribute],
      });

      await expect(
        service.create({
          ...createProductDto,
          variants: [
            {
              size: 'XL',
              color: 'Rojo',
              price: 1200,
              stock: 2,
            },
          ],
        }),
      ).rejects.toThrow('El talle XL no es valido para esta subcategoria');
      expect(productRepository.create).not.toHaveBeenCalled();
    });

    it('acepta atributos descriptivos y variantes validas', async () => {
      const brandAttribute = {
        id: 'brand-attribute',
        name: 'Marca',
        type: AttributeType.SELECT,
        usage: AttributeUsage.PRODUCT_ATTRIBUTE,
        appliesTo: AttributeAppliesTo.PRODUCT,
        required: true,
        options: ['Nike', 'Adidas'],
      };
      const sizeAttribute = {
        id: 'size-attribute',
        name: 'Talle',
        type: AttributeType.SELECT,
        usage: AttributeUsage.VARIANT_SIZE,
        appliesTo: AttributeAppliesTo.VARIANT,
        required: true,
        options: ['S', 'M', 'L'],
      };
      const colorAttribute = {
        id: 'color-attribute',
        name: 'Color',
        type: AttributeType.SELECT,
        usage: AttributeUsage.VARIANT_COLOR,
        appliesTo: AttributeAppliesTo.VARIANT,
        required: true,
        options: ['Negro', 'Blanco'],
      };

      subCategoryRepository.findOne?.mockResolvedValue({
        ...subCategory,
        attributes: [brandAttribute, sizeAttribute, colorAttribute],
      });
      productRepository.create?.mockReturnValue(productToSave);
      productRepository.save?.mockResolvedValue(savedProduct);
      productRepository.findOne?.mockResolvedValue(product);
      productAttributeValueRepository.create?.mockImplementation(data => data);
      productVariantRepository.create?.mockImplementation(data => data);

      await service.create({
        ...createProductDto,
        attributes: [
          {
            attributeId: brandAttribute.id,
            value: 'Nike',
          },
        ],
        variants: [
          {
            size: 'M',
            color: 'Negro',
            price: 1200,
            stock: 2,
          },
        ],
      });

      expect(productAttributeValueRepository.create).toHaveBeenCalledWith({
        value: 'Nike',
        product: savedProduct,
        attribute: brandAttribute,
      });
      expect(productVariantRepository.create).toHaveBeenCalledWith({
        size: 'M',
        color: 'Negro',
        price: 1200,
        stock: 2,
        isActive: true,
        product: savedProduct,
      });
    });

    it('crea variantes por talle cuando se envian en el producto', async () => {
      const dto: CreateProductDto = {
        ...createProductDto,
        variants: [
          {
            size: 'M',
            color: 'Negro',
            price: 1200,
            stock: 3,
          },
          {
            size: 'XL',
            price: 1500,
            stock: 2,
            isActive: false,
          },
        ],
      };
      const variantEntities = dto.variants!.map(variant => ({
        size: variant.size,
        color: variant.color ?? null,
        price: variant.price,
        stock: variant.stock,
        isActive: variant.isActive ?? true,
        product: savedProduct,
      }));

      subCategoryRepository.findOne?.mockResolvedValue(subCategory);
      productRepository.create?.mockReturnValue(productToSave);
      productRepository.save?.mockResolvedValue(savedProduct);
      productRepository.findOne?.mockResolvedValue({
        ...product,
        variants: variantEntities,
      });
      productVariantRepository.create?.mockImplementation(data => data);
      productVariantRepository.save?.mockImplementation(data =>
        Promise.resolve(data),
      );

      await service.create(dto);

      expect(productVariantRepository.create).toHaveBeenCalledTimes(2);
      expect(productVariantRepository.create).toHaveBeenCalledWith({
        size: 'M',
        color: 'Negro',
        price: 1200,
        stock: 3,
        isActive: true,
        product: savedProduct,
      });
      expect(productVariantRepository.save).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          size: 'M',
          color: 'Negro',
          price: 1200,
          stock: 3,
          isActive: true,
          product: savedProduct,
        }),
      );
      expect(productVariantRepository.save).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          size: 'XL',
          color: null,
          price: 1500,
          stock: 2,
          isActive: false,
          product: savedProduct,
        }),
      );
    });

    it('guarda atributos dinamicos propios para cada variante', async () => {
      const lengthAttribute = {
        id: 'length-attribute',
        name: 'Largo de lomo',
        type: AttributeType.TEXT,
        required: true,
        appliesTo: AttributeAppliesTo.VARIANT,
        appliesToVariant: true,
        usage: AttributeUsage.VARIANT_ATTRIBUTE,
      };
      const dto: CreateProductDto = {
        ...createProductDto,
        variants: [
          {
            size: 'S',
            color: 'Rosa',
            price: 40000,
            stock: 2,
            attributes: [
              {
                attributeId: lengthAttribute.id,
                value: '20cm',
              },
            ],
          },
          {
            size: 'M',
            color: 'Rosa',
            price: 42000,
            stock: 2,
            attributes: [
              {
                attributeId: lengthAttribute.id,
                value: '25cm',
              },
            ],
          },
        ],
      };
      let variantId = 0;

      subCategoryRepository.findOne?.mockResolvedValue({
        ...subCategory,
        attributes: [lengthAttribute],
      });
      productRepository.create?.mockReturnValue(productToSave);
      productRepository.save?.mockResolvedValue(savedProduct);
      productRepository.findOne?.mockResolvedValue(product);
      productVariantRepository.create?.mockImplementation(data => data);
      productVariantRepository.save?.mockImplementation(data =>
        Promise.resolve({
          ...data,
          id: `variant-${++variantId}`,
        }),
      );
      productVariantAttributeValueRepository.create?.mockImplementation(
        data => data,
      );

      await service.create(dto);

      expect(productVariantAttributeValueRepository.create).toHaveBeenCalledWith({
        value: '20cm',
        variant: expect.objectContaining({ id: 'variant-1' }),
        attribute: lengthAttribute,
      });
      expect(productVariantAttributeValueRepository.create).toHaveBeenCalledWith({
        value: '25cm',
        variant: expect.objectContaining({ id: 'variant-2' }),
        attribute: lengthAttribute,
      });
      expect(productVariantAttributeValueRepository.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('findAll', () => {
    it('devuelve un array de productos', async () => {
      productRepository.find?.mockResolvedValue([product]);

      const result = await service.findAll();

      expect(productRepository.find).toHaveBeenCalledWith({
        where: {
          isActive: true,
          approvalStatus: ProductApprovalStatus.APPROVED,
        },
        relations: {
          category: true,
          subCategory: true,
          seller: true,
          pickupAddress: true,
          media: true,
          variants: {
            attributes: {
              attribute: true,
            },
          },
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
          seller: true,
          pickupAddress: true,
          media: true,
          variants: {
            attributes: {
              attribute: true,
            },
          },
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
          seller: true,
          pickupAddress: true,
          media: true,
          variants: {
            attributes: {
              attribute: true,
            },
          },
          attributeValues: {
            attribute: true,
          },
        },
      });
      expect(result).toEqual(updatedProduct);
    });

    it('mapea subCategoryId y no lo envia como propiedad directa de Product', async () => {
      const updateProductDto: UpdateProductDto = {
        title: 'Notebook gamer actualizada',
        subCategoryId: subCategory.id,
        pickupAddressId: '8c8ad2ab-45e8-4be7-ae17-e60a1446f2da',
        mediaIds: ['d09a2b9d-1bc8-4aae-89d3-d652d09b9f10'],
        attributes: [
          {
            attributeId: '5c0f9c97-0970-4770-98c9-68788e458ced',
            value: 'Nike',
          },
        ],
      };

      productRepository.update?.mockResolvedValue({ affected: 1 });
      productRepository.findOne?.mockResolvedValue(product);

      await service.update(productId, updateProductDto);

      expect(productRepository.update).toHaveBeenCalledWith(productId, {
        title: updateProductDto.title,
        subCategory: {
          id: subCategory.id,
        },
        pickupAddress: {
          id: updateProductDto.pickupAddressId,
        },
      });
      expect(productRepository.update).not.toHaveBeenCalledWith(
        productId,
        expect.objectContaining({
          subCategoryId: expect.any(String),
          mediaIds: expect.any(Array),
          attributes: expect.any(Array),
        }),
      );
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
          seller: true,
          pickupAddress: true,
          media: true,
          variants: {
            attributes: {
              attribute: true,
            },
          },
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

