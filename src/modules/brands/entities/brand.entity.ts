import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { Product } from '../../products/entity/product.entity';

@Entity('brands')
export class Brand {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, nullable: true, unique: true })
  name?: string | null;

  @Column({ type: 'text', nullable: true })
  logo?: string | null;

  @Column({ type: 'varchar', nullable: true, select: false })
  logoPublicId?: string | null;

  @OneToMany(() => Product, (product) => product.brand)
  products!: Product[];
}
