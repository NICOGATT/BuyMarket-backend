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

  /**
   * Identificador externo del intento:
   * - Web Checkout Global: `payment_intent_id`.
   * - QR interoperable: `payment_id`.
   */
  @Index({ unique: true })
  @Column({ nullable: true })
  externalPaymentId?: string;

  /**
   * Identificador definitivo del pago cuando Getnet lo informa (webhook).
   */
  @Index({ unique: true })
  @Column({ nullable: true })
  providerPaymentId?: string;

  @Column({ type: 'enum', enum: PaymentAttemptStatus })
  status!: PaymentAttemptStatus;

  /**
   * Estado original reportado por Getnet (por ejemplo APPROVED, AUTHORIZED).
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  rawStatus?: string;

  @Column({ type: 'text', nullable: true })
  qrPayload?: string;

  /**
   * URL de checkout devuelta por Getnet cuando la modalidad es redirect.
   */
  @Column({ type: 'text', nullable: true })
  checkoutUrl?: string;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  /**
   * Fecha de la ultima notificacion recibida para este intento.
   */
  @Column({ type: 'timestamptz', nullable: true })
  lastNotifiedAt?: Date;

  /**
   * Metadata segura y sanitizada del ultimo webhook (sin datos sensibles).
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

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
