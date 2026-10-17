import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
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
import { PaywayClient } from './payway.client';

const PAYWAY_LINK_TTL_MS = 60 * 60 * 1000;
const MAX_LOGGED_NOTIFICATION_CHARS = 2000;

@Injectable()
export class PaywayService {
  private readonly logger = new Logger(PaywayService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly paywayClient: PaywayClient,
    private readonly dataSource: DataSource,
  ) {}

  getCapabilities() {
    return { paywayEnabled: this.paywayClient.isConfigured() };
  }

  /**
   * Crea (o reutiliza) el link del formulario de pago de Payway para una orden.
   * Se serializa por orden con un lock de fila para que dos llamadas
   * simultaneas no generen dos links: la segunda reutiliza el intento vigente.
   */
  async createPaymentLink(orderId: string, userId: string) {
    if (!this.paywayClient.isConfigured()) {
      throw new ServiceUnavailableException(
        'El pago con Payway todavia no esta disponible',
      );
    }

    return this.dataSource.transaction((manager) =>
      this.createPaymentLinkWithinTransaction(manager, orderId, userId),
    );
  }

  /**
   * FASE 1 (descubrimiento): Payway no documenta publicamente el formato de la
   * notificacion, asi que por ahora solo se registra (truncada) para conocerlo
   * en sandbox. NO modifica ordenes ni pagos: la acreditacion se implementa en
   * la fase 2, verificando el pago contra la API de Payway.
   */
  handleNotification(attemptId: string | undefined, body: unknown) {
    let serialized = '';
    try {
      serialized = JSON.stringify(body ?? null).slice(
        0,
        MAX_LOGGED_NOTIFICATION_CHARS,
      );
    } catch {
      serialized = '[unserializable]';
    }

    this.logger.log(
      `Payway notification received attempt=${attemptId ?? 'n/a'} body=${serialized}`,
    );

    return { received: true };
  }

  private async createPaymentLinkWithinTransaction(
    manager: EntityManager,
    orderId: string,
    userId: string,
  ) {
    const orderRepository = manager.getRepository(Order);
    // Lock sin joins: FOR UPDATE con LEFT JOIN falla en PostgreSQL.
    const lockedOrder = await orderRepository.findOne({
      where: { id: orderId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!lockedOrder) {
      throw new NotFoundException('Orden no encontrada');
    }

    const order = await orderRepository.findOne({
      where: { id: lockedOrder.id },
      relations: ['buyer'],
    });

    if (!order || order.buyer?.id !== userId) {
      throw new NotFoundException('Orden no encontrada');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('La orden no esta pendiente de pago');
    }

    if (order.paymentMethod !== PaymentMethod.PAYWAY) {
      throw new BadRequestException(
        'La orden no usa Payway como metodo de pago',
      );
    }

    const paymentRepository = manager.getRepository(PaymentEntity);
    let payment = await paymentRepository.findOne({
      where: { order: { id: order.id } },
      relations: ['attempts'],
    });

    if (!payment) {
      payment = await paymentRepository.save(
        paymentRepository.create({
          method: PaymentMethod.PAYWAY,
          status: PaymentStatus.PENDING,
          amount: Number(order.total),
          order,
        }),
      );
    }

    const now = new Date();
    const attempts = payment.attempts ?? [];
    const reusable = attempts
      .filter(
        (attempt) =>
          attempt.status === PaymentAttemptStatus.PENDING &&
          Boolean(attempt.externalPaymentId) &&
          Boolean(attempt.checkoutUrl) &&
          (!attempt.expiresAt || attempt.expiresAt.getTime() > now.getTime()),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    if (reusable) {
      return this.checkoutResponse(order, reusable);
    }

    const attemptRepository = manager.getRepository(PaymentAttempt);
    const stale = attempts.filter(
      (attempt) => attempt.status === PaymentAttemptStatus.PENDING,
    );
    if (stale.length > 0) {
      stale.forEach((attempt) => {
        attempt.status =
          attempt.expiresAt && attempt.expiresAt.getTime() <= now.getTime()
            ? PaymentAttemptStatus.EXPIRED
            : PaymentAttemptStatus.CANCELED;
      });
      await attemptRepository.save(stale);
    }

    const attempt = await attemptRepository.save(
      attemptRepository.create({
        idempotencyKey: randomUUID(),
        status: PaymentAttemptStatus.PENDING,
        expiresAt: new Date(now.getTime() + PAYWAY_LINK_TTL_MS),
        payment,
      }),
    );

    const link = await this.paywayClient.createPaymentLink({
      description: `Orden ${order.id}`.slice(0, 100),
      totalPrice: Math.round(Number(order.total) * 100) / 100,
      successUrl: this.frontendUrl('FRONTEND_SUCCESS_URL', order.id),
      cancelUrl: this.frontendUrl('FRONTEND_FAILURE_URL', order.id),
      notificationsUrl: this.notificationsUrl(attempt.id),
    });

    attempt.externalPaymentId = link.paymentId;
    attempt.checkoutUrl = link.checkoutUrl;
    await attemptRepository.save(attempt);

    order.paymentPreferenceId = link.paymentId;
    order.paymentStatus = 'PENDING';
    await orderRepository.save(order);

    return this.checkoutResponse(order, attempt);
  }

  private checkoutResponse(
    order: Order,
    attempt: Pick<PaymentAttempt, 'externalPaymentId' | 'checkoutUrl'>,
  ) {
    return {
      orderId: order.id,
      paymentId: attempt.externalPaymentId ?? '',
      checkoutUrl: attempt.checkoutUrl ?? '',
      checkoutType: 'redirect' as const,
    };
  }

  private frontendUrl(key: string, orderId: string) {
    const base = this.configService.get<string>(key)?.trim();

    if (!base) {
      throw new ServiceUnavailableException(
        'La integracion con Payway todavia no esta configurada',
      );
    }

    const url = new URL(base);
    // Una barra doble en la ruta (p. ej. //checkout/failure) la rechaza Payway.
    url.pathname = url.pathname.replace(/\/{2,}/g, '/');
    url.searchParams.set('orderId', orderId);
    return url.toString();
  }

  private notificationsUrl(attemptId: string) {
    const base = this.configService.get<string>('BACKEND_URL')?.trim();

    if (!base) {
      throw new ServiceUnavailableException(
        'La integracion con Payway todavia no esta configurada',
      );
    }

    // El id va en la ruta: Payway rechaza notifications_url con query string.
    return new URL(
      `${base.replace(/\/$/, '')}/payments/payway/webhook/${encodeURIComponent(attemptId)}`,
    ).toString();
  }
}
