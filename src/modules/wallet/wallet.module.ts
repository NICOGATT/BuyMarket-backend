import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Wallet } from './entity/wallet.entity';
import { WalletTransaction } from '../wallet-transaction/entity/wallet-transaction.entity';
import { WithdrawalRequest } from '../with-drawal-request/entities/with-drawal-request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Wallet,
      WalletTransaction,
      WithdrawalRequest,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class WalletsModule {}