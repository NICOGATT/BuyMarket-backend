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

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Payment, PaymentAttempt]),
    WalletsModule,
    CloudinaryModule,
    NotificationsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, GetnetClient, GetnetQrClient, GetnetQrService],
})
export class PaymentsModule {}
