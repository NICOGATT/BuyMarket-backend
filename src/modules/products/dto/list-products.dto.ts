import { IsOptional, IsUUID } from 'class-validator';

export class ListProductsDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;
}
