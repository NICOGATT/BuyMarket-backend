import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import * as bcrypt from 'bcrypt';

import { JwtService } from '@nestjs/jwt';

import { User } from '../users/entity/user.entity';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Plan } from '../plan/entities/plan.entity';
import { Wallet } from '../wallet/entity/wallet.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(Plan)
    private readonly plansRepository: Repository<Plan>,

    @InjectRepository(Wallet)
    private readonly walletsRepository: Repository<Wallet>,

    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(
      registerDto.password,
      10,
    );

    const freePlan = await this.plansRepository.findOne({
      where: {
        name: 'Free',
        isActive: true,
      },
    });

    if (!freePlan) {
      throw new NotFoundException(
        'No existe un plan Free configurado',
      );
    }

    const user = this.usersRepository.create({
      ...registerDto,
      password: hashedPassword,
      plan: freePlan,
    });

    const savedUser = await this.usersRepository.save(user);

    const wallet = this.walletsRepository.create({
      user: savedUser,
      balance: 0,
      pendingBalance: 0,
      totalEarned: 0,
    });

    await this.walletsRepository.save(wallet);

    const payload = {
      id: savedUser.id,
      email: savedUser.email,
      role: savedUser.role,
    };

    return {
      message: 'Usuario creado',
      access_token: await this.jwtService.signAsync(payload),
      user: payload,
    };
  }
  async login(loginDto: LoginDto) {
    const user = await this.usersRepository.findOne({
      where: {
        email: loginDto.email,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name : user.firstName,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user : payload
    };
  }
}