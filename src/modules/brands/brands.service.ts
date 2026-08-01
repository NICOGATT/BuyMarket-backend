import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { Product } from '../products/entity/product.entity';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { Brand } from './entities/brand.entity';

@Injectable()
export class BrandsService {
  constructor(
    @InjectRepository(Brand)
    private readonly brandsRepository: Repository<Brand>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  private async ensureNameIsAvailable(name: string, currentId?: string) {
    const existingBrand = await this.brandsRepository.findOne({
      where: { name },
    });

    if (existingBrand && existingBrand.id !== currentId) {
      throw new ConflictException('Ya existe una marca con ese nombre');
    }
  }

  private normalizeName(name?: string | null) {
    if (name === undefined || name === null) {
      return null;
    }

    const normalizedName = name.trim();

    if (!normalizedName) {
      throw new BadRequestException(
        'El nombre de la marca no puede estar vacio',
      );
    }

    return normalizedName;
  }

  private async findOneWithLogoPublicId(id: string) {
    const brand = await this.brandsRepository.findOne({
      where: { id },
      select: {
        id: true,
        name: true,
        logo: true,
        logoPublicId: true,
      },
    });

    if (!brand) {
      throw new NotFoundException('Marca no encontrada');
    }

    return brand;
  }

  async create(createBrandDto: CreateBrandDto) {
    const name = this.normalizeName(createBrandDto.name);

    if (name) {
      await this.ensureNameIsAvailable(name);
    }

    const brand = this.brandsRepository.create({ name });

    return this.brandsRepository.save(brand);
  }

  findAll() {
    return this.brandsRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const brand = await this.brandsRepository.findOne({ where: { id } });

    if (!brand) {
      throw new NotFoundException('Marca no encontrada');
    }

    return brand;
  }

  async update(id: string, updateBrandDto: UpdateBrandDto) {
    const brand = await this.findOne(id);

    if (updateBrandDto.name !== undefined) {
      const name = this.normalizeName(updateBrandDto.name);

      if (name) {
        await this.ensureNameIsAvailable(name, id);
      }

      brand.name = name;
    }

    return this.brandsRepository.save(brand);
  }

  async uploadLogo(id: string, file: Express.Multer.File) {
    const brand = await this.findOneWithLogoPublicId(id);
    const previousPublicId = brand.logoPublicId;
    const uploaded = await this.cloudinaryService.uploadFile(
      file,
      'buymarket/brands',
      'image',
    );

    brand.logo = uploaded.secure_url;
    brand.logoPublicId = uploaded.public_id;
    await this.brandsRepository.save(brand);

    if (previousPublicId) {
      await this.cloudinaryService.deleteFile(previousPublicId);
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    const brand = await this.findOneWithLogoPublicId(id);
    const productsCount = await this.productsRepository.count({
      where: { brand: { id } },
    });

    if (productsCount > 0) {
      throw new ConflictException(
        'No se puede eliminar una marca asociada a productos',
      );
    }

    await this.brandsRepository.remove(brand);

    if (brand.logoPublicId) {
      await this.cloudinaryService.deleteFile(brand.logoPublicId);
    }

    return { message: 'Marca eliminada' };
  }
}
