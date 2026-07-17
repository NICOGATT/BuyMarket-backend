import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Wallet } from '../wallet/entity/wallet.entity';
import { WithdrawalRequest } from './entities/with-drawal-request.entity';

import { WithdrawalRequestsController } from './with-drawal-request.controller';
import { WithDrawalRequestService } from './with-drawal-request.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, WithdrawalRequest]),
    NotificationsModule,
  ],
  controllers: [WithdrawalRequestsController],
  providers: [WithDrawalRequestService],
  exports: [WithDrawalRequestService],
})
export class WithdrawalRequestsModule {}
