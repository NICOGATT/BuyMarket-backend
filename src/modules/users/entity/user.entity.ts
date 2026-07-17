import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';

import { Product } from '../../products/entity/product.entity';
import { Wallet } from '../../wallet/entity/wallet.entity';
import { Plan } from '../../plan/entities/plan.entity';
import { UserAddress } from '../../user-address/entities/user-address.entity';
import { UserPaymentMethod } from '../../user-payment-methods/entities/user-payment-method.entity';
import { Notification } from '../../notifications/entities/notification.entity';

export enum UserRole {
  USER = 'user',
  SELLER = 'seller',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  firstName!: string;

  @Column({ type: 'varchar', length: 100 })
  lastName!: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  email!: string;

  @Column({ type: 'varchar', nullable: true })
  password?: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role!: UserRole;

  @OneToMany(() => Product, (product) => product.seller)
  products!: Product[];

  @ManyToOne(() => Wallet, (wallet) => wallet.user)
  wallet!: Wallet;

  @ManyToOne(() => Plan, (plan) => plan.users, {
    nullable: true,
    eager: true,
  })
  plan!: Plan;

  @OneToMany(() => UserAddress, (address) => address.user)
  addresses!: UserAddress[];

  @OneToMany(() => UserPaymentMethod, (paymentMethod) => paymentMethod.user)
  paymentMethods!: UserPaymentMethod[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications!: Notification[];

  @Column({ default: false })
  isEmailVerified!: boolean;

  @Column({ nullable: true })
  emailVerificationCode?: string;

  @Column({ type: 'timestamp', nullable: true })
  emailVerifcationExpires?: Date;

  @Column({ nullable: true })
  googleId?: string;

  @Column({ default: 'local' })
  provider!: 'local' | 'google';

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
