import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CloudinaryModule } from '../../cloudinary/cloudinary.module';
import { Product } from '../products/entity/product.entity';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';
import { Brand } from './entities/brand.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Brand, Product]), CloudinaryModule],
  controllers: [BrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}
