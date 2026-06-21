import { Controller } from '@nestjs/common';
import { WalletMovementService } from './wallet-movement.service';

@Controller('wallet-movement')
export class WalletMovementController {
  constructor(private readonly walletMovementService: WalletMovementService) {}
}
