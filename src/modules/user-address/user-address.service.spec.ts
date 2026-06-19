import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';

import { UserRole, User } from '../users/entity/user.entity';
import { CreateUserAddressDto } from './dto/create-user-address.dto';
import { UpdateUserAddressDto } from './dto/update-user-address.dto';
import { UserAddress } from './entities/user-address.entity';
import { UserAddressesService } from './user-address.service';

type MockRepository<T extends ObjectLiteral = ObjectLiteral> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockRepository = <T extends ObjectLiteral = ObjectLiteral>(): MockRepository<T> => ({
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

describe('UserAddressesService', () => {
  let service: UserAddressesService;
  let addressesRepository: MockRepository<UserAddress>;
  let usersRepository: MockRepository<User>;

  const userId = 'bdb0526e-0ee2-473d-8daa-a6e63c811f8f';
  const otherUserId = 'af3fc255-a5eb-4171-a6a3-f695ad232c46';
  const addressId = '8aa767a5-39fe-42ca-bd5d-2d1395268db7';

  const user = {
    id: userId,
    firstName: 'Nico',
    lastName: 'Gatti',
    email: 'nico@test.com',
    role: UserRole.USER,
  } as User;

  const otherUser = {
    id: otherUserId,
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@test.com',
    role: UserRole.USER,
  } as User;

  const createAddressDto: CreateUserAddressDto = {
    label: 'Casa',
    street: 'Av. Siempre Viva',
    number: '742',
    floor: '2',
    apartment: 'B',
    city: 'Buenos Aires',
    province: 'Buenos Aires',
    postalCode: '1000',
    reference: 'Timbre azul',
    isDefault: true,
  };

  const createAddress = (
    overrides: Partial<UserAddress> = {},
  ): UserAddress =>
    ({
      id: addressId,
      ...createAddressDto,
      isDefault: true,
      user,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    }) as UserAddress;

  const address = createAddress();

  beforeEach(async () => {
    addressesRepository = createMockRepository<UserAddress>();
    usersRepository = createMockRepository<User>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserAddressesService,
        {
          provide: getRepositoryToken(UserAddress),
          useValue: addressesRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: usersRepository,
        },
      ],
    }).compile();

    service = module.get<UserAddressesService>(UserAddressesService);
    jest.clearAllMocks();
  });

  it('deberia estar definido con todos sus repositorios mockeados', () => {
    expect(service).toBeDefined();
    expect(addressesRepository).toBeDefined();
    expect(usersRepository).toBeDefined();
  });

  describe('create', () => {
    it('crea una direccion default y desmarca defaults previas del usuario', async () => {
      usersRepository.findOne?.mockResolvedValue(user);
      addressesRepository.update?.mockResolvedValue({ affected: 1 });
      addressesRepository.create?.mockReturnValue(address);
      addressesRepository.save?.mockResolvedValue(address);

      const result = await service.create(userId, createAddressDto);

      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(addressesRepository.update).toHaveBeenCalledWith(
        { user: { id: userId } },
        { isDefault: false },
      );
      expect(addressesRepository.create).toHaveBeenCalledWith({
        ...createAddressDto,
        isDefault: true,
        user,
      });
      expect(addressesRepository.save).toHaveBeenCalledWith(address);
      expect(result).toEqual(address);
    });

    it('crea una direccion no default sin desmarcar otras direcciones', async () => {
      const dto: CreateUserAddressDto = {
        ...createAddressDto,
        isDefault: undefined,
      };
      const nonDefaultAddress = createAddress({
        isDefault: false,
      });

      usersRepository.findOne?.mockResolvedValue(user);
      addressesRepository.create?.mockReturnValue(nonDefaultAddress);
      addressesRepository.save?.mockResolvedValue(nonDefaultAddress);

      const result = await service.create(userId, dto);

      expect(addressesRepository.update).not.toHaveBeenCalled();
      expect(addressesRepository.create).toHaveBeenCalledWith({
        ...dto,
        isDefault: false,
        user,
      });
      expect(result).toEqual(nonDefaultAddress);
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      usersRepository.findOne?.mockResolvedValue(null);

      await expect(service.create(userId, createAddressDto)).rejects
        .toBeInstanceOf(NotFoundException);
      expect(addressesRepository.create).not.toHaveBeenCalled();
      expect(addressesRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findMyAddresses', () => {
    it('devuelve las direcciones del usuario ordenadas por default y fecha', async () => {
      addressesRepository.find?.mockResolvedValue([address]);

      const result = await service.findMyAddresses(userId);

      expect(addressesRepository.find).toHaveBeenCalledWith({
        where: {
          user: { id: userId },
        },
        order: {
          isDefault: 'DESC',
          createdAt: 'DESC',
        },
      });
      expect(result).toEqual([address]);
    });
  });

  describe('findOneForUser', () => {
    it('devuelve una direccion si existe y pertenece al usuario', async () => {
      addressesRepository.findOne?.mockResolvedValue(address);

      const result = await service.findOneForUser(addressId, userId);

      expect(addressesRepository.findOne).toHaveBeenCalledWith({
        where: { id: addressId },
        relations: {
          user: true,
        },
      });
      expect(result).toEqual(address);
    });

    it('lanza NotFoundException si la direccion no existe', async () => {
      addressesRepository.findOne?.mockResolvedValue(null);

      await expect(service.findOneForUser(addressId, userId)).rejects
        .toBeInstanceOf(NotFoundException);
    });

    it('lanza ForbiddenException si la direccion pertenece a otro usuario', async () => {
      addressesRepository.findOne?.mockResolvedValue(
        createAddress({
          user: otherUser,
        }),
      );

      await expect(service.findOneForUser(addressId, userId)).rejects
        .toBeInstanceOf(ForbiddenException);
    });
  });

  describe('update', () => {
    it('actualiza una direccion del usuario y guarda los cambios', async () => {
      const updateDto: UpdateUserAddressDto = {
        label: 'Trabajo',
        street: 'Av. Corrientes',
        isDefault: false,
      };
      const addressToUpdate = createAddress({
        isDefault: false,
      });
      const updatedAddress = {
        ...addressToUpdate,
        ...updateDto,
      } as UserAddress;

      addressesRepository.findOne?.mockResolvedValue(addressToUpdate);
      addressesRepository.save?.mockResolvedValue(updatedAddress);

      const result = await service.update(addressId, userId, updateDto);

      expect(addressesRepository.update).not.toHaveBeenCalled();
      expect(addressesRepository.save).toHaveBeenCalledWith(updatedAddress);
      expect(result).toEqual(updatedAddress);
    });

    it('si se actualiza como default, desmarca defaults previas del usuario', async () => {
      const updateDto: UpdateUserAddressDto = {
        isDefault: true,
      };
      const addressToUpdate = createAddress({
        isDefault: false,
      });
      const updatedAddress = {
        ...addressToUpdate,
        isDefault: true,
      } as UserAddress;

      addressesRepository.findOne?.mockResolvedValue(addressToUpdate);
      addressesRepository.update?.mockResolvedValue({ affected: 1 });
      addressesRepository.save?.mockResolvedValue(updatedAddress);

      const result = await service.update(addressId, userId, updateDto);

      expect(addressesRepository.update).toHaveBeenCalledWith(
        { user: { id: userId } },
        { isDefault: false },
      );
      expect(addressesRepository.save).toHaveBeenCalledWith(updatedAddress);
      expect(result).toEqual(updatedAddress);
    });
  });

  describe('setDefault', () => {
    it('marca una direccion como default y desmarca las demas', async () => {
      const addressToSetDefault = createAddress({
        isDefault: false,
      });
      const defaultAddress = {
        ...addressToSetDefault,
        isDefault: true,
      } as UserAddress;

      addressesRepository.findOne?.mockResolvedValue(addressToSetDefault);
      addressesRepository.update?.mockResolvedValue({ affected: 1 });
      addressesRepository.save?.mockResolvedValue(defaultAddress);

      const result = await service.setDefault(addressId, userId);

      expect(addressesRepository.update).toHaveBeenCalledWith(
        { user: { id: userId } },
        { isDefault: false },
      );
      expect(addressesRepository.save).toHaveBeenCalledWith(defaultAddress);
      expect(result).toEqual(defaultAddress);
    });
  });

  describe('remove', () => {
    it('elimina una direccion del usuario y devuelve mensaje de exito', async () => {
      addressesRepository.findOne?.mockResolvedValue(address);
      addressesRepository.remove?.mockResolvedValue(address);

      const result = await service.remove(addressId, userId);

      expect(addressesRepository.remove).toHaveBeenCalledWith(address);
      expect(result).toEqual({
        message: 'Dirección eliminada correctamente',
      });
    });
  });
});
