import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Product } from './entity/product.entity';
import { Category } from '../categories/entities/category.entity';
import { ProductMedia } from './product-media/entities/product-media.entity';
import { ProductAttributeValue } from './entity/product-attributes-value.entity';
import { SubCategory } from '../subcategoria/entities/subcategoria.entity';
import { SubCategoryAttribute } from '../subcategoria/subcategoria-attributes/entities/subcategoria-attribute.entity';

import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Category,
      SubCategory,
      ProductMedia,
      SubCategoryAttribute,
      ProductAttributeValue,
    ]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}