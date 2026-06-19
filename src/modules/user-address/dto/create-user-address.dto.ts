import {
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateUserAddressDto {
  @IsString()
  label!: string;

  @IsString()
  street!: string;

  @IsString()
  number!: string;

  @IsString()
  @IsOptional()
  floor?: string;

  @IsString()
  @IsOptional()
  apartment?: string;

  @IsString()
  city!: string;

  @IsString()
  province!: string;

  @IsString()
  postalCode!: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}