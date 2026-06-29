import { Product } from '../../entity/product.entity';
import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum ProductMediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document', 
}

@Entity('product_media')
export class ProductMedia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  url!: string;

  @Column({
    type: 'enum',
    enum: ProductMediaType,
    default: ProductMediaType.IMAGE,
  })
  type!: ProductMediaType;
  @Column({ default: false })
  isCover!: boolean;

  @Column({ default: 0 })
  order!: number;

  @Column()
  publicId!: string;

  @ManyToOne(() => Product, product => product.media, {
    onDelete: 'CASCADE',
    nullable : true
  })
  product?: Product | null;


}