import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';

import { PaymentMethod } from '../orders/entities/order.enums';
import { User } from '../users/entity/user.entity';
import { UserPaymentMethod } from './entities/user-payment-method.entity';
import { UserPaymentMethodsService } from './user-payment-methods.service';

type MockRepository<T extends ObjectLiteral = any> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockRepository = <
  T extends ObjectLiteral = any,
>(): MockRepository<T> => ({
  create: jest.fn((data) => data),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
  save: jest.fn((data) => data),
  update: jest.fn(),
});

describe('UserPaymentMethodsService', () => {
  let service: UserPaymentMethodsService;
  let paymentMethodsRepository: MockRepository<UserPaymentMethod>;
  let usersRepository: MockRepository<User>;

  beforeEach(async () => {
    paymentMethodsRepository = createMockRepository<UserPaymentMethod>();
    usersRepository = createMockRepository<User>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserPaymentMethodsService,
        {
          provide: getRepositoryToken(UserPaymentMethod),
          useValue: paymentMethodsRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: usersRepository,
        },
      ],
    }).compile();

    service = module.get<UserPaymentMethodsService>(
      UserPaymentMethodsService,
    );
  });

  it('crea un medio de pago para el usuario autenticado', async () => {
    const user = { id: 'user-1' } as User;

    usersRepository.findOne?.mockResolvedValue(user);
    paymentMethodsRepository.save?.mockImplementation((paymentMethod) =>
      Promise.resolve({
        id: 'payment-method-1',
        ...paymentMethod,
      }),
    );

    const result = await service.create(user.id, {
      method: PaymentMethod.TRANSFER,
      label: 'Transferencia Banco',
      senderAlias: 'comprador.alias',
    });

    expect(paymentMethodsRepository.create).toHaveBeenCalledWith({
      method: PaymentMethod.TRANSFER,
      label: 'Transferencia Banco',
      senderAlias: 'comprador.alias',
      isDefault: false,
      isActive: true,
      user,
    });
    expect(result).toMatchObject({
      id: 'payment-method-1',
      user,
    });
  });

  it('lista solo los medios de pago del usuario', async () => {
    const paymentMethods = [
      {
        id: 'payment-method-1',
        label: 'Mercado Pago',
        method: PaymentMethod.MERCADO_PAGO,
      },
    ] as UserPaymentMethod[];

    paymentMethodsRepository.find?.mockResolvedValue(paymentMethods);

    const result = await service.findMyPaymentMethods('user-1');

    expect(paymentMethodsRepository.find).toHaveBeenCalledWith({
      where: {
        user: { id: 'user-1' },
      },
      order: {
        isDefault: 'DESC',
        createdAt: 'DESC',
      },
    });
    expect(result).toBe(paymentMethods);
  });

  it('marca un medio como default y desmarca los demas', async () => {
    const paymentMethod = {
      id: 'payment-method-1',
      user: { id: 'user-1' },
      isDefault: false,
    } as UserPaymentMethod;

    paymentMethodsRepository.findOne?.mockResolvedValue(paymentMethod);
    paymentMethodsRepository.save?.mockImplementation((data) =>
      Promise.resolve(data),
    );

    const result = await service.setDefault('payment-method-1', 'user-1');

    expect(paymentMethodsRepository.update).toHaveBeenCalledWith(
      { user: { id: 'user-1' } },
      { isDefault: false },
    );
    expect(result.isDefault).toBe(true);
  });
});
