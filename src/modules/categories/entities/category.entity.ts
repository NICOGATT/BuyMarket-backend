import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Product } from '../../products/entity/product.entity';
import { SubCategory } from '../../subcategoria/entities/subcategoria.entity';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @OneToMany(() => Product, (product) => product.category)
  products!: Product[];

  @Column({
  type: 'text',
  nullable: true,
  })
  icon?: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  banner?: string;
  @OneToMany(() => SubCategory, subCategory => subCategory.category)
  subCategories!: SubCategory[];
}