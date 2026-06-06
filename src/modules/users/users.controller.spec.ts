import { Test, TestingModule } from '@nestjs/testing';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  const userId = 1;

  const createUserDto: CreateUserDto = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '1122334455',
    password: 'secret123',
    dni: '12345678',
    avatar: 'avatar.jpg',
  };

  const user: User = {
    id: userId,
    ...createUserDto,
    role: 'user',
  };

  beforeEach(async () => {
    const usersServiceMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a user successfully', async () => {
      jest.spyOn(service, 'create').mockResolvedValue(user);

      const result = await controller.create(createUserDto);

      expect(service.create).toHaveBeenCalledWith(createUserDto);
      expect(result).toEqual(user);
    });

    it('should propagate exceptions thrown by the service', async () => {
      const error = new Error('create failed');
      jest.spyOn(service, 'create').mockRejectedValue(error);

      await expect(controller.create(createUserDto)).rejects.toThrow(error);
      expect(service.create).toHaveBeenCalledWith(createUserDto);
    });
  });

  describe('findAll', () => {
    it('should return all users successfully', async () => {
      jest.spyOn(service, 'findAll').mockResolvedValue([user]);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith();
      expect(result).toEqual([user]);
    });

    it('should return an empty array when no users exist', async () => {
      jest.spyOn(service, 'findAll').mockResolvedValue([]);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith();
      expect(result).toEqual([]);
    });

    it('should propagate exceptions thrown by the service', async () => {
      const error = new Error('findAll failed');
      jest.spyOn(service, 'findAll').mockRejectedValue(error);

      await expect(controller.findAll()).rejects.toThrow(error);
      expect(service.findAll).toHaveBeenCalledWith();
    });
  });

  describe('getProfile', () => {
    it('should return the current authenticated user', () => {
      const currentUser = {
        sub: user.id,
        email: user.email,
        role: user.role,
      };

      const result = controller.getProfile(currentUser);

      expect(result).toEqual(currentUser);
    });
  });

  describe('findOne', () => {
    it('should return one user successfully', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(user);

      const result = await controller.findOne(String(userId));

      expect(service.findOne).toHaveBeenCalledWith(userId);
      expect(result).toEqual(user);
    });

    it('should return null when the user does not exist', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      const result = await controller.findOne(String(userId));

      expect(service.findOne).toHaveBeenCalledWith(userId);
      expect(result).toBeNull();
    });

    it('should propagate exceptions thrown by the service', async () => {
      const error = new Error('findOne failed');
      jest.spyOn(service, 'findOne').mockRejectedValue(error);

      await expect(controller.findOne(String(userId))).rejects.toThrow(error);
      expect(service.findOne).toHaveBeenCalledWith(userId);
    });
  });

  describe('update', () => {
    const updateUserDto: UpdateUserDto = {
      firstName: 'Janet',
      phone: '5566778899',
    };

    it('should update a user successfully', async () => {
      const updatedUser: User = {
        ...user,
        ...updateUserDto,
      };
      jest.spyOn(service, 'update').mockResolvedValue(updatedUser);

      const result = await controller.update(String(userId), updateUserDto);

      expect(service.update).toHaveBeenCalledWith(userId, updateUserDto);
      expect(result).toEqual(updatedUser);
    });

    it('should return null when the user to update does not exist', async () => {
      jest.spyOn(service, 'update').mockResolvedValue(null);

      const result = await controller.update(String(userId), updateUserDto);

      expect(service.update).toHaveBeenCalledWith(userId, updateUserDto);
      expect(result).toBeNull();
    });

    it('should propagate exceptions thrown by the service', async () => {
      const error = new Error('update failed');
      jest.spyOn(service, 'update').mockRejectedValue(error);

      await expect(
        controller.update(String(userId), updateUserDto),
      ).rejects.toThrow(error);
      expect(service.update).toHaveBeenCalledWith(userId, updateUserDto);
    });
  });

  describe('remove', () => {
    it('should remove a user successfully', async () => {
      jest.spyOn(service, 'remove').mockResolvedValue(user);

      const result = await controller.remove(String(userId));

      expect(service.remove).toHaveBeenCalledWith(userId);
      expect(result).toEqual(user);
    });

    it('should return null when the user to remove does not exist', async () => {
      jest.spyOn(service, 'remove').mockResolvedValue(null);

      const result = await controller.remove(String(userId));

      expect(service.remove).toHaveBeenCalledWith(userId);
      expect(result).toBeNull();
    });

    it('should propagate exceptions thrown by the service', async () => {
      const error = new Error('remove failed');
      jest.spyOn(service, 'remove').mockRejectedValue(error);

      await expect(controller.remove(String(userId))).rejects.toThrow(error);
      expect(service.remove).toHaveBeenCalledWith(userId);
    });
  });
});
