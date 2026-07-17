import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { WalletService } from './wallet.service';
import { WithdrawalStatus } from '../with-drawal-request/entities/with-drawal-request.entity';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entity/user.entity';

@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMyWallet(@Req() req: any) {
    return this.walletsService.findByUserId(req.user.id);
  }

  @Get('me/balance')
  @UseGuards(JwtAuthGuard)
  findMyBalance(@Req() req: any) {
    return this.walletsService.findMyBalance(req.user.id);
  }

  @Get('me/earnings')
  @UseGuards(JwtAuthGuard)
  findMyEarnings(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.walletsService.findMyEarnings(req.user.id, from, to);
  }

  @Post('withdrawals')
  @UseGuards(JwtAuthGuard)
  requestWithdrawal(
    @Req() req: any,
    @Body()
    body: {
      amount: number;
      alias?: string;
      cbu?: string;
    },
  ) {
    return this.walletsService.requestWithDrawal({
      userId: req.user.id,
      amount: body.amount,
      alias: body.alias,
      cbu: body.cbu,
    });
  }

  @Get('withdrawals/me')
  @UseGuards(JwtAuthGuard)
  findMyWithdrawals(@Req() req: any) {
    return this.walletsService.findMyWithdrawals(req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.walletsService.findAll();
  }

  @Get('admin/withdrawals/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findAllWithdrawals() {
    return this.walletsService.findAllWithdrawals();
  }
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findOne(@Param('id') id: string) {
    return this.walletsService.findOne(id);
  }

  @Patch('admin/withdrawals/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updateWithdrawalStatus(
    @Param('id') id: string,
    @Body()
    body: {
      status: WithdrawalStatus;
      adminNote?: string;
    },
  ) {
    return this.walletsService.updateWithdrawalStatus(
      id,
      body.status,
      body.adminNote,
    );
  }

  @Post('admin/sync-missing-wallets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  syncMissingWallets() {
    return this.walletsService.syncMissingWallets();
  }

  @Post('admin/release-available')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  releaseAvailableTransaction() {
    return this.walletsService.releaseAvailableTransaction();
  }
}
