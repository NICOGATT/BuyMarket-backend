import { Wallet } from '../../wallet/entity/wallet.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum WithdrawalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  PAID = 'paid',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

@Entity('withdrawal_requests')
export class WithdrawalRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Wallet, wallet => wallet.withdrawals, {
    onDelete: 'CASCADE',
  })
  wallet!: Wallet;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  amount!: number;

  @Column({ nullable: true })
  alias?: string;

  @Column({ nullable: true })
  cbu?: string;

  @Column({
    type: 'enum',
    enum: WithdrawalStatus,
    default: WithdrawalStatus.PENDING,
  })
  status!: WithdrawalStatus;

  @Column({ nullable: true })
  adminNote?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}