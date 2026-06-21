import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entity/user.entity';
import { NotifyTransferPaymentDto } from './dto/notify-transfer-payment.dto';
import { UpdateTransferPaymentStatusDto } from './dto/update-transfer-payment-status.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('mercadopago/create-preference/:orderId')
  createMercadoPagoPreference(
    @Param('orderId') orderId: string,
    @Req() req: any,
  ) {
    return this.paymentsService.createMercadoPagoPreference(
      orderId,
      req.user.id,
    );
  }

  @Post('mercadopago/webhook')
  handleMercadoPagoWebhook(
    @Body() body: any,
    @Query() query: any,
  ) {
    return this.paymentsService.handleMercadoPagoWebhook(body, query);
  }

  @UseGuards(JwtAuthGuard)
  @Post('transfer/:orderId/notify')
  notifyTransferPayment(
    @Param('orderId') orderId: string,
    @Req() req: any,
    @Body() dto: NotifyTransferPaymentDto,
  ) {
    return this.paymentsService.notifyTransferPayment(
      orderId,
      req.user.id,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('admin/transfer/:orderId/status')
  updateTransferPaymentStatus(
    @Param('orderId') orderId: string,
    @Body() dto: UpdateTransferPaymentStatusDto,
  ) {
    return this.paymentsService.updateTransferPaymentStatus(orderId, dto);
  }
}
