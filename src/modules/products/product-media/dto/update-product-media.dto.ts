import { PartialType } from '@nestjs/mapped-types';
import { CreateProductMediaDto } from './create-product-media.dto';

export class UpdateProductMediaDto extends PartialType(CreateProductMediaDto) {}
