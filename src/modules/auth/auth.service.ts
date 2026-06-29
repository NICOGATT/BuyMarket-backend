import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import * as bcrypt from 'bcrypt';

import { JwtService } from '@nestjs/jwt';

import { User, UserRole } from '../users/entity/user.entity';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Plan } from '../plan/entities/plan.entity';
import { Wallet } from '../wallet/entity/wallet.entity';
import { VerifyEmailDto } from './dto/verify-emai.dto';
import { MailService } from '../mail/mail.service';
import { OAuth2Client } from 'google-auth-library';
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

    private readonly mailService : MailService,
  ) {}

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private buildAuthPayload(user: User) {
    return {
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.firstName,
      role: user.role,
      emailVerified: user.isEmailVerified,
      isEmailVerified: user.isEmailVerified,
    };
  }

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
      provider : 'local',
      isEmailVerified : false
    });

    const savedUser = await this.usersRepository.save(user);

    const wallet = this.walletsRepository.create({
      user: savedUser,
      balance: 0,
      pendingBalance: 0,
      totalEarned: 0,
    });

    await this.walletsRepository.save(wallet);

    const payload = this.buildAuthPayload(savedUser);

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

    if(user.provider === 'google') {  
      throw new UnauthorizedException('Esta cuenta fue creada con google. Iniciá sesión con Google')
    }

    if(!user.password) {
      throw new UnauthorizedException('Esta cuenta inicia sesion con google'); 
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = this.buildAuthPayload(user);

    return {
      access_token: this.jwtService.sign(payload),
      user : payload
    };
  }

  async sendVerificationCode(userId : string) {
    const user = await this.usersRepository.findOne({
      where : {id : userId}
    })

    if(!user) {
      throw new NotFoundException('Usuario no encontrado')
    }

    if (user.isEmailVerified){
      throw new BadRequestException('El email ya esta verificado')
    }

    const code = this.generateVerificationCode(); 
    const hashedCode = await bcrypt.hash(code, 10);

    user.emailVerificationCode = hashedCode; 
    user.emailVerifcationExpires = new Date(Date.now() + 10 * 60 * 1000)

    await this.usersRepository.save(user); 

    await this.mailService.sendVerificationCode(user.email, code);
    return {
      message : 'Codigo de verificacion enviado al email '
    }
  }

  async verifyEmail(userId : string, dto: VerifyEmailDto){
    const user = await this.usersRepository.findOne({
      where : {id : userId},
    })

    if(!user) {
      throw new BadRequestException('Usuario no encontrado'); 
    }

    if (!user.emailVerifcationExpires) {
      throw new BadRequestException('No hay un código de verificación activo');
    }

    if (user.emailVerifcationExpires < new Date()) {
      throw new BadRequestException('El código expiró');
    }
    if (!user.emailVerificationCode) {
      throw new BadRequestException('No hay un código de verificación activo');
    }
    
    const valid = await bcrypt.compare(
      dto.code, 
      user.emailVerificationCode
    )

    if(!valid) {
      throw new BadRequestException('Codigo incorrecto')
    }

    user.isEmailVerified = true; 
    user.emailVerifcationExpires = undefined;
    user.emailVerificationCode = undefined; 

    await this.usersRepository.save(user); 

    const payload = this.buildAuthPayload(user);

    return {
      message : 'Email verificado correctamente',
      access_token: this.jwtService.sign(payload),
      emailVerified: true,
      isEmailVerified: true,
    }

  } 

  async getCurrentUser(userId: string) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return this.buildAuthPayload(user);
  }

  async googleAuth(idToken:string) {
    const googleClientId = process.env.GOOGLE_CLIENT_ID;

    if (!googleClientId) {
      throw new UnauthorizedException('Google no esta configurado');
    }

    const client = new OAuth2Client(googleClientId);
    let ticket;

    try {
      ticket = await client.verifyIdToken({
        idToken,
        audience: googleClientId,
      });
    } catch {
      throw new UnauthorizedException('Token de google invalido');
    }

    const payload = ticket.getPayload()
    if(!payload || !payload.email) {
      throw new UnauthorizedException('Token de google invalido')
    }

    const email = payload.email;
    const freePlan = await this.plansRepository.findOne({
      where: {
        name: 'Free',
        isActive: true,
      },
    });

    let user = await this.usersRepository.findOne({
      where : {email} 
    })

    if(!user) {
      if (!freePlan) {
        throw new NotFoundException(
          'No existe un plan Free configurado',
        );
      }

      user = this.usersRepository.create({
        firstName : payload.given_name || '', 
        lastName : payload.family_name || '', 
        email, 
        googleId : payload.sub, 
        provider : 'google', 
        isEmailVerified : true, 
        role : UserRole.USER,
        plan: freePlan,
      })

      user = await this.usersRepository.save(user);

      const wallet = this.walletsRepository.create({
        user,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
      });

      await this.walletsRepository.save(wallet);
    } else {
      user.googleId = user.googleId ?? payload.sub;
      user.isEmailVerified = true;
      user = await this.usersRepository.save(user);
    }

    const authPayload = this.buildAuthPayload(user);
    const token = await this.jwtService.signAsync(authPayload);

    return {
      message : 'Login con Google exitoso', 
      access_token: token,
      token, 
      user: authPayload, 
    }
  }
}
