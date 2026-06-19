import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  WalletTransaction,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../wallet-transaction/entity/wallet-transaction.entity';
import {
  WithdrawalRequest,
  WithdrawalStatus,
} from '../with-drawal-request/entities/with-drawal-request.entity';
import { UserRole } from '../users/entity/user.entity';
import { Wallet } from './entity/wallet.entity';
import { WalletService } from './wallet.service';

type MockRepository<T = unknown> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockRepository = <T = unknown>(): MockRepository<T> => ({
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
});

describe('WalletService', () => {
  let service: WalletService;
  let walletsRepository: MockRepository<Wallet>;
  let transactionRepository: MockRepository<WalletTransaction>;
  let withdrawalsRepository: MockRepository<WithdrawalRequest>;

  const userId = 'bdb0526e-0ee2-473d-8daa-a6e63c811f8f';
  const walletId = '73005f56-0681-4a72-b607-474165d73396';
  const orderId = '559b0806-5ec7-4669-b512-370136e57b8b';
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
      transactions: [],
      withdrawals: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    }) as Wallet;

  const wallet = createWallet();

  beforeEach(async () => {
    walletsRepository = createMockRepository<Wallet>();
    transactionRepository = createMockRepository<WalletTransaction>();
    withdrawalsRepository = createMockRepository<WithdrawalRequest>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: getRepositoryToken(Wallet),
          useValue: walletsRepository,
        },
        {
          provide: getRepositoryToken(WalletTransaction),
          useValue: transactionRepository,
        },
        {
          provide: getRepositoryToken(WithdrawalRequest),
          useValue: withdrawalsRepository,
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    jest.clearAllMocks();
  });

  it('deberia estar definido con todos sus repositorios mockeados', () => {
    expect(service).toBeDefined();
    expect(walletsRepository).toBeDefined();
    expect(transactionRepository).toBeDefined();
    expect(withdrawalsRepository).toBeDefined();
  });

  describe('findByUserId', () => {
    it('devuelve la billetera de un usuario con relaciones', async () => {
      walletsRepository.findOne?.mockResolvedValue(wallet);

      const result = await service.findByUserId(userId);

      expect(walletsRepository.findOne).toHaveBeenCalledWith({
        where: {
          user: { id: userId },
        },
        relations: {
          user: true,
          transactions: true,
          withdrawals: true,
        },
      });
      expect(result).toEqual(wallet);
    });

    it('lanza NotFoundException si el usuario no tiene billetera', async () => {
      walletsRepository.findOne?.mockResolvedValue(null);

      await expect(service.findByUserId(userId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findMyBalance', () => {
    it('devuelve balance, pendingBalance y totalEarned como numeros', async () => {
      walletsRepository.findOne?.mockResolvedValue(
        createWallet({
          balance: '1500.50' as unknown as number,
          pendingBalance: '200.25' as unknown as number,
          totalEarned: '3000.75' as unknown as number,
        }),
      );

      const result = await service.findMyBalance(userId);

      expect(result).toEqual({
        balance: 1500.5,
        pendingBalance: 200.25,
        totalEarned: 3000.75,
      });
    });
  });

  describe('findAll', () => {
    it('devuelve todas las billeteras ordenadas por fecha de creacion', async () => {
      walletsRepository.find?.mockResolvedValue([wallet]);

      const result = await service.findAll();

      expect(walletsRepository.find).toHaveBeenCalledWith({
        relations: {
          user: true,
          transactions: true,
          withdrawals: true,
        },
        order: {
          createdAt: 'DESC',
        },
      });
      expect(result).toEqual([wallet]);
    });
  });

  describe('findOne', () => {
    it('devuelve una billetera por id si existe', async () => {
      walletsRepository.findOne?.mockResolvedValue(wallet);

      const result = await service.findOne(walletId);

      expect(walletsRepository.findOne).toHaveBeenCalledWith({
        where: { id: walletId },
        relations: {
          user: true,
          transactions: true,
          withdrawals: true,
        },
      });
      expect(result).toEqual(wallet);
    });

    it('lanza NotFoundException si la billetera no existe', async () => {
      walletsRepository.findOne?.mockResolvedValue(null);

      await expect(service.findOne(walletId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('creditFromOrder', () => {
    it('acredita el neto de una orden, guarda la billetera y crea una transaccion completed', async () => {
      const walletToCredit = createWallet({
        balance: 1000,
        totalEarned: 2000,
      });
      const createdTransaction = {
        id: 'd73e715b-4dfd-4072-a93e-ff6c5841e307',
        wallet: walletToCredit,
        order: { id: orderId },
        type: WalletTransactionType.CREDIT,
        amount: 1000,
        commissionAmount: 100,
        netAmount: 900,
        status: WalletTransactionStatus.COMPLETED,
      } as WalletTransaction;

      walletsRepository.findOne?.mockResolvedValue(walletToCredit);
      walletsRepository.save?.mockResolvedValue(walletToCredit);
      transactionRepository.create?.mockReturnValue(createdTransaction);
      transactionRepository.save?.mockResolvedValue(createdTransaction);

      const result = await service.creditFromOrder({
        userId,
        orderId,
        amount: 1000,
        commisionPercentage: 10,
      });

      expect(walletToCredit.balance).toBe(1900);
      expect(walletToCredit.totalEarned).toBe(2900);
      expect(walletsRepository.save).toHaveBeenCalledWith(walletToCredit);
      expect(transactionRepository.create).toHaveBeenCalledWith({
        wallet: walletToCredit,
        order: {
          id: orderId,
        },
        type: WalletTransactionType.CREDIT,
        amount: 1000,
        commissionAmount: 100,
        netAmount: 900,
        status: WalletTransactionStatus.COMPLETED,
      });
      expect(transactionRepository.save).toHaveBeenCalledWith(
        createdTransaction,
      );
      expect(result).toEqual({
        wallet: walletToCredit,
        transaction: createdTransaction,
      });
    });
  });

  describe('requestWithDrawal', () => {
    it('crea una solicitud de retiro y mueve saldo a pendingBalance', async () => {
      const walletForWithdrawal = createWallet({
        balance: 1000,
        pendingBalance: 100,
      });
      const withdrawal = {
        id: withdrawalId,
        wallet: walletForWithdrawal,
        amount: 300,
        alias: 'nico.mp',
        status: WithdrawalStatus.PENDING,
      } as WithdrawalRequest;

      walletsRepository.findOne?.mockResolvedValue(walletForWithdrawal);
      walletsRepository.save?.mockResolvedValue(walletForWithdrawal);
      withdrawalsRepository.create?.mockReturnValue(withdrawal);
      withdrawalsRepository.save?.mockResolvedValue(withdrawal);

      const result = await service.requestWithDrawal({
        userId,
        amount: 300,
        alias: 'nico.mp',
      });

      expect(walletForWithdrawal.balance).toBe(700);
      expect(walletForWithdrawal.pendingBalance).toBe(400);
      expect(walletsRepository.save).toHaveBeenCalledWith(walletForWithdrawal);
      expect(withdrawalsRepository.create).toHaveBeenCalledWith({
        wallet: walletForWithdrawal,
        amount: 300,
        alias: 'nico.mp',
        cbu: undefined,
        status: WithdrawalStatus.PENDING,
      });
      expect(withdrawalsRepository.save).toHaveBeenCalledWith(withdrawal);
      expect(result).toEqual(withdrawal);
    });

    it('lanza BadRequestException si no se informa alias ni cbu', async () => {
      walletsRepository.findOne?.mockResolvedValue(wallet);

      await expect(
        service.requestWithDrawal({
          userId,
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
        service.requestWithDrawal({
          userId,
          amount: 300,
          alias: 'nico.mp',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(walletsRepository.save).not.toHaveBeenCalled();
      expect(withdrawalsRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('findMyWithdrawals', () => {
    it('devuelve los retiros de la billetera del usuario', async () => {
      const withdrawals = [
        {
          id: withdrawalId,
          wallet,
          amount: 300,
          status: WithdrawalStatus.PENDING,
        },
      ] as WithdrawalRequest[];

      walletsRepository.findOne?.mockResolvedValue(wallet);
      withdrawalsRepository.find?.mockResolvedValue(withdrawals);

      const result = await service.findMyWithdrawals(userId);

      expect(withdrawalsRepository.find).toHaveBeenCalledWith({
        where: {
          wallet: { id: wallet.id },
        },
        order: {
          createdAt: 'DESC',
        },
      });
      expect(result).toEqual(withdrawals);
    });
  });

  describe('findAllWithdrawals', () => {
    it('devuelve todos los retiros con wallet y user', async () => {
      const withdrawals = [
        {
          id: withdrawalId,
          wallet,
          amount: 300,
          status: WithdrawalStatus.PENDING,
        },
      ] as WithdrawalRequest[];

      withdrawalsRepository.find?.mockResolvedValue(withdrawals);

      const result = await service.findAllWithdrawals();

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
      expect(result).toEqual(withdrawals);
    });
  });

  describe('updateWithdrawalStatus', () => {
    it('marca un retiro como paid y descuenta pendingBalance', async () => {
      const walletForWithdrawal = createWallet({
        balance: 700,
        pendingBalance: 300,
      });
      const withdrawal = {
        id: withdrawalId,
        wallet: walletForWithdrawal,
        amount: 300,
        status: WithdrawalStatus.PENDING,
      } as WithdrawalRequest;
      const paidWithdrawal = {
        ...withdrawal,
        status: WithdrawalStatus.PAID,
        adminNote: 'Transferido',
      } as WithdrawalRequest;

      withdrawalsRepository.findOne?.mockResolvedValue(withdrawal);
      walletsRepository.save?.mockResolvedValue(walletForWithdrawal);
      withdrawalsRepository.save?.mockResolvedValue(paidWithdrawal);

      const result = await service.updateWithdrawalStatus(
        withdrawalId,
        WithdrawalStatus.PAID,
        'Transferido',
      );

      expect(walletForWithdrawal.pendingBalance).toBe(0);
      expect(walletsRepository.save).toHaveBeenCalledWith(walletForWithdrawal);
      expect(withdrawalsRepository.save).toHaveBeenCalledWith({
        ...withdrawal,
        status: WithdrawalStatus.PAID,
        adminNote: 'Transferido',
      });
      expect(result).toEqual(paidWithdrawal);
    });

    it('rechaza un retiro, devuelve el saldo retenido y guarda la wallet', async () => {
      const walletForWithdrawal = createWallet({
        balance: 700,
        pendingBalance: 300,
      });
      const withdrawal = {
        id: withdrawalId,
        wallet: walletForWithdrawal,
        amount: 300,
        status: WithdrawalStatus.PENDING,
      } as WithdrawalRequest;
      const rejectedWithdrawal = {
        ...withdrawal,
        status: WithdrawalStatus.REJECTED,
        adminNote: 'CBU invalido',
      } as WithdrawalRequest;

      withdrawalsRepository.findOne?.mockResolvedValue(withdrawal);
      walletsRepository.save?.mockResolvedValue(walletForWithdrawal);
      withdrawalsRepository.save?.mockResolvedValue(rejectedWithdrawal);

      const result = await service.updateWithdrawalStatus(
        withdrawalId,
        WithdrawalStatus.REJECTED,
        'CBU invalido',
      );

      expect(walletForWithdrawal.pendingBalance).toBe(0);
      expect(walletForWithdrawal.balance).toBe(1000);
      expect(walletsRepository.save).toHaveBeenCalledWith(walletForWithdrawal);
      expect(withdrawalsRepository.save).toHaveBeenCalledWith({
        ...withdrawal,
        status: WithdrawalStatus.REJECTED,
        adminNote: 'CBU invalido',
      });
      expect(result).toEqual(rejectedWithdrawal);
    });

    it('lanza NotFoundException si la solicitud de retiro no existe', async () => {
      withdrawalsRepository.findOne?.mockResolvedValue(null);

      await expect(
        service.updateWithdrawalStatus(withdrawalId, WithdrawalStatus.PAID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lanza BadRequestException si la solicitud ya fue procesada', async () => {
      withdrawalsRepository.findOne?.mockResolvedValue({
        id: withdrawalId,
        wallet,
        amount: 300,
        status: WithdrawalStatus.PAID,
      });

      await expect(
        service.updateWithdrawalStatus(
          withdrawalId,
          WithdrawalStatus.REJECTED,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(walletsRepository.save).not.toHaveBeenCalled();
      expect(withdrawalsRepository.save).not.toHaveBeenCalled();
    });
  });
});
