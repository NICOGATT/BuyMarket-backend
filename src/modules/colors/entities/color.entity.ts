import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ProductVariant } from '../../products/entity/product-variant.entity';

@Entity('colors')
export class Color {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'varchar', length: 80, unique: true, select: false })
  normalizedName!: string;

  @Column({ type: 'varchar', length: 7, unique: true })
  hex!: string;

  @OneToMany(() => ProductVariant, (variant) => variant.catalogColor)
  variants!: ProductVariant[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
