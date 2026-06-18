import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SubCategoryAttribute } from './entities/subcategoria-attribute.entity';
import { SubCategory } from '../entities/subcategoria.entity';

import { SubCategoryAttributesService } from './subcategoria-attributes.service';
import { SubCategoryAttributesController } from './subcategoria-attributes.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubCategoryAttribute,
      SubCategory,
    ]),
  ],
  controllers: [SubCategoryAttributesController],
  providers: [SubCategoryAttributesService],
  exports: [SubCategoryAttributesService],
})
export class SubCategoryAttributesModule {}