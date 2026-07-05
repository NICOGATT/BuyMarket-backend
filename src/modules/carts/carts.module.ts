import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity/cart-item.entity';
import { Product } from '../products/entity/product.entity';
import { ProductVariant } from '../products/entity/product-variant.entity';

import { CartsService } from './carts.service';
import { CartsController } from './carts.controller';
import { User } from '../users/entity/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cart,
      CartItem,
      Product,
      ProductVariant,
      User
    ]),
  ],
  controllers: [CartsController],
  providers: [CartsService],
})
export class CartsModule {}
