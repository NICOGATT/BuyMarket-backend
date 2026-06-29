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
import { ShipmentsService } from './shipments.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entity/user.entity';

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateShipmentDto) {
    return this.shipmentsService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.shipmentsService.findAll();
  }

  @Get('my-deliveries')
  @UseGuards(JwtAuthGuard)
  findMyDeliveries(@Req() req) {
    return this.shipmentsService.findMyDeliveries(req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.shipmentsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateShipmentDto) {
    return this.shipmentsService.update(id, dto);
  }

  @Patch(':id/assign-driver')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  assignDriver(
    @Param('id') id: string,
    @Body('driverId') driverId: string,
  ) {
    return this.shipmentsService.assignDriver(id, driverId);
  }

  @Patch(':id/picked-up')
  @UseGuards(JwtAuthGuard)
  markPickedUp(@Param('id') id: string, @Req() req) {
    return this.shipmentsService.markPickedUp(id, req.user.id);
  }

  @Patch(':id/in-transit')
  @UseGuards(JwtAuthGuard)
  markInTransit(@Param('id') id: string, @Req() req) {
    return this.shipmentsService.markInTransit(id, req.user.id);
  }

  @Patch(':id/delivered')
  @UseGuards(JwtAuthGuard)
  markDelivered(@Param('id') id: string, @Req() req) {
    return this.shipmentsService.markDelivered(id, req.user.id);
  }

  @Patch(':id/tracking')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updateTracking(
    @Param('id') id: string,
    @Body('trackingNumber') trackingNumber: string,
    @Body('trackingUrl') trackingUrl: string,
  ) {
    return this.shipmentsService.updateTracking(id, trackingNumber, trackingUrl);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  cancel(@Param('id') id: string) {
    return this.shipmentsService.cancel(id);
  }
}