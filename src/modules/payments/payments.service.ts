import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import {
  MercadoPagoConfig,
  Payment as MercadoPagoPayment,
  Preference,
} from 'mercadopago';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { isUUID } from 'class-validator';
import { DataSource, EntityManager, Repository } from 'typeorm';
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
import {
  getnetAmountToPesos,
  isGetnetAmountInteger,
  toGetnetAmount,
} from './getnet-money.util';
import { NotifyTransferPaymentDto } from './dto/notify-transfer-payment.dto';
import { UpdateTransferPaymentStatusDto } from './dto/update-transfer-payment-status.dto';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { ProductMediaType } from '../products/product-media/entities/product-media.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { GetnetClient } from './getnet.client';

/**
 * Payload tolerante del webhook de Getnet Web Checkout:
 * - Variante completa: payment.result.{payment_id,status}.
 * - Variante simplificada confirmada: status / payment_id / amount / currency
 *   en el nivel superior.
 */
interface GetnetWebhookBody {
  order_id?: string;
  payment_intent_id?: string;
  status?: string;
  payment_id?: string;
  amount?: number;
  currency?: string;
  checkout_id?: string;
  mode?: string;
  payment?: {
    method?: string;
    amount?: number;
    currency?: string;
    payment_id?: string;
    result?: {
      payment_id?: string;
      status?: string;
      authorization_code?: string;
      transaction_datetime?: string;
      return_message?: string;
    };
  };
}

/** Estados finales normalizados del proveedor. */
export type GetnetNormalizedStatus = 'APPROVED' | 'REJECTED';

interface SellerPaymentSummary {
  sellerId: string;
  grossAmount: number;
  netAmount: number;
  productTitles: string[];
}

interface GetnetWebhookEvent {
  orderId?: string;
  paymentIntentId?: string;
  paymentId?: string;
  statusRaw?: string;
  status?: GetnetNormalizedStatus;
  amount?: number;
  currency?: string;
}

interface GetnetWebhookTransition {
  handled: boolean;
  duplicate: boolean;
  order?: Order;
  sellers: SellerPaymentSummary[];
  notifyApproved: boolean;
  notifyRejected: boolean;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private client: MercadoPagoConfig;

  constructor(
    private readonly configService: ConfigService,

    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,

    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,

    private readonly walletService: WalletService,

    private readonly cloudinaryService: CloudinaryService,

    private readonly notificationsService: NotificationsService,

    private readonly getnetClient: GetnetClient,

    private readonly dataSource: DataSource,
  ) {
    this.client = new MercadoPagoConfig({
      accessToken: this.configService.get<string>('MP_ACCESS_TOKEN')!,
    });

    if (this.getWebhookAuthMode() === 'none') {
      if (this.isProductionEnv()) {
        this.logger.error(
          'GETNET_WEBHOOK_AUTH_MODE=none esta prohibido en produccion: el webhook rechazara las notificaciones hasta configurar basic.',
        );
      } else {
        this.logger.warn(
          'Webhook de Getnet SIN autenticacion (GETNET_WEBHOOK_AUTH_MODE=none). Usarlo solo en local/UAT mientras Getnet no soporte Basic Auth.',
        );
      }
    }
  }

  async createMercadoPagoPreference(orderId: string, userId: string) {
    const order = await this.orderRepository.findOne({
      where: {
        id: orderId,
        buyer: { id: userId },
      },
      relations: ['buyer', 'items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('La orden no esta pendiente de pago');
    }

    if (order.paymentMethod !== PaymentMethod.MERCADO_PAGO) {
      throw new BadRequestException(
        'La orden no usa Mercado Pago como metodo de pago',
      );
    }

    const preference = new Preference(this.client);

    const successUrl = this.configService.get<string>('FRONTEND_SUCCESS_URL');
    const failureUrl = this.configService.get<string>('FRONTEND_FAILURE_URL');
    const pendingUrl = this.configService.get<string>('FRONTEND_PENDING_URL');

    const backUrls =
      successUrl && failureUrl && pendingUrl
        ? {
            success: successUrl,
            failure: failureUrl,
            pending: pendingUrl,
          }
        : undefined;

    const result = await preference.create({
      body: {
        items: order.items.map((item) => ({
          id: item.product.id,
          title: item.product.title,
          quantity: item.quantity,
          unit_price: Number(item.unitPrice),
          currency_id: 'ARS',
        })),

        external_reference: order.id,

        payer: {
          email: order.buyer.email,
          name: order.buyer.firstName,
          surname: order.buyer.lastName,
        },

        notification_url: `${this.configService.get<string>('BACKEND_URL')}/payments/mercadopago/webhook`,

        ...(backUrls ? { back_urls: backUrls } : {}),

        metadata: {
          orderId: order.id,
          buyerId: order.buyer.id,
        },
      },
    });

    order.paymentPreferenceId = result.id;
    await this.orderRepository.save(order);

    return {
      orderId: order.id,
      preferenceId: result.id,
      initPoint: result.init_point,
      sandboxInitPoint: result.sandbox_init_point,
    };
  }

  async handleMercadoPagoWebhook(body: unknown, query: unknown) {
    const paymentId = this.extractPaymentId(body, query);

    if (!paymentId) {
      return { received: true };
    }

    const paymentClient = new MercadoPagoPayment(this.client);

    const payment = await paymentClient.get({
      id: paymentId,
    });

    const orderId = payment.external_reference;

    if (!orderId) {
      return { received: true };
    }

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['buyer', 'items', 'items.product', 'items.product.seller'],
    });

    if (!order) {
      return { received: true };
    }

    order.paymentId = String(payment.id);
    order.paymentStatus = payment.status ?? undefined;

    const wasAlreadyPaid = order.status === OrderStatus.PAID;

    if (payment.status === 'approved') {
      order.status = OrderStatus.PAID;
    }

    if (payment.status === 'rejected') {
      order.status = OrderStatus.REJECTED;
    }

    if (payment.status === 'cancelled') {
      order.status = OrderStatus.CANCELLED;
    }

    await this.orderRepository.save(order);

    if (payment.status === 'approved') {
      const sellers = await this.creditSellersFromOrder(order, !wasAlreadyPaid);
      await this.notifyApprovedOrder(order, sellers);
    }

    if (payment.status === 'rejected') {
      await this.notifyRejectedPayment(order);
    }

    return { received: true };
  }

  async notifyTransferPayment(
    orderId: string,
    userId: string,
    dto: NotifyTransferPaymentDto,
  ) {
    const order = await this.orderRepository.findOne({
      where: {
        id: orderId,
        buyer: { id: userId },
      },
      relations: ['payment'],
    });

    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    if (order.paymentMethod !== PaymentMethod.TRANSFER) {
      throw new BadRequestException(
        'La orden no usa transferencia como metodo de pago',
      );
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('La orden ya fue procesada');
    }

    const payment =
      order.payment ??
      this.paymentRepository.create({
        method: PaymentMethod.TRANSFER,
        status: PaymentStatus.PENDING,
        amount: Number(order.total),
        order,
      });

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('El pago ya fue procesado');
    }

    payment.senderAlias = dto.senderAlias;
    payment.senderCbu = dto.senderCbu;

    await this.paymentRepository.save(payment);

    return {
      orderId: order.id,
      paymentStatus: payment.status,
      message: 'Estamos chequeando la transferencia',
    };
  }

  async updateTransferPaymentStatus(
    orderId: string,
    dto: UpdateTransferPaymentStatusDto,
  ) {
    return this.updateManualPaymentStatus(orderId, dto, [
      PaymentMethod.TRANSFER,
    ]);
  }

  async updateManualPaymentStatus(
    orderId: string,
    dto: UpdateTransferPaymentStatusDto,
    allowedMethods: PaymentMethod[] = [
      PaymentMethod.TRANSFER,
      PaymentMethod.GETNET_QR,
    ],
  ) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: [
        'payment',
        'buyer',
        'items',
        'items.product',
        'items.product.seller',
      ],
    });

    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    if (!allowedMethods.includes(order.paymentMethod)) {
      throw new BadRequestException(
        'La orden no usa un metodo de pago con validacion manual',
      );
    }

    if (!order.payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    if (
      dto.status === PaymentStatus.COMPLETED &&
      order.paymentMethod === PaymentMethod.GETNET_QR &&
      !order.payment.proofImageUrl
    ) {
      throw new BadRequestException(
        'El comprobante del pago QR es obligatorio',
      );
    }

    if (
      order.payment.status !== PaymentStatus.PENDING ||
      order.status !== OrderStatus.PENDING
    ) {
      const isSameCompletedStatus =
        dto.status === PaymentStatus.COMPLETED &&
        order.payment.status === PaymentStatus.COMPLETED &&
        order.status === OrderStatus.PAID;
      const isSameRejectedStatus =
        dto.status === PaymentStatus.REJECTED &&
        order.payment.status === PaymentStatus.REJECTED &&
        order.status === OrderStatus.REJECTED;

      if (isSameCompletedStatus) {
        const sellers = await this.creditSellersFromOrder(order, false);
        await this.notifyApprovedOrder(order, sellers);
        return this.manualPaymentStatusResponse(order);
      }

      if (isSameRejectedStatus) {
        await this.notifyRejectedPayment(order);
        return this.manualPaymentStatusResponse(order);
      }

      throw new BadRequestException('El pago ya fue procesado');
    }

    order.payment.status = dto.status;
    order.payment.adminNote = dto.adminNote;

    if (dto.status === PaymentStatus.COMPLETED) {
      order.status = OrderStatus.PAID;
    }

    if (dto.status === PaymentStatus.REJECTED) {
      order.status = OrderStatus.REJECTED;
    }

    await this.paymentRepository.save(order.payment);
    await this.orderRepository.save(order);

    if (dto.status === PaymentStatus.COMPLETED) {
      const sellers = await this.creditSellersFromOrder(order, true);
      await this.notifyApprovedOrder(order, sellers);

      return {
        orderId: order.id,
        orderStatus: order.status,
        paymentStatus: order.payment.status,
        message: 'Pago confirmado, estamos asignando a un repartidor',
      };
    }

    if (dto.status === PaymentStatus.REJECTED) {
      await this.notifyRejectedPayment(order);
    }

    return {
      orderId: order.id,
      orderStatus: order.status,
      paymentStatus: order.payment.status,
      message:
        order.paymentMethod === PaymentMethod.GETNET_QR
          ? 'Pago QR rechazado'
          : 'Transferencia rechazada',
    };
  }

  async creditSellersFromOrder(order: Order, shouldCredit: boolean) {
    return this.creditSellersFromOrderWithManager(order, shouldCredit);
  }

  async notifyApprovedOrder(
    order: Order,
    sellers: Array<{
      sellerId: string;
      grossAmount: number;
      netAmount: number;
      productTitles: string[];
    }>,
  ) {
    await this.notificationsService.createManyOnce([
      ...sellers.flatMap((seller) => [
        {
          userId: seller.sellerId,
          type: NotificationType.NEW_SALE,
          title: 'Recibiste una nueva venta',
          message: `Vendiste ${seller.productTitles.join(', ')} por $${seller.grossAmount.toFixed(2)}.`,
          eventKey: `order:${order.id}:seller:${seller.sellerId}:sale`,
          data: {
            orderId: order.id,
            productTitles: seller.productTitles,
            grossAmount: seller.grossAmount,
            route: '/sales',
          },
        },
        {
          userId: seller.sellerId,
          type: NotificationType.BALANCE_AVAILABLE,
          title: 'Tu dinero esta disponible',
          message: `Se acreditaron $${seller.netAmount.toFixed(2)} en tu billetera.`,
          eventKey: `order:${order.id}:seller:${seller.sellerId}:balance`,
          data: {
            orderId: order.id,
            netAmount: seller.netAmount,
            route: '/wallet',
          },
        },
      ]),
      {
        userId: order.buyer.id,
        type: NotificationType.PAYMENT_APPROVED,
        title: 'Pago aprobado',
        message: `Confirmamos el pago de tu orden por $${Number(order.total).toFixed(2)}.`,
        eventKey: `order:${order.id}:buyer:payment-approved`,
        data: {
          orderId: order.id,
          amount: Number(order.total),
          route: `/orders/${order.id}`,
        },
      },
    ]);
  }

  async notifyRejectedPayment(order: Order) {
    await this.notificationsService.createOnce({
      userId: order.buyer.id,
      type: NotificationType.PAYMENT_REJECTED,
      title: 'Pago rechazado',
      message: 'No pudimos confirmar el pago de tu orden.',
      eventKey: `order:${order.id}:buyer:payment-rejected`,
      data: {
        orderId: order.id,
        amount: Number(order.total),
        route: `/orders/${order.id}`,
      },
    });
  }

  private manualPaymentStatusResponse(order: Order) {
    const completed = order.payment?.status === PaymentStatus.COMPLETED;
    return {
      orderId: order.id,
      orderStatus: order.status,
      paymentStatus: order.payment?.status,
      message: completed
        ? 'Pago confirmado, estamos asignando a un repartidor'
        : order.paymentMethod === PaymentMethod.GETNET_QR
          ? 'Pago QR rechazado'
          : 'Transferencia rechazada',
    };
  }

  private extractPaymentId(body: unknown, query: unknown) {
    const bodyData =
      typeof body === 'object' && body !== null && 'data' in body
        ? (body as { data?: unknown }).data
        : undefined;
    const bodyId =
      typeof bodyData === 'object' && bodyData !== null && 'id' in bodyData
        ? (bodyData as { id?: unknown }).id
        : undefined;
    const queryId =
      typeof query === 'object' && query !== null && 'id' in query
        ? (query as { id?: unknown }).id
        : undefined;
    const value = bodyId ?? queryId;

    return typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : undefined;
  }

  async uploadedTranferProof(
    paymentId: string,
    file: Express.Multer.File,
    userId: string,
  ) {
    const payment = await this.paymentRepository.findOne({
      where: {
        id: paymentId,
      },
      relations: ['order', 'order.buyer'],
    });

    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    if (payment.order.buyer.id !== userId) {
      throw new ForbiddenException('No podes subir comprobante de esta orden');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Este pago ya no esta pendiente');
    }

    const uploaded = await this.cloudinaryService.uploadFile(
      file,
      'buymarket/payments/proofs',
      ProductMediaType.IMAGE,
    );

    payment.proofImageUrl = uploaded.secure_url;
    payment.proofUploadedAt = new Date();

    await this.paymentRepository.save(payment);

    return {
      message: 'Comprobante subido correctamente',
      payment,
    };
  }

  // Getnet Web Checkout Global

  /**
   * Crea (o reutiliza) la intencion de pago de Getnet para una orden.
   *
   * Toda la decision corre dentro de una transaccion con lock pesimista sobre
   * la orden: dos llamadas concurrentes no pueden generar dos intenciones
   * externas porque la segunda espera el lock y reutiliza el intento vigente.
   */
  async createGetnetOrder(orderId: string, userId: string) {
    return this.dataSource.transaction((manager) =>
      this.createGetnetIntentWithinTransaction(manager, orderId, userId),
    );
  }

  private async createGetnetIntentWithinTransaction(
    manager: EntityManager,
    orderId: string,
    userId: string,
  ) {
    const orderRepository = manager.getRepository(Order);
    const lockedOrder = await orderRepository.findOne({
      where: { id: orderId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!lockedOrder || lockedOrder.buyer?.id !== userId) {
      throw new NotFoundException('Orden no encontrada');
    }

    const order = await orderRepository.findOne({
      where: { id: lockedOrder.id },
      relations: ['buyer', 'items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('La orden no esta pendiente de pago');
    }

    if (order.paymentMethod !== PaymentMethod.GETNET) {
      throw new BadRequestException(
        'La orden no usa GetNet como metodo de pago',
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
          method: PaymentMethod.GETNET,
          status: PaymentStatus.PENDING,
          amount: Number(order.total),
          order,
        }),
      );
    }

    const now = new Date();
    const reusableAttempt = this.findReusableGetnetAttempt(
      payment.attempts ?? [],
      now,
    );

    if (reusableAttempt) {
      return this.getnetCheckoutResponse(order, reusableAttempt);
    }

    const attemptRepository = manager.getRepository(PaymentAttempt);
    await this.closeStaleGetnetAttempts(attemptRepository, payment, now);

    const attempt = await attemptRepository.save(
      attemptRepository.create({
        idempotencyKey: randomUUID(),
        status: PaymentAttemptStatus.PENDING,
        expiresAt: this.getnetIntentExpiration(now),
        payment,
      }),
    );

    try {
      const result = await this.getnetClient.createPaymentIntent({
        order_id: order.id,
        customer: {
          first_name: order.buyer.firstName.slice(0, 40),
          last_name: order.buyer.lastName.slice(0, 80),
          email: order.buyer.email,
        },
        payment: {
          currency: 'ARS',
          amount: toGetnetAmount(this.configService, order.total),
        },
      });

      attempt.externalPaymentId = result.payment_intent_id;
      attempt.checkoutUrl = result.checkout_url;
      await attemptRepository.save(attempt);

      order.paymentPreferenceId = result.payment_intent_id;
      order.paymentStatus = 'PENDING';
      await orderRepository.save(order);

      return this.getnetCheckoutResponse(order, attempt);
    } catch (error) {
      attempt.status = PaymentAttemptStatus.ERROR;
      await attemptRepository.save(attempt);
      throw error;
    }
  }

  private findReusableGetnetAttempt(
    attempts: PaymentAttempt[],
    now: Date,
  ): PaymentAttempt | undefined {
    return attempts
      .filter(
        (attempt) =>
          attempt.status === PaymentAttemptStatus.PENDING &&
          Boolean(attempt.externalPaymentId) &&
          (!attempt.expiresAt || attempt.expiresAt.getTime() > now.getTime()),
      )
      .sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      )[0];
  }

  private async closeStaleGetnetAttempts(
    attemptRepository: Repository<PaymentAttempt>,
    payment: PaymentEntity,
    now: Date,
  ) {
    const stale = (payment.attempts ?? []).filter(
      (attempt) => attempt.status === PaymentAttemptStatus.PENDING,
    );

    if (stale.length === 0) return;

    stale.forEach((attempt) => {
      const expired =
        attempt.expiresAt && attempt.expiresAt.getTime() <= now.getTime();
      attempt.status = expired
        ? PaymentAttemptStatus.EXPIRED
        : PaymentAttemptStatus.CANCELED;
    });

    await attemptRepository.save(stale);
  }

  private getnetIntentExpiration(from: Date) {
    const raw = this.configService.get<string>('GETNET_EXPIRES_AT')?.trim();
    const match = /^([1-9]\d*)([mh])$/i.exec(raw ?? '');
    const milliseconds = match
      ? match[2].toLowerCase() === 'h'
        ? Number(match[1]) * 3_600_000
        : Number(match[1]) * 60_000
      : 3_600_000;

    return new Date(from.getTime() + milliseconds);
  }

  async handleGetnetWebhook(
    authorization: string | undefined,
    body: unknown,
  ): Promise<{ received: boolean }> {
    this.validateGetnetWebhookAuthorization(authorization);

    const event = this.parseGetnetWebhookEvent(body);

    if (!event.orderId || !event.paymentIntentId || !event.statusRaw) {
      this.logIgnoredGetnetWebhook('incomplete_payload', event);
      return { received: true };
    }

    if (!isUUID(event.orderId)) {
      // Un order_id mal formado no debe tumbar la consulta (cast a uuid) ni el webhook.
      this.logIgnoredGetnetWebhook('invalid_order_id', event);
      return { received: true };
    }

    if (!event.status) {
      this.logIgnoredGetnetWebhook('unsupported_status', event);
      return { received: true };
    }

    const confirmedEvent: GetnetWebhookEvent & {
      orderId: string;
      paymentIntentId: string;
      status: GetnetNormalizedStatus;
    } = {
      ...event,
      orderId: event.orderId,
      paymentIntentId: event.paymentIntentId,
      status: event.status,
    };

    const transition = await this.dataSource.transaction((manager) =>
      this.applyGetnetWebhookTransition(manager, confirmedEvent),
    );

    if (!transition.handled || !transition.order) {
      return { received: true };
    }

    this.logger.log(
      `Processed Getnet webhook orderId=${transition.order.id} paymentIntentId=${event.paymentIntentId} paymentId=${event.paymentId ?? '-'} status=${event.status} duplicate=${transition.duplicate}`,
    );

    if (transition.notifyApproved) {
      await this.notifyApprovedOrder(transition.order, transition.sellers);
    }

    if (transition.notifyRejected) {
      await this.notifyRejectedPayment(transition.order);
    }

    return { received: true };
  }

  /**
   * Normaliza el estado crudo de Getnet al vocabulario interno.
   * Se aceptan las variantes confirmadas del proveedor:
   * - Aprobacion: APPROVED (manual simplificado) y AUTHORIZED (payload completo).
   * - Rechazo: REJECTED y DENIED.
   */
  private normalizeGetnetStatus(
    status?: string,
  ): GetnetNormalizedStatus | undefined {
    switch (status?.trim().toUpperCase()) {
      case 'APPROVED':
      case 'AUTHORIZED':
        return 'APPROVED';
      case 'REJECTED':
      case 'DENIED':
        return 'REJECTED';
      default:
        return undefined;
    }
  }

  private parseGetnetWebhookEvent(body: unknown): GetnetWebhookEvent {
    const root = this.asRecord(body);
    const payment = this.asRecord(root.payment);
    const result = this.asRecord(payment.result);

    const orderId = this.nonEmptyString(root.order_id ?? root.orderId);
    const paymentIntentId = this.nonEmptyString(
      root.payment_intent_id ?? root.paymentIntentId,
    );
    const paymentId = this.firstNonEmptyString(
      root.payment_id,
      root.paymentId,
      payment.payment_id,
      result.payment_id,
    );
    const statusRaw = this.firstNonEmptyString(root.status, result.status);
    const amount =
      typeof root.amount === 'number'
        ? root.amount
        : typeof root.amount === 'string' && root.amount.trim() !== ''
          ? Number(root.amount)
          : typeof payment.amount === 'number'
            ? payment.amount
            : typeof payment.amount === 'string' && payment.amount.trim() !== ''
              ? Number(payment.amount)
              : undefined;
    const currency = this.firstNonEmptyString(root.currency, payment.currency);

    return {
      orderId,
      paymentIntentId,
      paymentId:
        typeof paymentId === 'string' ? paymentId.trim() || undefined : undefined,
      statusRaw,
      status: this.normalizeGetnetStatus(statusRaw),
      amount: amount !== undefined && Number.isFinite(amount) ? amount : undefined,
      currency,
    };
  }

  private async applyGetnetWebhookTransition(
    manager: EntityManager,
    event: GetnetWebhookEvent & {
      orderId: string;
      paymentIntentId: string;
      status: GetnetNormalizedStatus;
    },
  ): Promise<GetnetWebhookTransition> {
    const orderRepository = manager.getRepository(Order);
    const lockedOrder = await orderRepository.findOne({
      where: { id: event.orderId, paymentMethod: PaymentMethod.GETNET },
      lock: { mode: 'pessimistic_write' },
    });

    if (!lockedOrder) {
      this.logIgnoredGetnetWebhook('unknown_order', event);
      return this.emptyGetnetTransition();
    }

    const order = await orderRepository.findOne({
      where: { id: lockedOrder.id },
      relations: [
        'buyer',
        'items',
        'items.product',
        'items.product.seller',
        'items.product.seller.plan',
      ],
    });

    if (!order) {
      throw new Error(`Locked Getnet order ${lockedOrder.id} disappeared`);
    }

    if (
      !order.paymentPreferenceId ||
      order.paymentPreferenceId !== event.paymentIntentId
    ) {
      this.logIgnoredGetnetWebhook('payment_intent_mismatch', event);
      return this.emptyGetnetTransition();
    }

    const attemptRepository = manager.getRepository(PaymentAttempt);
    let attempt = await attemptRepository.findOne({
      where: { externalPaymentId: event.paymentIntentId },
    });

    if (!attempt) {
      attempt = await this.backfillGetnetAttempt(manager, order, event);
    }

    // Evidencia de auditoria: se persiste aunque el evento luego se ignore.
    this.touchGetnetAttempt(attempt, event);
    await attemptRepository.save(attempt);

    if (
      event.currency !== undefined &&
      event.currency.trim().toUpperCase() !== 'ARS'
    ) {
      this.logIgnoredGetnetWebhook('currency_mismatch', event);
      return this.emptyGetnetTransition(true);
    }

    if (event.amount !== undefined) {
      const expectedAmount = Number(order.total);
      const receivedAmount = getnetAmountToPesos(
        this.configService,
        event.amount,
      );
      const isConsistent =
        isGetnetAmountInteger(this.configService, event.amount) &&
        Math.abs(receivedAmount - expectedAmount) <= 0.005;

      if (!isConsistent) {
        this.logIgnoredGetnetWebhook('amount_mismatch', {
          ...event,
          expectedAmount,
          receivedAmount,
        });
        return this.emptyGetnetTransition(true);
      }
    }

    const paymentRepository = manager.getRepository(PaymentEntity);

    if (event.status === 'REJECTED') {
      if (order.status === OrderStatus.PAID) {
        this.logIgnoredGetnetWebhook('paid_order_cannot_be_rejected', event);
        return this.emptyGetnetTransition(true);
      }

      const wasAlreadyRejected = order.status === OrderStatus.REJECTED;
      order.paymentId = event.paymentId ?? order.paymentId;
      order.paymentStatus = 'REJECTED';
      order.status = OrderStatus.REJECTED;
      attempt.status = PaymentAttemptStatus.REJECTED;
      await attemptRepository.save(attempt);
      await orderRepository.save(order);

      const paymentEntity = await this.findGetnetPaymentEntity(
        paymentRepository,
        order.id,
      );
      if (paymentEntity && paymentEntity.status !== PaymentStatus.COMPLETED) {
        paymentEntity.status = PaymentStatus.REJECTED;
        await paymentRepository.save(paymentEntity);
      }

      return {
        handled: true,
        duplicate: wasAlreadyRejected,
        order,
        sellers: [],
        notifyApproved: false,
        notifyRejected: !wasAlreadyRejected,
      };
    }

    const wasAlreadyPaid = order.status === OrderStatus.PAID;
    if (wasAlreadyPaid) {
      return {
        handled: true,
        duplicate: true,
        order,
        sellers: [],
        notifyApproved: false,
        notifyRejected: false,
      };
    }

    attempt.status = PaymentAttemptStatus.APPROVED;
    await attemptRepository.save(attempt);

    order.paymentId = event.paymentId ?? order.paymentId;
    order.paymentStatus = 'APPROVED';
    order.status = OrderStatus.PAID;
    await orderRepository.save(order);

    const paymentEntity = await this.findGetnetPaymentEntity(
      paymentRepository,
      order.id,
    );
    if (paymentEntity && paymentEntity.status === PaymentStatus.PENDING) {
      paymentEntity.status = PaymentStatus.COMPLETED;
      await paymentRepository.save(paymentEntity);
    }

    const sellers = await this.creditSellersFromOrderWithManager(
      order,
      true,
      manager,
    );

    return {
      handled: true,
      duplicate: false,
      order,
      sellers,
      notifyApproved: true,
      notifyRejected: false,
    };
  }

  private async backfillGetnetAttempt(
    manager: EntityManager,
    order: Order,
    event: { paymentIntentId: string },
  ): Promise<PaymentAttempt> {
    const attemptRepository = manager.getRepository(PaymentAttempt);
    const paymentRepository = manager.getRepository(PaymentEntity);
    const existingPayment = await this.findGetnetPaymentEntity(
      paymentRepository,
      order.id,
    );
    const payment =
      existingPayment ??
      (await paymentRepository.save(
        paymentRepository.create({
          method: order.paymentMethod,
          status: PaymentStatus.PENDING,
          amount: Number(order.total),
          order,
        }),
      ));

    return attemptRepository.save(
      attemptRepository.create({
        idempotencyKey: randomUUID(),
        status: PaymentAttemptStatus.PENDING,
        externalPaymentId: event.paymentIntentId,
        payment,
      }),
    );
  }

  private touchGetnetAttempt(
    attempt: PaymentAttempt,
    event: GetnetWebhookEvent,
  ) {
    attempt.rawStatus = event.statusRaw ?? attempt.rawStatus;
    attempt.lastNotifiedAt = new Date();
    if (event.paymentId) {
      attempt.providerPaymentId = event.paymentId;
    }
    attempt.metadata = {
      provider: 'getnet_web_checkout',
      status: event.statusRaw ?? null,
      paymentId: event.paymentId ?? null,
      amount: event.amount ?? null,
      currency: event.currency ?? null,
      receivedAt: attempt.lastNotifiedAt.toISOString(),
    };
  }

  private async findGetnetPaymentEntity(
    paymentRepository: Repository<PaymentEntity>,
    orderId: string,
  ) {
    return paymentRepository.findOne({ where: { order: { id: orderId } } });
  }

  private async creditSellersFromOrderWithManager(
    order: Order,
    shouldCredit: boolean,
    manager?: EntityManager,
  ) {
    const amountsBySeller = this.sellerAmountsFromOrder(order);

    for (const [sellerId, data] of amountsBySeller) {
      if (shouldCredit) {
        const params = {
          userId: sellerId,
          orderId: order.id,
          amount: data.amount,
          commisionPercentage: data.commissionPercentage,
        };
        if (manager) {
          await this.walletService.creditFromOrder(params, manager);
        } else {
          await this.walletService.creditFromOrder(params);
        }
      }
    }

    return this.sellerSummaries(amountsBySeller);
  }

  private sellerAmountsFromOrder(order: Order) {
    const amountsBySeller = new Map<
      string,
      { amount: number; commissionPercentage: number; productTitles: string[] }
    >();

    for (const item of order.items ?? []) {
      const seller = item.product?.seller;
      if (!seller?.id) continue;

      const subtotal = Number(
        item.subtotal ?? Number(item.unitPrice) * item.quantity,
      );
      const current = amountsBySeller.get(seller.id);
      const commissionPercentage = Number(
        seller.plan?.commissionPercentage ?? 0,
      );
      amountsBySeller.set(seller.id, {
        amount: (current?.amount ?? 0) + subtotal,
        commissionPercentage,
        productTitles: [...(current?.productTitles ?? []), item.product.title],
      });
    }

    return amountsBySeller;
  }

  private sellerSummaries(
    amountsBySeller: Map<
      string,
      { amount: number; commissionPercentage: number; productTitles: string[] }
    >,
  ): SellerPaymentSummary[] {
    return Array.from(amountsBySeller, ([sellerId, data]) => ({
      sellerId,
      grossAmount: data.amount,
      netAmount: data.amount - data.amount * (data.commissionPercentage / 100),
      productTitles: data.productTitles,
    }));
  }

  private emptyGetnetTransition(handled = false): GetnetWebhookTransition {
    return {
      handled,
      duplicate: false,
      sellers: [],
      notifyApproved: false,
      notifyRejected: false,
    };
  }

  private nonEmptyString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private firstNonEmptyString(...values: unknown[]) {
    for (const value of values) {
      const normalized = this.nonEmptyString(value);
      if (normalized) return normalized;
    }
    return undefined;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {};
  }

  private logIgnoredGetnetWebhook(reason: string, context: GetnetWebhookEvent & { expectedAmount?: number; receivedAmount?: number }) {
    this.logger.warn(
      `Ignored Getnet webhook reason=${reason} orderId=${context.orderId ?? '-'} paymentIntentId=${context.paymentIntentId ?? '-'} paymentId=${context.paymentId ?? '-'} status=${context.statusRaw ?? '-'} expectedAmount=${context.expectedAmount ?? '-'} receivedAmount=${context.receivedAmount ?? '-'}`,
    );
  }

  /**
   * Respuesta para el frontend segun la modalidad configurada:
   * - redirect (default): checkoutUrl devuelta por Getnet.
   * - iframe: loader + payment_intent_id.
   * Si Getnet no devolvio checkout_url se degrada a iframe para no bloquear UX.
   */
  private getnetCheckoutResponse(
    order: Order,
    attempt: Pick<PaymentAttempt, 'externalPaymentId' | 'checkoutUrl'>,
  ) {
    const checkoutType = this.getnetCheckoutType();
    const paymentIntentId = attempt.externalPaymentId ?? '';

    if (!attempt.checkoutUrl || checkoutType === 'iframe') {
      return {
        orderId: order.id,
        paymentIntentId,
        checkoutType: 'iframe' as const,
        ...(attempt.checkoutUrl ? { checkoutUrl: attempt.checkoutUrl } : {}),
        loaderUrl: this.getnetClient.getLoaderUrl(),
      };
    }

    return {
      orderId: order.id,
      paymentIntentId,
      checkoutUrl: attempt.checkoutUrl,
      checkoutType: 'redirect' as const,
    };
  }

  private getnetCheckoutType(): 'redirect' | 'iframe' {
    const raw = this.configService
      .get<string>('GETNET_CHECKOUT_TYPE')
      ?.trim()
      .toLowerCase();

    return raw === 'iframe' ? 'iframe' : 'redirect';
  }

  private getWebhookAuthMode(): 'basic' | 'none' {
    const raw = this.configService
      .get<string>('GETNET_WEBHOOK_AUTH_MODE')
      ?.trim()
      .toLowerCase();

    return raw === 'none' ? 'none' : 'basic';
  }

  private isProductionEnv() {
    return (
      this.configService.get<string>('NODE_ENV')?.trim().toLowerCase() ===
      'production'
    );
  }

  private validateGetnetWebhookAuthorization(authorization?: string) {
    if (this.getWebhookAuthMode() === 'none') {
      // Modo explicito solo para UAT/local; en produccion se rechaza.
      if (this.isProductionEnv()) {
        throw new ServiceUnavailableException(
          'La autenticacion del webhook de Getnet no puede deshabilitarse en produccion',
        );
      }
      this.logger.warn(
        'Webhook de Getnet aceptado sin autenticacion (GETNET_WEBHOOK_AUTH_MODE=none). Solo permitido fuera de produccion.',
      );
      return;
    }

    const username = this.configService
      .get<string>('GETNET_WEBHOOK_USERNAME')
      ?.trim();
    const password = this.configService
      .get<string>('GETNET_WEBHOOK_PASSWORD')
      ?.trim();

    if (!username || !password) {
      throw new ServiceUnavailableException(
        'El webhook de Getnet todavia no esta configurado',
      );
    }

    const expected = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    const providedBuffer = Buffer.from(authorization ?? '');
    const expectedBuffer = Buffer.from(expected);
    const isValid =
      providedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(providedBuffer, expectedBuffer);

    if (!isValid) {
      throw new UnauthorizedException('Credenciales de webhook invalidas');
    }
  }
}
