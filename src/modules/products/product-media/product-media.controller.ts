import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';

import { FilesInterceptor } from '@nestjs/platform-express';
import { ProductMediaService } from './product-media.service';

@Controller('product-media')
export class ProductMediaController {
  constructor(
    private readonly productMediaService: ProductMediaService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      dest: './uploads/products',
    }),
  )
  uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productMediaService.uploadFiles(files);
  }

  @Get()
  findAll() {
    return this.productMediaService.findAll();
  }

  @Get('product/:productId')
  findByProduct(
    @Param('productId') productId: string,
  ) {
    return this.productMediaService.findByProduct(productId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
  ) {
    return this.productMediaService.remove(id);
  }
}