import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductMedia } from './entities/product-media.entity';
import { Product } from '../entity/product.entity';

import { ProductMediaController } from './product-media.controller';
import { ProductMediaService } from './product-media.service';
import { CloudinaryModule } from '../../../cloudinary/cloudinary.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductMedia,
      Product,
    ]),
    CloudinaryModule
  ],
  controllers: [ProductMediaController],
  providers: [ProductMediaService],
  exports: [ProductMediaService],
})
export class ProductMediaModule {}