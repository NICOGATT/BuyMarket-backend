import { Test, TestingModule } from '@nestjs/testing';

import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: jest.Mocked<ProductsService>;

  const productId = '507f1f77bcf86cd799439011';
  const ownerId = '507f1f77bcf86cd799439012';

  const createProductDto: CreateProductDto = {
    title: 'Notebook',
    description: 'Notebook gamer',
    price: 1500,
    stock: 4,
    categoriaId: 1,
    direccionRetiro: 'Av. Siempre Viva 742',
    horarioDisponible: '10:00 a 18:00',
    images: ['notebook.jpg'],
    owner: ownerId,
  };

  const product = {
    _id: productId,
    ...createProductDto,
    category: 'Tecnologia',
    isActive: true,
    owner: {
      _id: ownerId,
      name: 'Jane Doe',
      email: 'jane@example.com',
      role: 'user',
    },
  };

  beforeEach(async () => {
    const productsServiceMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findOnePublic: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: productsServiceMock,
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    service = module.get(ProductsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a product successfully', async () => {
      jest.spyOn(service, 'create').mockResolvedValue(product);

      const result = await controller.create(createProductDto);

      expect(service.create).toHaveBeenCalledWith(createProductDto);
      expect(result).toEqual(product);
    });

    it('should propagate exceptions thrown by the service', async () => {
      const error = new Error('create failed');
      jest.spyOn(service, 'create').mockRejectedValue(error);

      await expect(controller.create(createProductDto)).rejects.toThrow(error);
      expect(service.create).toHaveBeenCalledWith(createProductDto);
    });
  });

  describe('findAll', () => {
    it('should return all products successfully', async () => {
      jest.spyOn(service, 'findAll').mockResolvedValue([product]);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith();
      expect(result).toEqual([product]);
    });

    it('should return an empty array when no products exist', async () => {
      jest.spyOn(service, 'findAll').mockResolvedValue([]);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith();
      expect(result).toEqual([]);
    });

    it('should propagate exceptions thrown by the service', async () => {
      const error = new Error('findAll failed');
      jest.spyOn(service, 'findAll').mockRejectedValue(error);

      await expect(controller.findAll()).rejects.toThrow(error);
      expect(service.findAll).toHaveBeenCalledWith();
    });
  });

  describe('findOne', () => {
    it('should return one product successfully', async () => {
      jest.spyOn(service, 'findOnePublic').mockResolvedValue(product);

      const result = await controller.findOne(productId);

      expect(service.findOnePublic).toHaveBeenCalledWith(productId);
      expect(result).toEqual(product);
    });

    it('should return null when the product does not exist', async () => {
      jest.spyOn(service, 'findOnePublic').mockResolvedValue(null);

      const result = await controller.findOne(productId);

      expect(service.findOnePublic).toHaveBeenCalledWith(productId);
      expect(result).toBeNull();
    });

    it('should propagate exceptions thrown by the service', async () => {
      const error = new Error('findOne failed');
      jest.spyOn(service, 'findOnePublic').mockRejectedValue(error);

      await expect(controller.findOne(productId)).rejects.toThrow(error);
      expect(service.findOnePublic).toHaveBeenCalledWith(productId);
    });
  });

  describe('update', () => {
    const updateProductDto: UpdateProductDto = {
      title: 'Notebook actualizada',
      price: 1400,
    };

    it('should update a product successfully', async () => {
      const updatedProduct = {
        ...product,
        ...updateProductDto,
      };
      jest.spyOn(service, 'update').mockResolvedValue(updatedProduct);

      const result = await controller.update(productId, updateProductDto);

      expect(service.update).toHaveBeenCalledWith(productId, updateProductDto);
      expect(result).toEqual(updatedProduct);
    });

    it('should return null when the product to update does not exist', async () => {
      jest.spyOn(service, 'update').mockResolvedValue(null);

      const result = await controller.update(productId, updateProductDto);

      expect(service.update).toHaveBeenCalledWith(productId, updateProductDto);
      expect(result).toBeNull();
    });

    it('should propagate exceptions thrown by the service', async () => {
      const error = new Error('update failed');
      jest.spyOn(service, 'update').mockRejectedValue(error);

      await expect(
        controller.update(productId, updateProductDto),
      ).rejects.toThrow(error);
      expect(service.update).toHaveBeenCalledWith(productId, updateProductDto);
    });
  });

  describe('remove', () => {
    it('should remove a product successfully', async () => {
      jest.spyOn(service, 'remove').mockResolvedValue(product);

      const result = await controller.remove(productId);

      expect(service.remove).toHaveBeenCalledWith(productId);
      expect(result).toEqual(product);
    });

    it('should return null when the product to remove does not exist', async () => {
      jest.spyOn(service, 'remove').mockResolvedValue(null);

      const result = await controller.remove(productId);

      expect(service.remove).toHaveBeenCalledWith(productId);
      expect(result).toBeNull();
    });

    it('should propagate exceptions thrown by the service', async () => {
      const error = new Error('remove failed');
      jest.spyOn(service, 'remove').mockRejectedValue(error);

      await expect(controller.remove(productId)).rejects.toThrow(error);
      expect(service.remove).toHaveBeenCalledWith(productId);
    });
  });
});
