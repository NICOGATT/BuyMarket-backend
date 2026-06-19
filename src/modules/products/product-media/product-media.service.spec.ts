import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';

import { Product } from '../entity/product.entity';
import {
  ProductMedia,
  ProductMediaType,
} from './entities/product-media.entity';
import { ProductMediaService } from './product-media.service';

type MockRepository<T extends ObjectLiteral = ObjectLiteral> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockRepository = <T extends ObjectLiteral = ObjectLiteral>(): MockRepository<T> => ({
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
  save: jest.fn(),
});

describe('ProductMediaService', () => {
  let service: ProductMediaService;
  let mediaRepository: MockRepository<ProductMedia>;
  let productRepository: MockRepository<Product>;

  const productId = '4d2bfba0-173c-4d60-8e5b-aee88ac25f77';
  const imageMediaId = 'bb7be62b-d8a7-41d4-99ad-a2f33ae8fd6f';
  const videoMediaId = 'e0ddc632-47bf-4e52-80dc-b8bfe78b15c6';

  const product = {
    id: productId,
    title: 'Notebook gamer',
  } as Product;

  const imageFile = {
    filename: 'notebook.jpg',
    mimetype: 'image/jpeg',
  } as Express.Multer.File;

  const videoFile = {
    filename: 'demo.mp4',
    mimetype: 'video/mp4',
  } as Express.Multer.File;

  const imageMedia = {
    id: imageMediaId,
    url: '/uploads/products/notebook.jpg',
    type: ProductMediaType.IMAGE,
    product: null,
  } as ProductMedia;

  const videoMedia = {
    id: videoMediaId,
    url: '/uploads/products/demo.mp4',
    type: ProductMediaType.VIDEO,
    product: null,
  } as ProductMedia;

  beforeEach(async () => {
    mediaRepository = createMockRepository<ProductMedia>();
    productRepository = createMockRepository<Product>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductMediaService,
        {
          provide: getRepositoryToken(ProductMedia),
          useValue: mediaRepository,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: productRepository,
        },
      ],
    }).compile();

    service = module.get<ProductMediaService>(ProductMediaService);
    jest.clearAllMocks();
  });

  it('deberia estar definido con todos sus repositorios mockeados', () => {
    expect(service).toBeDefined();
    expect(mediaRepository).toBeDefined();
    expect(productRepository).toBeDefined();
  });

  describe('uploadFiles', () => {
    it('crea medias para imagenes y videos sin asociarlas a un producto', async () => {
      mediaRepository.create
        ?.mockReturnValueOnce(imageMedia)
        .mockReturnValueOnce(videoMedia);
      mediaRepository.save?.mockResolvedValue([imageMedia, videoMedia]);

      const result = await service.uploadFiles([imageFile, videoFile]);

      expect(mediaRepository.create).toHaveBeenNthCalledWith(1, {
        url: '/uploads/products/notebook.jpg',
        type: ProductMediaType.IMAGE,
        product: null,
      });
      expect(mediaRepository.create).toHaveBeenNthCalledWith(2, {
        url: '/uploads/products/demo.mp4',
        type: ProductMediaType.VIDEO,
        product: null,
      });
      expect(mediaRepository.save).toHaveBeenCalledWith([
        imageMedia,
        videoMedia,
      ]);
      expect(result).toEqual([imageMedia, videoMedia]);
    });
  });

  describe('findAll', () => {
    it('devuelve todas las medias con su relacion product', async () => {
      mediaRepository.find?.mockResolvedValue([imageMedia, videoMedia]);

      const result = await service.findAll();

      expect(mediaRepository.find).toHaveBeenCalledWith({
        relations: {
          product: true,
        },
      });
      expect(result).toEqual([imageMedia, videoMedia]);
    });
  });

  describe('findByProduct', () => {
    it('devuelve las medias asociadas a un producto', async () => {
      const mediaByProduct = [{ ...imageMedia, product }] as ProductMedia[];
      mediaRepository.find?.mockResolvedValue(mediaByProduct);

      const result = await service.findByProduct(productId);

      expect(mediaRepository.find).toHaveBeenCalledWith({
        where: {
          product: {
            id: productId,
          },
        },
      });
      expect(result).toEqual(mediaByProduct);
    });
  });

  describe('assignToProduct', () => {
    it('asigna medias existentes a un producto existente', async () => {
      const media = [{ ...imageMedia }, { ...videoMedia }] as ProductMedia[];
      const assignedMedia = media.map(item => ({
        ...item,
        product,
      })) as ProductMedia[];

      productRepository.findOne?.mockResolvedValue(product);
      mediaRepository.find?.mockResolvedValue(media);
      mediaRepository.save?.mockResolvedValue(assignedMedia);

      const result = await service.assignToProduct(
        [imageMediaId, videoMediaId],
        productId,
      );

      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { id: productId },
      });
      expect(mediaRepository.find).toHaveBeenCalledWith({
        where: {
          id: expect.any(Object),
        },
      });
      expect(mediaRepository.save).toHaveBeenCalledWith(assignedMedia);
      expect(result).toEqual(assignedMedia);
    });

    it('lanza NotFoundException si el producto no existe', async () => {
      productRepository.findOne?.mockResolvedValue(null);

      await expect(
        service.assignToProduct([imageMediaId], productId),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mediaRepository.find).not.toHaveBeenCalled();
      expect(mediaRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('elimina una media existente y devuelve mensaje de exito', async () => {
      mediaRepository.findOne?.mockResolvedValue(imageMedia);
      mediaRepository.remove?.mockResolvedValue(imageMedia);

      const result = await service.remove(imageMediaId);

      expect(mediaRepository.findOne).toHaveBeenCalledWith({
        where: { id: imageMediaId },
      });
      expect(mediaRepository.remove).toHaveBeenCalledWith(imageMedia);
      expect(result).toEqual({
        message: 'Archivo eliminado correctamente',
      });
    });

    it('lanza NotFoundException si la media no existe', async () => {
      mediaRepository.findOne?.mockResolvedValue(null);

      await expect(service.remove(imageMediaId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mediaRepository.remove).not.toHaveBeenCalled();
    });
  });
});
