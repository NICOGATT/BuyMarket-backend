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

export enum AttributeType {
  TEXT = 'text',
  NUMBER = 'number',
  SELECT = 'select',
  BOOLEAN = 'boolean',
}

export enum AttributeUsage {
  PRODUCT_ATTRIBUTE = 'product_attribute',
  VARIANT_SIZE = 'variant_size',
  VARIANT_COLOR = 'variant_color',
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

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
