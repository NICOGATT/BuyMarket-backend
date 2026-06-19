import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Order } from '../orders/entities/order.entity';
import { WalletsModule } from '../wallet/wallet.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order]), WalletsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
