import { Test, TestingModule } from '@nestjs/testing';
import { CartsController } from './carts.controller';
import { CartsService } from './carts.service';

describe('CartsController', () => {
  let controller: CartsController;
  let cartsService: {
    getCartByUser: jest.Mock;
    addProduct: jest.Mock;
    updateQuantity: jest.Mock;
    removeItem: jest.Mock;
    clearCart: jest.Mock;
  };

  beforeEach(async () => {
    cartsService = {
      getCartByUser: jest.fn(),
      addProduct: jest.fn(),
      updateQuantity: jest.fn(),
      removeItem: jest.fn(),
      clearCart: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartsController],
      providers: [
        {
          provide: CartsService,
          useValue: cartsService,
        },
      ],
    }).compile();

    controller = module.get<CartsController>(CartsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('envia variantId al service al agregar producto', () => {
    const user = { id: 'user-1' };
    const cart = { id: 'cart-1' };

    cartsService.addProduct.mockReturnValue(cart);

    expect(
      controller.addProduct(user, {
        productId: 'product-1',
        variantId: 'variant-1',
        quantity: 2,
      }),
    ).toBe(cart);
    expect(cartsService.addProduct).toHaveBeenCalledWith(
      user.id,
      'product-1',
      2,
      'variant-1',
    );
  });
});
