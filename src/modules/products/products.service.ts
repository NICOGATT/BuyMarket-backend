import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Product } from './entity/product.entity';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async create(createProductDto: CreateProductDto) {
    const product =
      this.productsRepository.create(createProductDto);

    return await this.productsRepository.save(product);
  }

  async findAll() {
    return await this.productsRepository.find({
      relations: ['seller'],
    });
  }

  async findOne(id: string) {
    return await this.productsRepository.findOne({
      where: { id },

      relations: ['seller'],
    });
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ) {

    await this.productsRepository.update(
      id,
      updateProductDto,
    );

    return this.findOne(id);
  }

  async remove(id: string) {
    const product = await this.findOne(id);

    if (!product) {
      return null;
    }

    return await this.productsRepository.remove(product);
  }
}