import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';

import { Cart } from '../carts/entities/cart.entity';
import { CartItem } from '../carts/entities/cart-item.entity/cart-item.entity';
import { Payment, PaymentStatus } from '../payments/entity/payment.entity';
import { ProductVariant } from '../products/entity/product-variant.entity';
import { Product } from '../products/entity/product.entity';
import { ShippingType } from '../shipments/entities/shipment.entity';
import { UserPaymentMethod } from '../user-payment-methods/entities/user-payment-method.entity';
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
  let productVariantsRepository: MockRepository<ProductVariant>;
  let usersRepository: MockRepository<User>;
  let paymentsRepository: MockRepository<Payment>;
  let userPaymentMethodsRepository: MockRepository<UserPaymentMethod>;

  beforeEach(async () => {
    ordersRepository = createMockRepository<Order>();
    orderItemsRepository = createMockRepository<OrderItem>();
    cartsRepository = createMockRepository<Cart>();
    cartItemsRepository = createMockRepository<CartItem>();
    productsRepository = createMockRepository<Product>();
    productVariantsRepository = createMockRepository<ProductVariant>();
    usersRepository = createMockRepository<User>();
    paymentsRepository = createMockRepository<Payment>();
    userPaymentMethodsRepository = createMockRepository<UserPaymentMethod>();

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
          provide: getRepositoryToken(ProductVariant),
          useValue: productVariantsRepository,
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
          provide: getRepositoryToken(UserPaymentMethod),
          useValue: userPaymentMethodsRepository,
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

  it('crea una orden con un medio de pago guardado de transferencia', async () => {
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
          quantity: 1,
          unitPrice: 2500,
        },
      ],
    } as Cart;
    const savedPaymentMethod = {
      id: 'payment-method-1',
      method: PaymentMethod.TRANSFER,
      label: 'Transferencia Banco',
      senderAlias: 'comprador.alias',
      senderCbu: '1234567890123456789012',
      isActive: true,
      user,
    } as UserPaymentMethod;
    const savedOrder = {
      id: 'order-1',
      buyer: user,
      total: 2500,
      status: OrderStatus.PENDING,
      deliveryAddress: 'Calle 123',
      paymentMethod: PaymentMethod.TRANSFER,
    } as Order;

    usersRepository.findOne?.mockResolvedValue(user);
    cartsRepository.findOne?.mockResolvedValue(cart);
    userPaymentMethodsRepository.findOne?.mockResolvedValue(savedPaymentMethod);
    ordersRepository.save?.mockResolvedValue(savedOrder);
    ordersRepository.findOne?.mockResolvedValue(savedOrder);
    orderItemsRepository.save?.mockResolvedValue([]);
    productsRepository.save?.mockResolvedValue(product);
    cartItemsRepository.delete?.mockResolvedValue({ affected: 1 });
    paymentsRepository.save?.mockImplementation((payment) =>
      Promise.resolve(payment),
    );

    await service.checkout(user.id, {
      deliveryAddress: 'Calle 123',
      paymentMethodId: savedPaymentMethod.id,
    });

    expect(ordersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentMethod: PaymentMethod.TRANSFER,
      }),
    );
    expect(paymentsRepository.create).toHaveBeenCalledWith({
      method: PaymentMethod.TRANSFER,
      status: PaymentStatus.PENDING,
      amount: 2500,
      senderAlias: savedPaymentMethod.senderAlias,
      senderCbu: savedPaymentMethod.senderCbu,
      order: savedOrder,
    });
  });

  it('rechaza checkout con medio de pago guardado inactivo', async () => {
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
          quantity: 1,
          unitPrice: 2500,
        },
      ],
    } as Cart;
    const savedPaymentMethod = {
      id: 'payment-method-1',
      method: PaymentMethod.TRANSFER,
      label: 'Transferencia Banco',
      isActive: false,
      user,
    } as UserPaymentMethod;

    usersRepository.findOne?.mockResolvedValue(user);
    cartsRepository.findOne?.mockResolvedValue(cart);
    userPaymentMethodsRepository.findOne?.mockResolvedValue(savedPaymentMethod);

    await expect(
      service.checkout(user.id, {
        deliveryAddress: 'Calle 123',
        paymentMethodId: savedPaymentMethod.id,
      }),
    ).rejects.toThrow('El medio de pago no esta activo');

    expect(ordersRepository.create).not.toHaveBeenCalled();
  });

  it('crea una orden de Mercado Pago con un medio guardado', async () => {
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
    const savedPaymentMethod = {
      id: 'payment-method-1',
      method: PaymentMethod.MERCADO_PAGO,
      label: 'Mercado Pago',
      isActive: true,
      user,
    } as UserPaymentMethod;
    const savedOrder = {
      id: 'order-1',
      buyer: user,
      total: 1000,
      status: OrderStatus.PENDING,
      deliveryAddress: 'Calle 123',
      paymentMethod: PaymentMethod.MERCADO_PAGO,
    } as Order;

    usersRepository.findOne?.mockResolvedValue(user);
    cartsRepository.findOne?.mockResolvedValue(cart);
    userPaymentMethodsRepository.findOne?.mockResolvedValue(savedPaymentMethod);
    ordersRepository.save?.mockResolvedValue(savedOrder);
    ordersRepository.findOne?.mockResolvedValue(savedOrder);
    orderItemsRepository.save?.mockResolvedValue([]);
    productsRepository.save?.mockResolvedValue(product);
    cartItemsRepository.delete?.mockResolvedValue({ affected: 1 });

    await service.checkout(user.id, {
      deliveryAddress: 'Calle 123',
      paymentMethodId: savedPaymentMethod.id,
    });

    expect(ordersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentMethod: PaymentMethod.MERCADO_PAGO,
      }),
    );
    expect(paymentsRepository.create).not.toHaveBeenCalled();
  });

  it('crea la orden con variante y descuenta stock del talle', async () => {
    const user = { id: 'buyer-1' } as User;
    const product = {
      id: 'product-1',
      title: 'Remera',
      stock: 10,
    } as Product;
    const variant = {
      id: 'variant-1',
      size: 'M',
      color: 'Negro',
      price: 1800,
      stock: 4,
      isActive: true,
      product,
    } as ProductVariant;
    const cart = {
      id: 'cart-1',
      items: [
        {
          product,
          variant,
          quantity: 2,
          unitPrice: 1800,
        },
      ],
    } as Cart;
    const savedOrder = {
      id: 'order-1',
      buyer: user,
      total: 3600,
      status: OrderStatus.PENDING,
      deliveryAddress: 'Calle 123',
      paymentMethod: PaymentMethod.CASH,
    } as Order;

    usersRepository.findOne?.mockResolvedValue(user);
    cartsRepository.findOne?.mockResolvedValue(cart);
    ordersRepository.save?.mockResolvedValue(savedOrder);
    ordersRepository.findOne?.mockResolvedValue({
      ...savedOrder,
      items: [],
    });
    orderItemsRepository.save?.mockResolvedValue([]);
    productVariantsRepository.save?.mockResolvedValue({
      ...variant,
      stock: 2,
    });
    cartItemsRepository.delete?.mockResolvedValue({ affected: 1 });

    await service.checkout(user.id, {
      deliveryAddress: 'Calle 123',
      paymentMethod: PaymentMethod.CASH,
    });

    expect(orderItemsRepository.create).toHaveBeenCalledWith({
      order: savedOrder,
      product,
      variant,
      quantity: 2,
      unitPrice: 1800,
      subtotal: 3600,
    });
    expect(variant.stock).toBe(2);
    expect(productVariantsRepository.save).toHaveBeenCalledWith(variant);
    expect(productsRepository.save).not.toHaveBeenCalled();
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

  it('devuelve las ventas confirmadas del vendedor sin datos sensibles', async () => {
    const seller = {
      id: 'seller-1',
      password: 'seller-secret',
    } as User;
    const buyer = {
      id: 'buyer-1',
      firstName: 'Juan',
      lastName: 'Perez',
      password: 'buyer-secret',
    } as User;
    const createdAt = new Date('2026-01-10T10:00:00.000Z');
    const media = [
      {
        id: 'media-1',
        url: 'https://example.com/product.jpg',
      },
    ];
    const paidSale = {
      id: 'item-1',
      quantity: 2,
      unitPrice: 1500,
      subtotal: 3000,
      product: {
        id: 'product-1',
        title: 'Teclado',
        media,
        seller,
      },
      variant: {
        id: 'variant-1',
        size: 'M',
        color: 'Negro',
      },
      order: {
        id: 'order-1',
        buyer,
        status: OrderStatus.PAID,
        paymentMethod: PaymentMethod.TRANSFER,
        shippingType: ShippingType.LOCAL_DELIVERY,
        createdAt,
      },
    } as unknown as OrderItem;
    const deliveredSale = {
      ...paidSale,
      id: 'item-2',
      order: {
        ...paidSale.order,
        id: 'order-2',
        status: OrderStatus.DELIVERED,
      },
    } as unknown as OrderItem;

    orderItemsRepository.find?.mockResolvedValue([paidSale, deliveredSale]);

    const result = await service.findMySales(seller.id);

    expect(orderItemsRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          product: {
            seller: {
              id: seller.id,
            },
          },
          order: expect.objectContaining({
            status: expect.objectContaining({
              _value: [OrderStatus.PAID, OrderStatus.DELIVERED],
            }),
          }),
        }),
        relations: expect.arrayContaining([
          'order',
          'order.buyer',
          'order.payment',
          'order.shipment',
          'product',
          'product.media',
          'product.seller',
          'variant',
        ]),
        order: {
          order: {
            createdAt: 'DESC',
          },
        },
      }),
    );
    expect(result).toEqual([
      {
        saleId: 'item-1',
        orderItemId: 'item-1',
        orderId: 'order-1',
        product: {
          id: 'product-1',
          title: 'Teclado',
          media,
        },
        variant: {
          id: 'variant-1',
          size: 'M',
          color: 'Negro',
        },
        buyer: {
          id: 'buyer-1',
          firstName: 'Juan',
          lastName: 'Perez',
        },
        quantity: 2,
        unitPrice: 1500,
        subtotal: 3000,
        orderStatus: OrderStatus.PAID,
        paymentMethod: PaymentMethod.TRANSFER,
        shippingType: ShippingType.LOCAL_DELIVERY,
        createdAt,
      },
      {
        saleId: 'item-2',
        orderItemId: 'item-2',
        orderId: 'order-2',
        product: {
          id: 'product-1',
          title: 'Teclado',
          media,
        },
        variant: {
          id: 'variant-1',
          size: 'M',
          color: 'Negro',
        },
        buyer: {
          id: 'buyer-1',
          firstName: 'Juan',
          lastName: 'Perez',
        },
        quantity: 2,
        unitPrice: 1500,
        subtotal: 3000,
        orderStatus: OrderStatus.DELIVERED,
        paymentMethod: PaymentMethod.TRANSFER,
        shippingType: ShippingType.LOCAL_DELIVERY,
        createdAt,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('buyer-secret');
    expect(JSON.stringify(result)).not.toContain('seller-secret');
  });
});
