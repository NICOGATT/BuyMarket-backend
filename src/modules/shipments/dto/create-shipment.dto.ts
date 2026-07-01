import {
  IsEnum,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import { ShippingCarrier } from '../entities/shipment.entity';
import { ShippingType } from '../entities/shipment.entity';

export class CreateShipmentDto {
  @IsUUID()
  orderId!: string;

  @IsEnum(ShippingType)
  type!: ShippingType;

  @IsEnum(ShippingCarrier)
  carrier!: ShippingCarrier;

  @IsOptional()
  @IsNumber()
  cost?: number;

  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  buyerFullName?: string;

  @IsOptional()
  @IsString()
  buyerDni?: string;

  @IsOptional()
  @IsString()
  buyerCuit?: string;

  @IsOptional()
  @IsString()
  buyerProvince?: string;

  @IsOptional()
  @IsString()
  buyerCity?: string;

  @IsOptional()
  @IsString()
  buyerPostalCode?: string;

  @IsOptional()
  @IsString()
  buyerCountry?: string;

  @IsOptional()
  @IsString()
  buyerPhone?: string;

  @IsOptional()
  @IsEmail()
  buyerEmail?: string;

  @IsOptional()
  @IsString()
  transportName?: string;
}
