import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WalletTransaction } from './entity/wallet-transaction.entity';
import { Wallet } from '../wallet/entity/wallet.entity';

import { WalletTransactionController } from './wallet-transaction.controller';;
import { WalletTransactionService } from './wallet-transaction.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WalletTransaction,
      Wallet,
    ]),
  ],
  controllers: [WalletTransactionController],
  providers: [WalletTransactionService],
  exports: [WalletTransactionService],
})
export class WalletTransactionsModule {}