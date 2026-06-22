import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity/cart-item.entity';
import { Product } from '../products/entity/product.entity';
import { User } from '../users/entity/user.entity';

@Injectable()
export class CartsService {
  constructor(
    @InjectRepository(Cart)
    private readonly cartsRepository: Repository<Cart>,

    @InjectRepository(CartItem)
    private readonly cartItemsRepository: Repository<CartItem>,

    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async getCartByUser(userId: string) {
    let cart = await this.cartsRepository.findOne({
      where: {
        user: { id: userId },
      },
      relations: ['user', 'items', 'items.product', 'items.product.media'],
    });

    if (!cart) {
      const user = await this.usersRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }

      cart = this.cartsRepository.create({
        user,
        items: [],
      });

      cart = await this.cartsRepository.save(cart);
    }

    return cart;
  }

  async addProduct(userId: string, productId: string, quantity: number = 1) {
    const cart = await this.getCartByUser(userId);

    const product = await this.productsRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    let item = await this.cartItemsRepository.findOne({
      where: {
        cart: { id: cart.id },
        product: { id: product.id },
      },
      relations: ['cart', 'product'],
    });

    if (item) {
      item.quantity += quantity;
    } else {
      item = this.cartItemsRepository.create({
        cart,
        product,
        quantity,
        unitPrice: Number(product.price),
      });
    }

    await this.cartItemsRepository.save(item);

    return this.getCartByUser(userId);
  }

  async updateQuantity(userId: string, itemId: string, quantity: number) {
    const cart = await this.getCartByUser(userId);

    const item = await this.cartItemsRepository.findOne({
      where: {
        id: itemId,
        cart: { id: cart.id },
      },
      relations: ['cart', 'product'],
    });

    if (!item) {
      throw new NotFoundException('Item no encontrado');
    }

    item.quantity = quantity;

    await this.cartItemsRepository.save(item);

    return this.getCartByUser(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.getCartByUser(userId);

    const item = await this.cartItemsRepository.findOne({
      where: {
        id: itemId,
        cart: { id: cart.id },
      },
    });

    if (!item) {
      throw new NotFoundException('Item no encontrado');
    }

    await this.cartItemsRepository.remove(item);

    return this.getCartByUser(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.getCartByUser(userId);

    await this.cartItemsRepository.delete({
      cart: { id: cart.id },
    });

    return this.getCartByUser(userId);
  }
}