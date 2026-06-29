import {
  IsEnum,
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
  buyerProvince?: string;

  @IsOptional()
  @IsString()
  buyerCity?: string;

  @IsOptional()
  @IsString()
  buyerPostalCode?: string;
}