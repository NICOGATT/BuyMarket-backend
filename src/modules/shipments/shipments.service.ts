import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Shipment } from './entities/shipment.entity';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';

import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entity/user.entity';

import { ShipmentStatus } from './entities/shipment.entity'
import { ShippingCarrier } from './entities/shipment.entity'; 
import { ShippingType } from './entities/shipment.entity';
import { OrderStatus } from '../orders/entities/order.entity';

@Injectable()
export class ShipmentsService {
  constructor(
    @InjectRepository(Shipment)
    private readonly shipmentRepository: Repository<Shipment>,

    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(dto: CreateShipmentDto) {
    const order = await this.orderRepository.findOne({
      where: { id: dto.orderId },
      relations: ['shipment'],
    });

    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException('La orden debe estar pagada para crear el envío');
    }

    if (order.shipment) {
      throw new BadRequestException('Esta orden ya tiene un envío creado');
    }

    const shipment = this.shipmentRepository.create({
      order,
      type: dto.type,
      carrier: dto.carrier,
      cost: dto.cost ?? 0,
      pickupAddress: dto.pickupAddress,
      deliveryAddress: dto.deliveryAddress,
      buyerProvince: dto.buyerProvince,
      buyerCity: dto.buyerCity,
      buyerPostalCode: dto.buyerPostalCode,
      status:
        dto.type === ShippingType.LOCAL_DELIVERY
          ? ShipmentStatus.ASSIGNING_DRIVER
          : ShipmentStatus.PENDING,
    });

    return this.shipmentRepository.save(shipment);
  }

  async findAll() {
    return this.shipmentRepository.find({
      relations: ['order', 'driver'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const shipment = await this.shipmentRepository.findOne({
      where: { id },
      relations: ['order', 'driver'],
    });

    if (!shipment) {
      throw new NotFoundException('Envío no encontrado');
    }

    return shipment;
  }

  async update(id: string, dto: UpdateShipmentDto) {
    const shipment = await this.findOne(id);

    Object.assign(shipment, dto);

    return this.shipmentRepository.save(shipment);
  }

  async assignDriver(id: string, driverId: string) {
    const shipment = await this.findOne(id);

    if (shipment.type !== ShippingType.LOCAL_DELIVERY) {
      throw new BadRequestException('Solo se puede asignar repartidor a envíos locales');
    }

    const driver = await this.userRepository.findOne({
      where: { id: driverId },
    });

    if (!driver) {
      throw new NotFoundException('Repartidor no encontrado');
    }

    shipment.driver = driver;
    shipment.carrier = ShippingCarrier.BUYMARKET;
    shipment.status = ShipmentStatus.DRIVER_ASSIGNED;

    return this.shipmentRepository.save(shipment);
  }

  async markPickedUp(id: string, userId: string) {
    const shipment = await this.findOne(id);

    this.validateDriver(shipment, userId);

    shipment.status = ShipmentStatus.PICKED_UP;

    return this.shipmentRepository.save(shipment);
  }

  async markInTransit(id: string, userId: string) {
    const shipment = await this.findOne(id);

    if (shipment.type === ShippingType.LOCAL_DELIVERY) {
      this.validateDriver(shipment, userId);
    }

    shipment.status = ShipmentStatus.IN_TRANSIT;

    return this.shipmentRepository.save(shipment);
  }

  async markDelivered(id: string, userId: string) {
    const shipment = await this.findOne(id);

    if (shipment.type === ShippingType.LOCAL_DELIVERY) {
      this.validateDriver(shipment, userId);
    }

    shipment.status = ShipmentStatus.DELIVERED;
    await this.shipmentRepository.save(shipment);

    shipment.order.status = OrderStatus.DELIVERED;
    await this.orderRepository.save(shipment.order);

    return {
      message: 'Envío entregado correctamente',
      shipment,
    };
  }

  async updateTracking(
    id: string,
    trackingNumber: string,
    trackingUrl?: string,
  ) {
    const shipment = await this.findOne(id);

    if (shipment.type !== ShippingType.NATIONAL_SHIPPING) {
      throw new BadRequestException('El tracking solo aplica para envíos nacionales');
    }

    shipment.trackingNumber = trackingNumber;
    shipment.trackingUrl = trackingUrl;
    shipment.status = ShipmentStatus.IN_TRANSIT;

    return this.shipmentRepository.save(shipment);
  }

  async cancel(id: string) {
    const shipment = await this.findOne(id);

    if (shipment.status === ShipmentStatus.DELIVERED) {
      throw new BadRequestException('No se puede cancelar un envío entregado');
    }

    shipment.status = ShipmentStatus.CANCELLED;

    return this.shipmentRepository.save(shipment);
  }

  async findMyDeliveries(driverId: string) {
    return this.shipmentRepository.find({
      where: {
        driver: { id: driverId },
      },
      relations: ['order', 'driver'],
      order: { createdAt: 'DESC' },
    });
  }

  private validateDriver(shipment: Shipment, userId: string) {
    if (!shipment.driver) {
      throw new BadRequestException('Este envío no tiene repartidor asignado');
    }

    if (shipment.driver.id !== userId) {
      throw new ForbiddenException('No sos el repartidor asignado a este envío');
    }
  }
}