import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SubCategory } from './entities/subcategoria.entity';
import { Category } from '../categories/entities/category.entity';
import { SubCategoriesController } from './subcategoria.controller';
import { SubCategoriesService } from './subcategoria.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubCategory,
      Category,
    ]),
  ],
  controllers: [SubCategoriesController],
  providers: [SubCategoriesService],
  exports: [SubCategoriesService],
})
export class SubCategoriesModule {}