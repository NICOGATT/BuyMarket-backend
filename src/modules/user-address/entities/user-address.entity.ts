import { User } from '../../users/entity/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_addresses')
export class UserAddress {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  label!: string; // Casa, Trabajo, Local

  @Column()
  street!: string;

  @Column()
  number!: string;

  @Column({ nullable: true })
  floor?: string;

  @Column({ nullable: true })
  apartment?: string;

  @Column()
  city!: string;

  @Column()
  province!: string;

  @Column()
  postalCode!: string;

  @Column({ nullable: true })
  reference?: string;

  @Column({ default: false })
  isDefault!: boolean;

  @ManyToOne(() => User, user => user.addresses, {
    onDelete: 'CASCADE',
  })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}