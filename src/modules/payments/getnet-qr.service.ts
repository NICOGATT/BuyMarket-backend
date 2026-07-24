import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import {
  Order,
  OrderStatus,
  PaymentMethod,
} from '../orders/entities/order.entity';
import {
  Payment as PaymentEntity,
  PaymentStatus,
} from './entity/payment.entity';
import {
  PaymentAttempt,
  PaymentAttemptStatus,
} from './entity/payment-attempt.entity';
import { GetnetQrClient, GetnetQrPayment } from './getnet-qr.client';
import { PaymentsService } from './payments.service';

type JsonRecord = Record<string, unknown>;

@Injectable()
export class GetnetQrService {
  private readonly logger = new Logger(GetnetQrService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly getnetQrClient: GetnetQrClient,
    private readonly paymentsService: PaymentsService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    @InjectRepository(PaymentAttempt)
    private readonly attemptRepository: Repository<PaymentAttempt>,
  ) {}

  getCapabilities() {
    return { getnetQrEnabled: this.getnetQrClient.isConfigured() };
  }

  async createPayment(orderId: string, userId: string) {
    if (!this.getnetQrClient.isConfigured()) {
      throw new ServiceUnavailableException(
        'El pago con QR de Getnet todavia no esta disponible',
      );
    }

    const order = await this.orderRepository.findOne({
      where: { id: orderId, buyer: { id: userId } },
      relations: ['buyer', 'payment', 'payment.attempts'],
    });

    if (!order) throw new NotFoundException('Orden no encontrada');
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('La orden no esta pendiente de pago');
    }
    if (order.paymentMethod !== PaymentMethod.GETNET_QR) {
      throw new BadRequestException('La orden no usa Getnet QR');
    }

    const payment =
      order.payment ??
      (await this.paymentRepository.save(
        this.paymentRepository.create({
          method: PaymentMethod.GETNET_QR,
          status: PaymentStatus.PENDING,
          amount: order.total,
          order,
        }),
      ));
    const now = new Date();
    const activeAttempt = payment.attempts
      ?.filter(
        (attempt) =>
          attempt.status === PaymentAttemptStatus.PENDING &&
          Boolean(attempt.qrPayload) &&
          Boolean(attempt.expiresAt) &&
          attempt.expiresAt!.getTime() > now.getTime(),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    if (activeAttempt) return this.response(order, activeAttempt);

    const expiredAttempts =
      payment.attempts?.filter(
        (attempt) =>
          attempt.status === PaymentAttemptStatus.PENDING &&
          attempt.expiresAt &&
          attempt.expiresAt.getTime() <= now.getTime(),
      ) ?? [];
    if (expiredAttempts.length > 0) {
      expiredAttempts.forEach((attempt) => {
        attempt.status = PaymentAttemptStatus.EXPIRED;
      });
      await this.attemptRepository.save(expiredAttempts);
    }

    const attemptId = randomUUID();
    const attempt = await this.attemptRepository.save(
      this.attemptRepository.create({
        id: attemptId,
        idempotencyKey: attemptId,
        status: PaymentAttemptStatus.PENDING,
        payment,
      }),
    );

    try {
      const result = await this.getnetQrClient.createPayment({
        idempotencyKey: attempt.idempotencyKey,
        requestId: attempt.id,
        orderId: order.id,
        paymentId: attempt.id,
        amount: this.toCents(order.total),
        customerId: order.buyer.id,
        customerEmail: order.buyer.email,
      });
      attempt.externalPaymentId = result.paymentId;
      attempt.qrPayload = result.qrPayload;
      attempt.expiresAt = this.resolveExpiration(result.expiresAt);
      await this.attemptRepository.save(attempt);
      order.paymentId = result.paymentId;
      order.paymentStatus = PaymentStatus.PENDING;
      await this.orderRepository.save(order);
      return this.response(order, attempt);
    } catch (error) {
      attempt.status = PaymentAttemptStatus.ERROR;
      await this.attemptRepository.save(attempt);
      throw error;
    }
  }

  async handleWebhook(body: unknown) {
    const externalPaymentId = this.extractPaymentId(body);

    if (!externalPaymentId) {
      this.logger.warn('Ignoring Getnet QR webhook without payment id');
      return { received: true };
    }

    const attempt = await this.attemptRepository.findOne({
      where: { externalPaymentId },
      relations: ['payment', 'payment.order'],
    });
    if (!attempt) {
      this.logger.warn('Ignoring Getnet QR webhook for unknown payment');
      return { received: true };
    }

    const providerPayment =
      await this.getnetQrClient.getPayment(externalPaymentId);
    const order = attempt.payment.order;
    if (!this.matchesOrder(providerPayment, order)) {
      this.logger.warn(`Ignoring inconsistent Getnet QR payment ${order.id}`);
      return { received: true };
    }

    const status = this.normalizeStatus(providerPayment.status);
    if (!status) {
      this.logger.warn('Ignoring Getnet QR webhook with unknown status');
      return { received: true };
    }

    const transition = await this.applyStatus(attempt.id, status);
    if (transition.approved) {
      const approvedOrder = await this.orderRepository.findOne({
        where: { id: transition.orderId },
        relations: [
          'buyer',
          'items',
          'items.product',
          'items.product.seller',
          'items.product.seller.plan',
        ],
      });

      if (approvedOrder) {
        const sellers = await this.paymentsService.creditSellersFromOrder(
          approvedOrder,
          true,
        );
        await this.paymentsService.notifyApprovedOrder(approvedOrder, sellers);
      }
    }

    if (transition.rejected) {
      const rejectedOrder = await this.orderRepository.findOne({
        where: { id: transition.orderId },
        relations: ['buyer'],
      });
      if (rejectedOrder) {
        await this.paymentsService.notifyRejectedPayment(rejectedOrder);
      }
    }

    return { received: true };
  }

  private async applyStatus(attemptId: string, status: PaymentAttemptStatus) {
    return this.dataSource.transaction(async (manager) => {
      const attempt = await manager.getRepository(PaymentAttempt).findOne({
        where: { id: attemptId },
        relations: ['payment', 'payment.order'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!attempt) return { orderId: '', approved: false, rejected: false };
      const payment = attempt.payment;
      const order = payment.order;
      const wasPaid = order.status === OrderStatus.PAID;
      const wasRejected = order.status === OrderStatus.REJECTED;
      attempt.status = status;

      if (status === PaymentAttemptStatus.APPROVED) {
        payment.status = PaymentStatus.COMPLETED;
        order.status = OrderStatus.PAID;
        order.paymentStatus = 'APPROVED';
        order.paymentId = attempt.externalPaymentId;
      } else if (
        !wasPaid &&
        [
          PaymentAttemptStatus.REJECTED,
          PaymentAttemptStatus.CANCELED,
          PaymentAttemptStatus.ERROR,
        ].includes(status)
      ) {
        payment.status = PaymentStatus.REJECTED;
        order.status = OrderStatus.REJECTED;
        order.paymentStatus = status;
      }

      await manager.getRepository(PaymentAttempt).save(attempt);
      await manager.getRepository(PaymentEntity).save(payment);
      await manager.getRepository(Order).save(order);

      return {
        orderId: order.id,
        approved: status === PaymentAttemptStatus.APPROVED && !wasPaid,
        rejected:
          !wasPaid &&
          !wasRejected &&
          [
            PaymentAttemptStatus.REJECTED,
            PaymentAttemptStatus.CANCELED,
            PaymentAttemptStatus.ERROR,
          ].includes(status),
      };
    });
  }

  private matchesOrder(provider: GetnetQrPayment, order: Order) {
    return (
      (!provider.orderId || provider.orderId === order.id) &&
      (!provider.currency || provider.currency === 'ARS') &&
      (provider.amount === undefined ||
        provider.amount === this.toCents(order.total))
    );
  }

  private normalizeStatus(status?: string) {
    switch (status?.toUpperCase()) {
      case 'APPROVED':
      case 'CAPTURED':
        return PaymentAttemptStatus.APPROVED;
      case 'DENIED':
      case 'REJECTED':
        return PaymentAttemptStatus.REJECTED;
      case 'CANCELED':
      case 'CANCELLED':
        return PaymentAttemptStatus.CANCELED;
      case 'EXPIRED':
        return PaymentAttemptStatus.EXPIRED;
      case 'ERROR':
        return PaymentAttemptStatus.ERROR;
      case 'PENDING':
      case 'WAITING':
        return PaymentAttemptStatus.PENDING;
      default:
        return undefined;
    }
  }

  private extractPaymentId(body: unknown) {
    if (typeof body !== 'object' || body === null) return undefined;
    const root = body as JsonRecord;
    const data = this.asRecord(root.data);
    const payment = this.asRecord(root.payment ?? data.payment);
    const value =
      root.payment_id ??
      root.paymentId ??
      data.payment_id ??
      payment.payment_id;
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private asRecord(value: unknown): JsonRecord {
    return typeof value === 'object' && value !== null
      ? (value as JsonRecord)
      : {};
  }

  private resolveExpiration(value?: string) {
    const parsed = value ? new Date(value) : undefined;
    if (parsed && Number.isFinite(parsed.getTime())) return parsed;
    const minutes = Number(
      this.configService.get<string>('GETNET_QR_EXPIRATION_MINUTES') ?? 10,
    );
    return new Date(Date.now() + Math.max(1, minutes) * 60_000);
  }

  private response(order: Order, attempt: PaymentAttempt) {
    if (!attempt.qrPayload || !attempt.expiresAt) {
      throw new BadRequestException('El intento QR no esta listo');
    }
    return {
      orderId: order.id,
      paymentAttemptId: attempt.id,
      qrPayload: attempt.qrPayload,
      expiresAt: attempt.expiresAt.toISOString(),
      paymentStatus: PaymentStatus.PENDING,
    };
  }

  private toCents(value: number | string) {
    return Math.round(Number(value) * 100);
  }
}
