import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../users/entity/user.entity';
import { OrderItem } from './order-item.entity';
import { Payment } from '../../payments/entity/payment.entity';
import { OrderStatus, PaymentMethod } from './order.enums';
import { Shipment } from '../../shipments/entities/shipment.entity';

export { OrderStatus, PaymentMethod } from './order.enums';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  buyer!: User;

  @OneToMany(() => OrderItem, (item) => item.order, {
    cascade: true,
  })
  items!: OrderItem[];

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  total!: number;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status!: OrderStatus;

  @Column({ type: 'varchar', length: 255 })
  deliveryAddress!: string;

  @Column({
    type : 'enum', 
    enum : PaymentMethod,
    default : PaymentMethod.CASH, 
  })
  paymentMethod! : PaymentMethod; 

  @Column({
    type : 'text', 
    nullable : true,
  })
  notes? : string;

  @Column({
    nullable : true, 
  })
  paymentId?: string; 

  @Column({
    nullable : true,     
  })
  paymentPreferenceId? : string; 

  @Column({
    nullable : true, 
  })
  paymentStatus? : string; 

  @OneToOne(() => Payment, (payment) => payment.order)
  payment? : Payment; 

  @OneToOne(() => Shipment, (shipment) => shipment.order)
  shipment! : Shipment; 
  
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
