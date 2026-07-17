import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Wallet } from './entity/wallet.entity';
import { WalletTransaction } from '../wallet-transaction/entity/wallet-transaction.entity';
import { WithdrawalRequest } from '../with-drawal-request/entities/with-drawal-request.entity';

import { WalletsController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { User } from '../users/entity/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Wallet,
      WalletTransaction,
      WithdrawalRequest,
      User,
    ]),
    NotificationsModule,
  ],
  controllers: [WalletsController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletsModule {}
