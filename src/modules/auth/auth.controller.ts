import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { VerifyEmailDto } from './dto/verify-emai.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register (
    @Body() registerDto : RegisterDto,
  ){
    return this.authService.register(registerDto);
  }

  @Post('login')
  login (
    @Body() loginDto : LoginDto,
  ) {
    return this.authService.login(loginDto);
  }

  @Post('send-verification-code')
  @UseGuards(JwtAuthGuard)
  sendVerificationCode(@Req() req) {
    return this.authService.sendVerificationCode(req.user.id)
  }

  @Post('verify-email')
  @UseGuards(JwtAuthGuard)
  verifyEmail(
    @Req() req,
    @Body() dto : VerifyEmailDto
  ) {
    return this.authService.verifyEmail(req.user.id, dto)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req) {
    return this.authService.getCurrentUser(req.user.id)
  }

  @Post('google')
  google(@Body() googleAuthDto: GoogleAuthDto) {
    return this.authService.googleAuth(googleAuthDto.idToken); 
  }
}
