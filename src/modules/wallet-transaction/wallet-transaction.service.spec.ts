import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';

import { UserRole } from '../users/entity/user.entity';
import { Wallet } from '../wallet/entity/wallet.entity';
import {
  WalletTransaction,
  WalletTransactionStatus,
  WalletTransactionType,
} from './entity/wallet-transaction.entity';
import { WalletTransactionService } from './wallet-transaction.service';

type MockRepository<T extends ObjectLiteral = Record<string, any>> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockRepository = <T extends ObjectLiteral = Record<string, any>>(): MockRepository<T> => ({
  find: jest.fn(),
  findOne: jest.fn(),
});

describe('WalletTransactionService', () => {
  let service: WalletTransactionService;
  let transactionRepository: MockRepository<WalletTransaction>;
  let walletRepository: MockRepository<Wallet>;

  const userId = 'bdb0526e-0ee2-473d-8daa-a6e63c811f8f';
  const walletId = '73005f56-0681-4a72-b607-474165d73396';
  const orderId = '559b0806-5ec7-4669-b512-370136e57b8b';
  const transactionId = 'd73e715b-4dfd-4072-a93e-ff6c5841e307';

  const user = {
    id: userId,
    firstName: 'Nico',
    lastName: 'Gatti',
    email: 'nico@test.com',
    role: UserRole.SELLER,
  };

  const wallet = {
    id: walletId,
    user,
    balance: 1000,
    pendingBalance: 100,
    totalEarned: 2000,
  } as Wallet;

  const transaction = {
    id: transactionId,
    wallet,
    order: {
      id: orderId,
    },
    type: WalletTransactionType.CREDIT,
    amount: 1000,
    commissionAmount: 100,
    netAmount: 900,
    status: WalletTransactionStatus.COMPLETED,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  } as WalletTransaction;

  beforeEach(async () => {
    transactionRepository = createMockRepository<WalletTransaction>();
    walletRepository = createMockRepository<Wallet>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletTransactionService,
        {
          provide: getRepositoryToken(WalletTransaction),
          useValue: transactionRepository,
        },
        {
          provide: getRepositoryToken(Wallet),
          useValue: walletRepository,
        },
      ],
    }).compile();

    service = module.get<WalletTransactionService>(WalletTransactionService);
    jest.clearAllMocks();
  });

  it('deberia estar definido con todos sus repositorios mockeados', () => {
    expect(service).toBeDefined();
    expect(transactionRepository).toBeDefined();
    expect(walletRepository).toBeDefined();
  });

  describe('findMyTransaction', () => {
    it('devuelve las transacciones de la billetera del usuario ordenadas por fecha', async () => {
      walletRepository.findOne?.mockResolvedValue(wallet);
      transactionRepository.find?.mockResolvedValue([transaction]);

      const result = await service.findMyTransaction(userId);

      expect(walletRepository.findOne).toHaveBeenCalledWith({
        where: {
          user: { id: userId },
        },
      });
      expect(transactionRepository.find).toHaveBeenCalledWith({
        where: {
          wallet: { id: wallet.id },
        },
        relations: {
          wallet: true,
          order: true,
        },
        order: {
          createdAt: 'DESC',
        },
      });
      expect(result).toEqual([transaction]);
    });

    it('lanza NotFoundException si el usuario no tiene billetera', async () => {
      walletRepository.findOne?.mockResolvedValue(null);

      await expect(service.findMyTransaction(userId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(transactionRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('findByWallet', () => {
    it('devuelve las transacciones de una billetera con wallet.user y order', async () => {
      transactionRepository.find?.mockResolvedValue([transaction]);

      const result = await service.findByWallet(walletId);

      expect(transactionRepository.find).toHaveBeenCalledWith({
        where: {
          wallet: { id: walletId },
        },
        relations: {
          wallet: {
            user: true,
          },
          order: true,
        },
      });
      expect(result).toEqual([transaction]);
    });
  });

  describe('findAllAdmin', () => {
    it('devuelve todas las transacciones para admin con relaciones y orden descendente', async () => {
      transactionRepository.find?.mockResolvedValue([transaction]);

      const result = await service.findAllAdmin();

      expect(transactionRepository.find).toHaveBeenCalledWith({
        relations: {
          wallet: {
            user: true,
          },
          order: true,
        },
        order: {
          createdAt: 'DESC',
        },
      });
      expect(result).toEqual([transaction]);
    });
  });
});
