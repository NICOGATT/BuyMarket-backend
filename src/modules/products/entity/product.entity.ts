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
import { Category } from '../../categories/entities/category.entity';
import { ProductMedia } from '../product-media/entities/product-media.entity';
import { SubCategory } from '../../subcategoria/entities/subcategoria.entity';
import { ProductAttributeValue } from './product-attributes-value.entity';
import { UserAddress } from '../../user-address/entities/user-address.entity';
import { ProductVariant } from './product-variant.entity';

export enum ProductApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

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

  @OneToMany(() => ProductVariant, variant => variant.product, {
    cascade: true,
  })
  variants!: ProductVariant[];

  @ManyToOne(() => Category, (category) => category.products, {
    nullable: false, 
    eager : true,
  })
  category! : Category;
  @ManyToOne(() => SubCategory, subCategory => subCategory.products, {
  nullable: true,
  })
  subCategory?: SubCategory;

  @OneToMany(() => ProductMedia, media => media.product, {
    cascade: true,
  })
  media!: ProductMedia[];

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({
    type: 'enum',
    enum: ProductApprovalStatus,
    default: ProductApprovalStatus.APPROVED,
  })
  approvalStatus!: ProductApprovalStatus;

  @Column({ type: 'varchar', length: 120, nullable: true })
  horarioDisponible?: string | null;

  @ManyToOne(() => User, (user) => user.products, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  seller!: User;

  @OneToMany(() => CartItem, (item) => item.product)
  cartItems! : CartItem[];

  @OneToMany(
    () => ProductAttributeValue,
    value => value.product,
    {
      cascade: true,
    },
  )
  attributeValues!: ProductAttributeValue[];

  @ManyToOne(() => UserAddress, {
    nullable : true,
  })
  pickupAddress? : UserAddress | null;
  
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
