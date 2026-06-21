import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Order } from '../orders/entities/order.entity';
import { WalletsModule } from '../wallet/wallet.module';
import { Payment } from './entity/payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Payment]), WalletsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
