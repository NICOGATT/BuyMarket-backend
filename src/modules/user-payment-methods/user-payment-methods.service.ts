import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../users/entity/user.entity';
import { CreateUserPaymentMethodDto } from './dto/create-user-payment-method.dto';
import { UpdateUserPaymentMethodDto } from './dto/update-user-payment-method.dto';
import { UserPaymentMethod } from './entities/user-payment-method.entity';

@Injectable()
export class UserPaymentMethodsService {
  constructor(
    @InjectRepository(UserPaymentMethod)
    private readonly paymentMethodsRepository: Repository<UserPaymentMethod>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(userId: string, dto: CreateUserPaymentMethodDto) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (dto.isDefault) {
      await this.clearDefault(userId);
    }

    const paymentMethod = this.paymentMethodsRepository.create({
      ...dto,
      isDefault: dto.isDefault ?? false,
      isActive: dto.isActive ?? true,
      user,
    });

    return this.paymentMethodsRepository.save(paymentMethod);
  }

  async findMyPaymentMethods(userId: string) {
    return this.paymentMethodsRepository.find({
      where: {
        user: { id: userId },
      },
      order: {
        isDefault: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  async findOneForUser(id: string, userId: string) {
    const paymentMethod = await this.paymentMethodsRepository.findOne({
      where: { id },
      relations: {
        user: true,
      },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Medio de pago no encontrado');
    }

    if (paymentMethod.user.id !== userId) {
      throw new ForbiddenException(
        'No tenes permiso para acceder a este medio de pago',
      );
    }

    return paymentMethod;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateUserPaymentMethodDto,
  ) {
    const paymentMethod = await this.findOneForUser(id, userId);

    if (dto.isDefault) {
      await this.clearDefault(userId);
    }

    Object.assign(paymentMethod, dto);

    return this.paymentMethodsRepository.save(paymentMethod);
  }

  async setDefault(id: string, userId: string) {
    const paymentMethod = await this.findOneForUser(id, userId);

    await this.clearDefault(userId);

    paymentMethod.isDefault = true;

    return this.paymentMethodsRepository.save(paymentMethod);
  }

  async remove(id: string, userId: string) {
    const paymentMethod = await this.findOneForUser(id, userId);

    await this.paymentMethodsRepository.remove(paymentMethod);

    return {
      message: 'Medio de pago eliminado correctamente',
    };
  }

  private clearDefault(userId: string) {
    return this.paymentMethodsRepository.update(
      { user: { id: userId } },
      { isDefault: false },
    );
  }
}
