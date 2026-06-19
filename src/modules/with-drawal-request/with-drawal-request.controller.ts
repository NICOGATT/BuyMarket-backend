import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { WithDrawalRequestService } from './with-drawal-request.service';
import { CreateWithdrawalRequestDto } from './dto/create-with-drawal-request.dto';
import { UpdateWithdrawalStatusDto } from './dto/update-with-drawal-request.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entity/user.entity';

@Controller('withdrawal-requests')
export class WithdrawalRequestsController {
  constructor(
    private readonly service: WithDrawalRequestService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Req() req: any,
    @Body() dto: CreateWithdrawalRequestDto,
  ) {
    return this.service.create(req.user.id, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMyRequests(@Req() req: any) {
    return this.service.findMyRequest(req.user.id);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.service.findAll();
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch('admin/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateWithdrawalStatusDto,
  ) {
    return this.service.updateStatus(id, dto);
  }
}