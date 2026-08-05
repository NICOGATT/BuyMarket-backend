import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Product } from './product.entity';
import { ProductVariantAttributeValue } from './product-variant-attribute-value.entity';
import { Color } from '../../colors/entities/color.entity';

@Entity('product_variants')
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  size!: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  color?: string | null;

  @Column({ type: 'varchar', length: 7, nullable: true })
  colorHex?: string | null;

  @Column({ type: 'uuid', nullable: true })
  catalogColorId?: string | null;

  @ManyToOne(() => Color, (color) => color.variants, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true,
  })
  @JoinColumn({ name: 'catalogColorId' })
  catalogColor?: Color | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  price!: number;

  @Column({ type: 'int', default: 0 })
  stock!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @ManyToOne(() => Product, (product) => product.variants, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  product!: Product;

  @OneToMany(() => ProductVariantAttributeValue, (value) => value.variant, {
    cascade: true,
  })
  attributes!: ProductVariantAttributeValue[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
