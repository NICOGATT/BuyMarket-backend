import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Product } from './entity/product.entity';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Category } from '../categories/entities/category.entity';
import { ProductMedia, ProductMediaType } from './product-media/entities/product-media.entity';
import { ProductAttributeValue } from './entity/product-attributes-value.entity';
import { SubCategory } from '../subcategoria/entities/subcategoria.entity';
import { UserAddress } from '../user-address/entities/user-address.entity';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(ProductMedia)
    private readonly productMediaRepository : Repository<ProductMedia>, 
    @InjectRepository(ProductAttributeValue)
    private readonly productAttributeValueRepository : Repository<ProductAttributeValue>,
    @InjectRepository(SubCategory)
    private readonly subCategoryRepository: Repository<SubCategory>,
    @InjectRepository(UserAddress)
    private readonly userAddressRepository : Repository<UserAddress>,
    
    private readonly cloudinaryService : CloudinaryService
  ) {}

  async create(createProductDto: CreateProductDto) {
    let pickupAddress : UserAddress | null = null; 
    const subCategory = await this.subCategoryRepository.findOne({
      where: {
        id: createProductDto.subCategoryId,
      },
      relations: {
        category: true,
        attributes: true,
      },
    });

    if (!subCategory) {
      throw new NotFoundException('Subcategoría no encontrada');
    }

    if(createProductDto.pickupAddressId){
      pickupAddress = await this.userAddressRepository.findOne({
        where : {
          id : createProductDto.pickupAddressId, 
          user : {
            id : createProductDto.seller
          }
        }
      })
        if (!pickupAddress) {
          throw new BadRequestException(
              'La dirección no existe o no pertenece al usuario',
          );
        }
    }
    const product = this.productsRepository.create({
      title: createProductDto.title,
      description: createProductDto.description,
      price: createProductDto.price,
      stock: createProductDto.stock,
      category: subCategory.category,
      subCategory,
      seller: {
        id: createProductDto.seller,
      },
      pickupAddress
    });

    const savedProduct = await this.productsRepository.save(product);

    console.log('MEDIA IDS:', createProductDto.mediaIds);
    // Vincular medias subidas previamente
    if (createProductDto.mediaIds?.length) {
      const media = await this.productMediaRepository.findBy({
        id: In(createProductDto.mediaIds),
      });

      media.forEach(item => {
        item.product = savedProduct;
      });

      await this.productMediaRepository.save(media);
    }

    const sentAttributes = createProductDto.attributes ?? [];

    const requiredAttributes = subCategory.attributes.filter(
      attribute => attribute.required,
    );

    for (const requiredAttribute of requiredAttributes) {
      const exists = sentAttributes.some(
        item => item.attributeId === requiredAttribute.id,
      );

      if (!exists) {
        throw new BadRequestException(
          `El atributo ${requiredAttribute.name} es obligatorio`,
        );
      }
    }

    if (sentAttributes.length > 0) {
      const values = sentAttributes.map(item => {
        const attribute = subCategory.attributes.find(
          attr => attr.id === item.attributeId,
        );

        if (!attribute) {
          throw new BadRequestException(
            `El atributo ${item.attributeId} no pertenece a esta subcategoría`,
          );
        }

        return this.productAttributeValueRepository.create({
          value: item.value,
          product: savedProduct,
          attribute,
        });
      });

      await this.productAttributeValueRepository.save(values);
    }

    return this.findOne(savedProduct.id);
  }

  async findAll() {
    return this.productsRepository.find({
      relations: {
        category: true,
        subCategory: true,
        media: true,
        attributeValues: {
          attribute: true,
        },
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOne(id: string) {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: {
        category: true,
        subCategory: true,
        media: true,
        attributeValues: {
          attribute: true,
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ) {
    const { seller, ...rest } = updateProductDto;
    const updateData = {
      ...rest,
      ...(seller ? { seller: { id: seller } } : {}),
    };

    await this.productsRepository.update(id, updateData);

    return this.findOne(id);
  }

  async remove(id: string) {
    const product = await this.findOne(id);

    if (!product) {
      return null;
    }

    return await this.productsRepository.remove(product);
  }

  async uploadProductMedia(
    productId: string,
    file: Express.Multer.File,
  ) {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
    });
    const mediaType = file.mimetype.startsWith('video/')
      ? ProductMediaType.VIDEO
      : ProductMediaType.IMAGE;
        if (!product) {
          throw new NotFoundException('Producto no encontrado');
        }

    const uploaded = await this.cloudinaryService.uploadFile(
      file,
      'buymarket/products',
      mediaType
    );

    const media = this.productMediaRepository.create({
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      type: mediaType,
      product: product,
    });

    return this.productMediaRepository.save(media);
  }

  async findMyProducts(userId : string) {
    return await this.productsRepository.find({
      where : {
        seller : {
          id : userId,
        }
      }, 
      relations : ['seller'], 
      order : {
        createdAt : 'DESC', 
      }
    })
  }
}