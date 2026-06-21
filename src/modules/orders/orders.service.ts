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
import { CheckoutOrderDto } from './dto/checkout-order.dto';
import { Payment, PaymentStatus } from '../payments/entity/payment.entity';

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

    const order = this.ordersRepository.create({
      buyer : user, 
      total, 
      status : OrderStatus.PENDING,
      deliveryAddress : checkoutDto.deliveryAddress, 
      paymentMethod : checkoutDto.paymentMethod
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
      relations : ['buyer', 'items', 'items.product', 'payment'], 
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
      relations: ['buyer', 'items', 'items.product', 'payment'],
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
    ],
    order: {
      createdAt: 'DESC',
    },
  });
}
}
