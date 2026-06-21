import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class NotifyTransferPaymentDto {
  @IsString()
  @IsNotEmpty()
  senderAlias!: string;

  @IsOptional()
  @IsString()
  senderCbu?: string;
}
