import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entity/user.entity';
import { UserRole } from '../users/entity/user.entity';
import { RegisterDto } from './dto/register.dto';
import { Plan } from '../plan/entities/plan.entity';
import { Wallet } from '../wallet/entity/wallet.entity';
describe('AuthService', () => {
  let authService: AuthService;

  const mockUsersRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  const mockPlansRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockWalletsRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUsersRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: getRepositoryToken(Plan),
          useValue: mockPlansRepository,
        },
        {
          provide: getRepositoryToken(Wallet),
          useValue: mockWalletsRepository,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  it('debería registrar un usuario y devolver token', async () => {
    const dto : RegisterDto= {
      firstName: 'Nico',
      lastName : "Gatti",
      email: 'nico@test.com',
      password: '123456',
    };

    const savedUser = {
      id: 1,
      name: 'Nico',
      email: 'nico@test.com',
      password: 'hashed',
      role: UserRole.USER,
    };

    const freePlan = {
      id: 1,
      name: 'Free',
      commissionPercentage: 0,
      isActive: true,
    };

    mockPlansRepository.findOne.mockResolvedValue(freePlan);
    mockUsersRepository.create.mockReturnValue(savedUser);
    mockUsersRepository.save.mockResolvedValue(savedUser);
    mockWalletsRepository.create.mockReturnValue({});
    mockWalletsRepository.save.mockResolvedValue({});
    mockJwtService.signAsync.mockResolvedValue('fake-token');

    const result = await authService.register(dto as RegisterDto);

    expect(result.message).toBe('Usuario creado');
    expect(result.access_token).toBe('fake-token');
    expect(result.user.email).toBe('nico@test.com');
    expect(result.user.role).toBe(UserRole.USER);
  });
});