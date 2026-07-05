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

import { CartsService } from './carts.service';

import { AddProductDto } from './dto/add-product.dto';
import { UpdateQuantityDto } from './dto/update-quantity.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorators';

@Controller('carts')
@UseGuards(JwtAuthGuard)
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Get('my-cart')
  getMyCart(@CurrentUser() user: any) {
    return this.cartsService.getCartByUser(user.id);
  }

  @Post('add-product')
  addProduct(
    @CurrentUser() user: any,
    @Body() addProductDto: AddProductDto,
  ) {
    return this.cartsService.addProduct(
      user.id,
      addProductDto.productId,
      addProductDto.quantity ?? 1,
      addProductDto.variantId,
    );
  }

  @Patch('items/:itemId')
  updateQuantity(
    @CurrentUser() user: any,
    @Param('itemId') itemId: string,
    @Body() updateQuantityDto: UpdateQuantityDto,
  ) {
    return this.cartsService.updateQuantity(
      user.id,
      itemId,
      updateQuantityDto.quantity,
    );
  }

  @Delete('items/:itemId')
  removeItem(
    @CurrentUser() user: any,
    @Param('itemId') itemId: string,
  ) {
    return this.cartsService.removeItem(user.id, itemId);
  }

  @Delete('clear')
  clearCart(@CurrentUser() user: any) {
    return this.cartsService.clearCart(user.id);
  }
}
