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

import { UserAddressesService } from './user-address.service';
import { CreateUserAddressDto } from './dto/create-user-address.dto';
import { UpdateUserAddressDto } from './dto/update-user-address.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('user-addresses')
@UseGuards(JwtAuthGuard)
export class UserAddressesController {
  constructor(
    private readonly userAddressesService: UserAddressesService,
  ) {}

  @Post()
  create(
    @Req() req: any,
    @Body() dto: CreateUserAddressDto,
  ) {
    return this.userAddressesService.create(
      req.user.id,
      dto,
    );
  }

  @Get('me')
  findMyAddresses(@Req() req: any) {
    return this.userAddressesService.findMyAddresses(
      req.user.id,
    );
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.userAddressesService.findOneForUser(
      id,
      req.user.id,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdateUserAddressDto,
  ) {
    return this.userAddressesService.update(
      id,
      req.user.id,
      dto,
    );
  }

  @Patch(':id/default')
  setDefault(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.userAddressesService.setDefault(
      id,
      req.user.id,
    );
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.userAddressesService.remove(
      id,
      req.user.id,
    );
  }
}