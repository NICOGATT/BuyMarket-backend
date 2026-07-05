import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Order } from './order.entity';
import { Product } from '../../products/entity/product.entity';
import { ProductVariant } from '../../products/entity/product-variant.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Order, (order) => order.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  order!: Order;

  @ManyToOne(() => Product, {
    nullable: false,
    eager: true,
  })
  product!: Product;

  @ManyToOne(() => ProductVariant, {
    nullable: true,
    eager: true,
  })
  variant?: ProductVariant | null;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  unitPrice!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  subtotal!: number;
}
