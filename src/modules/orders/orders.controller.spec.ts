import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

describe('OrdersController', () => {
  let controller: OrdersController;
  let ordersService: {
    checkout: jest.Mock;
    findMyOrders: jest.Mock;
    findMySales: jest.Mock;
    findAllOrders: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    ordersService = {
      checkout: jest.fn(),
      findMyOrders: jest.fn(),
      findMySales: jest.fn(),
      findAllOrders: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: ordersService,
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('busca las ventas del usuario autenticado', () => {
    const user = { id: 'seller-1' };
    const sales = [{ saleId: 'item-1' }];

    ordersService.findMySales.mockReturnValue(sales);

    expect(controller.findMySales(user)).toBe(sales);
    expect(ordersService.findMySales).toHaveBeenCalledWith(user.id);
  });
});
