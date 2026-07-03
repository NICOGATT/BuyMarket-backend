import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

import { PaymentMethod } from '../../orders/entities/order.enums';

export class CreateUserPaymentMethodDto {
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  senderAlias?: string;

  @IsString()
  @IsOptional()
  senderCbu?: string;
}
