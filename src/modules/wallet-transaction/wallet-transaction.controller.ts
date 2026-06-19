import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';

import { WalletTransactionService } from './wallet-transaction.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entity/user.entity';
@Controller('wallet-transaction')
export class WalletTransactionController {
  constructor(private readonly service: WalletTransactionService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMyTransactions(@Req() req: any) {
    return this.service.findMyTransaction(req.user.id);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findAllAdmin() {
    return this.service.findAllAdmin();
  }

  @Get('wallet/:walletId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findByWallet(@Param('walletId') walletId: string) {
    return this.service.findByWallet(walletId);
  }
}
