import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductMedia } from './entities/product-media.entity';
import { Product } from '../entity/product.entity';

import { ProductMediaController } from './product-media.controller';
import { ProductMediaService } from './product-media.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductMedia,
      Product,
    ]),
  ],
  controllers: [ProductMediaController],
  providers: [ProductMediaService],
  exports: [ProductMediaService],
})
export class ProductMediaModule {}