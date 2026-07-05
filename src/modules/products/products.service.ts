import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Product, ProductApprovalStatus } from './entity/product.entity';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Category } from '../categories/entities/category.entity';
import { ProductMedia, ProductMediaType } from './product-media/entities/product-media.entity';
import { ProductAttributeValue } from './entity/product-attributes-value.entity';
import { ProductVariant } from './entity/product-variant.entity';
import { SubCategory } from '../subcategoria/entities/subcategoria.entity';
import {
  AttributeType,
  AttributeUsage,
  SubCategoryAttribute,
} from '../subcategoria/subcategoria-attributes/entities/subcategoria-attribute.entity';
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
    @InjectRepository(ProductVariant)
    private readonly productVariantRepository : Repository<ProductVariant>,
    @InjectRepository(SubCategory)
    private readonly subCategoryRepository: Repository<SubCategory>,
    @InjectRepository(UserAddress)
    private readonly userAddressRepository : Repository<UserAddress>,
    
    private readonly cloudinaryService : CloudinaryService
  ) {}

  private removeSellerPassword<T extends Product | Product[]>(products: T): T {
    const productList = Array.isArray(products) ? products : [products];

    productList.forEach(product => {
      if (product.seller) {
        delete (product.seller as { password?: string }).password;
      }
    });

    return products;
  }

  private applyVariantPriceAndStock<T extends Product | Product[]>(products: T): T {
    const productList = Array.isArray(products) ? products : [products];

    productList.forEach(product => {
      const activeVariants = (product.variants ?? []).filter(
        variant => variant.isActive,
      );

      if (activeVariants.length === 0) {
        return;
      }

      product.price = Math.min(
        ...activeVariants.map(variant => Number(variant.price)),
      );
      product.stock = activeVariants.reduce(
        (total, variant) => total + Number(variant.stock),
        0,
      );
    });

    return products;
  }

  private normalizeProductResponse<T extends Product | Product[]>(products: T): T {
    this.applyVariantPriceAndStock(products);

    return this.removeSellerPassword(products);
  }

  private validateProductAttributeValue(
    attribute: SubCategoryAttribute,
    value: string,
  ) {
    const normalizedValue = String(value).trim();

    const usage = attribute.usage ?? AttributeUsage.PRODUCT_ATTRIBUTE;

    if (usage !== AttributeUsage.PRODUCT_ATTRIBUTE) {
      throw new BadRequestException(
        `El atributo ${attribute.name} se usa para variantes`,
      );
    }

    if (attribute.type === AttributeType.SELECT) {
      const options = attribute.options ?? [];

      if (!options.includes(normalizedValue)) {
        throw new BadRequestException(
          `El valor ${normalizedValue} no es valido para ${attribute.name}`,
        );
      }
    }

    if (
      attribute.type === AttributeType.NUMBER &&
      Number.isNaN(Number(normalizedValue))
    ) {
      throw new BadRequestException(
        `El valor de ${attribute.name} debe ser numerico`,
      );
    }

    if (
      attribute.type === AttributeType.BOOLEAN &&
      !['true', 'false'].includes(normalizedValue.toLowerCase())
    ) {
      throw new BadRequestException(
        `El valor de ${attribute.name} debe ser booleano`,
      );
    }
  }

  private validateVariantOptions(
    subCategory: SubCategory,
    variants?: CreateProductDto['variants'],
  ) {
    if (!variants?.length) {
      return;
    }

    const sizeAttribute = subCategory.attributes?.find(
      attribute => attribute.usage === AttributeUsage.VARIANT_SIZE,
    );
    const colorAttribute = subCategory.attributes?.find(
      attribute => attribute.usage === AttributeUsage.VARIANT_COLOR,
    );

    for (const variant of variants) {
      const size = variant.size.trim();
      const color = variant.color?.trim();

      if (sizeAttribute?.options?.length && !sizeAttribute.options.includes(size)) {
        throw new BadRequestException(
          `El talle ${size} no es valido para esta subcategoria`,
        );
      }

      if (colorAttribute?.options?.length) {
        if (!color || !colorAttribute.options.includes(color)) {
          throw new BadRequestException(
            `El color ${color ?? ''} no es valido para esta subcategoria`,
          );
        }
      }
    }
  }

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

    this.validateVariantOptions(subCategory, createProductDto.variants);

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
      isActive: false,
      approvalStatus: ProductApprovalStatus.PENDING,
      category: subCategory.category,
      subCategory,
      seller: {
        id: createProductDto.seller,
      },
      pickupAddress,
      horarioDisponible: createProductDto.horarioDisponible,
    });

    const savedProduct = await this.productsRepository.save(product);

    if (createProductDto.variants?.length) {
      const variants = createProductDto.variants.map(variant =>
        this.productVariantRepository.create({
          size: variant.size.trim(),
          color: variant.color?.trim() || null,
          price: variant.price,
          stock: variant.stock,
          isActive: variant.isActive ?? true,
          product: savedProduct,
        }),
      );

      await this.productVariantRepository.save(variants);
    }

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
      attribute =>
        attribute.required &&
        (attribute.usage ?? AttributeUsage.PRODUCT_ATTRIBUTE) ===
          AttributeUsage.PRODUCT_ATTRIBUTE,
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

        this.validateProductAttributeValue(attribute, item.value);

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
    const products = await this.productsRepository.find({
      where: {
        isActive: true,
        approvalStatus: ProductApprovalStatus.APPROVED,
      },
      relations: {
        category: true,
        subCategory: true,
        seller: true,
        pickupAddress: true,
        media: true,
        variants: true,
        attributeValues: {
          attribute: true,
        },
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return this.normalizeProductResponse(products);
  }

  async findAllForAdmin() {
    const products = await this.productsRepository.find({
      relations: {
        category: true,
        subCategory: true,
        seller: true,
        pickupAddress: true,
        media: true,
        variants: true,
        attributeValues: {
          attribute: true,
        },
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return this.normalizeProductResponse(products);
  }

  async findOne(id: string) {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: {
        category: true,
        subCategory: true,
        seller: true,
        pickupAddress: true,
        media: true,
        variants: true,
        attributeValues: {
          attribute: true,
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return this.normalizeProductResponse(product);
  }

  async findOnePublic(id: string) {
    const product = await this.productsRepository.findOne({
      where: {
        id,
        isActive: true,
        approvalStatus: ProductApprovalStatus.APPROVED,
      },
      relations: {
        category: true,
        subCategory: true,
        seller: true,
        pickupAddress: true,
        media: true,
        variants: true,
        attributeValues: {
          attribute: true,
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return this.normalizeProductResponse(product);
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ) {
    const { seller, variants, ...rest } = updateProductDto;
    const updateData = {
      ...rest,
      ...(seller ? { seller: { id: seller } } : {}),
    };

    await this.productsRepository.update(id, updateData);

    if (variants) {
      const product = await this.productsRepository.findOne({
        where: { id },
        relations: {
          subCategory: {
            attributes: true,
          },
        },
      });

      if (!product) {
        throw new NotFoundException('Producto no encontrado');
      }

      if (!product.subCategory) {
        throw new BadRequestException('El producto no tiene subcategoria');
      }

      this.validateVariantOptions(product.subCategory, variants);

      await this.productVariantRepository.delete({
        product: { id },
      });

      if (variants.length > 0) {
        const nextVariants = variants.map(variant =>
          this.productVariantRepository.create({
            size: variant.size.trim(),
            color: variant.color?.trim() || null,
            price: variant.price,
            stock: variant.stock,
            isActive: variant.isActive ?? true,
            product,
          }),
        );

        await this.productVariantRepository.save(nextVariants);
      }
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    const product = await this.findOne(id);

    if (!product) {
      return null;
    }

    return await this.productsRepository.remove(product);
  }

  async approve(id: string) {
    const product = await this.productsRepository.findOne({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    product.approvalStatus = ProductApprovalStatus.APPROVED;
    product.isActive = true;

    await this.productsRepository.save(product);

    return this.findOne(id);
  }

  async reject(id: string) {
    const product = await this.productsRepository.findOne({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    product.approvalStatus = ProductApprovalStatus.REJECTED;
    product.isActive = false;

    await this.productsRepository.save(product);

    return this.findOne(id);
  }

  async uploadProductMedia(
    productId: string,
    files: Express.Multer.File[],
  ) {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    const mediaItems : ProductMedia[] = [];

    for (const file of files) {
      const mediaType = file.mimetype.startsWith('video/')
        ? ProductMediaType.VIDEO
        : ProductMediaType.IMAGE;

      const uploaded = await this.cloudinaryService.uploadFile(
        file,
        'buymarket/products',
        mediaType,
      );

      const media = this.productMediaRepository.create({
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        type: mediaType,
        product,
      });

      mediaItems.push(media);
    }

    return this.productMediaRepository.save(mediaItems);
  }

  async findMyProducts(userId : string) {
    const products = await this.productsRepository.find({
      where : {
        seller : {
          id : userId,
        }
      }, 
      relations : ['seller', 'pickupAddress', 'variants'],
      order : {
        createdAt : 'DESC', 
      }
    })

    return this.normalizeProductResponse(products);
  }

  async findFeatured() {
    const products = await this.productsRepository.find({
      where : {
        isActive : true,
        approvalStatus: ProductApprovalStatus.APPROVED,
        seller : {
          plan : {
            isFeatured : true
          }
        }
      }, 
      relations : {
        seller : {
          plan : true
        }, 
        category : true, 
        media : true,
        variants: true,
      }, 
      order : {
        createdAt : 'DESC'
      }
    });

    return this.normalizeProductResponse(products);
  }
}
