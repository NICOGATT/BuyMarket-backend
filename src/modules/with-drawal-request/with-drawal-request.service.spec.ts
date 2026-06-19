import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';

import { UserRole } from '../users/entity/user.entity';
import { Wallet } from '../wallet/entity/wallet.entity';
import { CreateWithdrawalRequestDto } from './dto/create-with-drawal-request.dto';
import { UpdateWithdrawalStatusDto } from './dto/update-with-drawal-request.dto';
import {
  WithdrawalRequest,
  WithdrawalStatus,
} from './entities/with-drawal-request.entity';
import { WithDrawalRequestService } from './with-drawal-request.service';

type MockRepository<T extends ObjectLiteral = ObjectLiteral> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockRepository = <T extends ObjectLiteral = ObjectLiteral>(): MockRepository<T> => ({
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
});

describe('WithDrawalRequestService', () => {
  let service: WithDrawalRequestService;
  let walletsRepository: MockRepository<Wallet>;
  let withdrawalsRepository: MockRepository<WithdrawalRequest>;

  const userId = 'bdb0526e-0ee2-473d-8daa-a6e63c811f8f';
  const walletId = '73005f56-0681-4a72-b607-474165d73396';
  const withdrawalId = 'a185d8f1-29f5-4170-9d2e-f546f805847f';

  const user = {
    id: userId,
    firstName: 'Nico',
    lastName: 'Gatti',
    email: 'nico@test.com',
    role: UserRole.SELLER,
  };

  const createWallet = (overrides: Partial<Wallet> = {}) =>
    ({
      id: walletId,
      user,
      balance: 1000,
      pendingBalance: 100,
      totalEarned: 2000,
      withdrawals: [],
      transactions: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    }) as Wallet;

  const wallet = createWallet();

  const createWithdrawal = (
    overrides: Partial<WithdrawalRequest> = {},
  ): WithdrawalRequest =>
    ({
      id: withdrawalId,
      wallet,
      amount: 300,
      alias: 'nico.mp',
      status: WithdrawalStatus.PENDING,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    }) as WithdrawalRequest;

  const withdrawal = createWithdrawal();

  beforeEach(async () => {
    walletsRepository = createMockRepository<Wallet>();
    withdrawalsRepository = createMockRepository<WithdrawalRequest>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithDrawalRequestService,
        {
          provide: getRepositoryToken(Wallet),
          useValue: walletsRepository,
        },
        {
          provide: getRepositoryToken(WithdrawalRequest),
          useValue: withdrawalsRepository,
        },
      ],
    }).compile();

    service = module.get<WithDrawalRequestService>(WithDrawalRequestService);
    jest.clearAllMocks();
  });

  it('deberia estar definido con todos sus repositorios mockeados', () => {
    expect(service).toBeDefined();
    expect(walletsRepository).toBeDefined();
    expect(withdrawalsRepository).toBeDefined();
  });

  describe('create', () => {
    it('crea una solicitud de retiro con alias y mueve saldo a pendingBalance', async () => {
      const walletForWithdrawal = createWallet({
        balance: 1000,
        pendingBalance: 100,
      });
      const dto: CreateWithdrawalRequestDto = {
        amount: 300,
        alias: 'nico.mp',
      };
      const createdWithdrawal = createWithdrawal({
        wallet: walletForWithdrawal,
        amount: dto.amount,
        alias: dto.alias,
        cbu: undefined,
      });

      walletsRepository.findOne?.mockResolvedValue(walletForWithdrawal);
      walletsRepository.save?.mockResolvedValue(walletForWithdrawal);
      withdrawalsRepository.create?.mockReturnValue(createdWithdrawal);
      withdrawalsRepository.save?.mockResolvedValue(createdWithdrawal);

      const result = await service.create(userId, dto);

      expect(walletsRepository.findOne).toHaveBeenCalledWith({
        where: {
          user: { id: userId },
        },
      });
      expect(walletForWithdrawal.balance).toBe(700);
      expect(walletForWithdrawal.pendingBalance).toBe(400);
      expect(walletsRepository.save).toHaveBeenCalledWith(walletForWithdrawal);
      expect(withdrawalsRepository.create).toHaveBeenCalledWith({
        wallet: walletForWithdrawal,
        amount: dto.amount,
        alias: dto.alias,
        cbu: undefined,
        status: WithdrawalStatus.PENDING,
      });
      expect(withdrawalsRepository.save).toHaveBeenCalledWith(
        createdWithdrawal,
      );
      expect(result).toEqual(createdWithdrawal);
    });

    it('crea una solicitud de retiro con cbu aunque no tenga alias', async () => {
      const walletForWithdrawal = createWallet({
        balance: 1000,
        pendingBalance: 100,
      });
      const dto: CreateWithdrawalRequestDto = {
        amount: 300,
        cbu: '0000003100012345678901',
      };
      const createdWithdrawal = createWithdrawal({
        wallet: walletForWithdrawal,
        amount: dto.amount,
        alias: undefined,
        cbu: dto.cbu,
      });

      walletsRepository.findOne?.mockResolvedValue(walletForWithdrawal);
      walletsRepository.save?.mockResolvedValue(walletForWithdrawal);
      withdrawalsRepository.create?.mockReturnValue(createdWithdrawal);
      withdrawalsRepository.save?.mockResolvedValue(createdWithdrawal);

      const result = await service.create(userId, dto);

      expect(walletForWithdrawal.balance).toBe(700);
      expect(walletForWithdrawal.pendingBalance).toBe(400);
      expect(withdrawalsRepository.create).toHaveBeenCalledWith({
        wallet: walletForWithdrawal,
        amount: dto.amount,
        alias: undefined,
        cbu: dto.cbu,
        status: WithdrawalStatus.PENDING,
      });
      expect(result).toEqual(createdWithdrawal);
    });

    it('lanza NotFoundException si no existe billetera para el usuario', async () => {
      walletsRepository.findOne?.mockResolvedValue(null);

      await expect(
        service.create(userId, {
          amount: 300,
          alias: 'nico.mp',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(walletsRepository.save).not.toHaveBeenCalled();
      expect(withdrawalsRepository.create).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si no se informa alias ni cbu', async () => {
      walletsRepository.findOne?.mockResolvedValue(wallet);

      await expect(
        service.create(userId, {
          amount: 300,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(walletsRepository.save).not.toHaveBeenCalled();
      expect(withdrawalsRepository.create).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si el saldo es insuficiente', async () => {
      walletsRepository.findOne?.mockResolvedValue(
        createWallet({
          balance: 100,
        }),
      );

      await expect(
        service.create(userId, {
          amount: 300,
          alias: 'nico.mp',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(walletsRepository.save).not.toHaveBeenCalled();
      expect(withdrawalsRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('findMyRequest', () => {
    it('devuelve las solicitudes de retiro de la billetera del usuario', async () => {
      walletsRepository.findOne?.mockResolvedValue(wallet);
      withdrawalsRepository.find?.mockResolvedValue([withdrawal]);

      const result = await service.findMyRequest(userId);

      expect(walletsRepository.findOne).toHaveBeenCalledWith({
        where: {
          user: { id: userId },
        },
      });
      expect(withdrawalsRepository.find).toHaveBeenCalledWith({
        where: {
          wallet: { id: wallet.id },
        },
        order: {
          createdAt: 'DESC',
        },
      });
      expect(result).toEqual([withdrawal]);
    });

    it('lanza NotFoundException si el usuario no tiene billetera', async () => {
      walletsRepository.findOne?.mockResolvedValue(null);

      await expect(service.findMyRequest(userId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(withdrawalsRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('devuelve todas las solicitudes con wallet.user y orden descendente', async () => {
      withdrawalsRepository.find?.mockResolvedValue([withdrawal]);

      const result = await service.findAll();

      expect(withdrawalsRepository.find).toHaveBeenCalledWith({
        relations: {
          wallet: {
            user: true,
          },
        },
        order: {
          createdAt: 'DESC',
        },
      });
      expect(result).toEqual([withdrawal]);
    });
  });

  describe('findOne', () => {
    it('devuelve una solicitud por id si existe', async () => {
      withdrawalsRepository.findOne?.mockResolvedValue(withdrawal);

      const result = await service.findOne(withdrawalId);

      expect(withdrawalsRepository.findOne).toHaveBeenCalledWith({
        where: { id: withdrawalId },
        relations: {
          wallet: {
            user: true,
          },
        },
      });
      expect(result).toEqual(withdrawal);
    });

    it('lanza NotFoundException si la solicitud no existe', async () => {
      withdrawalsRepository.findOne?.mockResolvedValue(null);

      await expect(service.findOne(withdrawalId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    it('marca una solicitud como paid y descuenta pendingBalance', async () => {
      const walletForWithdrawal = createWallet({
        balance: 700,
        pendingBalance: 300,
      });
      const pendingWithdrawal = createWithdrawal({
        wallet: walletForWithdrawal,
        amount: 300,
      });
      const dto: UpdateWithdrawalStatusDto = {
        status: WithdrawalStatus.PAID,
        adminNote: 'Transferido',
      };
      const paidWithdrawal = {
        ...pendingWithdrawal,
        status: WithdrawalStatus.PAID,
        adminNote: dto.adminNote,
      } as WithdrawalRequest;

      withdrawalsRepository.findOne?.mockResolvedValue(pendingWithdrawal);
      walletsRepository.save?.mockResolvedValue(walletForWithdrawal);
      withdrawalsRepository.save?.mockResolvedValue(paidWithdrawal);

      const result = await service.updateStatus(withdrawalId, dto);

      expect(withdrawalsRepository.findOne).toHaveBeenCalledWith({
        where: { id: withdrawalId },
        relations: {
          wallet: true,
        },
      });
      expect(walletForWithdrawal.pendingBalance).toBe(0);
      expect(walletsRepository.save).toHaveBeenCalledWith(walletForWithdrawal);
      expect(withdrawalsRepository.save).toHaveBeenCalledWith({
        ...pendingWithdrawal,
        status: WithdrawalStatus.PAID,
        adminNote: dto.adminNote,
      });
      expect(result).toEqual(paidWithdrawal);
    });

    it('rechaza una solicitud, devuelve saldo retenido y guarda la wallet', async () => {
      const walletForWithdrawal = createWallet({
        balance: 700,
        pendingBalance: 300,
      });
      const pendingWithdrawal = createWithdrawal({
        wallet: walletForWithdrawal,
        amount: 300,
      });
      const dto: UpdateWithdrawalStatusDto = {
        status: WithdrawalStatus.REJECTED,
        adminNote: 'CBU invalido',
      };
      const rejectedWithdrawal = {
        ...pendingWithdrawal,
        status: WithdrawalStatus.REJECTED,
        adminNote: dto.adminNote,
      } as WithdrawalRequest;

      withdrawalsRepository.findOne?.mockResolvedValue(pendingWithdrawal);
      walletsRepository.save?.mockResolvedValue(walletForWithdrawal);
      withdrawalsRepository.save?.mockResolvedValue(rejectedWithdrawal);

      const result = await service.updateStatus(withdrawalId, dto);

      expect(walletForWithdrawal.pendingBalance).toBe(0);
      expect(walletForWithdrawal.balance).toBe(1000);
      expect(walletsRepository.save).toHaveBeenCalledWith(walletForWithdrawal);
      expect(withdrawalsRepository.save).toHaveBeenCalledWith({
        ...pendingWithdrawal,
        status: WithdrawalStatus.REJECTED,
        adminNote: dto.adminNote,
      });
      expect(result).toEqual(rejectedWithdrawal);
    });

    it('lanza NotFoundException si la solicitud no existe', async () => {
      withdrawalsRepository.findOne?.mockResolvedValue(null);

      await expect(
        service.updateStatus(withdrawalId, {
          status: WithdrawalStatus.PAID,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(walletsRepository.save).not.toHaveBeenCalled();
      expect(withdrawalsRepository.save).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si la solicitud ya fue procesada', async () => {
      withdrawalsRepository.findOne?.mockResolvedValue(
        createWithdrawal({
          status: WithdrawalStatus.PAID,
        }),
      );

      await expect(
        service.updateStatus(withdrawalId, {
          status: WithdrawalStatus.REJECTED,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(walletsRepository.save).not.toHaveBeenCalled();
      expect(withdrawalsRepository.save).not.toHaveBeenCalled();
    });
  });
});
