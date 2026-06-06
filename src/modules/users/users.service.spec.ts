import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UsersService } from './users.service';
import { User } from './entity/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

type MockRepository<T = unknown> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: MockRepository<User>;

  const userId = 1;

  const createUserDto: CreateUserDto = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
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
    usersRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: usersRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(usersRepository).toBeDefined();
  });

  describe('create', () => {
    it('should create a user successfully', async () => {
      jest.spyOn(usersRepository, 'create').mockReturnValue(user);
      jest.spyOn(usersRepository, 'save').mockResolvedValue(user);

      const result = await service.create(createUserDto);

      expect(usersRepository.create).toHaveBeenCalledWith(createUserDto);
      expect(usersRepository.save).toHaveBeenCalledWith(user);
      expect(result).toEqual(user);
    });

    it('should propagate exceptions thrown by the repository create method', async () => {
      const error = new Error('create failed');
      jest.spyOn(usersRepository, 'create').mockImplementation(() => {
        throw error;
      });

      await expect(service.create(createUserDto)).rejects.toThrow(error);
      expect(usersRepository.create).toHaveBeenCalledWith(createUserDto);
      expect(usersRepository.save).not.toHaveBeenCalled();
    });

    it('should propagate exceptions thrown by the repository save method', async () => {
      const error = new Error('save failed');
      jest.spyOn(usersRepository, 'create').mockReturnValue(user);
      jest.spyOn(usersRepository, 'save').mockRejectedValue(error);

      await expect(service.create(createUserDto)).rejects.toThrow(error);
      expect(usersRepository.create).toHaveBeenCalledWith(createUserDto);
      expect(usersRepository.save).toHaveBeenCalledWith(user);
    });
  });

  describe('findAll', () => {
    it('should return all users successfully', async () => {
      jest.spyOn(usersRepository, 'find').mockResolvedValue([user]);

      const result = await service.findAll();

      expect(usersRepository.find).toHaveBeenCalledWith();
      expect(result).toEqual([user]);
    });

    it('should return an empty array when no users exist', async () => {
      jest.spyOn(usersRepository, 'find').mockResolvedValue([]);

      const result = await service.findAll();

      expect(usersRepository.find).toHaveBeenCalledWith();
      expect(result).toEqual([]);
    });

    it('should propagate exceptions thrown by the repository', async () => {
      const error = new Error('find failed');
      jest.spyOn(usersRepository, 'find').mockRejectedValue(error);

      await expect(service.findAll()).rejects.toThrow(error);
      expect(usersRepository.find).toHaveBeenCalledWith();
    });
  });

  describe('findOne', () => {
    it('should return one user successfully', async () => {
      jest.spyOn(usersRepository, 'findOneBy').mockResolvedValue(user);

      const result = await service.findOne(userId);

      expect(usersRepository.findOneBy).toHaveBeenCalledWith({ id: userId });
      expect(result).toEqual(user);
    });

    it('should return null when the user does not exist', async () => {
      jest.spyOn(usersRepository, 'findOneBy').mockResolvedValue(null);

      const result = await service.findOne(userId);

      expect(usersRepository.findOneBy).toHaveBeenCalledWith({ id: userId });
      expect(result).toBeNull();
    });

    it('should propagate exceptions thrown by the repository', async () => {
      const error = new Error('findOne failed');
      jest.spyOn(usersRepository, 'findOneBy').mockRejectedValue(error);

      await expect(service.findOne(userId)).rejects.toThrow(error);
      expect(usersRepository.findOneBy).toHaveBeenCalledWith({ id: userId });
    });
  });

  describe('update', () => {
    const updateUserDto: UpdateUserDto = {
      firstName: 'Janet',
      phone: '5566778899',
    };

    it('should update a user successfully and return the updated user', async () => {
      const updatedUser: User = {
        ...user,
        ...updateUserDto,
      };
      jest.spyOn(usersRepository, 'update').mockResolvedValue({
        affected: 1,
        generatedMaps: [],
        raw: {},
      });
      jest.spyOn(usersRepository, 'findOneBy').mockResolvedValue(updatedUser);

      const result = await service.update(userId, updateUserDto);

      expect(usersRepository.update).toHaveBeenCalledWith(userId, updateUserDto);
      expect(usersRepository.findOneBy).toHaveBeenCalledWith({ id: userId });
      expect(result).toEqual(updatedUser);
    });

    it('should return null when the user to update does not exist', async () => {
      jest.spyOn(usersRepository, 'update').mockResolvedValue({
        affected: 0,
        generatedMaps: [],
        raw: {},
      });
      jest.spyOn(usersRepository, 'findOneBy').mockResolvedValue(null);

      const result = await service.update(userId, updateUserDto);

      expect(usersRepository.update).toHaveBeenCalledWith(userId, updateUserDto);
      expect(usersRepository.findOneBy).toHaveBeenCalledWith({ id: userId });
      expect(result).toBeNull();
    });

    it('should propagate exceptions thrown by the repository update method', async () => {
      const error = new Error('update failed');
      jest.spyOn(usersRepository, 'update').mockRejectedValue(error);

      await expect(service.update(userId, updateUserDto)).rejects.toThrow(error);
      expect(usersRepository.update).toHaveBeenCalledWith(userId, updateUserDto);
      expect(usersRepository.findOneBy).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove a user successfully', async () => {
      jest.spyOn(usersRepository, 'findOneBy').mockResolvedValue(user);
      jest.spyOn(usersRepository, 'remove').mockResolvedValue(user);

      const result = await service.remove(userId);

      expect(usersRepository.findOneBy).toHaveBeenCalledWith({ id: userId });
      expect(usersRepository.remove).toHaveBeenCalledWith(user);
      expect(result).toEqual(user);
    });

    it('should return null when the user to remove does not exist', async () => {
      jest.spyOn(usersRepository, 'findOneBy').mockResolvedValue(null);

      const result = await service.remove(userId);

      expect(usersRepository.findOneBy).toHaveBeenCalledWith({ id: userId });
      expect(usersRepository.remove).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should propagate exceptions thrown while finding the user', async () => {
      const error = new Error('find before remove failed');
      jest.spyOn(usersRepository, 'findOneBy').mockRejectedValue(error);

      await expect(service.remove(userId)).rejects.toThrow(error);
      expect(usersRepository.findOneBy).toHaveBeenCalledWith({ id: userId });
      expect(usersRepository.remove).not.toHaveBeenCalled();
    });

    it('should propagate exceptions thrown by the repository remove method', async () => {
      const error = new Error('remove failed');
      jest.spyOn(usersRepository, 'findOneBy').mockResolvedValue(user);
      jest.spyOn(usersRepository, 'remove').mockRejectedValue(error);

      await expect(service.remove(userId)).rejects.toThrow(error);
      expect(usersRepository.findOneBy).toHaveBeenCalledWith({ id: userId });
      expect(usersRepository.remove).toHaveBeenCalledWith(user);
    });
  });
});
