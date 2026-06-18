import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Product } from './product.entity';
import { SubCategoryAttribute } from '../../subcategoria/subcategoria-attributes/entities/subcategoria-attribute.entity';

@Entity('product_attribute_values')
export class ProductAttributeValue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  value!: string;

  @ManyToOne(
    () => Product,
    product => product.attributeValues,
    {
      onDelete: 'CASCADE',
    },
  )
  product!: Product;

  @ManyToOne(
    () => SubCategoryAttribute,
    attribute => attribute.values,
    {
      onDelete: 'CASCADE',
    },
  )
  attribute!: SubCategoryAttribute;
}