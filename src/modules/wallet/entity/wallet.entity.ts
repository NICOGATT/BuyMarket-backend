import { User } from '../../users/entity/user.entity'; 
import { WalletTransaction } from '../../wallet-transaction/entity/wallet-transaction.entity';
import { WithdrawalRequest } from '../../with-drawal-request/entities/with-drawal-request.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User, user => user.wallet, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  user!: User;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  balance!: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  pendingBalance!: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  totalEarned!: number;

  @OneToMany(() => WalletTransaction, transaction => transaction.wallet)
  transactions!: WalletTransaction[];

  @OneToMany(() => WithdrawalRequest, withdrawal => withdrawal.wallet)
  withdrawals!: WithdrawalRequest[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}