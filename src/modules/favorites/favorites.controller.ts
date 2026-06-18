import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorators';

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(
    private readonly favoritesService: FavoritesService,
  ) {}

  @Get('my-favorites')
  getMyFavorites(@CurrentUser() user: any) {
    return this.favoritesService.getMyFavorites(user.id);
  }

  @Post(':productId')
  addFavorite(
    @CurrentUser() user: any,
    @Param('productId') productId: string,
  ) {
    return this.favoritesService.addFavorite(user.id, productId);
  }

  @Delete(':productId')
  removeFavorite(
    @CurrentUser() user: any,
    @Param('productId') productId: string,
  ) {
    return this.favoritesService.removeFavorite(user.id, productId);
  }
}
