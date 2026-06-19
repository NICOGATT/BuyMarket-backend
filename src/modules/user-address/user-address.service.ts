import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserAddress } from './entities/user-address.entity';
import { User } from '../users/entity/user.entity';

import { CreateUserAddressDto } from './dto/create-user-address.dto';
import { UpdateUserAddressDto } from './dto/update-user-address.dto';

@Injectable()
export class UserAddressesService {
  constructor(
    @InjectRepository(UserAddress)
    private readonly addressesRepository: Repository<UserAddress>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(userId: string, dto: CreateUserAddressDto) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (dto.isDefault) {
      await this.addressesRepository.update(
        { user: { id: userId } },
        { isDefault: false },
      );
    }

    const address = this.addressesRepository.create({
      ...dto,
      isDefault: dto.isDefault ?? false,
      user,
    });

    return this.addressesRepository.save(address);
  }

  async findMyAddresses(userId: string) {
    return this.addressesRepository.find({
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
    const address = await this.addressesRepository.findOne({
      where: { id },
      relations: {
        user: true,
      },
    });

    if (!address) {
      throw new NotFoundException('Dirección no encontrada');
    }

    if (address.user.id !== userId) {
      throw new ForbiddenException(
        'No tenés permiso para acceder a esta dirección',
      );
    }

    return address;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateUserAddressDto,
  ) {
    const address = await this.findOneForUser(id, userId);

    if (dto.isDefault) {
      await this.addressesRepository.update(
        { user: { id: userId } },
        { isDefault: false },
      );
    }

    Object.assign(address, dto);

    return this.addressesRepository.save(address);
  }

  async setDefault(id: string, userId: string) {
    const address = await this.findOneForUser(id, userId);

    await this.addressesRepository.update(
      { user: { id: userId } },
      { isDefault: false },
    );

    address.isDefault = true;

    return this.addressesRepository.save(address);
  }

  async remove(id: string, userId: string) {
    const address = await this.findOneForUser(id, userId);

    await this.addressesRepository.remove(address);

    return {
      message: 'Dirección eliminada correctamente',
    };
  }
}