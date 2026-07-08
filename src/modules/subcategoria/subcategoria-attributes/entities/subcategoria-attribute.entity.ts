import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { SubCategory } from '../../entities/subcategoria.entity';
import { ProductAttributeValue } from '../../../products/entity/product-attributes-value.entity'; 
import { ProductVariantAttributeValue } from '../../../products/entity/product-variant-attribute-value.entity';

export enum AttributeType {
  TEXT = 'text',
  NUMBER = 'number',
  SELECT = 'select',
  BOOLEAN = 'boolean',
}

export enum AttributeUsage {
  PRODUCT_ATTRIBUTE = 'PRODUCT_ATTRIBUTE',
  VARIANT_ATTRIBUTE = 'VARIANT_ATTRIBUTE',
  VARIANT_SIZE = 'VARIANT_SIZE',
  VARIANT_COLOR = 'VARIANT_COLOR',
}

export enum AttributeAppliesTo {
  PRODUCT = 'PRODUCT',
  VARIANT = 'VARIANT',
}

@Entity('sub_category_attributes')
export class SubCategoryAttribute {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({
    type: 'enum',
    enum: AttributeType,
    default: AttributeType.TEXT,
  })
  type!: AttributeType;

  @Column({ default: false })
  required!: boolean;

  @Column({
    type: 'enum',
    enum: AttributeAppliesTo,
    default: AttributeAppliesTo.PRODUCT,
  })
  appliesTo!: AttributeAppliesTo;

  @Column({ default: false })
  appliesToVariant!: boolean;

  @Column({
    type: 'enum',
    enum: AttributeUsage,
    default: AttributeUsage.PRODUCT_ATTRIBUTE,
  })
  usage!: AttributeUsage;

  @Column({ type: 'jsonb', nullable: true })
  options?: string[];

  @ManyToOne(
    () => SubCategory,
    subCategory => subCategory.attributes,
    {
      onDelete: 'CASCADE',
    },
  )
  subCategory!: SubCategory;

  @OneToMany(
    () => ProductAttributeValue,
    value => value.attribute,
  )
  values!: ProductAttributeValue[];

  @OneToMany(
    () => ProductVariantAttributeValue,
    value => value.attribute,
  )
  variantValues!: ProductVariantAttributeValue[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

