/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus, PaymentMethod } from '../orders/entities/order.enums';
import { Payment, PaymentStatus } from './entity/payment.entity';
import {
  PaymentAttempt,
  PaymentAttemptStatus,
} from './entity/payment-attempt.entity';
import { GetnetQrService } from './getnet-qr.service';

describe('GetnetQrService', () => {
  const buyer = { id: 'buyer-1', email: 'buyer@test.com' };
  const payment = {
    id: 'logical-payment-1',
    method: PaymentMethod.GETNET_QR,
    status: PaymentStatus.PENDING,
    amount: 1500,
    attempts: [],
  } as any;
  const order = {
    id: 'order-1',
    buyer,
    status: OrderStatus.PENDING,
    paymentMethod: PaymentMethod.GETNET_QR,
    payment,
    total: 1500,
  } as any;

  let orderRepository: any;
  let paymentRepository: any;
  let attemptRepository: any;
  let client: any;
  let paymentsService: any;
  let dataSource: any;
  let service: GetnetQrService;

  beforeEach(() => {
    payment.attempts = [];
    payment.status = PaymentStatus.PENDING;
    order.status = OrderStatus.PENDING;
    order.paymentStatus = undefined;
    orderRepository = {
      findOne: jest.fn().mockResolvedValue(order),
      save: jest.fn(async (value) => value),
    };
    paymentRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    attemptRepository = {
      create: jest.fn((value) => ({
        createdAt: new Date(),
        updatedAt: new Date(),
        ...value,
      })),
      save: jest.fn(async (value) => value),
      findOne: jest.fn(),
    };
    client = {
      isConfigured: jest.fn().mockReturnValue(true),
      createPayment: jest.fn().mockResolvedValue({
        paymentId: 'external-payment-1',
        qrPayload: '000201payload',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
      getPayment: jest.fn(),
    };
    paymentsService = {
      creditSellersFromOrder: jest.fn().mockResolvedValue([]),
      notifyApprovedOrder: jest.fn(),
      notifyRejectedPayment: jest.fn(),
    };
    dataSource = { transaction: jest.fn() };
    service = new GetnetQrService(
      { get: jest.fn(() => undefined) } as unknown as ConfigService,
      dataSource as DataSource,
      client,
      paymentsService,
      orderRepository,
      paymentRepository,
      attemptRepository,
    );
  });

  it('crea el intento en centavos y persiste el payload interoperable', async () => {
    const result = await service.createPayment(order.id, buyer.id);

    expect(client.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: order.id,
        amount: 150000,
        customerId: buyer.id,
      }),
    );
    expect(result).toMatchObject({
      orderId: order.id,
      qrPayload: '000201payload',
      paymentStatus: PaymentStatus.PENDING,
    });
  });

  it('reutiliza un intento pendiente que todavia no vencio', async () => {
    const activeAttempt = {
      id: 'attempt-1',
      status: PaymentAttemptStatus.PENDING,
      qrPayload: 'active-payload',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    };
    payment.attempts = [activeAttempt] as any;

    const result = await service.createPayment(order.id, buyer.id);

    expect(result.qrPayload).toBe('active-payload');
    expect(client.createPayment).not.toHaveBeenCalled();
  });

  it('valida el webhook con Getnet y acredita una aprobacion una sola vez', async () => {
    const attempt = {
      id: 'attempt-1',
      externalPaymentId: 'external-payment-1',
      status: PaymentAttemptStatus.PENDING,
      payment: { ...payment, order },
    };
    attemptRepository.findOne.mockResolvedValue(attempt);
    client.getPayment.mockResolvedValue({
      paymentId: 'external-payment-1',
      orderId: order.id,
      amount: 150000,
      currency: 'ARS',
      status: 'APPROVED',
    });
    const managerRepositories = new Map<any, any>();
    const manager = {
      getRepository: jest.fn((entity) => managerRepositories.get(entity)),
    };
    const savingRepository = {
      findOne: jest.fn().mockResolvedValue(attempt),
      save: jest.fn(async (value) => value),
    };
    managerRepositories.set(PaymentAttempt, savingRepository);
    managerRepositories.set(Payment, savingRepository);
    managerRepositories.set(Order, savingRepository);
    dataSource.transaction.mockImplementation((callback: any) =>
      callback(manager),
    );

    await service.handleWebhook({ payment_id: 'external-payment-1' });

    expect(client.getPayment).toHaveBeenCalledWith('external-payment-1');
    expect(paymentsService.creditSellersFromOrder).toHaveBeenCalledTimes(1);
    expect(paymentsService.notifyApprovedOrder).toHaveBeenCalledTimes(1);

    order.status = OrderStatus.PAID;
    await service.handleWebhook({ payment_id: 'external-payment-1' });
    expect(paymentsService.creditSellersFromOrder).toHaveBeenCalledTimes(1);
  });

  it('ignora un monto que no coincide sin mutar la orden', async () => {
    attemptRepository.findOne.mockResolvedValue({
      id: 'attempt-1',
      payment: { ...payment, order },
    });
    client.getPayment.mockResolvedValue({
      paymentId: 'external-payment-1',
      orderId: order.id,
      amount: 1,
      currency: 'ARS',
      status: 'APPROVED',
    });

    await service.handleWebhook({ payment_id: 'external-payment-1' });

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(paymentsService.creditSellersFromOrder).not.toHaveBeenCalled();
  });
});
