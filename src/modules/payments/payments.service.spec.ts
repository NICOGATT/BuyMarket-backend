import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';

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

  const buyerId = 'bdb0526e-0ee2-473d-8daa-a6e63c811f8f';
  const orderId = '559b0806-5ec7-4669-b512-370136e57b8b';
  const sellerId = 'a3b08f39-e5e4-4907-a43a-cef3248e2bb2';
  const secondSellerId = '7a4db075-b46b-4c39-bb37-1e9a8a87e73d';

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const values: Record<string, string> = {
                MP_ACCESS_TOKEN: 'fake-access-token',
                BACKEND_URL: 'https://api.test.com',
                FRONTEND_SUCCESS_URL: 'https://front.test.com/success',
                FRONTEND_FAILURE_URL: 'https://front.test.com/failure',
                FRONTEND_PENDING_URL: 'https://front.test.com/pending',
                GETNET_WEBHOOK_USERNAME: 'getnet-user',
                GETNET_WEBHOOK_PASSWORD: 'getnet-password',
              };

              return values[key];
            }),
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
    it('crea un payment intent global y devuelve el contrato del iframe', async () => {
      const order = createOrder({ paymentMethod: PaymentMethod.GETNET });
      orderRepository.findOne?.mockResolvedValue(order);
      orderRepository.save?.mockResolvedValue(order);
      getnetClient.createPaymentIntent.mockResolvedValue({
        payment_intent_id: 'getnet-intent-1',
      });

      const result = await service.createGetnetOrder(orderId, buyerId);

      expect(getnetClient.createPaymentIntent).toHaveBeenCalledWith({
        order_id: orderId,
        payment: { currency: 'ARS', amount: 150000 },
        product: [
          {
            product_type: 'physical_goods',
            title: 'Notebook',
            description: 'Notebook para trabajo',
            value: 100000,
            quantity: 1,
          },
          {
            product_type: 'physical_goods',
            title: 'Mouse',
            description: 'Mouse inalambrico',
            value: 25000,
            quantity: 2,
          },
        ],
        customer: {
          customer_id: buyerId,
          first_name: 'Nico',
          last_name: 'Gatti',
          name: 'Nico Gatti',
          email: 'buyer@test.com',
          document_type: 'DNI',
          checked_email: true,
        },
      });
      expect(order.paymentPreferenceId).toBe('getnet-intent-1');
      expect(order.paymentStatus).toBe('Pending');
      expect(result).toEqual({
        orderId,
        paymentIntentId: 'getnet-intent-1',
        checkoutType: 'iframe',
        loaderUrl:
          'https://www.pre.globalgetnet.com/digital-checkout/loader.js',
      });
    });

    it('reutiliza un payment intent previamente guardado', async () => {
      const order = createOrder({
        paymentMethod: PaymentMethod.GETNET,
        paymentPreferenceId: 'existing-intent',
      });
      orderRepository.findOne?.mockResolvedValue(order);

      const result = await service.createGetnetOrder(orderId, buyerId);

      expect(getnetClient.createPaymentIntent).not.toHaveBeenCalled();
      expect(orderRepository.save).not.toHaveBeenCalled();
      expect(result.paymentIntentId).toBe('existing-intent');
    });

    it('rechaza una orden que no usa Getnet', async () => {
      orderRepository.findOne?.mockResolvedValue(createOrder());

      await expect(
        service.createGetnetOrder(orderId, buyerId),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(getnetClient.createPaymentIntent).not.toHaveBeenCalled();
    });
  });

  describe('handleGetnetWebhook', () => {
    const authorization = `Basic ${Buffer.from(
      'getnet-user:getnet-password',
    ).toString('base64')}`;

    const createGetnetWebhook = (status: 'Authorized' | 'Denied') => ({
      payment_intent_id: 'getnet-intent-1',
      checkout_id: 'checkout-1',
      order_id: orderId,
      mode: 'instant',
      payment: {
        method: 'credit',
        amount: 150000,
        currency: 'ARS',
        result: {
          payment_id: 'getnet-payment-1',
          status,
        },
      },
    });

    const createGetnetOrder = (overrides: Partial<Order> = {}) =>
      createOrder({
        paymentMethod: PaymentMethod.GETNET,
        paymentPreferenceId: 'getnet-intent-1',
        ...overrides,
      });

    it('rechaza webhooks sin Basic Auth valida', async () => {
      await expect(
        service.handleGetnetWebhook(
          undefined,
          createGetnetWebhook('Authorized'),
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(orderRepository.findOne).not.toHaveBeenCalled();
    });

    it('confirma un pago autorizado y acredita una sola vez', async () => {
      const order = createGetnetOrder();
      orderRepository.findOne?.mockResolvedValue(order);
      orderRepository.save?.mockResolvedValue(order);

      await expect(
        service.handleGetnetWebhook(
          authorization,
          createGetnetWebhook('Authorized'),
        ),
      ).resolves.toEqual({ received: true });

      expect(order.status).toBe(OrderStatus.PAID);
      expect(order.paymentId).toBe('getnet-payment-1');
      expect(order.paymentStatus).toBe('Authorized');
      expect(walletService.creditFromOrder).toHaveBeenCalledTimes(2);

      orderRepository.findOne?.mockResolvedValue(order);
      jest.clearAllMocks();
      await service.handleGetnetWebhook(
        authorization,
        createGetnetWebhook('Authorized'),
      );
      expect(walletService.creditFromOrder).not.toHaveBeenCalled();
      expect(notificationsService.createManyOnce).not.toHaveBeenCalled();
    });

    it('marca la orden como rechazada sin acreditar vendedores', async () => {
      const order = createGetnetOrder();
      orderRepository.findOne?.mockResolvedValue(order);
      orderRepository.save?.mockResolvedValue(order);

      await service.handleGetnetWebhook(
        authorization,
        createGetnetWebhook('Denied'),
      );

      expect(order.status).toBe(OrderStatus.REJECTED);
      expect(order.paymentStatus).toBe('Denied');
      expect(walletService.creditFromOrder).not.toHaveBeenCalled();
      expect(notificationsService.createOnce).toHaveBeenCalled();
    });

    it('ignora ordenes e intents desconocidos', async () => {
      orderRepository.findOne?.mockResolvedValueOnce(null);
      await service.handleGetnetWebhook(
        authorization,
        createGetnetWebhook('Authorized'),
      );

      orderRepository.findOne?.mockResolvedValueOnce(
        createGetnetOrder({ paymentPreferenceId: 'another-intent' }),
      );
      await service.handleGetnetWebhook(
        authorization,
        createGetnetWebhook('Authorized'),
      );

      expect(orderRepository.save).not.toHaveBeenCalled();
      expect(walletService.creditFromOrder).not.toHaveBeenCalled();
    });

    it('rechaza montos o monedas que no coinciden', async () => {
      orderRepository.findOne?.mockResolvedValue(createGetnetOrder());
      const webhook = createGetnetWebhook('Authorized');
      webhook.payment.amount = 1;

      await expect(
        service.handleGetnetWebhook(authorization, webhook),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(walletService.creditFromOrder).not.toHaveBeenCalled();
    });

    it('ignora estados futuros que todavia no reconoce', async () => {
      orderRepository.findOne?.mockResolvedValue(createGetnetOrder());
      const webhook = createGetnetWebhook('Authorized');
      webhook.payment.result.status = 'Pending' as 'Authorized';

      await expect(
        service.handleGetnetWebhook(authorization, webhook),
      ).resolves.toEqual({ received: true });
      expect(orderRepository.save).not.toHaveBeenCalled();
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
