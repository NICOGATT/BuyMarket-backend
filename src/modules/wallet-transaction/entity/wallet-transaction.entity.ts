import { Order } from '../../orders/entities/order.entity';
import { Wallet } from '../../wallet/entity/wallet.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum WalletTransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
  WITHDRAWAL = 'withdrawal',
  COMMISSION = 'commission',
  REFUND = 'refund',
}

export enum WalletTransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('wallet_transactions')
@Index('UQ_wallet_transaction_order_type', ['wallet', 'order', 'type'], {
  unique: true,
})
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Wallet, (wallet) => wallet.transactions, {
    onDelete: 'CASCADE',
  })
  wallet!: Wallet;

  @ManyToOne(() => Order, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  order?: Order | null;

  @Column({
    type: 'enum',
    enum: WalletTransactionType,
  })
  type!: WalletTransactionType;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  amount!: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  commissionAmount!: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  netAmount!: number;

  @Column({
    type: 'enum',
    enum: WalletTransactionStatus,
    default: WalletTransactionStatus.COMPLETED,
  })
  status!: WalletTransactionStatus;

  @Column({ type: 'timestamp', nullable: true })
  releaseDate?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  effectiveAt?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  mercadoPagoPaymentId?: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
