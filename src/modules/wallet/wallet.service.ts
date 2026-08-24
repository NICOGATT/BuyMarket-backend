import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, LessThanOrEqual, Repository } from 'typeorm';

import { Wallet } from './entity/wallet.entity';
import {
  WalletTransaction,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../wallet-transaction/entity/wallet-transaction.entity';
import {
  WithdrawalRequest,
  WithdrawalStatus,
} from '../with-drawal-request/entities/with-drawal-request.entity';
import { User } from '../users/entity/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletsRepository: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private readonly transactionRepository: Repository<WalletTransaction>,
    @InjectRepository(WithdrawalRequest)
    private readonly withdrawalsRepository: Repository<WithdrawalRequest>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findByUserId(userId: string) {
    const wallet = await this.walletsRepository.findOne({
      where: {
        user: { id: userId },
      },
      relations: {
        user: true,
        transactions: true,
        withdrawals: true,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Billetera no encontrada');
    }

    return wallet;
  }

  async findMyBalance(userId: string) {
    const wallet = await this.findByUserId(userId);

    return {
      balance: Number(wallet.balance),
      pendingBalance: Number(wallet.pendingBalance),
      totalEarned: Number(wallet.totalEarned),
    };
  }

  async findMyEarnings(userId: string, fromValue: string, toValue: string) {
    const from = new Date(fromValue);
    const to = new Date(toValue);

    if (
      !fromValue ||
      !toValue ||
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      from >= to
    ) {
      throw new BadRequestException('El periodo de ganancias no es valido');
    }

    const wallet = await this.findByUserId(userId);
    const completedTransactions = await this.transactionRepository.find({
      where: {
        wallet: { id: wallet.id },
        status: WalletTransactionStatus.COMPLETED,
      },
      order: { createdAt: 'ASC' },
    });
    const transactions = completedTransactions.filter((transaction) => {
      const effectiveAt = transaction.effectiveAt ?? transaction.createdAt;
      return effectiveAt >= from && effectiveAt < to;
    });

    let income = 0;
    let adjustments = 0;

    for (const transaction of transactions) {
      if (transaction.type === WalletTransactionType.CREDIT) {
        income += Number(transaction.netAmount);
        continue;
      }

      if (
        transaction.type === WalletTransactionType.DEBIT ||
        transaction.type === WalletTransactionType.REFUND
      ) {
        adjustments -= Math.abs(
          Number(transaction.netAmount) || Number(transaction.amount),
        );
        continue;
      }

      // Commissions are already included in credit.netAmount.
    }

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      income: this.roundMoney(income),
      adjustments: this.roundMoney(adjustments),
      total: this.roundMoney(income + adjustments),
    };
  }

  async findAll() {
    return this.walletsRepository.find({
      relations: {
        user: true,
        transactions: true,
        withdrawals: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOne(id: string) {
    const wallet = await this.walletsRepository.findOne({
      where: { id },
      relations: {
        user: true,
        transactions: true,
        withdrawals: true,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Billetera no encontrada');
    }

    return wallet;
  }

  async creditFromOrder(
    params: {
      userId: string;
      orderId: string;
      amount: number;
      commisionPercentage: number;
    },
    manager?: EntityManager,
  ) {
    const walletsRepository = manager
      ? manager.getRepository(Wallet)
      : this.walletsRepository;
    const transactionRepository = manager
      ? manager.getRepository(WalletTransaction)
      : this.transactionRepository;
    const wallet = manager
      ? await walletsRepository
          .createQueryBuilder('wallet')
          .innerJoin('wallet.user', 'user')
          .where('user.id = :userId', { userId: params.userId })
          .setLock('pessimistic_write')
          .getOne()
      : await this.findByUserId(params.userId);

    if (!wallet) {
      throw new NotFoundException('Billetera no encontrada');
    }

    const existingTransaction = await transactionRepository.findOne({
      where: {
        wallet: { id: wallet.id },
        order: { id: params.orderId },
        type: WalletTransactionType.CREDIT,
      },
    });

    if (existingTransaction) {
      return { wallet, transaction: existingTransaction };
    }

    const commissionAmount = params.amount * (params.commisionPercentage / 100);

    const netAmount = params.amount - commissionAmount;

    wallet.balance = Number(wallet.balance) + Number(netAmount);

    wallet.totalEarned = Number(wallet.totalEarned) + Number(netAmount);

    await walletsRepository.save(wallet);

    const transaction = transactionRepository.create({
      wallet,
      order: {
        id: params.orderId,
      },
      type: WalletTransactionType.CREDIT,
      amount: params.amount,
      commissionAmount,
      netAmount,
      status: WalletTransactionStatus.COMPLETED,
      effectiveAt: new Date(),
    });

    await transactionRepository.save(transaction);

    return {
      wallet,
      transaction,
    };
  }

  async requestWithDrawal(params: {
    userId: string;
    amount: number;
    alias?: string;
    cbu?: string;
  }) {
    const wallet = await this.findByUserId(params.userId);

    if (!params.alias && !params.cbu) {
      throw new BadRequestException('Tenés que ingresar alias o cbu');
    }

    if (Number(wallet.balance) < params.amount) {
      throw new BadRequestException('Saldo insuficiente');
    }

    wallet.balance = Number(wallet.balance) - Number(params.amount);

    wallet.pendingBalance =
      Number(wallet.pendingBalance) + Number(params.amount);

    await this.walletsRepository.save(wallet);

    const withdrawal = this.withdrawalsRepository.create({
      wallet,
      amount: params.amount,
      alias: params.alias,
      cbu: params.cbu,
      status: WithdrawalStatus.PENDING,
    });

    return this.withdrawalsRepository.save(withdrawal);
  }

  async findMyWithdrawals(userId: string) {
    const wallet = await this.findByUserId(userId);

    return this.withdrawalsRepository.find({
      where: {
        wallet: { id: wallet.id },
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findAllWithdrawals() {
    return this.withdrawalsRepository.find({
      relations: {
        wallet: {
          user: true,
        },
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async updateWithdrawalStatus(
    id: string,
    status: WithdrawalStatus,
    adminNote?: string,
  ) {
    const withdrawal = await this.withdrawalsRepository.findOne({
      where: { id },
      relations: {
        wallet: {
          user: true,
        },
      },
    });

    if (!withdrawal) {
      throw new NotFoundException('Solicitud de retiro no encontrada');
    }

    if (withdrawal.status === status) {
      await this.notifyWithdrawalStatus(withdrawal);
      return withdrawal;
    }

    const canStillBeProcessed =
      withdrawal.status === WithdrawalStatus.PENDING ||
      withdrawal.status === WithdrawalStatus.APPROVED;

    if (!canStillBeProcessed) {
      throw new BadRequestException('Esta solicitud ya fue procesada');
    }

    if (
      status === WithdrawalStatus.REJECTED ||
      status === WithdrawalStatus.CANCELLED
    ) {
      withdrawal.wallet.pendingBalance =
        Number(withdrawal.wallet.pendingBalance) - Number(withdrawal.amount);
      withdrawal.wallet.balance =
        Number(withdrawal.wallet.balance) + Number(withdrawal.amount);
      await this.walletsRepository.save(withdrawal.wallet);
    }

    if (status === WithdrawalStatus.PAID) {
      withdrawal.wallet.pendingBalance =
        Number(withdrawal.wallet.pendingBalance) - Number(withdrawal.amount);

      await this.walletsRepository.save(withdrawal.wallet);
    }

    withdrawal.status = status;
    withdrawal.adminNote = adminNote;

    const savedWithdrawal = await this.withdrawalsRepository.save(withdrawal);
    await this.notifyWithdrawalStatus(savedWithdrawal);
    return savedWithdrawal;
  }

  async syncMissingWallets() {
    const users = await this.usersRepository.find({
      relations: {
        wallet: true,
      },
    });

    const usersWithoutWallet = users.filter((user) => !user.wallet);

    const wallets = usersWithoutWallet.map((user) =>
      this.walletsRepository.create({
        user,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
      }),
    );

    await this.walletsRepository.save(wallets);

    return {
      message: 'Wallets sincronizadas correctamente',
      created: wallets.length,
    };
  }

  async creditPendingFromOrder(params: {
    userId: string;
    orderId: string;
    amount: number;
    commissionPercetage: number;
    mercadoPagoPaymentId?: string;
    realeaseDate?: Date;
  }) {
    const wallet = await this.findByUserId(params.userId);

    const commissionAmount = params.amount * (params.commissionPercetage / 100);

    const netAmount = params.amount - commissionAmount;

    wallet.pendingBalance = Number(wallet.pendingBalance) + Number(netAmount);

    wallet.totalEarned = Number(wallet.totalEarned) + Number(netAmount);

    await this.walletsRepository.save(wallet);

    const transaction = this.transactionRepository.create({
      wallet,
      order: {
        id: params.orderId,
      },
      type: WalletTransactionType.CREDIT,
      amount: params.amount,
      commissionAmount,
      netAmount,
      status: WalletTransactionStatus.PENDING,
      mercadoPagoPaymentId: params.mercadoPagoPaymentId,
      releaseDate: params.realeaseDate,
    });

    return this.transactionRepository.save(transaction);
  }

  async releaseAvailableTransaction() {
    const now = new Date();

    const transactions = await this.transactionRepository.find({
      where: {
        status: WalletTransactionStatus.PENDING,
        releaseDate: LessThanOrEqual(now),
      },
      relations: {
        wallet: true,
      },
    });

    for (const transaction of transactions) {
      transaction.wallet.pendingBalance =
        Number(transaction.wallet.pendingBalance) -
        Number(transaction.netAmount);

      transaction.wallet.balance =
        Number(transaction.wallet.balance) + Number(transaction.netAmount);

      transaction.status = WalletTransactionStatus.COMPLETED;
      transaction.effectiveAt = now;

      await this.walletsRepository.save(transaction.wallet);
      await this.transactionRepository.save(transaction);
    }

    return {
      release: transactions.length,
    };
  }

  private async notifyWithdrawalStatus(withdrawal: WithdrawalRequest) {
    const userId = withdrawal.wallet?.user?.id;
    if (!userId) return;

    if (withdrawal.status === WithdrawalStatus.PAID) {
      await this.notificationsService.createOnce({
        userId,
        type: NotificationType.WITHDRAWAL_PAID,
        title: 'Retiro pagado',
        message: `Tu retiro de $${Number(withdrawal.amount).toFixed(2)} fue pagado.`,
        eventKey: `withdrawal:${withdrawal.id}:paid`,
        data: {
          withdrawalId: withdrawal.id,
          amount: Number(withdrawal.amount),
          route: '/wallet',
        },
      });
    }

    if (withdrawal.status === WithdrawalStatus.REJECTED) {
      await this.notificationsService.createOnce({
        userId,
        type: NotificationType.WITHDRAWAL_REJECTED,
        title: 'Retiro rechazado',
        message: `Tu retiro de $${Number(withdrawal.amount).toFixed(2)} fue rechazado.`,
        eventKey: `withdrawal:${withdrawal.id}:rejected`,
        data: {
          withdrawalId: withdrawal.id,
          amount: Number(withdrawal.amount),
          adminNote: withdrawal.adminNote ?? null,
          route: '/wallet',
        },
      });
    }
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
