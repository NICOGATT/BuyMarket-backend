import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Payment } from './payment.entity';

export enum PaymentAttemptStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELED = 'CANCELED',
  EXPIRED = 'EXPIRED',
  ERROR = 'ERROR',
}

@Entity('payment_attempts')
export class PaymentAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  idempotencyKey!: string;

  @Index({ unique: true })
  @Column({ nullable: true })
  externalPaymentId?: string;

  @Column({ type: 'enum', enum: PaymentAttemptStatus })
  status!: PaymentAttemptStatus;

  @Column({ type: 'text', nullable: true })
  qrPayload?: string;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @ManyToOne(() => Payment, (payment) => payment.attempts, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  payment!: Payment;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
