import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { SubCategoriesService } from './subcategoria.service';

import { CreateSubCategoryDto } from './dto/create-subcategoria.dto';
import { UpdateSubCategoryDto } from './dto/update-subcategoria.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entity/user.entity';

@Controller('subcategories')
export class SubCategoriesController {
  constructor(
    private readonly subCategoriesService: SubCategoriesService,
  ) {}
  
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  create(
    @Body()
    createSubCategoryDto: CreateSubCategoryDto,
  ) {
    return this.subCategoriesService.create(
      createSubCategoryDto,
    );
  }
  
  @Get()
  findAll() {
    return this.subCategoriesService.findAll();
  }
  
  @Get(':id')
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.subCategoriesService.findOne(id);
  }
  
  @Get('category/:categoryId')
  findByCategory(
    @Param('categoryId')
    categoryId: string,
  ) {
    return this.subCategoriesService.findByCategory(
      categoryId,
    );
  }
  
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id')
    id: string,
    
    @Body()
    updateSubCategoryDto: UpdateSubCategoryDto,
  ) {
    return this.subCategoriesService.update(
      id,
      updateSubCategoryDto,
    );
  }
  
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(
    @Param('id')
    id: string,
  ) {
    return this.subCategoriesService.remove(id);
  }
}