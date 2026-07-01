import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { Order, OrderStatus, PaymentMethod } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Cart } from '../carts/entities/cart.entity';
import { CartItem } from '../carts/entities/cart-item.entity/cart-item.entity';
import { Product } from '../products/entity/product.entity';
import { User } from '../users/entity/user.entity';
import {
  CheckoutOrderDto,
  NationalShippingDataDto,
} from './dto/checkout-order.dto';
import { Payment, PaymentStatus } from '../payments/entity/payment.entity';
import { ShippingType } from '../shipments/entities/shipment.entity';

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

    @InjectRepository(User)
    private readonly userRepository : Repository<User>,

    @InjectRepository(Payment)
    private readonly paymentRepository : Repository<Payment>,

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
      relations : ['items', 'items.product']
    })

    if(!cart || !cart.items || cart.items.length === 0){
      throw new BadRequestException("El carrito esta vacio")
    }

    let total = 0; 

    for (const item of cart.items) {
      if(item.product.stock < item.quantity) {
        throw new BadRequestException(`Stock insuficiente para ${item.product.title}`);
      }

      total += Number(item.unitPrice) * item.quantity; 
    }

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
      paymentMethod : checkoutDto.paymentMethod,
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
        quantity : item.quantity, 
        unitPrice : item.unitPrice, 
        subtotal : Number(item.unitPrice) * item.quantity
      })
    )

    await this.orderItemsRepository.save(orderItems); 

    for (const item of cart.items){
      item.product.stock -= item.quantity; 

      await this.productsRepository.save(item.product)
    }

    await this.cartItemsRepository.delete({
      cart : {id : cart.id},
    });

    if (checkoutDto.paymentMethod === PaymentMethod.TRANSFER) {
      await this.paymentRepository.save(
        this.paymentRepository.create({
          method: PaymentMethod.TRANSFER,
          status: PaymentStatus.PENDING,
          amount: total,
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
      relations : ['buyer', 'items', 'items.product', 'payment', 'shipment'],
      order : {
        createdAt : 'DESC'
      }
    })
  }

  async findOne(id: string, userId: string) {
    const order = await this.ordersRepository.findOne({
      where: {
        id,
        buyer: { id: userId },
      },
      relations: ['buyer', 'items', 'items.product', 'payment', 'shipment'],
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
}
