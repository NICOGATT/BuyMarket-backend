import {
  Body,
  Controller,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
}