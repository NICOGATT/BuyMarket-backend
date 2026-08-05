import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { Order, OrderStatus, PaymentMethod } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Cart } from '../carts/entities/cart.entity';
import { CartItem } from '../carts/entities/cart-item.entity/cart-item.entity';
import { Product } from '../products/entity/product.entity';
import { ProductVariant } from '../products/entity/product-variant.entity';
import { User } from '../users/entity/user.entity';
import {
  CheckoutOrderDto,
  NationalShippingDataDto,
} from './dto/checkout-order.dto';
import { Payment, PaymentStatus } from '../payments/entity/payment.entity';
import { ShippingType } from '../shipments/entities/shipment.entity';
import { UserPaymentMethod } from '../user-payment-methods/entities/user-payment-method.entity';
import {
  WalletTransaction,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../wallet-transaction/entity/wallet-transaction.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,

    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,

    @InjectRepository(Cart)
    private readonly cartsRepository: Repository<Cart>,

    @InjectRepository(CartItem)
    private readonly cartItemsRepository: Repository<CartItem>,

    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,

    @InjectRepository(ProductVariant)
    private readonly productVariantsRepository: Repository<ProductVariant>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,

    @InjectRepository(UserPaymentMethod)
    private readonly userPaymentMethodsRepository: Repository<UserPaymentMethod>,

    @InjectRepository(WalletTransaction)
    private readonly walletTransactionsRepository: Repository<WalletTransaction>,

    private readonly configService: ConfigService,
  ) {}

  private normalizeOrderVariantColors(order: Order): Order;
  private normalizeOrderVariantColors(orders: Order[]): Order[];
  private normalizeOrderVariantColors(orders: Order | Order[]) {
    const orderList: Order[] = Array.isArray(orders) ? orders : [orders];

    orderList.forEach((order) => {
      (order.items ?? []).forEach((item) => {
        if (item.variant) {
          item.variant.color =
            item.variant.catalogColor?.name ?? item.variant.color;
        }
      });
    });

    return orders;
  }

  async checkout(userId: string, checkoutDto: CheckoutOrderDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encotrado');
    }

    const cart = await this.cartsRepository.findOne({
      where: {
        user: { id: userId },
      },
      relations: [
        'items',
        'items.product',
        'items.variant',
        'items.variant.catalogColor',
      ],
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      throw new BadRequestException('El carrito esta vacio');
    }

    let total = 0;

    for (const item of cart.items) {
      const availableStock = item.variant?.stock ?? item.product.stock;
      const itemName = item.variant
        ? [
            item.product.title,
            `talle ${item.variant.size}`,
            (item.variant.catalogColor?.name ?? item.variant.color)
              ? `color ${item.variant.catalogColor?.name ?? item.variant.color}`
              : undefined,
          ]
            .filter(Boolean)
            .join(' ')
        : item.product.title;

      if (availableStock < item.quantity) {
        throw new BadRequestException(`Stock insuficiente para ${itemName}`);
      }

      total += Number(item.unitPrice) * item.quantity;
    }

    const selectedPaymentMethod = await this.resolvePaymentMethod(
      userId,
      checkoutDto,
    );

    const shippingType =
      checkoutDto.shippingType ?? ShippingType.LOCAL_DELIVERY;
    const nationalShippingData =
      shippingType === ShippingType.NATIONAL_SHIPPING
        ? this.normalizeNationalShippingData(checkoutDto.nationalShippingData)
        : undefined;

    const order = this.ordersRepository.create({
      buyer: user,
      total,
      status: OrderStatus.PENDING,
      deliveryAddress:
        nationalShippingData?.address ?? checkoutDto.deliveryAddress!,
      shippingType,
      paymentMethod: selectedPaymentMethod.method,
      notes: checkoutDto.notes,
      nationalShippingFullName: nationalShippingData?.fullName,
      nationalShippingDni: nationalShippingData?.dni,
      nationalShippingCuit: nationalShippingData?.cuit,
      nationalShippingAddress: nationalShippingData?.address,
      nationalShippingPostalCode: nationalShippingData?.postalCode,
      nationalShippingCity: nationalShippingData?.city,
      nationalShippingProvince: nationalShippingData?.province,
      nationalShippingCountry: nationalShippingData?.country,
      nationalShippingPhone: nationalShippingData?.phone,
      nationalShippingEmail: nationalShippingData?.email,
      nationalShippingTransportName: nationalShippingData?.transportName,
    });

    const savedOrder = await this.ordersRepository.save(order);

    const orderItems = cart.items.map((item) =>
      this.orderItemsRepository.create({
        order: savedOrder,
        product: item.product,
        variant: item.variant ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: Number(item.unitPrice) * item.quantity,
      }),
    );

    await this.orderItemsRepository.save(orderItems);

    for (const item of cart.items) {
      if (item.variant) {
        item.variant.stock -= item.quantity;

        await this.productVariantsRepository.save(item.variant);
      } else {
        item.product.stock -= item.quantity;

        await this.productsRepository.save(item.product);
      }
    }

    await this.cartItemsRepository.delete({
      cart: { id: cart.id },
    });

    if (
      selectedPaymentMethod.method === PaymentMethod.TRANSFER ||
      selectedPaymentMethod.method === PaymentMethod.GETNET_QR
    ) {
      await this.paymentRepository.save(
        this.paymentRepository.create({
          method: selectedPaymentMethod.method,
          status: PaymentStatus.PENDING,
          amount: total,
          senderAlias:
            selectedPaymentMethod.method === PaymentMethod.TRANSFER
              ? selectedPaymentMethod.senderAlias
              : undefined,
          senderCbu:
            selectedPaymentMethod.method === PaymentMethod.TRANSFER
              ? selectedPaymentMethod.senderCbu
              : undefined,
          order: savedOrder,
        }),
      );

      const orderWithItems = await this.findOne(savedOrder.id, userId);

      if (selectedPaymentMethod.method === PaymentMethod.GETNET_QR) {
        return orderWithItems;
      }

      return {
        ...orderWithItems,
        transferInfo: {
          alias: this.configService.get<string>('TRANSFER_ALIAS'),
          cbu: this.configService.get<string>('TRANSFER_CBU'),
          amount: total,
        },
        message: 'Estamos chequeando la transferencia',
      };
    }

    return this.findOne(savedOrder.id, userId);
  }

  async findMyOrders(userId: string) {
    const orders = await this.ordersRepository.find({
      where: {
        buyer: { id: userId },
      },
      relations: [
        'buyer',
        'items',
        'items.product',
        'items.variant',
        'items.variant.catalogColor',
        'payment',
        'shipment',
      ],
      order: {
        createdAt: 'DESC',
      },
    });

    return this.normalizeOrderVariantColors(orders);
  }

  async findMySales(userId: string) {
    const sales = await this.orderItemsRepository.find({
      where: {
        product: {
          seller: {
            id: userId,
          },
        },
        order: {
          status: In([OrderStatus.PAID, OrderStatus.DELIVERED]),
        },
      },
      relations: [
        'order',
        'order.buyer',
        'order.payment',
        'order.shipment',
        'product',
        'product.media',
        'product.seller',
        'variant',
        'variant.catalogColor',
      ],
      order: {
        order: {
          createdAt: 'DESC',
        },
      },
    });

    const orderIds = [...new Set(sales.map((sale) => sale.order.id))];
    const transactions =
      orderIds.length === 0
        ? []
        : await this.walletTransactionsRepository.find({
            where: {
              wallet: { user: { id: userId } },
              order: { id: In(orderIds) },
              type: WalletTransactionType.CREDIT,
            },
            relations: {
              order: true,
              wallet: { user: true },
            },
          });
    const transactionByOrder = new Map(
      transactions.map((transaction) => [transaction.order?.id, transaction]),
    );
    const salesByOrder = new Map<string, OrderItem[]>();

    for (const sale of sales) {
      const orderSales = salesByOrder.get(sale.order.id) ?? [];
      orderSales.push(sale);
      salesByOrder.set(sale.order.id, orderSales);
    }

    const allocations = new Map<
      string,
      {
        grossAmount: number;
        commissionAmount: number;
        netAmount: number;
        walletStatus: WalletTransactionStatus | 'unavailable';
        effectiveAt: Date | null;
      }
    >();

    for (const [orderId, orderSales] of salesByOrder) {
      const transaction = transactionByOrder.get(orderId);
      const fallbackGross = orderSales.reduce(
        (total, sale) => total + Number(sale.subtotal),
        0,
      );
      const grossCents = this.toCents(transaction?.amount ?? fallbackGross);
      const commissionCents = this.toCents(transaction?.commissionAmount ?? 0);
      const netCents = this.toCents(transaction?.netAmount ?? fallbackGross);
      const weights = orderSales.map((sale) => Number(sale.subtotal));
      const allocatedGross = this.allocateCents(grossCents, weights);
      const allocatedCommission = this.allocateCents(commissionCents, weights);
      const allocatedNet = this.allocateCents(netCents, weights);

      orderSales.forEach((sale, index) => {
        allocations.set(sale.id, {
          grossAmount: allocatedGross[index] / 100,
          commissionAmount: allocatedCommission[index] / 100,
          netAmount: allocatedNet[index] / 100,
          walletStatus: transaction?.status ?? 'unavailable',
          effectiveAt:
            transaction?.effectiveAt ??
            (transaction?.status === WalletTransactionStatus.COMPLETED
              ? transaction.createdAt
              : null),
        });
      });
    }

    return sales.map((sale) => {
      const financial = allocations.get(sale.id)!;

      return {
        saleId: sale.id,
        orderItemId: sale.id,
        orderId: sale.order.id,
        product: {
          id: sale.product.id,
          title: sale.product.title,
          media: sale.product.media ?? [],
        },
        variant: sale.variant
          ? {
              id: sale.variant.id,
              size: sale.variant.size,
              color:
                sale.variant.catalogColor?.name ?? sale.variant.color ?? null,
            }
          : null,
        buyer: {
          id: sale.order.buyer.id,
          firstName: sale.order.buyer.firstName,
          lastName: sale.order.buyer.lastName,
        },
        quantity: sale.quantity,
        unitPrice: Number(sale.unitPrice),
        subtotal: Number(sale.subtotal),
        orderStatus: sale.order.status,
        paymentMethod: sale.order.paymentMethod,
        shippingType: sale.order.shippingType,
        createdAt: sale.order.createdAt,
        financial: {
          grossAmount: financial.grossAmount,
          deductions:
            financial.commissionAmount > 0
              ? [
                  {
                    code: 'commission',
                    label: 'Comisión BuyMarket',
                    amount: financial.commissionAmount,
                  },
                ]
              : [],
          netAmount: financial.netAmount,
          walletStatus: financial.walletStatus,
          effectiveAt: financial.effectiveAt,
        },
      };
    });
  }

  private toCents(value: number | string) {
    return Math.round(Number(value) * 100);
  }

  private allocateCents(totalCents: number, weights: number[]) {
    const totalWeight = weights.reduce((total, weight) => total + weight, 0);
    if (weights.length === 0) return [];
    if (totalWeight <= 0) {
      return weights.map((_, index) =>
        index === weights.length - 1 ? totalCents : 0,
      );
    }

    let allocated = 0;
    return weights.map((weight, index) => {
      if (index === weights.length - 1) return totalCents - allocated;
      const share = Math.round(totalCents * (weight / totalWeight));
      allocated += share;
      return share;
    });
  }

  async findOne(id: string, userId: string) {
    const order = await this.ordersRepository.findOne({
      where: {
        id,
        buyer: { id: userId },
      },
      relations: [
        'buyer',
        'items',
        'items.product',
        'items.variant',
        'items.variant.catalogColor',
        'payment',
        'shipment',
      ],
    });

    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    return this.normalizeOrderVariantColors(order);
  }

  async findAllOrders() {
    const orders = await this.ordersRepository.find({
      relations: [
        'buyer',
        'items',
        'items.product',
        'items.variant',
        'items.variant.catalogColor',
        'items.product.seller',
        'payment',
        'shipment',
      ],
      order: {
        createdAt: 'DESC',
      },
    });

    return this.normalizeOrderVariantColors(orders);
  }

  private normalizeNationalShippingData(data?: NationalShippingDataDto) {
    if (!data) {
      throw new BadRequestException(
        'Los datos de envio nacional son obligatorios',
      );
    }

    const requiredFields: Array<keyof NationalShippingDataDto> = [
      'fullName',
      'dni',
      'cuit',
      'address',
      'postalCode',
      'city',
      'province',
      'phone',
      'email',
      'transportName',
    ];

    const missingField = requiredFields.find((field) => {
      const value = data[field];

      return typeof value !== 'string' || value.trim().length === 0;
    });

    if (missingField) {
      throw new BadRequestException(
        'Los datos de envio nacional estan incompletos',
      );
    }

    return {
      fullName: data.fullName.trim(),
      dni: data.dni.trim(),
      cuit: data.cuit.trim(),
      address: data.address.trim(),
      postalCode: data.postalCode.trim(),
      city: data.city.trim(),
      province: data.province.trim(),
      country: data.country?.trim() || 'Argentina',
      phone: data.phone.trim(),
      email: data.email.trim(),
      transportName: data.transportName.trim(),
    };
  }

  private async resolvePaymentMethod(
    userId: string,
    checkoutDto: CheckoutOrderDto,
  ): Promise<{
    method: PaymentMethod;
    senderAlias?: string;
    senderCbu?: string;
  }> {
    if (!checkoutDto.paymentMethodId) {
      if (!checkoutDto.paymentMethod) {
        throw new BadRequestException('El medio de pago es obligatorio');
      }

      return {
        method: checkoutDto.paymentMethod,
      };
    }

    const savedPaymentMethod = await this.userPaymentMethodsRepository.findOne({
      where: {
        id: checkoutDto.paymentMethodId,
        user: { id: userId },
      },
      relations: ['user'],
    });

    if (!savedPaymentMethod) {
      throw new NotFoundException('Medio de pago no encontrado');
    }

    if (!savedPaymentMethod.isActive) {
      throw new BadRequestException('El medio de pago no esta activo');
    }

    return {
      method: savedPaymentMethod.method,
      senderAlias: savedPaymentMethod.senderAlias,
      senderCbu: savedPaymentMethod.senderCbu,
    };
  }
}
