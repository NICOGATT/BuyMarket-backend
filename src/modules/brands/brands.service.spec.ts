import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';

import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { Product } from '../products/entity/product.entity';
import { BrandsService } from './brands.service';
import { Brand } from './entities/brand.entity';

type MockRepository<T extends ObjectLiteral> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockRepository = <
  T extends ObjectLiteral,
>(): MockRepository<T> => ({
  count: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
  save: jest.fn(),
});

describe('BrandsService', () => {
  let service: BrandsService;
  let brandsRepository: MockRepository<Brand>;
  let productsRepository: MockRepository<Product>;
  let cloudinaryService: {
    uploadFile: jest.Mock;
    deleteFile: jest.Mock;
  };

  const brand = {
    id: '4f53b30d-a566-4b4e-a103-b1b3482c0849',
    name: 'Nike',
    logo: null,
    logoPublicId: null,
  } as Brand;

  beforeEach(async () => {
    brandsRepository = createMockRepository<Brand>();
    productsRepository = createMockRepository<Product>();
    cloudinaryService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandsService,
        {
          provide: getRepositoryToken(Brand),
          useValue: brandsRepository,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: productsRepository,
        },
        {
          provide: CloudinaryService,
          useValue: cloudinaryService,
        },
      ],
    }).compile();

    service = module.get(BrandsService);
  });

  it('crea una marca sin nombre', async () => {
    const unnamedBrand = { ...brand, name: null };
    brandsRepository.create?.mockReturnValue(unnamedBrand);
    brandsRepository.save?.mockResolvedValue(unnamedBrand);

    await expect(service.create({})).resolves.toEqual(unnamedBrand);
    expect(brandsRepository.create).toHaveBeenCalledWith({ name: null });
  });

  it('rechaza un nombre exacto duplicado', async () => {
    brandsRepository.findOne?.mockResolvedValue(brand);

    await expect(service.create({ name: brand.name })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rechaza un nombre compuesto solamente por espacios', async () => {
    await expect(service.create({ name: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('lanza NotFoundException para una marca inexistente', async () => {
    brandsRepository.findOne?.mockResolvedValue(null);

    await expect(service.findOne(brand.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('reemplaza el logo y elimina el archivo anterior', async () => {
    const brandWithLogo = {
      ...brand,
      logo: 'https://old-logo.test/logo.png',
      logoPublicId: 'buymarket/brands/old-logo',
    };
    const file = { buffer: Buffer.from('logo') } as Express.Multer.File;
    brandsRepository.findOne?.mockResolvedValue(brandWithLogo);
    cloudinaryService.uploadFile.mockResolvedValue({
      secure_url: 'https://new-logo.test/logo.png',
      public_id: 'buymarket/brands/new-logo',
    });
    brandsRepository.save?.mockImplementation((value) =>
      Promise.resolve(value),
    );
    brandsRepository.findOne
      ?.mockResolvedValueOnce(brandWithLogo)
      .mockResolvedValueOnce({
        ...brandWithLogo,
        logo: 'https://new-logo.test/logo.png',
        logoPublicId: undefined,
      });

    const result = await service.uploadLogo(brand.id, file);

    expect(result.logo).toBe('https://new-logo.test/logo.png');
    expect(cloudinaryService.deleteFile).toHaveBeenCalledWith(
      'buymarket/brands/old-logo',
    );
  });

  it('bloquea la eliminacion cuando hay productos asociados', async () => {
    brandsRepository.findOne?.mockResolvedValue(brand);
    productsRepository.count?.mockResolvedValue(1);

    await expect(service.remove(brand.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(brandsRepository.remove).not.toHaveBeenCalled();
  });

  it('elimina una marca sin productos asociados', async () => {
    const brandWithLogo = {
      ...brand,
      logoPublicId: 'buymarket/brands/logo',
    };
    brandsRepository.findOne?.mockResolvedValue(brandWithLogo);
    productsRepository.count?.mockResolvedValue(0);
    brandsRepository.remove?.mockResolvedValue(brandWithLogo);

    await expect(service.remove(brand.id)).resolves.toEqual({
      message: 'Marca eliminada',
    });
    expect(cloudinaryService.deleteFile).toHaveBeenCalledWith(
      brandWithLogo.logoPublicId,
    );
  });
});
