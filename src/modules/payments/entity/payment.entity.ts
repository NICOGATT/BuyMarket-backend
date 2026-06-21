import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { PaymentMethod } from '../../orders/entities/order.enums';

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: PaymentMethod })
  method!: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status!: PaymentStatus;

  @Column('decimal', { precision: 12, scale: 2 })
  amount!: number;

  @Column({ nullable: true })
  proofImageUrl?: string;

  @Column({ nullable: true })
  senderAlias?: string;

  @Column({ nullable: true })
  senderCbu?: string;

  @Column({ type: 'text', nullable: true })
  adminNote?: string;

  @OneToOne(() => Order, (order) => order.payment)
  @JoinColumn()
  order!: Order;

  @CreateDateColumn()
  createdAt: Date | undefined;

  @UpdateDateColumn()
  updatedAt?: Date;
}
