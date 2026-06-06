import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  Unique,
} from 'typeorm';

import { User } from '../../users/entity/user.entity';
import { Product } from '../../products/entity/product.entity';

@Entity('favorites')
@Unique(['user', 'product'])
export class Favorite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  user!: User;

  @ManyToOne(() => Product, {
    nullable: false,
    onDelete: 'CASCADE',
    eager: true,
  })
  product!: Product;

  @CreateDateColumn()
  createdAt!: Date;
}