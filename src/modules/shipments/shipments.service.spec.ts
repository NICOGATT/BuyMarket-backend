import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';

import { Order, OrderStatus } from '../orders/entities/order.entity';
import { User } from '../users/entity/user.entity';
import {
  Shipment,
  ShipmentStatus,
  ShippingCarrier,
  ShippingType,
} from './entities/shipment.entity';
import { ShipmentsService } from './shipments.service';

type MockRepository<T extends ObjectLiteral = any> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockRepository = <
  T extends ObjectLiteral = any,
>(): MockRepository<T> => ({
  create: jest.fn((data) => data),
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn((data) => data),
});

describe('ShipmentsService', () => {
  let service: ShipmentsService;
  let shipmentRepository: MockRepository<Shipment>;
  let orderRepository: MockRepository<Order>;
  let userRepository: MockRepository<User>;

  beforeEach(async () => {
    shipmentRepository = createMockRepository<Shipment>();
    orderRepository = createMockRepository<Order>();
    userRepository = createMockRepository<User>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentsService,
        {
          provide: getRepositoryToken(Shipment),
          useValue: shipmentRepository,
        },
        {
          provide: getRepositoryToken(Order),
          useValue: orderRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
      ],
    }).compile();

    service = module.get<ShipmentsService>(ShipmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('crea envio nacional copiando los datos nacionales guardados en la orden', async () => {
    const order = {
      id: 'order-1',
      status: OrderStatus.PAID,
      deliveryAddress: 'Ruta 1 KM 2',
      nationalShippingFullName: 'Juan Perez',
      nationalShippingDni: '12345678',
      nationalShippingCuit: '20-12345678-9',
      nationalShippingAddress: 'Ruta 1 KM 2',
      nationalShippingPostalCode: '5000',
      nationalShippingCity: 'Cordoba',
      nationalShippingProvince: 'Cordoba',
      nationalShippingCountry: 'Argentina',
      nationalShippingPhone: '3511234567',
      nationalShippingEmail: 'juan@example.com',
      nationalShippingTransportName: 'Andreani',
    } as Order;

    orderRepository.findOne?.mockResolvedValue(order);
    shipmentRepository.save?.mockImplementation((shipment) =>
      Promise.resolve(shipment),
    );

    const result = await service.create({
      orderId: order.id,
      type: ShippingType.NATIONAL_SHIPPING,
      carrier: ShippingCarrier.ANDREANI,
    });

    expect(shipmentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        order,
        type: ShippingType.NATIONAL_SHIPPING,
        carrier: ShippingCarrier.ANDREANI,
        deliveryAddress: order.nationalShippingAddress,
        buyerFullName: order.nationalShippingFullName,
        buyerDni: order.nationalShippingDni,
        buyerCuit: order.nationalShippingCuit,
        buyerProvince: order.nationalShippingProvince,
        buyerCity: order.nationalShippingCity,
        buyerPostalCode: order.nationalShippingPostalCode,
        buyerCountry: order.nationalShippingCountry,
        buyerPhone: order.nationalShippingPhone,
        buyerEmail: order.nationalShippingEmail,
        transportName: order.nationalShippingTransportName,
        status: ShipmentStatus.PENDING,
      }),
    );
    expect(result).toMatchObject({
      buyerFullName: order.nationalShippingFullName,
      transportName: order.nationalShippingTransportName,
    });
  });
});
