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
import { Repository } from 'typeorm';
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
import { NotifyTransferPaymentDto } from './dto/notify-transfer-payment.dto';
import { UpdateTransferPaymentStatusDto } from './dto/update-transfer-payment-status.dto';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { ProductMediaType } from '../products/product-media/entities/product-media.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { GetnetClient } from './getnet.client';

interface GetnetWebhookBody {
  payment_intent_id?: string;
  checkout_id?: string;
  order_id?: string;
  mode?: string;
  payment?: {
    method?: string;
    amount?: number;
    currency?: string;
    result?: {
      payment_id?: string;
      status?: string;
      authorization_code?: string;
      transaction_datetime?: string;
      return_message?: string;
    };
  };
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
  ) {
    this.client = new MercadoPagoConfig({
      accessToken: this.configService.get<string>('MP_ACCESS_TOKEN')!,
    });
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

    if (order.paymentMethod !== PaymentMethod.TRANSFER) {
      throw new BadRequestException(
        'La orden no usa transferencia como metodo de pago',
      );
    }

    if (!order.payment) {
      throw new NotFoundException('Pago no encontrado');
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
        return this.transferStatusResponse(order);
      }

      if (isSameRejectedStatus) {
        await this.notifyRejectedPayment(order);
        return this.transferStatusResponse(order);
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
      message: 'Transferencia rechazada',
    };
  }

  async creditSellersFromOrder(order: Order, shouldCredit: boolean) {
    const amountsBySeller = new Map<
      string,
      { amount: number; commissionPercentage: number; productTitles: string[] }
    >();

    for (const item of order.items ?? []) {
      const seller = item.product?.seller;

      if (!seller?.id) {
        continue;
      }

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

    for (const [sellerId, data] of amountsBySeller) {
      if (shouldCredit) {
        await this.walletService.creditFromOrder({
          userId: sellerId,
          orderId: order.id,
          amount: data.amount,
          commisionPercentage: data.commissionPercentage,
        });
      }
    }

    return Array.from(amountsBySeller, ([sellerId, data]) => ({
      sellerId,
      grossAmount: data.amount,
      netAmount: data.amount - data.amount * (data.commissionPercentage / 100),
      productTitles: data.productTitles,
    }));
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

  private transferStatusResponse(order: Order) {
    const completed = order.payment?.status === PaymentStatus.COMPLETED;
    return {
      orderId: order.id,
      orderStatus: order.status,
      paymentStatus: order.payment?.status,
      message: completed
        ? 'Pago confirmado, estamos asignando a un repartidor'
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

  async createGetnetOrder(orderId: string, userId: string) {
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

    if (order.paymentMethod !== PaymentMethod.GETNET) {
      throw new BadRequestException(
        'La orden no usa GetNet como metodo de pago',
      );
    }

    if (order.paymentPreferenceId) {
      return this.getnetPaymentIntentResponse(
        order.id,
        order.paymentPreferenceId,
      );
    }

    const result = await this.getnetClient.createPaymentIntent({
      order_id: order.id,
      payment: {
        currency: 'ARS',
        amount: this.toCents(order.total),
      },
      product: order.items.map((item) => ({
        product_type: 'physical_goods',
        title: item.product.title.slice(0, 128),
        description: item.product.description?.slice(0, 1024),
        value: this.toCents(item.unitPrice),
        quantity: item.quantity,
      })),
      customer: {
        customer_id: order.buyer.id,
        first_name: order.buyer.firstName.slice(0, 40),
        last_name: order.buyer.lastName.slice(0, 80),
        name: `${order.buyer.firstName} ${order.buyer.lastName}`.slice(0, 100),
        email: order.buyer.email,
        document_type: 'DNI',
        checked_email: order.buyer.isEmailVerified,
      },
    });

    order.paymentPreferenceId = result.payment_intent_id;
    order.paymentStatus = 'Pending';
    await this.orderRepository.save(order);

    return this.getnetPaymentIntentResponse(order.id, result.payment_intent_id);
  }

  async handleGetnetWebhook(
    authorization: string | undefined,
    body: GetnetWebhookBody,
  ) {
    this.validateGetnetWebhookAuthorization(authorization);

    const orderId = body?.order_id;
    const paymentIntentId = body?.payment_intent_id;
    const paymentStatus = body?.payment?.result?.status;

    if (!orderId || !paymentIntentId || !paymentStatus) {
      this.logger.warn('Ignoring an incomplete Getnet webhook');
      return { received: true };
    }

    const order = await this.orderRepository.findOne({
      where: { id: orderId, paymentMethod: PaymentMethod.GETNET },
      relations: ['buyer', 'items', 'items.product', 'items.product.seller'],
    });

    if (!order) {
      this.logger.warn(`Ignoring Getnet webhook for unknown order ${orderId}`);
      return { received: true };
    }

    if (order.paymentPreferenceId !== paymentIntentId) {
      this.logger.warn(
        `Ignoring mismatched Getnet intent for order ${orderId}`,
      );
      return { received: true };
    }

    if (
      body.payment?.currency !== 'ARS' ||
      body.payment.amount !== this.toCents(order.total)
    ) {
      throw new BadRequestException(
        'El monto o la moneda del pago Getnet no coincide con la orden',
      );
    }

    if (paymentStatus !== 'Authorized' && paymentStatus !== 'Denied') {
      this.logger.warn(`Ignoring unknown Getnet status ${paymentStatus}`);
      return { received: true };
    }

    const wasAlreadyPaid = order.status === OrderStatus.PAID;
    const wasAlreadyRejected = order.status === OrderStatus.REJECTED;

    if (paymentStatus === 'Authorized') {
      if (!body.payment?.result?.payment_id) {
        throw new BadRequestException(
          'El webhook autorizado de Getnet no tiene payment_id',
        );
      }

      order.paymentId = body.payment.result.payment_id;
      order.paymentStatus = paymentStatus;
      order.status = OrderStatus.PAID;
      await this.orderRepository.save(order);

      if (wasAlreadyPaid) {
        return { received: true };
      }

      const sellers = await this.creditSellersFromOrder(order, true);
      await this.notifyApprovedOrder(order, sellers);
      return { received: true };
    }

    if (wasAlreadyPaid) {
      return { received: true };
    }

    order.paymentId = body.payment?.result?.payment_id ?? order.paymentId;
    order.paymentStatus = paymentStatus;
    order.status = OrderStatus.REJECTED;
    await this.orderRepository.save(order);

    if (!wasAlreadyRejected) {
      await this.notifyRejectedPayment(order);
    }

    return { received: true };
  }

  private getnetPaymentIntentResponse(
    orderId: string,
    paymentIntentId: string,
  ) {
    return {
      orderId,
      paymentIntentId,
      checkoutType: 'iframe' as const,
      loaderUrl: this.getnetClient.getLoaderUrl(),
    };
  }

  private toCents(value: number | string) {
    return Math.round(Number(value) * 100);
  }

  private validateGetnetWebhookAuthorization(authorization?: string) {
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
