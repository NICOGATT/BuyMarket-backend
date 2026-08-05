import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateProductDto } from './create-product.dto';
import { UpdateProductDto } from './update-product.dto';

const variant = {
  size: 'M',
  price: 1200,
  stock: 3,
};

describe('DTOs de variantes de producto', () => {
  it('acepta el UUID de una variante existente durante la edicion', async () => {
    const dto = plainToInstance(UpdateProductDto, {
      variants: [
        {
          ...variant,
          id: '11111111-1111-4111-8111-111111111111',
        },
        variant,
      ],
    });

    await expect(
      validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).resolves.toHaveLength(0);
  });

  it('rechaza un id de variante que no sea UUID', async () => {
    const dto = plainToInstance(UpdateProductDto, {
      variants: [{ ...variant, id: 'variante-invalida' }],
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].children?.[0].children?.[0].property).toBe('id');
  });

  it('no acepta id en variantes durante la creacion', async () => {
    const dto = plainToInstance(CreateProductDto, {
      title: 'Remera',
      description: 'Remera de algodon',
      seller: '11111111-1111-4111-8111-111111111111',
      subCategoryId: '22222222-2222-4222-8222-222222222222',
      variants: [
        {
          ...variant,
          id: '33333333-3333-4333-8333-333333333333',
        },
      ],
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.some((error) => error.property === 'variants')).toBe(true);
  });
});
