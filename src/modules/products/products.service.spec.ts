import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ProductsService } from './products.service';
import { Product } from './entity/product.entity';
import { User } from '../users/entity/user.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

type MockModel<T = unknown> = Partial<Record<keyof Model<T>, jest.Mock>>;

describe('ProductsService', () => {
  let service: ProductsService;
  let productModel: MockModel<Product>;
  let userModel: MockModel<User>;

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
    productModel = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };

    userModel = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getModelToken(Product.name),
          useValue: productModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: userModel,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(productModel).toBeDefined();
    expect(userModel).toBeDefined();
  });

  describe('create', () => {
    it('should create a product successfully', async () => {
      jest.spyOn(productModel, 'create').mockResolvedValue(product as never);

      const result = await service.create(createProductDto);

      expect(productModel.create).toHaveBeenCalledWith(createProductDto);
      expect(result).toEqual(product);
    });

    it('should propagate exceptions thrown by the product model', async () => {
      const error = new Error('create failed');
      jest.spyOn(productModel, 'create').mockRejectedValue(error as never);

      await expect(service.create(createProductDto)).rejects.toThrow(error);
      expect(productModel.create).toHaveBeenCalledWith(createProductDto);
    });
  });

  describe('findAll', () => {
    it('should return all products populated with owner data', async () => {
      const populate = jest.fn().mockResolvedValue([product]);
      jest.spyOn(productModel, 'find').mockReturnValue({ populate } as never);

      const result = await service.findAll();

      expect(productModel.find).toHaveBeenCalledWith();
      expect(populate).toHaveBeenCalledWith('owner', 'name email role');
      expect(result).toEqual([product]);
    });

    it('should return an empty array when no products exist', async () => {
      const populate = jest.fn().mockResolvedValue([]);
      jest.spyOn(productModel, 'find').mockReturnValue({ populate } as never);

      const result = await service.findAll();

      expect(productModel.find).toHaveBeenCalledWith();
      expect(populate).toHaveBeenCalledWith('owner', 'name email role');
      expect(result).toEqual([]);
    });

    it('should propagate exceptions thrown by the product model', async () => {
      const error = new Error('find failed');
      const populate = jest.fn().mockRejectedValue(error);
      jest.spyOn(productModel, 'find').mockReturnValue({ populate } as never);

      await expect(service.findAll()).rejects.toThrow(error);
      expect(productModel.find).toHaveBeenCalledWith();
      expect(populate).toHaveBeenCalledWith('owner', 'name email role');
    });
  });

  describe('findOne', () => {
    it('should return one product populated with owner data', async () => {
      const populate = jest.fn().mockResolvedValue(product);
      jest.spyOn(productModel, 'findById').mockReturnValue({ populate } as never);

      const result = await service.findOne(productId);

      expect(productModel.findById).toHaveBeenCalledWith(productId);
      expect(populate).toHaveBeenCalledWith('owner', 'name email role');
      expect(result).toEqual(product);
    });

    it('should return null when the product does not exist', async () => {
      const populate = jest.fn().mockResolvedValue(null);
      jest.spyOn(productModel, 'findById').mockReturnValue({ populate } as never);

      const result = await service.findOne(productId);

      expect(productModel.findById).toHaveBeenCalledWith(productId);
      expect(populate).toHaveBeenCalledWith('owner', 'name email role');
      expect(result).toBeNull();
    });

    it('should propagate exceptions thrown by the product model', async () => {
      const error = new Error('findById failed');
      const populate = jest.fn().mockRejectedValue(error);
      jest.spyOn(productModel, 'findById').mockReturnValue({ populate } as never);

      await expect(service.findOne(productId)).rejects.toThrow(error);
      expect(productModel.findById).toHaveBeenCalledWith(productId);
      expect(populate).toHaveBeenCalledWith('owner', 'name email role');
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
      jest
        .spyOn(productModel, 'findByIdAndUpdate')
        .mockResolvedValue(updatedProduct as never);

      const result = await service.update(productId, updateProductDto);

      expect(productModel.findByIdAndUpdate).toHaveBeenCalledWith(
        productId,
        updateProductDto,
        { new: true },
      );
      expect(result).toEqual(updatedProduct);
    });

    it('should return null when the product to update does not exist', async () => {
      jest.spyOn(productModel, 'findByIdAndUpdate').mockResolvedValue(null);

      const result = await service.update(productId, updateProductDto);

      expect(productModel.findByIdAndUpdate).toHaveBeenCalledWith(
        productId,
        updateProductDto,
        { new: true },
      );
      expect(result).toBeNull();
    });

    it('should propagate exceptions thrown by the product model', async () => {
      const error = new Error('update failed');
      jest.spyOn(productModel, 'findByIdAndUpdate').mockRejectedValue(error);

      await expect(service.update(productId, updateProductDto)).rejects.toThrow(
        error,
      );
      expect(productModel.findByIdAndUpdate).toHaveBeenCalledWith(
        productId,
        updateProductDto,
        { new: true },
      );
    });
  });

  describe('remove', () => {
    it('should remove a product successfully', async () => {
      jest.spyOn(productModel, 'findByIdAndDelete').mockResolvedValue(product);

      const result = await service.remove(productId);

      expect(productModel.findByIdAndDelete).toHaveBeenCalledWith(productId);
      expect(result).toEqual(product);
    });

    it('should return null when the product to remove does not exist', async () => {
      jest.spyOn(productModel, 'findByIdAndDelete').mockResolvedValue(null);

      const result = await service.remove(productId);

      expect(productModel.findByIdAndDelete).toHaveBeenCalledWith(productId);
      expect(result).toBeNull();
    });

    it('should propagate exceptions thrown by the product model', async () => {
      const error = new Error('delete failed');
      jest.spyOn(productModel, 'findByIdAndDelete').mockRejectedValue(error);

      await expect(service.remove(productId)).rejects.toThrow(error);
      expect(productModel.findByIdAndDelete).toHaveBeenCalledWith(productId);
    });
  });
});
