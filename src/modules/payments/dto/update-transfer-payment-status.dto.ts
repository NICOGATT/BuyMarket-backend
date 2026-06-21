import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaymentStatus } from '../entity/payment.entity';

export class UpdateTransferPaymentStatusDto {
  @IsIn([PaymentStatus.COMPLETED, PaymentStatus.REJECTED])
  status!: PaymentStatus.COMPLETED | PaymentStatus.REJECTED;

  @IsOptional()
  @IsString()
  adminNote?: string;
}
