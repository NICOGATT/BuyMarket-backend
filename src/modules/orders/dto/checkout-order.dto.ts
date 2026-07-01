import {
  IsEnum,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../entities/order.entity';
import { ShippingType } from '../../shipments/entities/shipment.entity';

export class NationalShippingDataDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  dni!: string;

  @IsString()
  @IsNotEmpty()
  cuit!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsString()
  @IsNotEmpty()
  postalCode!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  province!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  country?: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  transportName!: string;
}

export class CheckoutOrderDto {
  @ValidateIf((dto) => dto.shippingType !== ShippingType.NATIONAL_SHIPPING)
  @IsString()
  @IsNotEmpty()
  deliveryAddress?: string;

  @IsOptional()
  @IsEnum(ShippingType)
  shippingType?: ShippingType;

  @ValidateIf((dto) => dto.shippingType === ShippingType.NATIONAL_SHIPPING)
  @IsObject()
  @ValidateNested()
  @Type(() => NationalShippingDataDto)
  nationalShippingData?: NationalShippingDataDto;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsString()
  notes?: string;
}
