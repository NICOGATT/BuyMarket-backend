import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Wallet } from '../wallet/entity/wallet.entity';
import { WithdrawalRequest } from './entities/with-drawal-request.entity';

import { WithdrawalRequestsController } from './with-drawal-request.controller';
import { WithDrawalRequestService } from './with-drawal-request.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Wallet,
      WithdrawalRequest,
    ]),
  ],
  controllers: [WithdrawalRequestsController],
  providers: [WithDrawalRequestService],
  exports: [WithDrawalRequestService],
})
export class WithdrawalRequestsModule {}