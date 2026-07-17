import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../users/entity/user.entity';

export enum NotificationType {
  NEW_SALE = 'NEW_SALE',
  BALANCE_AVAILABLE = 'BALANCE_AVAILABLE',
  PAYMENT_APPROVED = 'PAYMENT_APPROVED',
  PAYMENT_REJECTED = 'PAYMENT_REJECTED',
  WITHDRAWAL_PAID = 'WITHDRAWAL_PAID',
  WITHDRAWAL_REJECTED = 'WITHDRAWAL_REJECTED',
}

@Entity('notifications')
@Index('IDX_notifications_user_created_at', ['user', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  user!: User;

  @Column({ type: 'enum', enum: NotificationType })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  data!: Record<string, unknown>;

  @Index('UQ_notifications_event_key', { unique: true })
  @Column({ type: 'varchar', length: 255 })
  eventKey!: string;

  @Column({ type: 'timestamp', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
