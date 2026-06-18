import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import {
  ProductMedia,
  ProductMediaType,
} from './entities/product-media.entity';

import { Product } from '../entity/product.entity';

@Injectable()
export class ProductMediaService {
  constructor(
    @InjectRepository(ProductMedia)
    private readonly mediaRepository: Repository<ProductMedia>,

    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async uploadFiles(files: Express.Multer.File[]) {
    const media = files.map(file => {
      const type = file.mimetype.startsWith('video')
        ? ProductMediaType.VIDEO
        : ProductMediaType.IMAGE;

      return this.mediaRepository.create({
        url: `/uploads/products/${file.filename}`,
        type,
        product: null,
      });
    });

    return this.mediaRepository.save(media);
  }

  async findAll() {
    return this.mediaRepository.find({
      relations: {
        product: true,
      },
    });
  }

  async findByProduct(productId: string) {
    return this.mediaRepository.find({
      where: {
        product: {
          id: productId,
        },
      },
    });
  }

  async assignToProduct(mediaIds: string[], productId: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    const media = await this.mediaRepository.find({
      where: {
        id: In(mediaIds),
      },
    });

    media.forEach(item => {
      item.product = product;
    });

    return this.mediaRepository.save(media);
  }

  async remove(id: string) {
    const media = await this.mediaRepository.findOne({
      where: { id },
    });

    if (!media) {
      throw new NotFoundException('Archivo no encontrado');
    }

    await this.mediaRepository.remove(media);

    return {
      message: 'Archivo eliminado correctamente',
    };
  }
}
