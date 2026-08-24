import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';

import { CloudinaryService } from '../src/cloudinary/cloudinary.service';
import { Brand } from '../src/modules/brands/entities/brand.entity';
import { Cart } from '../src/modules/carts/entities/cart.entity';
import { CartItem } from '../src/modules/carts/entities/cart-item.entity/cart-item.entity';
import { Category } from '../src/modules/categories/entities/category.entity';
import { CategorySuggestion } from '../src/modules/category-suggestions/entities/category-suggestion.entity';
import { Color } from '../src/modules/colors/entities/color.entity';
import { Favorite } from '../src/modules/favorites/entities/favorite.entity';
import { Notification } from '../src/modules/notifications/entities/notification.entity';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { Order } from '../src/modules/orders/entities/order.entity';
import { OrderItem } from '../src/modules/orders/entities/order-item.entity';
import {
  OrderStatus,
  PaymentMethod,
} from '../src/modules/orders/entities/order.enums';
import {
  PaymentAttempt,
  PaymentAttemptStatus,
} from '../src/modules/payments/entity/payment-attempt.entity';
import {
  Payment,
  PaymentStatus,
} from '../src/modules/payments/entity/payment.entity';
import { GetnetClient } from '../src/modules/payments/getnet.client';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { Plan } from '../src/modules/plan/entities/plan.entity';
import { ProductAttributeValue } from '../src/modules/products/entity/product-attributes-value.entity';
import { ProductVariantAttributeValue } from '../src/modules/products/entity/product-variant-attribute-value.entity';
import { ProductVariant } from '../src/modules/products/entity/product-variant.entity';
import { Product } from '../src/modules/products/entity/product.entity';
import { ProductMedia } from '../src/modules/products/product-media/entities/product-media.entity';
import { Shipment } from '../src/modules/shipments/entities/shipment.entity';
import { SubCategoryAttribute } from '../src/modules/subcategoria/subcategoria-attributes/entities/subcategoria-attribute.entity';
import { SubCategory } from '../src/modules/subcategoria/entities/subcategoria.entity';
import { UserAddress } from '../src/modules/user-address/entities/user-address.entity';
import { UserPaymentMethod } from '../src/modules/user-payment-methods/entities/user-payment-method.entity';
import { User, UserRole } from '../src/modules/users/entity/user.entity';
import {
  WalletTransaction,
  WalletTransactionType,
} from '../src/modules/wallet-transaction/entity/wallet-transaction.entity';
import { Wallet } from '../src/modules/wallet/entity/wallet.entity';
import { WalletService } from '../src/modules/wallet/wallet.service';
import { WithdrawalRequest } from '../src/modules/with-drawal-request/entities/with-drawal-request.entity';

const entities = [
  Brand,
  Cart,
  CartItem,
  Category,
  CategorySuggestion,
  Color,
  Favorite,
  Notification,
  Order,
  OrderItem,
  Payment,
  PaymentAttempt,
  Plan,
  Product,
  ProductAttributeValue,
  ProductMedia,
  ProductVariant,
  ProductVariantAttributeValue,
  Shipment,
  SubCategory,
  SubCategoryAttribute,
  User,
  UserAddress,
  UserPaymentMethod,
  Wallet,
  WalletTransaction,
  WithdrawalRequest,
];

interface Fixture {
  order: Order;
  buyer: User;
  sellers: [User, User];
}

describe('Getnet webhook con PostgreSQL', () => {
  const database = process.env.GETNET_TEST_DB_NAME ?? 'buymarket_webhook_test';
  const databaseHost = process.env.GETNET_TEST_DB_HOST ?? '127.0.0.1';
  const webhookUsername = 'getnet-local-user';
  const webhookPassword = 'getnet-local-password';
  const authorization = `Basic ${Buffer.from(
    `${webhookUsername}:${webhookPassword}`,
  ).toString('base64')}`;

  let dataSource: DataSource;
  let paymentsService: PaymentsService;
  let walletService: WalletService;
  let orderRepository: Repository<Order>;
  let walletRepository: Repository<Wallet>;
  let transactionRepository: Repository<WalletTransaction>;
  let notificationRepository: Repository<Notification>;
  let attemptRepository: Repository<PaymentAttempt>;
  let paymentRepository: Repository<Payment>;

  const getnetClient = {
    createPaymentIntent: jest.fn(),
    getLoaderUrl: jest.fn(),
  } as unknown as GetnetClient;

  beforeAll(async () => {
    if (!database.endsWith('_test')) {
      throw new Error(
        `Base rechazada: ${database}. GETNET_TEST_DB_NAME debe terminar en _test.`,
      );
    }
    if (!['127.0.0.1', 'localhost', '::1'].includes(databaseHost)) {
      throw new Error(
        `Host rechazado: ${databaseHost}. La prueba destructiva solo admite PostgreSQL local.`,
      );
    }

    dataSource = new DataSource({
      type: 'postgres',
      host: databaseHost,
      port: Number(process.env.GETNET_TEST_DB_PORT ?? 55432),
      username: process.env.GETNET_TEST_DB_USER ?? 'postgres',
      password: process.env.GETNET_TEST_DB_PASSWORD ?? 'postgres',
      database,
      entities,
      dropSchema: true,
      synchronize: true,
      logging: false,
    });
    await dataSource.initialize();

    orderRepository = dataSource.getRepository(Order);
    walletRepository = dataSource.getRepository(Wallet);
    transactionRepository = dataSource.getRepository(WalletTransaction);
    notificationRepository = dataSource.getRepository(Notification);
    attemptRepository = dataSource.getRepository(PaymentAttempt);
    paymentRepository = dataSource.getRepository(Payment);

    const notificationsService = new NotificationsService(
      notificationRepository,
    );
    walletService = new WalletService(
      walletRepository,
      transactionRepository,
      dataSource.getRepository(WithdrawalRequest),
      dataSource.getRepository(User),
      notificationsService,
    );
    const configService = new ConfigService({
      MP_ACCESS_TOKEN: 'local-integration-token',
      GETNET_WEBHOOK_USERNAME: webhookUsername,
      GETNET_WEBHOOK_PASSWORD: webhookPassword,
    });
    paymentsService = new PaymentsService(
      configService,
      orderRepository,
      dataSource.getRepository(Payment),
      walletService,
      {} as CloudinaryService,
      notificationsService,
      getnetClient,
      dataSource,
    );
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it('autoriza y acredita el neto correcto a cada vendedor', async () => {
    const fixture = await seedFixture();

    await paymentsService.handleGetnetWebhook(
      authorization,
      authorizedPayload(fixture.order),
    );

    await expectApproved(fixture);
    const attempt = await attemptRepository.findOneOrFail({
      where: { externalPaymentId: fixture.order.paymentPreferenceId },
    });
    expect(attempt.status).toBe(PaymentAttemptStatus.APPROVED);
    expect(attempt.rawStatus).toBe('AUTHORIZED');
    expect(attempt.providerPaymentId).toBe(`payment-${fixture.order.id}`);
    expect(attempt.lastNotifiedAt).toBeInstanceOf(Date);
  });

  it('aprueba con el payload simplificado sin importe ni moneda', async () => {
    const fixture = await seedFixture();

    await paymentsService.handleGetnetWebhook(authorization, {
      order_id: fixture.order.id,
      payment_intent_id: fixture.order.paymentPreferenceId,
      status: 'APPROVED',
    });

    await expectApproved(fixture);
  });

  it('serializa dos webhooks concurrentes sin duplicar saldos ni movimientos', async () => {
    const fixture = await seedFixture();
    const payload = authorizedPayload(fixture.order);

    await Promise.all([
      paymentsService.handleGetnetWebhook(authorization, payload),
      paymentsService.handleGetnetWebhook(authorization, payload),
    ]);

    await expectApproved(fixture);
  });

  it('revierte toda la transaccion si falla un vendedor y permite reintentar', async () => {
    const fixture = await seedFixture();
    const originalCredit = walletService.creditFromOrder.bind(walletService);
    let creditCalls = 0;
    const creditSpy = jest
      .spyOn(walletService, 'creditFromOrder')
      .mockImplementation(async (params, manager) => {
        creditCalls += 1;
        if (creditCalls === 2) throw new Error('forced wallet failure');
        return originalCredit(params, manager);
      });

    await expect(
      paymentsService.handleGetnetWebhook(
        authorization,
        authorizedPayload(fixture.order),
      ),
    ).rejects.toThrow('forced wallet failure');

    expect((await reloadOrder(fixture.order.id)).status).toBe(
      OrderStatus.PENDING,
    );
    expect(await transactionRepository.count()).toBe(0);
    expect(await notificationRepository.count()).toBe(0);
    await expectWalletBalances(fixture.sellers, [0, 0]);

    creditSpy.mockRestore();
    await paymentsService.handleGetnetWebhook(
      authorization,
      authorizedPayload(fixture.order),
    );
    await expectApproved(fixture);
  });

  it('no permite que Denied revierta una orden ya pagada', async () => {
    const fixture = await seedFixture();
    await paymentsService.handleGetnetWebhook(
      authorization,
      authorizedPayload(fixture.order),
    );

    await paymentsService.handleGetnetWebhook(
      authorization,
      deniedPayload(fixture.order),
    );

    const order = await reloadOrder(fixture.order.id);
    expect(order.status).toBe(OrderStatus.PAID);
    expect(order.paymentStatus).toBe('APPROVED');
    expect(await transactionRepository.count()).toBe(2);
    expect(await notificationRepository.count()).toBe(5);
  });

  it('el reenvio del mismo webhook aprobado no duplica saldos ni notificaciones', async () => {
    const fixture = await seedFixture();
    const payload = authorizedPayload(fixture.order);

    await paymentsService.handleGetnetWebhook(authorization, payload);
    await paymentsService.handleGetnetWebhook(authorization, payload);

    const order = await reloadOrder(fixture.order.id);
    expect(order.status).toBe(OrderStatus.PAID);
    expect(await transactionRepository.count()).toBe(2);
    expect(await notificationRepository.count()).toBe(5);
  });

  it('ignora monedas distintas de ARS cuando el payload la incluye', async () => {
    const fixture = await seedFixture();
    const payload = authorizedPayload(fixture.order);
    (payload.payment as { currency: string }).currency = 'USD';

    await paymentsService.handleGetnetWebhook(authorization, payload);

    expect((await reloadOrder(fixture.order.id)).status).toBe(
      OrderStatus.PENDING,
    );
    expect(await transactionRepository.count()).toBe(0);
    // La evidencia del evento ignorado queda auditada.
    const attempt = await attemptRepository.findOneOrFail({
      where: { externalPaymentId: fixture.order.paymentPreferenceId },
    });
    expect(attempt.status).toBe(PaymentAttemptStatus.PENDING);
    expect(attempt.lastNotifiedAt).toBeInstanceOf(Date);
  });

  it('ignora ordenes desconocidas e intents inconsistentes sin mutar datos', async () => {
    const fixture = await seedFixture();
    const unknownPayload = authorizedPayload(fixture.order);
    unknownPayload.order_id = randomUUID();
    const mismatchedPayload = authorizedPayload(fixture.order);
    mismatchedPayload.payment_intent_id = 'different-intent';

    await paymentsService.handleGetnetWebhook(authorization, unknownPayload);
    await paymentsService.handleGetnetWebhook(authorization, mismatchedPayload);

    expect((await reloadOrder(fixture.order.id)).status).toBe(
      OrderStatus.PENDING,
    );
    expect(await transactionRepository.count()).toBe(0);
    expect(await notificationRepository.count()).toBe(0);
    await expectWalletBalances(fixture.sellers, [0, 0]);
  });

  describe('createGetnetOrder con PostgreSQL', () => {
    beforeEach(() => {
      getnetClient.createPaymentIntent = jest.fn(async () => ({
        payment_intent_id: `intent-${randomUUID()}`,
        checkout_url: 'https://checkout.uat.getnet.test/pay',
      }));
      (getnetClient.getLoaderUrl as jest.Mock).mockReturnValue(
        'https://www.pre.globalgetnet.com/digital-checkout/loader.js',
      );
    });

    it('el comprador correcto crea la intencion y deja intento y pago persistidos', async () => {
      const fixture = await seedFixture();

      const response = await paymentsService.createGetnetOrder(
        fixture.order.id,
        fixture.buyer.id,
      );

      expect(response.orderId).toBe(fixture.order.id);
      expect(response.paymentIntentId).toBe(
        (await reloadOrder(fixture.order.id)).paymentPreferenceId,
      );
      expect(response.checkoutType).toBe('redirect');
      expect(response.checkoutUrl).toContain('https://');

      const order = await reloadOrder(fixture.order.id);
      expect(order.paymentStatus).toBe('PENDING');
      expect(await attemptRepository.count()).toBe(1);
      const attempt = await attemptRepository.findOneOrFail({
        where: {},
      });
      expect(attempt.status).toBe(PaymentAttemptStatus.PENDING);
      expect(attempt.externalPaymentId).toBe(response.paymentIntentId);
      const payment = await paymentRepository.findOneOrFail({
        where: { order: { id: fixture.order.id } },
      });
      expect(payment.status).toBe('PENDING');
      expect(payment.method).toBe(PaymentMethod.GETNET);
    });

    it('rechaza a un comprador distinto sin crear intentos', async () => {
      const fixture = await seedFixture();

      await expect(
        paymentsService.createGetnetOrder(
          fixture.order.id,
          randomUUID(),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(await attemptRepository.count()).toBe(0);
      expect((await reloadOrder(fixture.order.id)).paymentPreferenceId).toBe(
        fixture.order.paymentPreferenceId,
      );
    });

    it('devuelve 404 para una orden inexistente', async () => {
      await expect(
        paymentsService.createGetnetOrder(randomUUID(), randomUUID()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza una orden que no usa Getnet', async () => {
      const fixture = await seedFixture();
      await orderRepository.update(
        { id: fixture.order.id },
        { paymentMethod: PaymentMethod.MERCADO_PAGO },
      );

      await expect(
        paymentsService.createGetnetOrder(
          fixture.order.id,
          fixture.buyer.id,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(getnetClient.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('rechaza una orden que no esta pendiente', async () => {
      const fixture = await seedFixture();
      await orderRepository.update(
        { id: fixture.order.id },
        { status: OrderStatus.PAID },
      );

      await expect(
        paymentsService.createGetnetOrder(
          fixture.order.id,
          fixture.buyer.id,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(getnetClient.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('reutiliza el intento pendiente vigente en llamadas secuenciales', async () => {
      const fixture = await seedFixture();

      const first = await paymentsService.createGetnetOrder(
        fixture.order.id,
        fixture.buyer.id,
      );
      const second = await paymentsService.createGetnetOrder(
        fixture.order.id,
        fixture.buyer.id,
      );

      expect(second.paymentIntentId).toBe(first.paymentIntentId);
      expect(getnetClient.createPaymentIntent).toHaveBeenCalledTimes(1);
      expect(await attemptRepository.count()).toBe(1);
    });

    it('serializa dos creaciones concurrentes en una sola intencion externa', async () => {
      const fixture = await seedFixture();
      let intentsCreated = 0;
      getnetClient.createPaymentIntent = jest.fn(async () => {
        intentsCreated += 1;
        // Simula la latencia del proveedor para forzar la contienda del lock.
        await new Promise((resolve) => setTimeout(resolve, 150));
        return {
          payment_intent_id: `intent-concurrente`,
          checkout_url: 'https://checkout.uat.getnet.test/pay',
        };
      });

      const [first, second] = await Promise.all([
        paymentsService.createGetnetOrder(fixture.order.id, fixture.buyer.id),
        paymentsService.createGetnetOrder(fixture.order.id, fixture.buyer.id),
      ]);

      expect(intentsCreated).toBe(1);
      expect(first.paymentIntentId).toBe('intent-concurrente');
      expect(second.paymentIntentId).toBe('intent-concurrente');
      expect(await attemptRepository.count()).toBe(1);
    });

    it('crea una nueva intencion cuando la anterior expiro', async () => {
      const fixture = await seedFixture();
      const first = await paymentsService.createGetnetOrder(
        fixture.order.id,
        fixture.buyer.id,
      );
      // Fuerza vencimiento del intento vigente.
      await attemptRepository.update(
        { externalPaymentId: first.paymentIntentId },
        { expiresAt: new Date(Date.now() - 1000) },
      );

      const second = await paymentsService.createGetnetOrder(
        fixture.order.id,
        fixture.buyer.id,
      );

      expect(second.paymentIntentId).not.toBe(first.paymentIntentId);
      expect(getnetClient.createPaymentIntent).toHaveBeenCalledTimes(2);
      const statuses = (await attemptRepository.find())
        .filter((attempt) => attempt.externalPaymentId === first.paymentIntentId)
        .map((attempt) => attempt.status);
      expect(statuses).toEqual([PaymentAttemptStatus.EXPIRED]);
    });

    it('crea una nueva intencion cuando la anterior fue rechazada', async () => {
      const fixture = await seedFixture();
      const first = await paymentsService.createGetnetOrder(
        fixture.order.id,
        fixture.buyer.id,
      );
      await attemptRepository.update(
        { externalPaymentId: first.paymentIntentId },
        { status: PaymentAttemptStatus.REJECTED },
      );

      const second = await paymentsService.createGetnetOrder(
        fixture.order.id,
        fixture.buyer.id,
      );

      expect(second.paymentIntentId).not.toBe(first.paymentIntentId);
      expect(getnetClient.createPaymentIntent).toHaveBeenCalledTimes(2);
    });

    it('propaga el fallo del proveedor y registra evidencia ERROR fuera del rollback', async () => {
      const fixture = await seedFixture();
      getnetClient.createPaymentIntent = jest
        .fn()
        .mockRejectedValue(new Error('getnet 503'));

      await expect(
        paymentsService.createGetnetOrder(fixture.order.id, fixture.buyer.id),
      ).rejects.toThrow('getnet 503');

      const order = await reloadOrder(fixture.order.id);
      expect(order.status).toBe(OrderStatus.PENDING);
      expect(order.paymentPreferenceId).toBe(fixture.order.paymentPreferenceId);

      const errorAttempt = await attemptRepository.findOneOrFail({
        where: { status: PaymentAttemptStatus.ERROR },
      });
      expect(errorAttempt.externalPaymentId ?? null).toBeNull();
      expect(errorAttempt.metadata?.stage).toBe('create_payment_intent');
      expect(errorAttempt.metadata?.failure).toBe('provider_error');
    });
  });

  it('registra evidencia separada cuando falla la acreditacion y no muta datos', async () => {
    const fixture = await seedFixture({ withAttempt: true });
    const originalCredit = walletService.creditFromOrder.bind(walletService);
    const creditSpy = jest
      .spyOn(walletService, 'creditFromOrder')
      .mockRejectedValue(new Error('forced wallet failure'));

    await expect(
      paymentsService.handleGetnetWebhook(
        authorization,
        authorizedPayload(fixture.order),
      ),
    ).rejects.toThrow('forced wallet failure');

    creditSpy.mockRestore();

    const order = await reloadOrder(fixture.order.id);
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(await transactionRepository.count()).toBe(0);
    expect(await notificationRepository.count()).toBe(0);
    await expectWalletBalances(fixture.sellers, [0, 0]);

    // Evidencia persistida DESPUES del rollback, en operacion separada.
    const attempt = await attemptRepository.findOneOrFail({
      where: { externalPaymentId: fixture.order.paymentPreferenceId },
    });
    expect(attempt.metadata?.failure).toBe('processing_failed');
    expect(attempt.lastNotifiedAt).toBeInstanceOf(Date);
  });

  it('recupera notificaciones aprobadas perdidas reenviando el mismo webhook', async () => {
    const fixture = await seedFixture();
    const payload = authorizedPayload(fixture.order);
    const saveSpy = jest
      .spyOn(notificationRepository, 'save')
      .mockRejectedValueOnce(new Error('notifications down'));

    await expect(
      paymentsService.handleGetnetWebhook(authorization, payload),
    ).rejects.toThrow('notifications down');

    // La orden quedo pagada y las billeteras acreditadas aunque fallearan los
    // avisos. createManyOnce crea en paralelo: con un fallo puntual pueden
    // haber quedado algunas notificaciones, pero nunca las cinco completas.
    expect((await reloadOrder(fixture.order.id)).status).toBe(OrderStatus.PAID);
    expect(await transactionRepository.count()).toBe(2);
    await expectWalletBalances(fixture.sellers, [900, 475]);
    expect(await notificationRepository.count()).toBeLessThan(5);

    saveSpy.mockRestore();
    // Reintento de Getnet: no reacredita y recupera las notificaciones.
    await paymentsService.handleGetnetWebhook(authorization, payload);

    await expectApproved(fixture);
    await expectWalletBalances(fixture.sellers, [900, 475]);

    // Tercera entrega: nada cambia.
    await paymentsService.handleGetnetWebhook(authorization, payload);
    expect(await notificationRepository.count()).toBe(5);
    expect(await transactionRepository.count()).toBe(2);
  });

  it('recupera la notificacion de rechazo perdida reenviando el mismo webhook', async () => {
    const fixture = await seedFixture();
    const payload = deniedPayload(fixture.order);
    const saveSpy = jest
      .spyOn(notificationRepository, 'save')
      .mockRejectedValueOnce(new Error('notifications down'));

    await expect(
      paymentsService.handleGetnetWebhook(authorization, payload),
    ).rejects.toThrow('notifications down');

    expect((await reloadOrder(fixture.order.id)).status).toBe(
      OrderStatus.REJECTED,
    );
    expect(await notificationRepository.count()).toBe(0);

    saveSpy.mockRestore();
    await paymentsService.handleGetnetWebhook(authorization, payload);
    expect(await notificationRepository.count()).toBe(1);

    await paymentsService.handleGetnetWebhook(authorization, payload);
    expect(await notificationRepository.count()).toBe(1);
  });

  it('el esquema sincronizado contiene las columnas e indice definidos por la migracion', async () => {
    // Paridad entidad <-> migracion: el schema generado por synchronize()
    // debe exponer exactamente lo que agrega
    // AddGetnetWebCheckoutAttemptFields (columnas camelCase e indice con
    // nombre fijado en la entidad).
    const columns = (
      await dataSource.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'payment_attempts'`,
      )
    ).map((row: { column_name: string }) => row.column_name);

    for (const column of [
      'idempotencyKey',
      'externalPaymentId',
      'providerPaymentId',
      'rawStatus',
      'checkoutUrl',
      'lastNotifiedAt',
      'metadata',
    ]) {
      expect(columns).toContain(column);
    }

    const indexes = (
      await dataSource.query(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'payment_attempts'`,
      )
    ).map((row: { indexname: string }) => row.indexname);
    expect(indexes).toContain('IDX_payment_attempts_provider_payment_id');
  });

  async function seedFixture(options: { withAttempt?: boolean } = {}): Promise<Fixture> {
    const planRepository = dataSource.getRepository(Plan);
    const userRepository = dataSource.getRepository(User);
    const categoryRepository = dataSource.getRepository(Category);
    const productRepository = dataSource.getRepository(Product);
    const orderItemRepository = dataSource.getRepository(OrderItem);

    const [plan10, plan5] = await planRepository.save([
      planRepository.create({
        name: 'Local 10%',
        commissionPercentage: 10,
        isActive: true,
        isFeatured: false,
      }),
      planRepository.create({
        name: 'Local 5%',
        commissionPercentage: 5,
        isActive: true,
        isFeatured: false,
      }),
    ]);
    const [buyer, sellerA, sellerB] = await userRepository.save([
      userRepository.create({
        firstName: 'Buyer',
        lastName: 'Local',
        email: `buyer-${randomUUID()}@test.local`,
        role: UserRole.USER,
        isEmailVerified: true,
      }),
      userRepository.create({
        firstName: 'Seller',
        lastName: 'Ten',
        email: `seller-a-${randomUUID()}@test.local`,
        role: UserRole.SELLER,
        isEmailVerified: true,
        plan: plan10,
      }),
      userRepository.create({
        firstName: 'Seller',
        lastName: 'Five',
        email: `seller-b-${randomUUID()}@test.local`,
        role: UserRole.SELLER,
        isEmailVerified: true,
        plan: plan5,
      }),
    ]);
    await walletRepository.save([
      walletRepository.create({
        user: sellerA,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
      }),
      walletRepository.create({
        user: sellerB,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
      }),
    ]);
    const category = await categoryRepository.save(
      categoryRepository.create({ name: `Local-${randomUUID()}` }),
    );
    const [productA, productB] = await productRepository.save([
      productRepository.create({
        title: 'Producto A',
        description: 'Fixture Getnet A',
        price: 1000,
        stock: 10,
        category,
        seller: sellerA,
      }),
      productRepository.create({
        title: 'Producto B',
        description: 'Fixture Getnet B',
        price: 250,
        stock: 10,
        category,
        seller: sellerB,
      }),
    ]);
    const order = await orderRepository.save(
      orderRepository.create({
        buyer,
        total: 1500,
        status: OrderStatus.PENDING,
        deliveryAddress: 'Calle local 123',
        paymentMethod: PaymentMethod.GETNET,
        paymentPreferenceId: `intent-${randomUUID()}`,
        paymentStatus: 'Pending',
      }),
    );
    await orderItemRepository.save([
      orderItemRepository.create({
        order,
        product: productA,
        quantity: 1,
        unitPrice: 1000,
        subtotal: 1000,
      }),
      orderItemRepository.create({
        order,
        product: productB,
        quantity: 2,
        unitPrice: 250,
        subtotal: 500,
      }),
    ]);

    if (options.withAttempt) {
      const payment = await paymentRepository.save(
        paymentRepository.create({
          method: PaymentMethod.GETNET,
          status: PaymentStatus.PENDING,
          amount: 1500,
          order,
        }),
      );
      await attemptRepository.save(
        attemptRepository.create({
          idempotencyKey: randomUUID(),
          status: PaymentAttemptStatus.PENDING,
          externalPaymentId: order.paymentPreferenceId,
          expiresAt: new Date(Date.now() + 3_600_000),
          payment,
        }),
      );
    }

    return { order, buyer, sellers: [sellerA, sellerB] };
  }

  function authorizedPayload(order: Order) {
    return {
      order_id: order.id,
      payment_intent_id: order.paymentPreferenceId,
      payment: {
        amount: 150000,
        currency: 'ARS',
        result: {
          payment_id: `payment-${order.id}`,
          status: 'AUTHORIZED',
        },
      },
    };
  }

  function deniedPayload(order: Order) {
    return {
      order_id: order.id,
      payment_intent_id: order.paymentPreferenceId,
      payment: {
        amount: 150000,
        currency: 'ARS',
        result: {
          payment_id: `payment-${order.id}`,
          status: 'DENIED',
        },
      },
    };
  }

  async function expectApproved(fixture: Fixture) {
    const order = await reloadOrder(fixture.order.id);
    expect(order.status).toBe(OrderStatus.PAID);
    expect(order.paymentStatus).toBe('APPROVED');
    expect(
      await transactionRepository.count({
        where: {
          order: { id: fixture.order.id },
          type: WalletTransactionType.CREDIT,
        },
      }),
    ).toBe(2);
    await expectWalletBalances(fixture.sellers, [900, 475]);
    expect(await notificationRepository.count()).toBe(5);
    const eventKeys = (await notificationRepository.find()).map(
      (notification) => notification.eventKey,
    );
    expect(new Set(eventKeys).size).toBe(eventKeys.length);
  }

  async function expectWalletBalances(
    sellers: [User, User],
    expected: [number, number],
  ) {
    const wallets = await Promise.all(
      sellers.map((seller) =>
        walletRepository.findOneOrFail({
          where: { user: { id: seller.id } },
        }),
      ),
    );
    expect(wallets.map((wallet) => Number(wallet.balance))).toEqual(expected);
    expect(wallets.map((wallet) => Number(wallet.totalEarned))).toEqual(
      expected,
    );
  }

  function reloadOrder(orderId: string) {
    return orderRepository.findOneOrFail({ where: { id: orderId } });
  }
});
