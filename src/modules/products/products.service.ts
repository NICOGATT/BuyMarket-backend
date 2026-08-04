import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';

import { Product, ProductApprovalStatus } from './entity/product.entity';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Category } from '../categories/entities/category.entity';
import {
  ProductMedia,
  ProductMediaType,
} from './product-media/entities/product-media.entity';
import { ProductAttributeValue } from './entity/product-attributes-value.entity';
import { ProductVariantAttributeValue } from './entity/product-variant-attribute-value.entity';
import { ProductVariant } from './entity/product-variant.entity';
import { SubCategory } from '../subcategoria/entities/subcategoria.entity';
import {
  AttributeAppliesTo,
  AttributeType,
  AttributeUsage,
  SubCategoryAttribute,
} from '../subcategoria/subcategoria-attributes/entities/subcategoria-attribute.entity';
import { normalizeSubCategoryAttributesAppliesTo } from '../subcategoria/subcategoria-attributes/attribute-applies-to.util';
import { UserAddress } from '../user-address/entities/user-address.entity';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { Brand } from '../brands/entities/brand.entity';
import { ProductResult } from './dto/product-result.dto';
import { ColorsService } from '../colors/colors.service';

type ProductSearchRow = Omit<ProductResult, 'stock' | 'price' | 'currency'> & {
  stock: number | string;
  price: number | string;
};

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(ProductMedia)
    private readonly productMediaRepository: Repository<ProductMedia>,
    @InjectRepository(ProductAttributeValue)
    private readonly productAttributeValueRepository: Repository<ProductAttributeValue>,
    @InjectRepository(ProductVariant)
    private readonly productVariantRepository: Repository<ProductVariant>,
    @InjectRepository(ProductVariantAttributeValue)
    private readonly productVariantAttributeValueRepository: Repository<ProductVariantAttributeValue>,
    @InjectRepository(SubCategory)
    private readonly subCategoryRepository: Repository<SubCategory>,
    @InjectRepository(UserAddress)
    private readonly userAddressRepository: Repository<UserAddress>,
    @InjectRepository(Brand)
    private readonly brandsRepository: Repository<Brand>,

    private readonly cloudinaryService: CloudinaryService,
    private readonly colorsService: ColorsService,
  ) {}

  private removeSellerPassword<T extends Product | Product[]>(products: T): T {
    const productList = Array.isArray(products) ? products : [products];

    productList.forEach((product) => {
      if (product.seller) {
        delete (product.seller as { password?: string }).password;
      }
    });

    return products;
  }

  private applyVariantPriceAndStock<T extends Product | Product[]>(
    products: T,
  ): T {
    const productList = Array.isArray(products) ? products : [products];

    productList.forEach((product) => {
      const activeVariants = (product.variants ?? []).filter(
        (variant) => variant.isActive,
      );

      if (activeVariants.length === 0) {
        return;
      }

      product.price = Math.min(
        ...activeVariants.map((variant) => Number(variant.price)),
      );
      product.stock = activeVariants.reduce(
        (total, variant) => total + Number(variant.stock),
        0,
      );
    });

    return products;
  }

  private normalizeProductResponse<T extends Product | Product[]>(
    products: T,
  ): T {
    this.applyVariantPriceAndStock(products);
    this.normalizeVariantAttributes(products);

    return this.removeSellerPassword(products);
  }

  private normalizeVariantAttributes<T extends Product | Product[]>(
    products: T,
  ): T {
    const productList = Array.isArray(products) ? products : [products];

    productList.forEach((product) => {
      (product.variants ?? []).forEach((variant) => {
        const attributes = (variant.attributes ?? []).map((value) => ({
          id: value.id,
          attributeId: value.attribute?.id,
          name: value.attribute?.name,
          type: value.attribute?.type,
          value: value.value,
        }));

        (variant as unknown as { attributes: typeof attributes }).attributes =
          attributes;
      });
    });

    return products;
  }

  private validateAttributeValueType(
    attribute: SubCategoryAttribute,
    value: string,
  ) {
    const normalizedValue = String(value).trim();

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

  private validateProductAttributeValue(
    attribute: SubCategoryAttribute,
    value: string,
  ) {
    if (attribute.appliesTo !== AttributeAppliesTo.PRODUCT) {
      throw new BadRequestException(
        `El atributo ${attribute.name} se usa para variantes`,
      );
    }

    this.validateAttributeValueType(attribute, value);
  }

  private validateVariantAttributeValue(
    attribute: SubCategoryAttribute,
    value: string,
  ) {
    if (attribute.appliesTo !== AttributeAppliesTo.VARIANT) {
      throw new BadRequestException(
        `El atributo ${attribute.name} no se usa para variantes`,
      );
    }

    this.validateAttributeValueType(attribute, value);
  }

  private validateRequiredVariantAttributes(
    subCategory: SubCategory,
    variant: NonNullable<CreateProductDto['variants']>[number],
  ) {
    const sentAttributes = variant.attributes ?? [];
    const requiredAttributes = subCategory.attributes.filter(
      (attribute) =>
        attribute.required &&
        attribute.appliesTo === AttributeAppliesTo.VARIANT &&
        attribute.usage !== AttributeUsage.VARIANT_SIZE &&
        attribute.usage !== AttributeUsage.VARIANT_COLOR,
    );

    for (const requiredAttribute of requiredAttributes) {
      const exists = sentAttributes.some(
        (item) => item.attributeId === requiredAttribute.id,
      );

      if (!exists) {
        throw new BadRequestException(
          `El atributo ${requiredAttribute.name} es obligatorio para la variante ${variant.size}`,
        );
      }
    }
  }

  private buildVariantAttributeValues(
    subCategory: SubCategory,
    variant: NonNullable<CreateProductDto['variants']>[number],
    savedVariant: ProductVariant,
  ) {
    return (variant.attributes ?? []).map((item) => {
      const attribute = subCategory.attributes.find(
        (attr) => attr.id === item.attributeId,
      );

      if (!attribute) {
        throw new BadRequestException(
          `El atributo ${item.attributeId} no pertenece a esta subcategorÃ­a`,
        );
      }

      this.validateVariantAttributeValue(attribute, item.value);

      return this.productVariantAttributeValueRepository.create({
        value: item.value,
        variant: savedVariant,
        attribute,
      });
    });
  }

  private validateVariantOptions(
    subCategory: SubCategory,
    variants?: CreateProductDto['variants'],
  ) {
    if (!variants?.length) {
      return;
    }

    const sizeAttribute = subCategory.attributes?.find(
      (attribute) => attribute.usage === AttributeUsage.VARIANT_SIZE,
    );
    for (const variant of variants) {
      const size = variant.size.trim();

      if (
        sizeAttribute?.options?.length &&
        !sizeAttribute.options.includes(size)
      ) {
        throw new BadRequestException(
          `El talle ${size} no es valido para esta subcategoria`,
        );
      }
    }
  }

  private async normalizeVariantColors(
    variants?: CreateProductDto['variants'],
  ): Promise<CreateProductDto['variants']> {
    if (variants === undefined) {
      return undefined;
    }

    const variantsWithHex = variants.filter((variant) => variant.colorHex);
    const recommendations = await this.colorsService.recommendMany(
      variantsWithHex.map((variant) => variant.colorHex!),
    );
    let recommendationIndex = 0;

    return variants.map((variant) => {
      if (variant.colorHex) {
        const recommendation = recommendations[recommendationIndex++];

        return {
          ...variant,
          color: recommendation.color.name,
          colorHex: recommendation.inputHex,
        };
      }

      return {
        ...variant,
        color: variant.color?.trim() || undefined,
        colorHex: undefined,
      };
    });
  }

  private resolveProductPriceAndStock(
    price?: number,
    stock?: number,
    variants?: CreateProductDto['variants'],
  ) {
    if (variants?.length) {
      const activeVariants = variants.filter(
        (variant) => variant.isActive !== false,
      );

      if (activeVariants.length === 0) {
        throw new BadRequestException(
          'El producto debe tener al menos una variante activa',
        );
      }

      return {
        price: Math.min(...activeVariants.map((variant) => variant.price)),
        stock: activeVariants.reduce(
          (total, variant) => total + variant.stock,
          0,
        ),
      };
    }

    if (price === undefined || stock === undefined) {
      throw new BadRequestException(
        'El precio y el stock son obligatorios cuando el producto no tiene variantes',
      );
    }

    return { price, stock };
  }

  async create(createProductDto: CreateProductDto) {
    let pickupAddress: UserAddress | null = null;
    let brand: Brand | null = null;
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
      throw new NotFoundException('SubcategorÃ­a no encontrada');
    }

    if (createProductDto.brandId) {
      brand = await this.brandsRepository.findOne({
        where: { id: createProductDto.brandId },
      });

      if (!brand) {
        throw new NotFoundException('Marca no encontrada');
      }
    }
    subCategory.attributes = normalizeSubCategoryAttributesAppliesTo(
      subCategory.attributes,
    );

    const normalizedVariants = await this.normalizeVariantColors(
      createProductDto.variants,
    );
    this.validateVariantOptions(subCategory, normalizedVariants);
    const productTotals = this.resolveProductPriceAndStock(
      createProductDto.price,
      createProductDto.stock,
      normalizedVariants,
    );

    if (createProductDto.pickupAddressId) {
      pickupAddress = await this.userAddressRepository.findOne({
        where: {
          id: createProductDto.pickupAddressId,
          user: {
            id: createProductDto.seller,
          },
        },
      });
      if (!pickupAddress) {
        throw new BadRequestException(
          'La direcciÃ³n no existe o no pertenece al usuario',
        );
      }
    }
    const product = this.productsRepository.create({
      title: createProductDto.title,
      description: createProductDto.description,
      price: productTotals.price,
      stock: productTotals.stock,
      isActive: false,
      approvalStatus: ProductApprovalStatus.PENDING,
      category: subCategory.category,
      subCategory,
      brand,
      seller: {
        id: createProductDto.seller,
      },
      pickupAddress,
      horarioDisponible: createProductDto.horarioDisponible,
    });

    const savedProduct = await this.productsRepository.save(product);

    if (normalizedVariants?.length) {
      for (const variant of normalizedVariants) {
        this.validateRequiredVariantAttributes(subCategory, variant);

        const variantEntity = this.productVariantRepository.create({
          size: variant.size.trim(),
          color: variant.color?.trim() || null,
          colorHex: variant.colorHex?.trim() || null,
          price: variant.price,
          stock: variant.stock,
          isActive: variant.isActive ?? true,
          product: savedProduct,
        });

        const savedVariant =
          await this.productVariantRepository.save(variantEntity);
        const attributeValues = this.buildVariantAttributeValues(
          subCategory,
          variant,
          savedVariant,
        );

        if (attributeValues.length > 0) {
          await this.productVariantAttributeValueRepository.save(
            attributeValues,
          );
        }
      }
    }

    console.log('MEDIA IDS:', createProductDto.mediaIds);
    // Vincular medias subidas previamente
    if (createProductDto.mediaIds?.length) {
      const media = await this.productMediaRepository.findBy({
        id: In(createProductDto.mediaIds),
      });

      media.forEach((item) => {
        item.product = savedProduct;
      });

      await this.productMediaRepository.save(media);
    }

    const sentAttributes = createProductDto.attributes ?? [];

    const requiredAttributes = subCategory.attributes.filter(
      (attribute) =>
        attribute.required &&
        attribute.appliesTo === AttributeAppliesTo.PRODUCT,
    );

    for (const requiredAttribute of requiredAttributes) {
      const exists = sentAttributes.some(
        (item) => item.attributeId === requiredAttribute.id,
      );

      if (!exists) {
        throw new BadRequestException(
          `El atributo ${requiredAttribute.name} es obligatorio`,
        );
      }
    }

    if (sentAttributes.length > 0) {
      const values = sentAttributes.map((item) => {
        const attribute = subCategory.attributes.find(
          (attr) => attr.id === item.attributeId,
        );

        if (!attribute) {
          throw new BadRequestException(
            `El atributo ${item.attributeId} no pertenece a esta subcategorÃ­a`,
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

  async findAll(brandId?: string) {
    const products = await this.productsRepository.find({
      where: {
        isActive: true,
        approvalStatus: ProductApprovalStatus.APPROVED,
        ...(brandId ? { brand: { id: brandId } } : {}),
      },
      relations: {
        category: true,
        subCategory: true,
        brand: true,
        seller: true,
        pickupAddress: true,
        media: true,
        variants: {
          attributes: {
            attribute: true,
          },
        },
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

  async search(q: string, limit = 10): Promise<ProductResult[]> {
    const terms = q
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (terms.length === 0) {
      throw new BadRequestException('La busqueda no puede estar vacia');
    }

    const query = this.productsRepository
      .createQueryBuilder('product')
      .leftJoin('product.brand', 'brand')
      .leftJoin('product.variants', 'variant')
      .select('product.id', 'productId')
      .addSelect('variant.id', 'variantId')
      .addSelect('product.title', 'name')
      .addSelect('brand.name', 'brand')
      .addSelect('variant.color', 'color')
      .addSelect('variant.size', 'size')
      .addSelect('COALESCE(variant.stock, product.stock)', 'stock')
      .addSelect('COALESCE(variant.price, product.price)', 'price')
      .where('product.isActive = :isActive', { isActive: true })
      .andWhere('product.approvalStatus = :approvalStatus', {
        approvalStatus: ProductApprovalStatus.APPROVED,
      })
      .andWhere(
        new Brackets((availabilityQuery) => {
          availabilityQuery
            .where('variant.id IS NULL AND product.stock > 0')
            .orWhere(
              'variant.id IS NOT NULL AND variant.isActive = :variantIsActive AND variant.stock > 0',
              { variantIsActive: true },
            );
        }),
      );

    terms.forEach((term, index) => {
      const parameterName = `searchTerm${index}`;
      const escapedTerm = term.replace(/[\\%_]/g, '\\$&');
      const pattern = `%${escapedTerm}%`;

      query.andWhere(
        new Brackets((termQuery) => {
          termQuery
            .where(
              `product.title ILIKE :${parameterName} ESCAPE '\\'`,
              { [parameterName]: pattern },
            )
            .orWhere(
              `COALESCE(brand.name, '') ILIKE :${parameterName} ESCAPE '\\'`,
            )
            .orWhere(
              `COALESCE(variant.color, '') ILIKE :${parameterName} ESCAPE '\\'`,
            )
            .orWhere(
              `COALESCE(variant.size, '') ILIKE :${parameterName} ESCAPE '\\'`,
            );
        }),
      );
    });

    const rows = await query
      .orderBy('product.createdAt', 'DESC')
      .addOrderBy('variant.createdAt', 'ASC')
      .limit(limit)
      .getRawMany<ProductSearchRow>();

    return rows.map((row) => ({
      productId: row.productId,
      variantId: row.variantId ?? null,
      name: row.name,
      brand: row.brand ?? null,
      color: row.color ?? null,
      size: row.size ?? null,
      stock: Number(row.stock),
      price: Number(row.price),
      currency: 'ARS',
    }));
  }

  async findAllForAdmin() {
    const products = await this.productsRepository.find({
      relations: {
        category: true,
        subCategory: true,
        brand: true,
        seller: true,
        pickupAddress: true,
        media: true,
        variants: {
          attributes: {
            attribute: true,
          },
        },
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
        brand: true,
        seller: true,
        pickupAddress: true,
        media: true,
        variants: {
          attributes: {
            attribute: true,
          },
        },
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
        brand: true,
        seller: true,
        pickupAddress: true,
        media: true,
        variants: {
          attributes: {
            attribute: true,
          },
        },
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

  async update(id: string, updateProductDto: UpdateProductDto) {
    const {
      seller,
      variants,
      attributes,
      mediaIds,
      subCategoryId,
      pickupAddressId,
      brandId,
      price,
      stock,
      ...rest
    } = updateProductDto;
    const normalizedVariants = await this.normalizeVariantColors(variants);
    const productTotals =
      normalizedVariants === undefined
        ? {
            ...(price !== undefined ? { price } : {}),
            ...(stock !== undefined ? { stock } : {}),
          }
        : this.resolveProductPriceAndStock(price, stock, normalizedVariants);
    const updateData = {
      ...rest,
      ...productTotals,
      ...(seller ? { seller: { id: seller } } : {}),
      ...(subCategoryId ? { subCategory: { id: subCategoryId } } : {}),
      ...(pickupAddressId ? { pickupAddress: { id: pickupAddressId } } : {}),
    };

    if (brandId !== undefined) {
      if (brandId === null) {
        Object.assign(updateData, { brand: null });
      } else {
        const brand = await this.brandsRepository.findOne({
          where: { id: brandId },
        });

        if (!brand) {
          throw new NotFoundException('Marca no encontrada');
        }

        Object.assign(updateData, { brand });
      }
    }

    let productWithSubCategory: Product | null = null;

    if (normalizedVariants !== undefined) {
      productWithSubCategory = await this.productsRepository.findOne({
        where: { id },
        relations: {
          subCategory: {
            attributes: true,
          },
        },
      });

      if (!productWithSubCategory) {
        throw new NotFoundException('Producto no encontrado');
      }

      if (!productWithSubCategory.subCategory) {
        throw new BadRequestException('El producto no tiene subcategoria');
      }
      productWithSubCategory.subCategory.attributes =
        normalizeSubCategoryAttributesAppliesTo(
          productWithSubCategory.subCategory.attributes,
        );

      this.validateVariantOptions(
        productWithSubCategory.subCategory,
        normalizedVariants,
      );

      for (const variant of normalizedVariants) {
        this.validateRequiredVariantAttributes(
          productWithSubCategory.subCategory,
          variant,
        );
      }
    }

    await this.productsRepository.update(id, updateData);

    if (normalizedVariants !== undefined && productWithSubCategory) {
      await this.productVariantRepository.delete({
        product: { id },
      });

      if (normalizedVariants.length > 0) {
        for (const variant of normalizedVariants) {
          const nextVariant = this.productVariantRepository.create({
            size: variant.size.trim(),
            color: variant.color?.trim() || null,
            colorHex: variant.colorHex?.trim() || null,
            price: variant.price,
            stock: variant.stock,
            isActive: variant.isActive ?? true,
            product: productWithSubCategory,
          });

          const savedVariant =
            await this.productVariantRepository.save(nextVariant);
          const attributeValues = this.buildVariantAttributeValues(
            productWithSubCategory.subCategory!,
            variant,
            savedVariant,
          );

          if (attributeValues.length > 0) {
            await this.productVariantAttributeValueRepository.save(
              attributeValues,
            );
          }
        }
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

  async uploadProductMedia(productId: string, files: Express.Multer.File[]) {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

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

  async findMyProducts(userId: string) {
    const products = await this.productsRepository.find({
      where: {
        seller: {
          id: userId,
        },
      },
      relations: {
        seller: true,
        brand: true,
        pickupAddress: true,
        variants: {
          attributes: {
            attribute: true,
          },
        },
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return this.normalizeProductResponse(products);
  }

  async findFeatured() {
    const products = await this.productsRepository.find({
      where: {
        isActive: true,
        approvalStatus: ProductApprovalStatus.APPROVED,
        seller: {
          plan: {
            isFeatured: true,
          },
        },
      },
      relations: {
        seller: {
          plan: true,
        },
        category: true,
        brand: true,
        media: true,
        variants: {
          attributes: {
            attribute: true,
          },
        },
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return this.normalizeProductResponse(products);
  }
}
