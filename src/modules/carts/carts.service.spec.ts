import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';

import { ProductVariant } from '../products/entity/product-variant.entity';
import { Product } from '../products/entity/product.entity';
import { User } from '../users/entity/user.entity';
import { CartsService } from './carts.service';
import { CartItem } from './entities/cart-item.entity/cart-item.entity';
import { Cart } from './entities/cart.entity';

type MockRepository<T extends ObjectLiteral = any> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockRepository = <T extends ObjectLiteral = any>(): MockRepository<T> => ({
  create: jest.fn(data => data),
  delete: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
  save: jest.fn(data => data),
});

describe('CartsService', () => {
  let service: CartsService;
  let cartsRepository: MockRepository<Cart>;
  let cartItemsRepository: MockRepository<CartItem>;
  let productsRepository: MockRepository<Product>;
  let productVariantsRepository: MockRepository<ProductVariant>;
  let usersRepository: MockRepository<User>;

  beforeEach(async () => {
    cartsRepository = createMockRepository<Cart>();
    cartItemsRepository = createMockRepository<CartItem>();
    productsRepository = createMockRepository<Product>();
    productVariantsRepository = createMockRepository<ProductVariant>();
    usersRepository = createMockRepository<User>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartsService,
        {
          provide: getRepositoryToken(Cart),
          useValue: cartsRepository,
        },
        {
          provide: getRepositoryToken(CartItem),
          useValue: cartItemsRepository,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: productsRepository,
        },
        {
          provide: getRepositoryToken(ProductVariant),
          useValue: productVariantsRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: usersRepository,
        },
      ],
    }).compile();

    service = module.get<CartsService>(CartsService);
  });

  it('deberia estar definido con sus dependencias mockeadas', () => {
    expect(service).toBeDefined();
  });

  it('exige variantId si el producto tiene variantes activas', async () => {
    const cart = { id: 'cart-1', items: [] } as Cart;
    const product = {
      id: 'product-1',
      variants: [{ id: 'variant-1', isActive: true }],
    } as Product;

    cartsRepository.findOne?.mockResolvedValue(cart);
    productsRepository.findOne?.mockResolvedValue(product);

    await expect(
      service.addProduct('user-1', product.id, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('usa el precio de la variante seleccionada como unitPrice', async () => {
    const cart = { id: 'cart-1', items: [] } as Cart;
    const product = {
      id: 'product-1',
      price: 1000,
      variants: [{ id: 'variant-1', isActive: true }],
    } as Product;
    const variant = {
      id: 'variant-1',
      size: 'M',
      price: 1500,
      stock: 4,
      isActive: true,
      product,
    } as ProductVariant;

    cartsRepository.findOne?.mockResolvedValue(cart);
    productsRepository.findOne?.mockResolvedValue(product);
    productVariantsRepository.findOne?.mockResolvedValue(variant);
    cartItemsRepository.findOne?.mockResolvedValue(null);

    await service.addProduct('user-1', product.id, 2, variant.id);

    expect(cartItemsRepository.create).toHaveBeenCalledWith({
      cart,
      product,
      variant,
      quantity: 2,
      unitPrice: Number(variant.price),
    });
    expect(cartItemsRepository.save).toHaveBeenCalled();
  });

  it('mantiene el flujo anterior para productos sin variantes', async () => {
    const cart = { id: 'cart-1', items: [] } as Cart;
    const product = {
      id: 'product-1',
      price: 1000,
      variants: [],
    } as Product;

    cartsRepository.findOne?.mockResolvedValue(cart);
    productsRepository.findOne?.mockResolvedValue(product);
    cartItemsRepository.findOne?.mockResolvedValue(null);

    await service.addProduct('user-1', product.id, 1);

    expect(cartItemsRepository.create).toHaveBeenCalledWith({
      cart,
      product,
      variant: null,
      quantity: 1,
      unitPrice: Number(product.price),
    });
  });
});
