import { IsEnum, IsOptional, IsString } from 'class-validator';
import { WithdrawalStatus } from '../entities/with-drawal-request.entity';

export class UpdateWithdrawalStatusDto {
  @IsEnum(WithdrawalStatus)
  status!: WithdrawalStatus;

  @IsString()
  @IsOptional()
  adminNote?: string;
}