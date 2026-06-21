import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';

import { Cart } from '../carts/entities/cart.entity';
import { CartItem } from '../carts/entities/cart-item.entity/cart-item.entity';
import { Payment, PaymentStatus } from '../payments/entity/payment.entity';
import { Product } from '../products/entity/product.entity';
import { User } from '../users/entity/user.entity';
import { Order, OrderStatus, PaymentMethod } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrdersService } from './orders.service';

type MockRepository<T extends ObjectLiteral = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const createMockRepository = <T extends ObjectLiteral = any>(): MockRepository<T> => ({
  create: jest.fn((data) => data),
  delete: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn((data) => data),
});

describe('OrdersService', () => {
  let service: OrdersService;
  let ordersRepository: MockRepository<Order>;
  let orderItemsRepository: MockRepository<OrderItem>;
  let cartsRepository: MockRepository<Cart>;
  let cartItemsRepository: MockRepository<CartItem>;
  let productsRepository: MockRepository<Product>;
  let usersRepository: MockRepository<User>;
  let paymentsRepository: MockRepository<Payment>;

  beforeEach(async () => {
    ordersRepository = createMockRepository<Order>();
    orderItemsRepository = createMockRepository<OrderItem>();
    cartsRepository = createMockRepository<Cart>();
    cartItemsRepository = createMockRepository<CartItem>();
    productsRepository = createMockRepository<Product>();
    usersRepository = createMockRepository<User>();
    paymentsRepository = createMockRepository<Payment>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Order),
          useValue: ordersRepository,
        },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: orderItemsRepository,
        },
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
          provide: getRepositoryToken(User),
          useValue: usersRepository,
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: paymentsRepository,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const values: Record<string, string> = {
                TRANSFER_ALIAS: 'buymarket.alias',
                TRANSFER_CBU: '0000000000000000000000',
              };

              return values[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('deberia estar definido con sus dependencias mockeadas', () => {
    expect(service).toBeDefined();
  });

  it('crea una orden con pago pendiente y devuelve los datos de transferencia', async () => {
    const user = { id: 'buyer-1' } as User;
    const product = {
      id: 'product-1',
      title: 'Teclado',
      stock: 5,
    } as Product;
    const cart = {
      id: 'cart-1',
      items: [
        {
          product,
          quantity: 2,
          unitPrice: 1000,
        },
      ],
    } as Cart;
    const savedOrder = {
      id: 'order-1',
      buyer: user,
      total: 2000,
      status: OrderStatus.PENDING,
      deliveryAddress: 'Calle 123',
      paymentMethod: PaymentMethod.TRANSFER,
    } as Order;
    const orderWithRelations = {
      ...savedOrder,
      items: [],
      payment: {
        id: 'payment-1',
        method: PaymentMethod.TRANSFER,
        status: PaymentStatus.PENDING,
        amount: 2000,
        order: savedOrder,
        createdAt: new Date(),
      },
    } as Order;

    usersRepository.findOne?.mockResolvedValue(user);
    cartsRepository.findOne?.mockResolvedValue(cart);
    ordersRepository.save?.mockResolvedValue(savedOrder);
    ordersRepository.findOne?.mockResolvedValue(orderWithRelations);
    orderItemsRepository.save?.mockResolvedValue([]);
    productsRepository.save?.mockResolvedValue(product);
    cartItemsRepository.delete?.mockResolvedValue({ affected: 1 });
    paymentsRepository.save?.mockImplementation((payment) =>
      Promise.resolve(payment),
    );

    const result = await service.checkout(user.id, {
      deliveryAddress: 'Calle 123',
      paymentMethod: PaymentMethod.TRANSFER,
    });

    expect(paymentsRepository.create).toHaveBeenCalledWith({
      method: PaymentMethod.TRANSFER,
      status: PaymentStatus.PENDING,
      amount: 2000,
      order: savedOrder,
    });
    expect(paymentsRepository.save).toHaveBeenCalled();
    expect(result).toMatchObject({
      id: savedOrder.id,
      status: OrderStatus.PENDING,
      transferInfo: {
        alias: 'buymarket.alias',
        cbu: '0000000000000000000000',
        amount: 2000,
      },
      message: 'Estamos chequeando la transferencia',
    });
  });
});
