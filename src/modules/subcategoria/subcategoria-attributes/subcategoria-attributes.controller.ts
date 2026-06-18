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

import { SubCategoryAttributesService } from './subcategoria-attributes.service';
import { CreateSubCategoryAttributeDto } from './dto/create-subcategoria-attribute.dto';
import { UpdateSubcategoriaAttributeDto } from './dto/update-subcategoria-attribute.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UserRole } from '../../users/entity/user.entity';
import { Roles } from '../../../common/decorators/roles.decorator';

@Controller('sub-category-attributes')
export class SubCategoryAttributesController {
  constructor(
    private readonly service: SubCategoryAttributesService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateSubCategoryAttributeDto) {
    return this.service.create(dto);
  }
  
  @Get()
  findAll() {
    return this.service.findAll();
  }
  
  @Get('subcategory/:subCategoryId')
  findBySubCategory(
    @Param('subCategoryId') subCategoryId: string,
  ) {
    return this.service.findBySubCategory(subCategoryId);
  }
  
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
  
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubcategoriaAttributeDto,
  ) {
    return this.service.update(id, dto);
  }
  
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}