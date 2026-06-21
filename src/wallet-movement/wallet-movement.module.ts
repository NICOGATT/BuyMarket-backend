import { Module } from '@nestjs/common';
import { WalletMovementService } from './wallet-movement.service';
import { WalletMovementController } from './wallet-movement.controller';

@Module({
  controllers: [WalletMovementController],
  providers: [WalletMovementService],
})
export class WalletMovementModule {}
