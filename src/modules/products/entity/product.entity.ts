import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

import { User } from '../../users/entity/user.entity';
import { CartItem } from '../../carts/entities/cart-item.entity/cart-item.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  price!: number;

  @Column({ type: 'int', default: 0 })
  stock!: number;

  @Column({ type: 'varchar', length: 100 })
  category!: string;

  @Column('text', { array: true, default: [] })
  images!: string[];

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @ManyToOne(() => User, (user) => user.products, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  seller!: User;

  @OneToMany(() => CartItem, (item) => item.product)
  cartItems! : CartItem[];
  
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}