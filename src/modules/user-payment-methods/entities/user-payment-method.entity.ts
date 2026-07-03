import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { PaymentMethod } from '../../orders/entities/order.enums';
import { User } from '../../users/entity/user.entity';

@Entity('user_payment_methods')
export class UserPaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: PaymentMethod })
  method!: PaymentMethod;

  @Column()
  label!: string;

  @Column({ default: false })
  isDefault!: boolean;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ nullable: true })
  senderAlias?: string;

  @Column({ nullable: true })
  senderCbu?: string;

  @ManyToOne(() => User, (user) => user.paymentMethods, {
    onDelete: 'CASCADE',
  })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
