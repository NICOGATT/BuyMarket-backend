import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';

import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
  ) {}

  @Post()
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }

  @Post(':id/images')
  @UseInterceptors(
  FileFieldsInterceptor(
    [
      { name: 'icon', maxCount: 1 },
      { name: 'banner', maxCount: 1 },
    ],
    {
      storage: diskStorage({
        destination: './uploads/categories',
        filename: (req, file, callback) => {
          const uniqueName =
            Date.now() + '-' + Math.round(Math.random() * 1e9);

          const extension = extname(file.originalname);

          callback(null, `${uniqueName}${extension}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return callback(
            new Error('Solo se permiten imágenes'),
            false,
          );
        }

        callback(null, true);
      },
    },
  ),
)
  uploadCategoryImages(
    @Param('id') id: string,
    @UploadedFiles()
    files: {
      icon?: Express.Multer.File[];
      banner?: Express.Multer.File[];
    },
  ) {
    const iconUrl = files.icon?.[0]
      ? `http://localhost:3000/uploads/categories/${files.icon[0].filename}`
      : undefined;

    const bannerUrl = files.banner?.[0]
      ? `http://localhost:3000/uploads/categories/${files.banner[0].filename}`
      : undefined;

    return this.categoriesService.uploadImages(
      id,
      iconUrl,
      bannerUrl,
    );
  }
}