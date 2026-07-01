import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';

import { Cart } from '../carts/entities/cart.entity';
import { CartItem } from '../carts/entities/cart-item.entity/cart-item.entity';
import { Payment, PaymentStatus } from '../payments/entity/payment.entity';
import { Product } from '../products/entity/product.entity';
import { ShippingType } from '../shipments/entities/shipment.entity';
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

  it('crea una orden nacional usando los datos nacionales como direccion principal', async () => {
    const user = { id: 'buyer-1' } as User;
    const product = {
      id: 'product-1',
      title: 'Monitor',
      stock: 3,
    } as Product;
    const cart = {
      id: 'cart-1',
      items: [
        {
          product,
          quantity: 1,
          unitPrice: 5000,
        },
      ],
    } as Cart;
    const nationalShippingData = {
      fullName: 'Juan Perez',
      dni: '12345678',
      cuit: '20-12345678-9',
      address: 'Ruta 1 KM 2',
      postalCode: '5000',
      city: 'Cordoba',
      province: 'Cordoba',
      phone: '3511234567',
      email: 'juan@example.com',
      transportName: 'Andreani',
    };
    const savedOrder = {
      id: 'order-1',
      buyer: user,
      total: 5000,
      status: OrderStatus.PENDING,
      deliveryAddress: nationalShippingData.address,
      shippingType: ShippingType.NATIONAL_SHIPPING,
      paymentMethod: PaymentMethod.CASH,
    } as Order;

    usersRepository.findOne?.mockResolvedValue(user);
    cartsRepository.findOne?.mockResolvedValue(cart);
    ordersRepository.save?.mockResolvedValue(savedOrder);
    ordersRepository.findOne?.mockResolvedValue(savedOrder);
    orderItemsRepository.save?.mockResolvedValue([]);
    productsRepository.save?.mockResolvedValue(product);
    cartItemsRepository.delete?.mockResolvedValue({ affected: 1 });

    await service.checkout(user.id, {
      shippingType: ShippingType.NATIONAL_SHIPPING,
      nationalShippingData,
      paymentMethod: PaymentMethod.CASH,
    });

    expect(ordersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryAddress: nationalShippingData.address,
        shippingType: ShippingType.NATIONAL_SHIPPING,
        nationalShippingFullName: nationalShippingData.fullName,
        nationalShippingDni: nationalShippingData.dni,
        nationalShippingCuit: nationalShippingData.cuit,
        nationalShippingAddress: nationalShippingData.address,
        nationalShippingPostalCode: nationalShippingData.postalCode,
        nationalShippingCity: nationalShippingData.city,
        nationalShippingProvince: nationalShippingData.province,
        nationalShippingCountry: 'Argentina',
        nationalShippingPhone: nationalShippingData.phone,
        nationalShippingEmail: nationalShippingData.email,
        nationalShippingTransportName: nationalShippingData.transportName,
      }),
    );
  });

  it('rechaza checkout nacional sin datos nacionales', async () => {
    const user = { id: 'buyer-1' } as User;
    const product = {
      id: 'product-1',
      title: 'Mouse',
      stock: 2,
    } as Product;
    const cart = {
      id: 'cart-1',
      items: [
        {
          product,
          quantity: 1,
          unitPrice: 1000,
        },
      ],
    } as Cart;

    usersRepository.findOne?.mockResolvedValue(user);
    cartsRepository.findOne?.mockResolvedValue(cart);

    await expect(
      service.checkout(user.id, {
        shippingType: ShippingType.NATIONAL_SHIPPING,
        paymentMethod: PaymentMethod.CASH,
      }),
    ).rejects.toThrow('Los datos de envio nacional son obligatorios');

    expect(ordersRepository.create).not.toHaveBeenCalled();
  });
});
