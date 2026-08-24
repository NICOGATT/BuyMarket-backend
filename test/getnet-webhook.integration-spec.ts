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
import { PaymentAttempt } from '../src/modules/payments/entity/payment-attempt.entity';
import { Payment } from '../src/modules/payments/entity/payment.entity';
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
      {
        createPaymentIntent: jest.fn(),
        getLoaderUrl: jest.fn(),
      } as unknown as GetnetClient,
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
    expect(order.paymentStatus).toBe('Authorized');
    expect(await transactionRepository.count()).toBe(2);
    expect(await notificationRepository.count()).toBe(5);
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

  async function seedFixture(): Promise<Fixture> {
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

    return { order, sellers: [sellerA, sellerB] };
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
    expect(order.paymentStatus).toBe('Authorized');
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
