import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateUserPaymentMethodDto } from './dto/create-user-payment-method.dto';
import { UpdateUserPaymentMethodDto } from './dto/update-user-payment-method.dto';
import { UserPaymentMethodsService } from './user-payment-methods.service';

@Controller('user-payment-methods')
@UseGuards(JwtAuthGuard)
export class UserPaymentMethodsController {
  constructor(
    private readonly userPaymentMethodsService: UserPaymentMethodsService,
  ) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateUserPaymentMethodDto) {
    return this.userPaymentMethodsService.create(req.user.id, dto);
  }

  @Get('me')
  findMyPaymentMethods(@Req() req: any) {
    return this.userPaymentMethodsService.findMyPaymentMethods(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.userPaymentMethodsService.findOneForUser(id, req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdateUserPaymentMethodDto,
  ) {
    return this.userPaymentMethodsService.update(id, req.user.id, dto);
  }

  @Patch(':id/default')
  setDefault(@Param('id') id: string, @Req() req: any) {
    return this.userPaymentMethodsService.setDefault(id, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.userPaymentMethodsService.remove(id, req.user.id);
  }
}
