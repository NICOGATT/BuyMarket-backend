import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Product } from './entity/product.entity';
import { Category } from '../categories/entities/category.entity';
import { ProductMedia } from './product-media/entities/product-media.entity';
import { ProductAttributeValue } from './entity/product-attributes-value.entity';
import { ProductVariantAttributeValue } from './entity/product-variant-attribute-value.entity';
import { ProductVariant } from './entity/product-variant.entity';
import { SubCategory } from '../subcategoria/entities/subcategoria.entity';
import { SubCategoryAttribute } from '../subcategoria/subcategoria-attributes/entities/subcategoria-attribute.entity';

import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { UserAddress } from '../user-address/entities/user-address.entity';

import { CloudinaryModule } from '../../cloudinary/cloudinary.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Category,
      SubCategory,
      ProductMedia,
      ProductVariant,
      ProductVariantAttributeValue,
      SubCategoryAttribute,
      ProductAttributeValue,
      UserAddress
    ]),
    CloudinaryModule
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
