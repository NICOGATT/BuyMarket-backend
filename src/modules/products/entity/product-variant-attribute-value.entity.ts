import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { SubCategoryAttribute } from '../../subcategoria/subcategoria-attributes/entities/subcategoria-attribute.entity';
import { ProductVariant } from './product-variant.entity';

@Entity('product_variant_attribute_values')
export class ProductVariantAttributeValue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  value!: string;

  @ManyToOne(
    () => ProductVariant,
    variant => variant.attributes,
    {
      onDelete: 'CASCADE',
    },
  )
  variant!: ProductVariant;

  @ManyToOne(
    () => SubCategoryAttribute,
    attribute => attribute.variantValues,
    {
      onDelete: 'CASCADE',
    },
  )
  attribute!: SubCategoryAttribute;
}
