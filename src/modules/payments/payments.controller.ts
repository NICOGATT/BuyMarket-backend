import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  HttpStatus,
  Headers,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entity/user.entity';
import { NotifyTransferPaymentDto } from './dto/notify-transfer-payment.dto';
import { UpdateTransferPaymentStatusDto } from './dto/update-transfer-payment-status.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { GetnetQrService } from './getnet-qr.service';

const transferProofMaxSize = 5 * 1024 * 1024;
const transferProofMaxSizeMessage = 'El comprobante no puede superar los 5 MB.';

@Catch()
class TransferProofUploadExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const isFileSizeError =
      exception?.code === 'LIMIT_FILE_SIZE' ||
      exception?.message === 'File too large' ||
      exception?.response?.message === 'File too large';

    if (!isFileSizeError) {
      throw exception;
    }

    const response = host.switchToHttp().getResponse();

    response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      message: transferProofMaxSizeMessage,
      error: 'Payload Too Large',
    });
  }
}

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly getnetQrService: GetnetQrService,
  ) {}

  @Get('capabilities')
  getCapabilities() {
    return this.getnetQrService.getCapabilities();
  }

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
  handleMercadoPagoWebhook(@Body() body: any, @Query() query: any) {
    return this.paymentsService.handleMercadoPagoWebhook(body, query);
  }

  @UseGuards(JwtAuthGuard)
  @Post('getnet/create-order/:orderId')
  createGetnetOrder(@Param('orderId') orderId: string, @Req() req: any) {
    return this.paymentsService.createGetnetOrder(orderId, req.user.id);
  }

  @Post('getnet/webhook')
  handleGetnetWebhook(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: any,
  ) {
    return this.paymentsService.handleGetnetWebhook(authorization, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('getnet-qr/create/:orderId')
  createGetnetQrPayment(@Param('orderId') orderId: string, @Req() req: any) {
    return this.getnetQrService.createPayment(orderId, req.user.id);
  }

  @Post('getnet-qr/webhook')
  handleGetnetQrWebhook(@Body() body: unknown) {
    return this.getnetQrService.handleWebhook(body);
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
  @Patch('admin/manual/:orderId/status')
  updateManualPaymentStatus(
    @Param('orderId') orderId: string,
    @Body() dto: UpdateTransferPaymentStatusDto,
  ) {
    return this.paymentsService.updateManualPaymentStatus(orderId, dto);
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

  @Post(':paymentId/proof')
  @UseGuards(JwtAuthGuard)
  @UseFilters(TransferProofUploadExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: transferProofMaxSize,
      },
    }),
  )
  uploadProof(
    @Param('paymentId') paymentId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
  ) {
    return this.paymentsService.uploadedTranferProof(
      paymentId,
      file,
      req.user.id,
    );
  }
}
