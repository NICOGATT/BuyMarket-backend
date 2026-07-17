import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Wallet } from '../wallet/entity/wallet.entity';
import {
  WithdrawalRequest,
  WithdrawalStatus,
} from '../with-drawal-request/entities/with-drawal-request.entity';

import { CreateWithdrawalRequestDto } from './dto/create-with-drawal-request.dto';
import { UpdateWithdrawalStatusDto } from './dto/update-with-drawal-request.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
@Injectable()
export class WithDrawalRequestService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletsRepository: Repository<Wallet>,
    @InjectRepository(WithdrawalRequest)
    private readonly withdrawalsRepository: Repository<WithdrawalRequest>,
    private readonly notificationsService: NotificationsService,
  ) {}
  async create(userId: string, dto: CreateWithdrawalRequestDto) {
    const wallet = await this.walletsRepository.findOne({
      where: {
        user: { id: userId },
      },
    });

    if (!wallet) {
      throw new NotFoundException('Billetera no encontrada');
    }

    if (!dto.alias && !dto.cbu) {
      throw new BadRequestException('Tenes que ingresar alias o cbu');
    }

    if (Number(wallet.balance) < dto.amount) {
      throw new BadRequestException('Saldo insuficiente');
    }

    wallet.balance = Number(wallet.balance) - Number(dto.amount);
    wallet.pendingBalance = Number(wallet.pendingBalance) + Number(dto.amount);

    await this.walletsRepository.save(wallet);

    const withdrawal = this.withdrawalsRepository.create({
      wallet,
      amount: dto.amount,
      alias: dto.alias,
      cbu: dto.cbu,
      status: WithdrawalStatus.PENDING,
    });

    return this.withdrawalsRepository.save(withdrawal);
  }

  async findMyRequest(userId: string) {
    const wallet = await this.walletsRepository.findOne({
      where: {
        user: { id: userId },
      },
    });

    if (!wallet) {
      throw new NotFoundException('Billetera no encotrada');
    }

    return this.withdrawalsRepository.find({
      where: {
        wallet: { id: wallet.id },
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }
  async findAll() {
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

  async findOne(id: string) {
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

    return withdrawal;
  }

  async updateStatus(id: string, dto: UpdateWithdrawalStatusDto) {
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

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      if (withdrawal.status === dto.status) {
        await this.notifyWithdrawalStatus(withdrawal);
        return withdrawal;
      }
      throw new BadRequestException('Esta solicitud ya fue procesada');
    }

    if (dto.status === WithdrawalStatus.REJECTED) {
      withdrawal.wallet.pendingBalance =
        Number(withdrawal.wallet.pendingBalance) - Number(withdrawal.amount);

      withdrawal.wallet.balance =
        Number(withdrawal.wallet.balance) + Number(withdrawal.amount);

      await this.walletsRepository.save(withdrawal.wallet);
    }

    if (dto.status === WithdrawalStatus.PAID) {
      withdrawal.wallet.pendingBalance =
        Number(withdrawal.wallet.pendingBalance) - Number(withdrawal.amount);

      await this.walletsRepository.save(withdrawal.wallet);
    }

    withdrawal.status = dto.status;
    withdrawal.adminNote = dto.adminNote;

    const savedWithdrawal = await this.withdrawalsRepository.save(withdrawal);
    await this.notifyWithdrawalStatus(savedWithdrawal);
    return savedWithdrawal;
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
}
