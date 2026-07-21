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

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Payment]),
    WalletsModule,
    CloudinaryModule,
    NotificationsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, GetnetClient],
})
export class PaymentsModule {}
