import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Wallet } from "../../modules/wallet/entity/wallet.entity";
import { Order } from "../../modules/orders/entities/order.entity";

@Entity('wallet_movements')
export class WalletMovement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Wallet)
  wallet!: Wallet;

  @Column({ type: 'enum', enum: WalletMovement })
  type!: WalletMovement;

  @Column('decimal', { precision: 12, scale: 2 })
  amount!: number;

  @Column()
  reason!: string;

  @ManyToOne(() => Order, { nullable: true })
  order?: Order;

  @CreateDateColumn()
  createdAt?: Date;
}