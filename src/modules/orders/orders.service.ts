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

@Injectable()
export class OrdersService {
  constructor (
    @InjectRepository(Order) 
    private readonly ordersRepository : Repository<Order>,

    @InjectRepository(OrderItem)
    private readonly orderItemsRepository : Repository<OrderItem>, 

    @InjectRepository(Cart)
    private readonly cartsRepository : Repository<Cart>,

    @InjectRepository(CartItem)
    private readonly cartItemsRepository : Repository<CartItem>, 

    @InjectRepository(Product)
    private readonly productsRepository : Repository<Product>, 

    @InjectRepository(ProductVariant)
    private readonly productVariantsRepository : Repository<ProductVariant>,

    @InjectRepository(User)
    private readonly userRepository : Repository<User>,

    @InjectRepository(Payment)
    private readonly paymentRepository : Repository<Payment>,

    @InjectRepository(UserPaymentMethod)
    private readonly userPaymentMethodsRepository : Repository<UserPaymentMethod>,

    private readonly configService: ConfigService,
  ){}

  async checkout (userId : string, checkoutDto : CheckoutOrderDto){
    const user = await this.userRepository.findOne({
      where : {id : userId}
    })

    if(!user) {
      throw new NotFoundException("Usuario no encotrado")
    }

    const cart = await this.cartsRepository.findOne({
      where : {
        user : {id : userId}
      }, 
      relations : ['items', 'items.product', 'items.variant']
    })

    if(!cart || !cart.items || cart.items.length === 0){
      throw new BadRequestException("El carrito esta vacio")
    }

    let total = 0; 

    for (const item of cart.items) {
      const availableStock = item.variant?.stock ?? item.product.stock;
      const itemName = item.variant
        ? [
            item.product.title,
            `talle ${item.variant.size}`,
            item.variant.color ? `color ${item.variant.color}` : undefined,
          ]
            .filter(Boolean)
            .join(' ')
        : item.product.title;

      if(availableStock < item.quantity) {
        throw new BadRequestException(`Stock insuficiente para ${itemName}`);
      }

      total += Number(item.unitPrice) * item.quantity; 
    }

    const selectedPaymentMethod = await this.resolvePaymentMethod(
      userId,
      checkoutDto,
    );

    const shippingType = checkoutDto.shippingType ?? ShippingType.LOCAL_DELIVERY;
    const nationalShippingData =
      shippingType === ShippingType.NATIONAL_SHIPPING
        ? this.normalizeNationalShippingData(checkoutDto.nationalShippingData)
        : undefined;

    const order = this.ordersRepository.create({
      buyer : user, 
      total, 
      status : OrderStatus.PENDING,
      deliveryAddress : nationalShippingData?.address ?? checkoutDto.deliveryAddress!,
      shippingType,
      paymentMethod : selectedPaymentMethod.method,
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
    })

    const savedOrder = await this.ordersRepository.save(order); 

    const orderItems = cart.items.map((item) => 
      this.orderItemsRepository.create({
        order : savedOrder, 
        product : item.product, 
        variant : item.variant ?? null,
        quantity : item.quantity, 
        unitPrice : item.unitPrice, 
        subtotal : Number(item.unitPrice) * item.quantity
      })
    )

    await this.orderItemsRepository.save(orderItems); 

    for (const item of cart.items){
      if (item.variant) {
        item.variant.stock -= item.quantity;

        await this.productVariantsRepository.save(item.variant);
      } else {
        item.product.stock -= item.quantity;

        await this.productsRepository.save(item.product);
      }
    }

    await this.cartItemsRepository.delete({
      cart : {id : cart.id},
    });

    if (selectedPaymentMethod.method === PaymentMethod.TRANSFER) {
      await this.paymentRepository.save(
        this.paymentRepository.create({
          method: PaymentMethod.TRANSFER,
          status: PaymentStatus.PENDING,
          amount: total,
          senderAlias: selectedPaymentMethod.senderAlias,
          senderCbu: selectedPaymentMethod.senderCbu,
          order: savedOrder,
        }),
      );

      const orderWithItems = await this.findOne(savedOrder.id, userId);

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

  async findMyOrders(userId:string) {
    return this.ordersRepository.find({
      where : {
        buyer : {id : userId}
      }, 
      relations : ['buyer', 'items', 'items.product', 'items.variant', 'payment', 'shipment'],
      order : {
        createdAt : 'DESC'
      }
    })
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
      ],
      order: {
        order: {
          createdAt: 'DESC',
        },
      },
    });

    return sales.map((sale) => ({
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
            color: sale.variant.color ?? null,
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
    }));
  }

  async findOne(id: string, userId: string) {
    const order = await this.ordersRepository.findOne({
      where: {
        id,
        buyer: { id: userId },
      },
      relations: ['buyer', 'items', 'items.product', 'items.variant', 'payment', 'shipment'],
    });

    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    return order;
  }

  async findAllOrders() {
    return this.ordersRepository.find({
      relations: [
        'buyer',
        'items',
        'items.product',
        'items.variant',
        'items.product.seller',
        'payment',
        'shipment',
      ],
      order: {
        createdAt: 'DESC',
      },
    });
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
