import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CategorySuggestionsService } from './category-suggestions.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorators';
import { UserRole } from '../users/entity/user.entity';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('category-suggestions')
export class CategorySuggestionsController {
  constructor(
    private readonly categorySuggestionsService:
      CategorySuggestionsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() createDto: any,
    @CurrentUser() user: any,
  ) {
    return this.categorySuggestionsService.create(
      createDto,
      user,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('pending')
  findPending() {
    return this.categorySuggestionsService.findPending();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.categorySuggestionsService.approve(id);
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string) {
    return this.categorySuggestionsService.reject(id);
  }
}