import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

import {
  WalletTransactionStatus,
  WalletTransactionType,
} from '../entity/wallet-transaction.entity';

export class CreateWalletTransactionDto {
  @IsUUID()
  walletId!: string;

  @IsUUID()
  @IsOptional()
  orderId?: string;

  @IsEnum(WalletTransactionType)
  type!: WalletTransactionType;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  commissionAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  netAmount?: number;

  @IsEnum(WalletTransactionStatus)
  @IsOptional()
  status?: WalletTransactionStatus;
}