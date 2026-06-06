import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Cart } from '../cart.entity';
import { Product } from '../../../products/entity/product.entity';

@Entity('cart_items')
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Cart, (cart) => cart.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  cart!: Cart;

  @ManyToOne(() => Product, {
    nullable: false,
    eager: true,
  })
  product!: Product;

  @Column({ type: 'int', default: 1 })
  quantity!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  unitPrice!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}