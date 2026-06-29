import { Order } from "../../orders/entities/order.entity";
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { User } from "../../users/entity/user.entity";


export enum ShippingType {
    LOCAL_DELIVERY = 'local_delivery', 
    NATIONAL_SHIPPING = 'national_shipping'
}

export enum ShippingCarrier {
    BUYMARKET = 'buymarket', 
    ANDREANI = 'andreani', 
    CORREO_ARGENTINO = 'correo_argentino', 
    OCA = 'oca',
}

export enum ShipmentStatus {
    PENDING = 'pending',
    ASSIGNING_DRIVER = 'assigning_driver',
    DRIVER_ASSIGNED = 'driver_assigned',
    PICKED_UP = 'picked_up',
    IN_TRANSIT = 'in_transit',
    DELIVERED = 'delivered',
    CANCELLED = 'cancelled',
}
@Entity('shipments')
export class Shipment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Order, order => order.shipment)
  @JoinColumn()
  order!: Order;

  @Column({
    type: 'enum',
    enum: ShippingType,
  })
  type?: ShippingType;

  @Column({
    type: 'enum',
    enum: ShippingCarrier,
  })
  carrier?: ShippingCarrier;

  @Column({
    type: 'enum',
    enum: ShipmentStatus,
    default: ShipmentStatus.PENDING,
  })
  status?: ShipmentStatus;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  cost!: number;

  @Column({ nullable: true })
  trackingNumber?: string;

  @Column({ nullable: true })
  trackingUrl?: string;

  @Column({ nullable: true })
  pickupAddress?: string;

  @Column({ nullable: true })
  deliveryAddress?: string;

  @Column({ nullable: true })
  buyerProvince?: string;

  @Column({ nullable: true })
  buyerCity?: string;

  @Column({ nullable: true })
  buyerPostalCode?: string;

  @ManyToOne(() => User, { nullable: true })
  driver?: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

}