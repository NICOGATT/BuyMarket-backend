import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Order } from '../orders/entities/order.entity';
import { WalletsModule } from '../wallet/wallet.module';
import { Payment } from './entity/payment.entity';
import { CloudinaryModule } from '../../cloudinary/cloudinary.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GetnetClient } from './getnet.client';
import { GetnetQrClient } from './getnet-qr.client';
import { GetnetQrService } from './getnet-qr.service';
import { PaymentAttempt } from './entity/payment-attempt.entity';
import { PaywayClient } from './payway.client';
import { PaywayService } from './payway.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Payment, PaymentAttempt]),
    WalletsModule,
    CloudinaryModule,
    NotificationsModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    GetnetClient,
    GetnetQrClient,
    GetnetQrService,
    PaywayClient,
    PaywayService,
  ],
})
export class PaymentsModule {}
