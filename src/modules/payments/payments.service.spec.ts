import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, ObjectLiteral, Repository } from 'typeorm';

import {
  Order,
  OrderStatus,
  PaymentMethod,
} from '../orders/entities/order.entity';
import { WalletService } from '../wallet/wallet.service';
import {
  Payment as PaymentEntity,
  PaymentStatus,
} from './entity/payment.entity';
import {
  PaymentAttempt,
  PaymentAttemptStatus,
} from './entity/payment-attempt.entity';
import { PaymentsService } from './payments.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GetnetClient } from './getnet.client';

const mockPreferenceCreate = jest.fn();
const mockPaymentGet = jest.fn();

jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn().mockImplementation((config) => ({ config })),
  Preference: jest.fn().mockImplementation(() => ({
    create: mockPreferenceCreate,
  })),
  Payment: jest.fn().mockImplementation(() => ({
    get: mockPaymentGet,
  })),
}));

type MockRepository<T extends ObjectLiteral = ObjectLiteral> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockRepository = <
  T extends ObjectLiteral = ObjectLiteral,
>(): MockRepository<T> => ({
  findOne: jest.fn(),
  save: jest.fn(),
});

describe('PaymentsService', () => {
  let service: PaymentsService;
  let orderRepository: MockRepository<Order>;
  let paymentRepository: MockRepository<PaymentEntity>;
  let walletService: jest.Mocked<Pick<WalletService, 'creditFromOrder'>>;
  let notificationsService: {
    createOnce: jest.Mock;
    createManyOnce: jest.Mock;
  };
  let getnetClient: {
    createPaymentIntent: jest.Mock;
    getLoaderUrl: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let txOrderRepository: MockRepository<Order>;
  let txPaymentRepository: MockRepository<PaymentEntity>;
  let txAttemptRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let attemptsStore: PaymentAttempt[];
  let transactionManager: { getRepository: jest.Mock };

  const buyerId = 'bdb0526e-0ee2-473d-8daa-a6e63c811f8f';
  const orderId = '559b0806-5ec7-4669-b512-370136e57b8b';
  const sellerId = 'a3b08f39-e5e4-4907-a43a-cef3248e2bb2';
  const secondSellerId = '7a4db075-b46b-4c39-bb37-1e9a8a87e73d';

  let configValues: Record<string, string | undefined>;

  const buyer = {
    id: buyerId,
    email: 'buyer@test.com',
    firstName: 'Nico',
    lastName: 'Gatti',
    isEmailVerified: true,
  };

  const seller = {
    id: sellerId,
    plan: {
      commissionPercentage: 10,
    },
  };

  const secondSeller = {
    id: secondSellerId,
    plan: {
      commissionPercentage: 5,
    },
  };

  const createOrder = (overrides: Partial<Order> = {}) =>
    ({
      id: orderId,
      buyer,
      status: OrderStatus.PENDING,
      paymentMethod: PaymentMethod.MERCADO_PAGO,
      total: 1500,
      items: [
        {
          id: 'item-1',
          quantity: 1,
          unitPrice: 1000,
          subtotal: 1000,
          product: {
            id: 'product-1',
            title: 'Notebook',
            description: 'Notebook para trabajo',
            seller,
          },
        },
        {
          id: 'item-2',
          quantity: 2,
          unitPrice: 250,
          subtotal: 500,
          product: {
            id: 'product-2',
            title: 'Mouse',
            description: 'Mouse inalambrico',
            seller: secondSeller,
          },
        },
      ],
      ...overrides,
    }) as Order;

  beforeEach(async () => {
    orderRepository = createMockRepository<Order>();
    paymentRepository = {
      ...createMockRepository<PaymentEntity>(),
      create: jest.fn((data) => data),
    };
    walletService = {
      creditFromOrder: jest.fn(),
    };
    notificationsService = {
      createOnce: jest.fn().mockResolvedValue(undefined),
      createManyOnce: jest.fn().mockResolvedValue([]),
    };
    getnetClient = {
      createPaymentIntent: jest.fn(),
      getLoaderUrl: jest
        .fn()
        .mockReturnValue(
          'https://www.pre.globalgetnet.com/digital-checkout/loader.js',
        ),
    };
    attemptsStore = [];
    configValues = {
      MP_ACCESS_TOKEN: 'fake-access-token',
      BACKEND_URL: 'https://api.test.com',
      FRONTEND_SUCCESS_URL: 'https://front.test.com/success',
      FRONTEND_FAILURE_URL: 'https://front.test.com/failure',
      FRONTEND_PENDING_URL: 'https://front.test.com/pending',
      GETNET_WEBHOOK_USERNAME: 'getnet-user',
      GETNET_WEBHOOK_PASSWORD: 'getnet-password',
      GETNET_CHECKOUT_TYPE: 'redirect',
      GETNET_AMOUNT_UNIT: 'cents',
    };
    txOrderRepository = createMockRepository<Order>();
    txPaymentRepository = {
      ...createMockRepository<PaymentEntity>(),
      create: jest.fn((data) => data),
      save: jest.fn(async (saved) => saved),
    };
    txAttemptRepository = {
      findOne: jest.fn(),
      save: jest.fn(async (attempt) => {
        if (!attemptsStore.includes(attempt)) attemptsStore.push(attempt);
        return attempt;
      }),
      create: jest.fn((data) => data),
    };
    transactionManager = {
      getRepository: jest.fn((entity) => {
        if (entity === Order) return txOrderRepository;
        if (entity === PaymentEntity) return txPaymentRepository;
        if (entity === PaymentAttempt) return txAttemptRepository;
        throw new Error(`Repositorio transaccional no configurado: ${entity}`);
      }),
    };
    dataSource = {
      transaction: jest.fn((callback) => callback(transactionManager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => configValues[key]),
          },
        },
        {
          provide: getRepositoryToken(Order),
          useValue: orderRepository,
        },
        {
          provide: getRepositoryToken(PaymentEntity),
          useValue: paymentRepository,
        },
        {
          provide: WalletService,
          useValue: walletService,
        },
        {
          provide: CloudinaryService,
          useValue: { uploadFile: jest.fn() },
        },
        {
          provide: NotificationsService,
          useValue: notificationsService,
        },
        {
          provide: GetnetClient,
          useValue: getnetClient,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
  });

  it('deberia estar definido con sus dependencias mockeadas', () => {
    expect(service).toBeDefined();
    expect(orderRepository).toBeDefined();
    expect(paymentRepository).toBeDefined();
    expect(walletService).toBeDefined();
  });

  describe('createMercadoPagoPreference', () => {
    it('crea una preferencia de Mercado Pago y guarda el preferenceId en la orden', async () => {
      const order = createOrder();
      orderRepository.findOne?.mockResolvedValue(order);
      orderRepository.save?.mockResolvedValue(order);
      mockPreferenceCreate.mockResolvedValue({
        id: 'preference-123',
        init_point: 'https://mp.com/init',
        sandbox_init_point: 'https://sandbox.mp.com/init',
      });

      const result = await service.createMercadoPagoPreference(
        orderId,
        buyerId,
      );

      expect(orderRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: orderId,
          buyer: { id: buyerId },
        },
        relations: ['buyer', 'items', 'items.product'],
      });
      expect(mockPreferenceCreate).toHaveBeenCalledWith({
        body: expect.objectContaining({
          items: [
            {
              id: 'product-1',
              title: 'Notebook',
              quantity: 1,
              unit_price: 1000,
              currency_id: 'ARS',
            },
            {
              id: 'product-2',
              title: 'Mouse',
              quantity: 2,
              unit_price: 250,
              currency_id: 'ARS',
            },
          ],
          external_reference: order.id,
          payer: {
            email: buyer.email,
            name: buyer.firstName,
            surname: buyer.lastName,
          },
          notification_url: 'https://api.test.com/payments/mercadopago/webhook',
          back_urls: {
            success: 'https://front.test.com/success',
            failure: 'https://front.test.com/failure',
            pending: 'https://front.test.com/pending',
          },
          metadata: {
            orderId: order.id,
            buyerId: buyer.id,
          },
        }),
      });
      expect(order.paymentPreferenceId).toBe('preference-123');
      expect(orderRepository.save).toHaveBeenCalledWith(order);
      expect(result).toEqual({
        orderId: order.id,
        preferenceId: 'preference-123',
        initPoint: 'https://mp.com/init',
        sandboxInitPoint: 'https://sandbox.mp.com/init',
      });
    });

    it('lanza NotFoundException si la orden no existe o no pertenece al usuario', async () => {
      orderRepository.findOne?.mockResolvedValue(null);

      await expect(
        service.createMercadoPagoPreference(orderId, buyerId),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockPreferenceCreate).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si la orden no esta pendiente', async () => {
      orderRepository.findOne?.mockResolvedValue(
        createOrder({
          status: OrderStatus.PAID,
        }),
      );

      await expect(
        service.createMercadoPagoPreference(orderId, buyerId),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPreferenceCreate).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si la orden no usa Mercado Pago', async () => {
      orderRepository.findOne?.mockResolvedValue(
        createOrder({
          paymentMethod: PaymentMethod.CASH,
        }),
      );

      await expect(
        service.createMercadoPagoPreference(orderId, buyerId),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPreferenceCreate).not.toHaveBeenCalled();
    });
  });

  describe('handleMercadoPagoWebhook', () => {
    it('ignora webhooks sin paymentId', async () => {
      const result = await service.handleMercadoPagoWebhook({}, {});

      expect(result).toEqual({ received: true });
      expect(mockPaymentGet).not.toHaveBeenCalled();
      expect(orderRepository.save).not.toHaveBeenCalled();
    });

    it('ignora pagos sin external_reference', async () => {
      mockPaymentGet.mockResolvedValue({
        id: 123,
        status: 'approved',
      });

      const result = await service.handleMercadoPagoWebhook(
        { data: { id: '123' } },
        {},
      );

      expect(mockPaymentGet).toHaveBeenCalledWith({ id: '123' });
      expect(result).toEqual({ received: true });
      expect(orderRepository.findOne).not.toHaveBeenCalled();
    });

    it('ignora pagos asociados a ordenes inexistentes', async () => {
      mockPaymentGet.mockResolvedValue({
        id: 123,
        status: 'approved',
        external_reference: orderId,
      });
      orderRepository.findOne?.mockResolvedValue(null);

      const result = await service.handleMercadoPagoWebhook(
        { data: { id: '123' } },
        {},
      );

      expect(orderRepository.findOne).toHaveBeenCalledWith({
        where: { id: orderId },
        relations: ['buyer', 'items', 'items.product', 'items.product.seller'],
      });
      expect(result).toEqual({ received: true });
      expect(orderRepository.save).not.toHaveBeenCalled();
    });

    it('marca la orden como paid y acredita wallets de vendedores si el pago fue aprobado', async () => {
      const order = createOrder();
      mockPaymentGet.mockResolvedValue({
        id: 123,
        status: 'approved',
        external_reference: orderId,
      });
      orderRepository.findOne?.mockResolvedValue(order);
      orderRepository.save?.mockResolvedValue(order);
      walletService.creditFromOrder.mockResolvedValue({} as never);

      const result = await service.handleMercadoPagoWebhook(
        { data: { id: '123' } },
        {},
      );

      expect(order.paymentId).toBe('123');
      expect(order.paymentStatus).toBe('approved');
      expect(order.status).toBe(OrderStatus.PAID);
      expect(orderRepository.save).toHaveBeenCalledWith(order);
      expect(walletService.creditFromOrder).toHaveBeenCalledTimes(2);
      expect(walletService.creditFromOrder).toHaveBeenNthCalledWith(1, {
        userId: sellerId,
        orderId,
        amount: 1000,
        commisionPercentage: 10,
      });
      expect(walletService.creditFromOrder).toHaveBeenNthCalledWith(2, {
        userId: secondSellerId,
        orderId,
        amount: 500,
        commisionPercentage: 5,
      });
      expect(notificationsService.createManyOnce).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            userId: sellerId,
            type: 'NEW_SALE',
          }),
          expect.objectContaining({
            userId: sellerId,
            type: 'BALANCE_AVAILABLE',
            data: expect.objectContaining({ netAmount: 900 }),
          }),
          expect.objectContaining({
            userId: buyerId,
            type: 'PAYMENT_APPROVED',
          }),
        ]),
      );
      expect(result).toEqual({ received: true });
    });

    it('marca la orden como rejected si Mercado Pago devuelve rejected', async () => {
      const order = createOrder();
      mockPaymentGet.mockResolvedValue({
        id: 123,
        status: 'rejected',
        external_reference: orderId,
      });
      orderRepository.findOne?.mockResolvedValue(order);
      orderRepository.save?.mockResolvedValue(order);

      const result = await service.handleMercadoPagoWebhook({}, { id: '123' });

      expect(order.status).toBe(OrderStatus.REJECTED);
      expect(order.paymentStatus).toBe('rejected');
      expect(walletService.creditFromOrder).not.toHaveBeenCalled();
      expect(notificationsService.createOnce).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: buyerId,
          type: 'PAYMENT_REJECTED',
        }),
      );
      expect(result).toEqual({ received: true });
    });

    it('marca la orden como cancelled si Mercado Pago devuelve cancelled', async () => {
      const order = createOrder();
      mockPaymentGet.mockResolvedValue({
        id: 123,
        status: 'cancelled',
        external_reference: orderId,
      });
      orderRepository.findOne?.mockResolvedValue(order);
      orderRepository.save?.mockResolvedValue(order);

      const result = await service.handleMercadoPagoWebhook(
        { data: { id: '123' } },
        {},
      );

      expect(order.status).toBe(OrderStatus.CANCELLED);
      expect(order.paymentStatus).toBe('cancelled');
      expect(walletService.creditFromOrder).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true });
    });

    it('no acredita dos veces si la orden ya estaba paid', async () => {
      const order = createOrder({
        status: OrderStatus.PAID,
      });
      mockPaymentGet.mockResolvedValue({
        id: 123,
        status: 'approved',
        external_reference: orderId,
      });
      orderRepository.findOne?.mockResolvedValue(order);
      orderRepository.save?.mockResolvedValue(order);

      const result = await service.handleMercadoPagoWebhook(
        { data: { id: '123' } },
        {},
      );

      expect(order.status).toBe(OrderStatus.PAID);
      expect(orderRepository.save).toHaveBeenCalledWith(order);
      expect(walletService.creditFromOrder).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true });
    });
  });

  describe('createGetnetOrder', () => {
    const setupGetnetOrder = (overrides: Partial<Order> = {}) => {
      const order = createOrder({
        paymentMethod: PaymentMethod.GETNET,
        ...overrides,
      });
      txOrderRepository.findOne?.mockResolvedValue(order);
      txOrderRepository.save?.mockImplementation(async (saved) => saved);
      return order;
    };

    it('crea la intencion con el body del manual y devuelve checkout redirect', async () => {
      const order = setupGetnetOrder();
      txPaymentRepository.findOne?.mockResolvedValue(null);
      getnetClient.createPaymentIntent.mockResolvedValue({
        payment_intent_id: 'abc123',
        checkout_url: 'https://checkout.pre.globalgetnet.com/s/abc123',
      });

      const result = await service.createGetnetOrder(orderId, buyerId);

      expect(getnetClient.createPaymentIntent).toHaveBeenCalledTimes(1);
      expect(getnetClient.createPaymentIntent).toHaveBeenCalledWith({
        order_id: orderId,
        customer: {
          first_name: 'Nico',
          last_name: 'Gatti',
          email: 'buyer@test.com',
        },
        payment: { currency: 'ARS', amount: 150000 },
      });
      expect(txPaymentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          method: PaymentMethod.GETNET,
          status: PaymentStatus.PENDING,
          amount: 1500,
        }),
      );
      expect(order.paymentPreferenceId).toBe('abc123');
      expect(order.paymentStatus).toBe('PENDING');

      const attempt = attemptsStore[0];
      expect(attempt.externalPaymentId).toBe('abc123');
      expect(attempt.checkoutUrl).toBe(
        'https://checkout.pre.globalgetnet.com/s/abc123',
      );
      expect(attempt.status).toBe(PaymentAttemptStatus.PENDING);
      expect(attempt.idempotencyKey).toBeTruthy();
      expect(attempt.expiresAt!.getTime()).toBeGreaterThan(Date.now());

      expect(result).toEqual({
        orderId,
        paymentIntentId: 'abc123',
        checkoutUrl: 'https://checkout.pre.globalgetnet.com/s/abc123',
        checkoutType: 'redirect',
      });
    });

    it('devuelve loader e iframe cuando la modalidad configurada es iframe', async () => {
      const order = setupGetnetOrder();
      txPaymentRepository.findOne?.mockResolvedValue(null);
      configValues.GETNET_CHECKOUT_TYPE = 'iframe';
      getnetClient.createPaymentIntent.mockResolvedValue({
        payment_intent_id: 'abc123',
        checkout_url: 'https://checkout.pre.globalgetnet.com/s/abc123',
      });

      const result = await service.createGetnetOrder(orderId, buyerId);

      expect(result).toEqual({
        orderId,
        paymentIntentId: 'abc123',
        checkoutType: 'iframe',
        checkoutUrl: 'https://checkout.pre.globalgetnet.com/s/abc123',
        loaderUrl:
          'https://www.pre.globalgetnet.com/digital-checkout/loader.js',
      });
    });

    it('degrada a iframe cuando Getnet no devuelve checkout_url', async () => {
      setupGetnetOrder();
      txPaymentRepository.findOne?.mockResolvedValue(null);
      getnetClient.createPaymentIntent.mockResolvedValue({
        payment_intent_id: 'solo-intent',
      });

      const result = await service.createGetnetOrder(orderId, buyerId);

      expect(result).toEqual({
        orderId,
        paymentIntentId: 'solo-intent',
        checkoutType: 'iframe',
        loaderUrl:
          'https://www.pre.globalgetnet.com/digital-checkout/loader.js',
      });
    });

    it('reutiliza un intento pendiente vigente sin llamar a Getnet', async () => {
      setupGetnetOrder();
      const vigente = {
        id: 'attempt-1',
        idempotencyKey: 'key-1',
        status: PaymentAttemptStatus.PENDING,
        externalPaymentId: 'intent-vigente',
        checkoutUrl: 'https://checkout/vigente',
        expiresAt: new Date(Date.now() + 3_600_000),
        createdAt: new Date(),
      } as PaymentAttempt;
      attemptsStore.push(vigente);
      txPaymentRepository.findOne?.mockResolvedValue({
        id: 'pay-1',
        attempts: attemptsStore,
      });

      const result = await service.createGetnetOrder(orderId, buyerId);

      expect(getnetClient.createPaymentIntent).not.toHaveBeenCalled();
      expect(txOrderRepository.save).not.toHaveBeenCalled();
      expect(result).toEqual({
        orderId,
        paymentIntentId: 'intent-vigente',
        checkoutUrl: 'https://checkout/vigente',
        checkoutType: 'redirect',
      });
    });

    it('genera un nuevo intento cuando el anterior expiro', async () => {
      setupGetnetOrder();
      const expirado = {
        id: 'attempt-old',
        idempotencyKey: 'key-old',
        status: PaymentAttemptStatus.PENDING,
        externalPaymentId: 'intent-viejo',
        expiresAt: new Date(Date.now() - 1_000),
        createdAt: new Date(Date.now() - 3_600_000),
      } as PaymentAttempt;
      attemptsStore.push(expirado);
      txPaymentRepository.findOne?.mockResolvedValue({
        id: 'pay-1',
        attempts: attemptsStore,
      });
      getnetClient.createPaymentIntent.mockResolvedValue({
        payment_intent_id: 'intent-nuevo',
        checkout_url: 'https://checkout/nuevo',
      });

      const result = await service.createGetnetOrder(orderId, buyerId);

      expect(getnetClient.createPaymentIntent).toHaveBeenCalledTimes(1);
      expect(expirado.status).toBe(PaymentAttemptStatus.EXPIRED);
      expect(result.paymentIntentId).toBe('intent-nuevo');
    });

    it('serializa creaciones concurrentes en una sola intencion externa', async () => {
      const order = setupGetnetOrder();
      txPaymentRepository.findOne?.mockImplementation(async () => ({
        id: 'pay-1',
        attempts: attemptsStore,
      }));
      let queue = Promise.resolve();
      dataSource.transaction.mockImplementation((callback) => {
        const result = queue.then(() => callback(transactionManager));
        queue = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      });
      let intentsCreated = 0;
      getnetClient.createPaymentIntent.mockImplementation(async () => {
        intentsCreated += 1;
        return {
          payment_intent_id: `intent-${intentsCreated}`,
          checkout_url: `https://checkout/${intentsCreated}`,
        };
      });

      const [first, second] = await Promise.all([
        service.createGetnetOrder(orderId, buyerId),
        service.createGetnetOrder(orderId, buyerId),
      ]);

      expect(intentsCreated).toBe(1);
      expect(first.paymentIntentId).toBe('intent-1');
      expect(second.paymentIntentId).toBe('intent-1');
      expect(order.paymentPreferenceId).toBe('intent-1');
    });

    it('marca el intento como ERROR si Getnet falla y no actualiza la orden', async () => {
      const order = setupGetnetOrder();
      txPaymentRepository.findOne?.mockResolvedValue(null);
      getnetClient.createPaymentIntent.mockRejectedValue(
        new BadGatewayException('Getnet no pudo crear la intencion de pago'),
      );

      await expect(
        service.createGetnetOrder(orderId, buyerId),
      ).rejects.toBeInstanceOf(BadGatewayException);

      expect(attemptsStore[0].status).toBe(PaymentAttemptStatus.ERROR);
      expect(order.paymentPreferenceId).toBeUndefined();
    });

    it('rechaza una orden inexistente o ajena', async () => {
      txOrderRepository.findOne?.mockResolvedValue(null);

      await expect(
        service.createGetnetOrder(orderId, 'otro-comprador'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(getnetClient.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('rechaza una orden que no usa Getnet o no esta pendiente', async () => {
      setupGetnetOrder({ status: OrderStatus.REJECTED });

      await expect(
        service.createGetnetOrder(orderId, buyerId),
      ).rejects.toBeInstanceOf(BadRequestException);

      setupGetnetOrder({ paymentMethod: PaymentMethod.MERCADO_PAGO });

      await expect(
        service.createGetnetOrder(orderId, buyerId),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(getnetClient.createPaymentIntent).not.toHaveBeenCalled();
    });
  });

  describe('handleGetnetWebhook', () => {
    const basicAuthorization = `Basic ${Buffer.from(
      'getnet-user:getnet-password',
    ).toString('base64')}`;

    const setupGetnetOrder = (overrides: Partial<Order> = {}) =>
      createOrder({
        paymentMethod: PaymentMethod.GETNET,
        paymentPreferenceId: 'getnet-intent-1',
        ...overrides,
      }) as Order;

    interface PayloadOptions {
      status?: string;
      amount?: number;
      currency?: string;
      paymentId?: string;
    }

    // Variante completa documentada previamente por Getnet (estados anidados).
    const authorizedFullPayload = (id: string, opts: PayloadOptions = {}) => ({
      payment_intent_id: 'getnet-intent-1',
      checkout_id: 'checkout-1',
      order_id: id,
      mode: 'instant',
      payment: {
        method: 'credit',
        amount: opts.amount ?? 150000,
        currency: opts.currency ?? 'ARS',
        result: {
          payment_id: opts.paymentId ?? 'getnet-payment-1',
          status: opts.status ?? 'AUTHORIZED',
        },
      },
    });

    // Variante simplificada confirmada en el manual vigente.
    const authorizedSimplifiedPayload = (
      id: string,
      opts: PayloadOptions = {},
    ) => ({
      order_id: id,
      payment_intent_id: 'getnet-intent-1',
      status: opts.status ?? 'APPROVED',
    });

    const rejectedSimplifiedPayload = (id: string) => ({
      order_id: id,
      payment_intent_id: 'getnet-intent-1',
      status: 'REJECTED',
    });

    const expectApprovedAndCredited = async (
      result: { received: boolean },
      order: Order,
    ) => {
      expect(result).toEqual({ received: true });
      expect(order.status).toBe(OrderStatus.PAID);
      expect(order.paymentStatus).toBe('APPROVED');
      expect(walletService.creditFromOrder).toHaveBeenCalledTimes(2);
      expect(notificationsService.createManyOnce).toHaveBeenCalledTimes(1);
      const attempt = attemptsStore[0];
      expect(attempt.status).toBe(PaymentAttemptStatus.APPROVED);
      expect(attempt.rawStatus).toBeTruthy();
      expect(attempt.lastNotifiedAt).toBeInstanceOf(Date);
    };

    it('rechaza webhooks sin Basic Auth valida', async () => {
      await expect(
        service.handleGetnetWebhook(
          undefined,
          authorizedFullPayload(orderId),
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(txOrderRepository.findOne).not.toHaveBeenCalled();
    });

    it('rechaza credenciales Basic Auth incorrectas', async () => {
      await expect(
        service.handleGetnetWebhook(
          `Basic ${Buffer.from('getnet-user:wrong').toString('base64')}`,
          authorizedFullPayload(orderId),
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('falla controladamente cuando faltan credenciales configuradas', async () => {
      delete configValues.GETNET_WEBHOOK_USERNAME;

      await expect(
        service.handleGetnetWebhook(basicAuthorization, {}),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('acepta webhooks sin autorizacion solo con modo none fuera de produccion', async () => {
      configValues.GETNET_WEBHOOK_AUTH_MODE = 'none';
      const order = setupGetnetOrder();
      txOrderRepository.findOne?.mockResolvedValue(order);
      txAttemptRepository.findOne.mockResolvedValue(undefined);

      const result = await service.handleGetnetWebhook(
        undefined,
        authorizedSimplifiedPayload(orderId),
      );

      expect(result).toEqual({ received: true });
      expect(order.status).toBe(OrderStatus.PAID);
      expect(walletService.creditFromOrder).toHaveBeenCalled();
    });

    it('prohibe el modo none en produccion', async () => {
      configValues.GETNET_WEBHOOK_AUTH_MODE = 'none';
      configValues.NODE_ENV = 'production';

      await expect(
        service.handleGetnetWebhook(undefined, authorizedFullPayload(orderId)),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('ignora payloads incompletos autenticados respondiendo received', async () => {
      await expect(
        service.handleGetnetWebhook(basicAuthorization, {
          order_id: orderId,
        }),
      ).resolves.toEqual({ received: true });

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(txOrderRepository.findOne).not.toHaveBeenCalled();
    });

    it('ignora estados desconocidos sin romper', async () => {
      await expect(
        service.handleGetnetWebhook(
          basicAuthorization,
          authorizedFullPayload(orderId, { status: 'PENDING' }),
        ),
      ).resolves.toEqual({ received: true });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('ignora order_id con formato invalido sin consultar la base', async () => {
      txOrderRepository.findOne?.mockClear();

      await expect(
        service.handleGetnetWebhook(basicAuthorization, {
          order_id: 'inexistente',
          payment_intent_id: 'intent-x',
          status: 'APPROVED',
        }),
      ).resolves.toEqual({ received: true });

      expect(txOrderRepository.findOne).not.toHaveBeenCalled();
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('aprueba con el payload simplificado APPROVED sin importe ni payment_id', async () => {
      const order = setupGetnetOrder();
      txOrderRepository.findOne?.mockResolvedValue(order);
      txAttemptRepository.findOne.mockResolvedValue(undefined);

      await expectApprovedAndCredited(
        await service.handleGetnetWebhook(
          basicAuthorization,
          authorizedSimplifiedPayload(orderId),
        ),
        order,
      );
    });

    it('aprueba con la variante completa AUTHORIZED anidada', async () => {
      const order = setupGetnetOrder();
      txOrderRepository.findOne?.mockResolvedValue(order);
      txAttemptRepository.findOne.mockResolvedValue(undefined);

      await expectApprovedAndCredited(
        await service.handleGetnetWebhook(
          basicAuthorization,
          authorizedFullPayload(orderId),
        ),
        order,
      );
      expect(attemptsStore[0].providerPaymentId).toBe('getnet-payment-1');
      expect(attemptsStore[0].rawStatus).toBe('AUTHORIZED');
    });

    it('no duplica creditos ni notificaciones ante un webhook duplicado', async () => {
      const order = setupGetnetOrder({ status: OrderStatus.PAID });
      order.paymentId = 'getnet-payment-1';
      txOrderRepository.findOne?.mockResolvedValue(order);
      txAttemptRepository.findOne.mockResolvedValue(undefined);

      const first = await service.handleGetnetWebhook(
        basicAuthorization,
        authorizedFullPayload(orderId),
      );
      const second = await service.handleGetnetWebhook(
        basicAuthorization,
        authorizedFullPayload(orderId),
      );

      expect(first).toEqual({ received: true });
      expect(second).toEqual({ received: true });
      expect(order.status).toBe(OrderStatus.PAID);
      expect(walletService.creditFromOrder).not.toHaveBeenCalled();
      expect(notificationsService.createManyOnce).not.toHaveBeenCalled();
    });

    it('serializa dos webhooks aprobados concurrentes sin duplicar creditos', async () => {
      const order = setupGetnetOrder();
      txOrderRepository.findOne?.mockResolvedValue(order);
      txAttemptRepository.findOne.mockResolvedValue(undefined);
      let transactionQueue = Promise.resolve();
      dataSource.transaction.mockImplementation((callback) => {
        const result = transactionQueue.then(() =>
          callback(transactionManager),
        );
        transactionQueue = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      });

      await Promise.all([
        service.handleGetnetWebhook(
          basicAuthorization,
          authorizedFullPayload(orderId),
        ),
        service.handleGetnetWebhook(
          basicAuthorization,
          authorizedFullPayload(orderId),
        ),
      ]);

      expect(order.status).toBe(OrderStatus.PAID);
      expect(walletService.creditFromOrder).toHaveBeenCalledTimes(2);
    });

    it('rechaza con REJECTED simplificado sin acreditar vendedores', async () => {
      const order = setupGetnetOrder();
      txOrderRepository.findOne?.mockResolvedValue(order);
      txAttemptRepository.findOne.mockResolvedValue(undefined);

      await service.handleGetnetWebhook(
        basicAuthorization,
        rejectedSimplifiedPayload(orderId),
      );

      expect(order.status).toBe(OrderStatus.REJECTED);
      expect(order.paymentStatus).toBe('REJECTED');
      expect(walletService.creditFromOrder).not.toHaveBeenCalled();
      expect(notificationsService.createOnce).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'PAYMENT_REJECTED' }),
      );
      expect(attemptsStore[0].status).toBe(PaymentAttemptStatus.REJECTED);
    });

    it('rechaza con la variante completa DENIED anidada', async () => {
      const order = setupGetnetOrder();
      txOrderRepository.findOne?.mockResolvedValue(order);
      txAttemptRepository.findOne.mockResolvedValue(undefined);

      await service.handleGetnetWebhook(
        basicAuthorization,
        authorizedFullPayload(orderId, { status: 'DENIED' }),
      );

      expect(order.status).toBe(OrderStatus.REJECTED);
      expect(walletService.creditFromOrder).not.toHaveBeenCalled();
    });

    it('ignora un rechazo posterior sobre una orden ya pagada', async () => {
      const order = setupGetnetOrder({
        status: OrderStatus.PAID,
        paymentStatus: 'APPROVED',
      });
      order.paymentId = 'getnet-payment-1';
      txOrderRepository.findOne?.mockResolvedValue(order);
      txAttemptRepository.findOne.mockResolvedValue(undefined);

      await service.handleGetnetWebhook(
        basicAuthorization,
        authorizedFullPayload(orderId, { status: 'DENIED' }),
      );

      expect(order.status).toBe(OrderStatus.PAID);
      expect(order.paymentStatus).toBe('APPROVED');
      expect(notificationsService.createOnce).not.toHaveBeenCalled();
    });

    it('no notifica dos veces un rechazo duplicado', async () => {
      const order = setupGetnetOrder({ status: OrderStatus.REJECTED, paymentStatus: 'REJECTED' });
      txOrderRepository.findOne?.mockResolvedValue(order);
      txAttemptRepository.findOne.mockResolvedValue(undefined);

      await service.handleGetnetWebhook(
        basicAuthorization,
        rejectedSimplifiedPayload(orderId),
      );

      expect(notificationsService.createOnce).not.toHaveBeenCalled();
    });

    it('ignora ordenes inexistentes e intents inconsistentes sin mutar datos', async () => {
      txOrderRepository.findOne?.mockResolvedValueOnce(null);
      await service.handleGetnetWebhook(
        basicAuthorization,
        authorizedFullPayload(orderId),
      );

      const mismatched = setupGetnetOrder({
        paymentPreferenceId: 'otro-intent',
      });
      txOrderRepository.findOne?.mockResolvedValue(mismatched);
      await service.handleGetnetWebhook(
        basicAuthorization,
        authorizedFullPayload(orderId),
      );

      expect(txOrderRepository.save).not.toHaveBeenCalled();
      expect(walletService.creditFromOrder).not.toHaveBeenCalled();
    });

    it('ignora montos inconsistentes cuando el payload los incluye', async () => {
      const order = setupGetnetOrder();
      txOrderRepository.findOne?.mockResolvedValue(order);
      txAttemptRepository.findOne.mockResolvedValue(undefined);

      await expect(
        service.handleGetnetWebhook(
          basicAuthorization,
          authorizedFullPayload(orderId, { amount: 1 }),
        ),
      ).resolves.toEqual({ received: true });
      expect(walletService.creditFromOrder).not.toHaveBeenCalled();
      expect(txOrderRepository.save).not.toHaveBeenCalled();
    });

    it('ignora monedas distintas de ARS cuando el payload la incluye', async () => {
      const order = setupGetnetOrder();
      txOrderRepository.findOne?.mockResolvedValue(order);
      txAttemptRepository.findOne.mockResolvedValue(undefined);

      await expect(
        service.handleGetnetWebhook(
          basicAuthorization,
          authorizedFullPayload(orderId, { currency: 'USD' }),
        ),
      ).resolves.toEqual({ received: true });
      expect(walletService.creditFromOrder).not.toHaveBeenCalled();
    });

    it('propaga fallos transaccionales para que Getnet reintente', async () => {
      const order = setupGetnetOrder();
      txOrderRepository.findOne?.mockResolvedValue(order);
      txAttemptRepository.findOne.mockResolvedValue(undefined);
      walletService.creditFromOrder.mockRejectedValueOnce(
        new Error('wallet unavailable'),
      );

      await expect(
        service.handleGetnetWebhook(
          basicAuthorization,
          authorizedFullPayload(orderId),
        ),
      ).rejects.toThrow('wallet unavailable');

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(notificationsService.createManyOnce).not.toHaveBeenCalled();
      // La evidencia del webhook queda persistida aunque el credito falle.
      expect(attemptsStore[0].lastNotifiedAt).toBeInstanceOf(Date);
    });
  });

  describe('notifyTransferPayment', () => {
    it('lanza NotFoundException si la orden no existe o no pertenece al usuario', async () => {
      orderRepository.findOne?.mockResolvedValue(null);

      await expect(
        service.notifyTransferPayment(orderId, buyerId, {
          senderAlias: 'comprador.alias',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(paymentRepository.save).not.toHaveBeenCalled();
    });

    it('guarda el alias del comprador y mantiene el pago pendiente', async () => {
      const payment = {
        id: 'payment-1',
        method: PaymentMethod.TRANSFER,
        status: PaymentStatus.PENDING,
        amount: 1500,
      } as PaymentEntity;
      const order = createOrder({
        paymentMethod: PaymentMethod.TRANSFER,
        payment,
      });
      orderRepository.findOne?.mockResolvedValue(order);
      paymentRepository.save?.mockResolvedValue(payment);

      const result = await service.notifyTransferPayment(orderId, buyerId, {
        senderAlias: 'comprador.alias',
        senderCbu: '0000000000000000000000',
      });

      expect(payment.senderAlias).toBe('comprador.alias');
      expect(payment.senderCbu).toBe('0000000000000000000000');
      expect(payment.status).toBe(PaymentStatus.PENDING);
      expect(paymentRepository.save).toHaveBeenCalledWith(payment);
      expect(result).toEqual({
        orderId,
        paymentStatus: PaymentStatus.PENDING,
        message: 'Estamos chequeando la transferencia',
      });
    });
  });

  describe('updateTransferPaymentStatus', () => {
    const createTransferOrder = (paymentStatus = PaymentStatus.PENDING) => {
      const payment = {
        id: 'payment-1',
        method: PaymentMethod.TRANSFER,
        status: paymentStatus,
        amount: 1500,
      } as PaymentEntity;

      return createOrder({
        paymentMethod: PaymentMethod.TRANSFER,
        payment,
      });
    };

    it('confirma una transferencia, marca la orden como paid y acredita wallets', async () => {
      const order = createTransferOrder();
      orderRepository.findOne?.mockResolvedValue(order);
      orderRepository.save?.mockResolvedValue(order);
      paymentRepository.save?.mockResolvedValue(order.payment as PaymentEntity);
      walletService.creditFromOrder.mockResolvedValue({} as never);

      const result = await service.updateTransferPaymentStatus(orderId, {
        status: PaymentStatus.COMPLETED,
        adminNote: 'Recibido',
      });

      expect(order.status).toBe(OrderStatus.PAID);
      expect(order.payment?.status).toBe(PaymentStatus.COMPLETED);
      expect(order.payment?.adminNote).toBe('Recibido');
      expect(paymentRepository.save).toHaveBeenCalledWith(order.payment);
      expect(orderRepository.save).toHaveBeenCalledWith(order);
      expect(walletService.creditFromOrder).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        orderId,
        orderStatus: OrderStatus.PAID,
        paymentStatus: PaymentStatus.COMPLETED,
        message: 'Pago confirmado, estamos asignando a un repartidor',
      });
    });

    it('rechaza una transferencia sin acreditar wallets', async () => {
      const order = createTransferOrder();
      orderRepository.findOne?.mockResolvedValue(order);
      orderRepository.save?.mockResolvedValue(order);
      paymentRepository.save?.mockResolvedValue(order.payment as PaymentEntity);

      const result = await service.updateTransferPaymentStatus(orderId, {
        status: PaymentStatus.REJECTED,
      });

      expect(order.status).toBe(OrderStatus.REJECTED);
      expect(order.payment?.status).toBe(PaymentStatus.REJECTED);
      expect(walletService.creditFromOrder).not.toHaveBeenCalled();
      expect(result).toEqual({
        orderId,
        orderStatus: OrderStatus.REJECTED,
        paymentStatus: PaymentStatus.REJECTED,
        message: 'Transferencia rechazada',
      });
    });

    it('reintenta una transferencia completada sin volver a acreditar', async () => {
      const order = createTransferOrder(PaymentStatus.COMPLETED);
      order.status = OrderStatus.PAID;
      orderRepository.findOne?.mockResolvedValue(order);

      await expect(
        service.updateTransferPaymentStatus(orderId, {
          status: PaymentStatus.COMPLETED,
        }),
      ).resolves.toEqual({
        orderId,
        orderStatus: OrderStatus.PAID,
        paymentStatus: PaymentStatus.COMPLETED,
        message: 'Pago confirmado, estamos asignando a un repartidor',
      });
      expect(walletService.creditFromOrder).not.toHaveBeenCalled();
      expect(notificationsService.createManyOnce).toHaveBeenCalled();
    });
  });

  describe('updateManualPaymentStatus', () => {
    it('confirma un pago QR manual y acredita las wallets una sola vez', async () => {
      const payment = {
        id: 'payment-qr',
        method: PaymentMethod.GETNET_QR,
        status: PaymentStatus.PENDING,
        amount: 1500,
        proofImageUrl: 'https://example.com/proof.png',
      } as PaymentEntity;
      const order = createOrder({
        paymentMethod: PaymentMethod.GETNET_QR,
        payment,
      });
      orderRepository.findOne?.mockResolvedValue(order);
      orderRepository.save?.mockResolvedValue(order);
      paymentRepository.save?.mockResolvedValue(payment);
      walletService.creditFromOrder.mockResolvedValue({} as never);

      const result = await service.updateManualPaymentStatus(orderId, {
        status: PaymentStatus.COMPLETED,
        adminNote: 'Comprobante QR validado',
      });

      expect(order.status).toBe(OrderStatus.PAID);
      expect(payment.status).toBe(PaymentStatus.COMPLETED);
      expect(payment.adminNote).toBe('Comprobante QR validado');
      expect(walletService.creditFromOrder).toHaveBeenCalledTimes(2);
      expect(result.paymentStatus).toBe(PaymentStatus.COMPLETED);
    });

    it('rechaza la aprobacion manual de un metodo automatico', async () => {
      const order = createOrder({
        paymentMethod: PaymentMethod.MERCADO_PAGO,
      });
      orderRepository.findOne?.mockResolvedValue(order);

      await expect(
        service.updateManualPaymentStatus(orderId, {
          status: PaymentStatus.COMPLETED,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(paymentRepository.save).not.toHaveBeenCalled();
      expect(orderRepository.save).not.toHaveBeenCalled();
      expect(walletService.creditFromOrder).not.toHaveBeenCalled();
    });

    it('exige comprobante antes de aprobar un pago QR manual', async () => {
      const payment = {
        id: 'payment-qr',
        method: PaymentMethod.GETNET_QR,
        status: PaymentStatus.PENDING,
        amount: 1500,
      } as PaymentEntity;
      const order = createOrder({
        paymentMethod: PaymentMethod.GETNET_QR,
        payment,
      });
      orderRepository.findOne?.mockResolvedValue(order);

      await expect(
        service.updateManualPaymentStatus(orderId, {
          status: PaymentStatus.COMPLETED,
        }),
      ).rejects.toThrow('El comprobante del pago QR es obligatorio');

      expect(walletService.creditFromOrder).not.toHaveBeenCalled();
    });

    it('no vuelve a acreditar un pago QR que ya estaba aprobado', async () => {
      const payment = {
        id: 'payment-qr',
        method: PaymentMethod.GETNET_QR,
        status: PaymentStatus.COMPLETED,
        amount: 1500,
        proofImageUrl: 'https://example.com/proof.png',
      } as PaymentEntity;
      const order = createOrder({
        paymentMethod: PaymentMethod.GETNET_QR,
        payment,
      });
      order.status = OrderStatus.PAID;
      orderRepository.findOne?.mockResolvedValue(order);

      await expect(
        service.updateManualPaymentStatus(orderId, {
          status: PaymentStatus.COMPLETED,
        }),
      ).resolves.toEqual({
        orderId,
        orderStatus: OrderStatus.PAID,
        paymentStatus: PaymentStatus.COMPLETED,
        message: 'Pago confirmado, estamos asignando a un repartidor',
      });

      expect(walletService.creditFromOrder).not.toHaveBeenCalled();
      expect(notificationsService.createManyOnce).toHaveBeenCalled();
    });
  });
});
