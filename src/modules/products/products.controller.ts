import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';

import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorators';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entity/user.entity';
import { ListProductsDto } from './dto/list-products.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  findAll(@Query() query: ListProductsDto = {}) {
    return this.productsService.findAll(query.brandId);
  }

  @Get('featured')
  findFeatured() {
    return this.productsService.findFeatured();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin')
  findAllForAdmin() {
    return this.productsService.findAllForAdmin();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.approve(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/reject')
  reject(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.reject(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-products')
  findMyProducts(@CurrentUser() user: { id: string }) {
    return this.productsService.findMyProducts(user.id);
  }
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOnePublic(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Post(':id/media')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      dest: './uploads/products',
    }),
  )
  uploadProductMedia(
    @Param('id', ParseIntPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productsService.uploadProductMedia(id, files);
  }
}
