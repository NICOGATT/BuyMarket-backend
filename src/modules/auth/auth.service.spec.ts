import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entity/user.entity';
import { UserRole } from '../users/entity/user.entity';
import { RegisterDto } from './dto/register.dto';
import { Plan } from '../plan/entities/plan.entity';
import { Wallet } from '../wallet/entity/wallet.entity';
import { MailService } from '../mail/mail.service';
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
    createQueryBuilder: jest.fn(),
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
        {
          provide: MailService,
          useValue: {
            sendVerificationCode: jest.fn(),
            sendPasswordResetEmail: jest.fn(),
          },
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
  describe('plan Free automatico', () => {
    const dto: RegisterDto = {
      firstName: 'Nico',
      lastName: 'Gatti',
      email: 'nico@test.com',
      password: '123456',
    };
    const originalNodeEnv = process.env.NODE_ENV;
    const originalCommission = process.env.FREE_PLAN_COMMISSION;
    const insertBuilder = () => {
      const builder: Record<string, jest.Mock> = {};
      ['insert', 'into', 'values', 'orIgnore'].forEach((method) => {
        builder[method] = jest.fn().mockReturnValue(builder);
      });
      builder.execute = jest.fn().mockResolvedValue(undefined);
      return builder;
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockPlansRepository.findOne.mockReset();
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockUsersRepository.create.mockImplementation((value) => value);
      mockUsersRepository.save.mockImplementation((value) => ({
        id: 'user-1',
        role: UserRole.USER,
        ...value,
      }));
      mockWalletsRepository.create.mockImplementation((value) => value);
      mockWalletsRepository.save.mockResolvedValue({});
      mockJwtService.signAsync.mockResolvedValue('fake-token');
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalCommission === undefined) {
        delete process.env.FREE_PLAN_COMMISSION;
      } else {
        process.env.FREE_PLAN_COMMISSION = originalCommission;
      }
    });

    it('crea el plan Free si falta fuera de produccion y registra al usuario', async () => {
      process.env.NODE_ENV = 'staging';
      process.env.FREE_PLAN_COMMISSION = '12.5';
      const builder = insertBuilder();
      mockPlansRepository.createQueryBuilder.mockReturnValue(builder);
      const freePlan = { id: 'plan-1', name: 'Free', isActive: true };
      mockPlansRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(freePlan);

      const result = await authService.register(dto);

      expect(builder.values).toHaveBeenCalledWith({
        name: 'Free',
        commissionPercentage: 12.5,
        isActive: true,
      });
      expect(builder.orIgnore).toHaveBeenCalled();
      expect(mockUsersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ plan: freePlan }),
      );
      expect(result.message).toBe('Usuario creado');
    });

    it('usa comision 0 si FREE_PLAN_COMMISSION es invalida', async () => {
      process.env.NODE_ENV = 'staging';
      process.env.FREE_PLAN_COMMISSION = 'abc';
      const builder = insertBuilder();
      mockPlansRepository.createQueryBuilder.mockReturnValue(builder);
      mockPlansRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'plan-1', name: 'Free' });

      await authService.register(dto);

      expect(builder.values).toHaveBeenCalledWith(
        expect.objectContaining({ commissionPercentage: 0 }),
      );
    });

    it('no crea el plan en produccion y mantiene el error', async () => {
      process.env.NODE_ENV = 'production';
      mockPlansRepository.findOne.mockResolvedValueOnce(null);

      await expect(authService.register(dto)).rejects.toThrow(
        'No existe un plan Free configurado',
      );
      expect(mockPlansRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('no toca la base de planes si el Free ya existe', async () => {
      process.env.NODE_ENV = 'staging';
      mockPlansRepository.findOne.mockResolvedValueOnce({
        id: 'plan-1',
        name: 'Free',
      });

      await authService.register(dto);

      expect(mockPlansRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('mantiene el error si el Free existe pero esta inactivo', async () => {
      process.env.NODE_ENV = 'staging';
      mockPlansRepository.createQueryBuilder.mockReturnValue(insertBuilder());
      // El insert se ignora por el unique de name y el plan sigue inactivo.
      mockPlansRepository.findOne.mockResolvedValue(null);

      await expect(authService.register(dto)).rejects.toThrow(
        'No existe un plan Free configurado',
      );
    });
  });
});
