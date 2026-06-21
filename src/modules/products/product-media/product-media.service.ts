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
import { CloudinaryService } from '../../../cloudinary/cloudinary.service';

@Injectable()
export class ProductMediaService {
  constructor(
    @InjectRepository(ProductMedia)
    private readonly mediaRepository: Repository<ProductMedia>,

    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly cloudinaryService : CloudinaryService
  ) {}

  async uploadMedia(files: Express.Multer.File[]) {
    const mediaItems: ProductMedia[] = [];

    for (const file of files) {
      const mediaType = file.mimetype.startsWith('video/')
        ? ProductMediaType.VIDEO
        : ProductMediaType.IMAGE;

      const uploaded = await this.cloudinaryService.uploadFile(
        file,
        'buymarket/products',
        mediaType,
      );

      const media = this.mediaRepository.create({
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        type: mediaType,
        product: null,
      });

      mediaItems.push(media);
    }

    return this.mediaRepository.save(mediaItems);
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
