import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entity/user.entity';
import { UserRole } from '../users/entity/user.entity';
import { RegisterDto } from './dto/register.dto';
import { Plan } from '../plan/entities/plan.entity';
import { Wallet } from '../wallet/entity/wallet.entity';
import bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));
describe('AuthService', () => {
  let authService: AuthService;

  const mockUsersRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne : jest.fn()
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    sign: jest.fn(),
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

    const createdWallet = {
      id : 1, 
      user:savedUser, 
      balance: 0, 
      pendingBalance : 0, 
      totalEarned : 0
    }

    mockPlansRepository.findOne.mockResolvedValue(freePlan);
    mockUsersRepository.create.mockReturnValue(savedUser);
    mockUsersRepository.save.mockResolvedValue(savedUser);
    mockWalletsRepository.create.mockReturnValue(createdWallet);
    mockWalletsRepository.save.mockResolvedValue(createdWallet);
    mockJwtService.signAsync.mockResolvedValue('fake-token');

    const result = await authService.register(dto as RegisterDto);

    expect(result.message).toBe('Usuario creado');
    expect(result.access_token).toBe('fake-token');
    expect(result.user.email).toBe('nico@test.com');
    expect(result.user.role).toBe(UserRole.USER);
    expect(mockWalletsRepository.create).toHaveBeenCalledWith({
      user: savedUser,
      balance: 0,
      pendingBalance: 0,
      totalEarned: 0,
    });

    expect(mockWalletsRepository.save).toHaveBeenCalledWith(createdWallet);
  });

  it('deberia loguear un usuario y devolver token', async() => {
    const dto = {
      email : 'nico@test.com',
      password : '123456'
    }

    const user = {
      id: 1,
      name: 'Nico',
      email: 'nico@test.com',
      password: 'hashed',
      role: UserRole.USER,
    };
    
    mockUsersRepository.findOne.mockResolvedValue(user); 
    (bcrypt.compare as jest.Mock).mockResolvedValue(true); 

    mockJwtService.sign.mockReturnValue('fake-token');
    const result = await authService.login(dto);

    expect(result.access_token).toBe('fake-token');
    expect(result.user.sub).toBe(1);
    expect(result.user.email).toBe('nico@test.com');
    expect(result.user.role).toBe(UserRole.USER);
  })
});