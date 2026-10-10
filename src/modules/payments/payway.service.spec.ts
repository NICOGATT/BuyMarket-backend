/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  Order,
  OrderStatus,
  PaymentMethod,
} from '../orders/entities/order.entity';
import { Payment } from './entity/payment.entity';
import { PaymentAttemptStatus } from './entity/payment-attempt.entity';
import { PaywayClient } from './payway.client';
import { PaywayService } from './payway.service';

describe('PaywayService', () => {
  const orderId = 'order-1';
  const userId = 'user-1';

  let orderRepository: { findOne: jest.Mock; save: jest.Mock };
  let paymentRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let attemptRepository: { save: jest.Mock; create: jest.Mock };
  let paywayClient: { isConfigured: jest.Mock; createPaymentLink: jest.Mock };
  let service: PaywayService;

  const buildOrder = (overrides: Partial<Order> = {}) =>
    ({
      id: orderId,
      status: OrderStatus.PENDING,
      paymentMethod: PaymentMethod.PAYWAY,
      total: 2500.499,
      buyer: { id: userId },
      ...overrides,
    }) as unknown as Order;

  beforeEach(() => {
    orderRepository = { findOne: jest.fn(), save: jest.fn() };
    paymentRepository = {
      findOne: jest.fn(),
      save: jest.fn(async (value) => value),
      create: jest.fn((value) => value),
    };
    attemptRepository = {
      save: jest.fn(async (value) => ({ id: 'attempt-1', ...value })),
      create: jest.fn((value) => value),
    };
    paywayClient = {
      isConfigured: jest.fn().mockReturnValue(true),
      createPaymentLink: jest.fn().mockResolvedValue({
        paymentId: 'link-1',
        checkoutUrl: 'https://developers.decidir.com/web/checkout/link-1',
      }),
    };

    const manager = {
      getRepository: (entity: unknown) =>
        entity === Order
          ? orderRepository
          : entity === Payment
            ? paymentRepository
            : attemptRepository,
    };
    const dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
    } as unknown as DataSource;
    const values: Record<string, string> = {
      BACKEND_URL: 'https://api.test/',
      FRONTEND_SUCCESS_URL: 'https://front.test/success',
      FRONTEND_FAILURE_URL: 'https://front.test/failure',
    };
    const config = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;

    service = new PaywayService(
      config,
      paywayClient as unknown as PaywayClient,
      dataSource,
    );

    orderRepository.findOne.mockResolvedValue(buildOrder());
    paymentRepository.findOne.mockResolvedValue({
      id: 'payment-1',
      attempts: [],
    });
  });

  it('expone si Payway esta habilitado en capabilities', () => {
    paywayClient.isConfigured.mockReturnValue(false);

    expect(service.getCapabilities()).toEqual({ paywayEnabled: false });
  });

  it('rechaza con 503 si Payway no esta configurado', async () => {
    paywayClient.isConfigured.mockReturnValue(false);

    await expect(
      service.createPaymentLink(orderId, userId),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('responde 404 si la orden no existe o es de otro usuario', async () => {
    orderRepository.findOne
      .mockResolvedValueOnce(buildOrder())
      .mockResolvedValueOnce(
        buildOrder({ buyer: { id: 'otro' } as Order['buyer'] }),
      );

    await expect(
      service.createPaymentLink(orderId, userId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza ordenes no pendientes o con otro metodo de pago', async () => {
    orderRepository.findOne.mockResolvedValue(
      buildOrder({ status: OrderStatus.PAID }),
    );
    await expect(
      service.createPaymentLink(orderId, userId),
    ).rejects.toBeInstanceOf(BadRequestException);

    orderRepository.findOne.mockResolvedValue(
      buildOrder({ paymentMethod: PaymentMethod.GETNET }),
    );
    await expect(
      service.createPaymentLink(orderId, userId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(paywayClient.createPaymentLink).not.toHaveBeenCalled();
  });

  it('crea el link, guarda el intento y deja la orden pendiente', async () => {
    const result = await service.createPaymentLink(orderId, userId);

    expect(paywayClient.createPaymentLink).toHaveBeenCalledWith({
      description: 'Orden order-1',
      totalPrice: 2500.5,
      successUrl: 'https://front.test/success?orderId=order-1',
      cancelUrl: 'https://front.test/failure?orderId=order-1',
      notificationsUrl:
        'https://api.test/payments/payway/webhook?attempt=attempt-1',
    });
    expect(attemptRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        externalPaymentId: 'link-1',
        checkoutUrl: 'https://developers.decidir.com/web/checkout/link-1',
      }),
    );
    expect(orderRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentPreferenceId: 'link-1',
        paymentStatus: 'PENDING',
      }),
    );
    expect(result).toEqual({
      orderId,
      paymentId: 'link-1',
      checkoutUrl: 'https://developers.decidir.com/web/checkout/link-1',
      checkoutType: 'redirect',
    });
  });

  it('reutiliza el intento vigente sin pedir otro link a Payway', async () => {
    paymentRepository.findOne.mockResolvedValue({
      id: 'payment-1',
      attempts: [
        {
          status: PaymentAttemptStatus.PENDING,
          externalPaymentId: 'link-vigente',
          checkoutUrl:
            'https://developers.decidir.com/web/checkout/link-vigente',
          expiresAt: new Date(Date.now() + 60_000),
          createdAt: new Date(),
        },
      ],
    });

    const result = await service.createPaymentLink(orderId, userId);

    expect(paywayClient.createPaymentLink).not.toHaveBeenCalled();
    expect(result.paymentId).toBe('link-vigente');
  });

  it('cierra los intentos vencidos antes de crear uno nuevo', async () => {
    const expired = {
      status: PaymentAttemptStatus.PENDING,
      externalPaymentId: 'link-viejo',
      checkoutUrl: 'https://developers.decidir.com/web/checkout/link-viejo',
      expiresAt: new Date(Date.now() - 60_000),
      createdAt: new Date(),
    };
    paymentRepository.findOne.mockResolvedValue({
      id: 'payment-1',
      attempts: [expired],
    });

    await service.createPaymentLink(orderId, userId);

    expect(expired.status).toBe(PaymentAttemptStatus.EXPIRED);
    expect(paywayClient.createPaymentLink).toHaveBeenCalledTimes(1);
  });

  it('la notificacion solo se registra: no toca ordenes ni pagos', () => {
    const result = service.handleNotification('attempt-1', {
      status: 'approved',
    });

    expect(result).toEqual({ received: true });
    expect(orderRepository.save).not.toHaveBeenCalled();
    expect(paymentRepository.save).not.toHaveBeenCalled();
  });
});
