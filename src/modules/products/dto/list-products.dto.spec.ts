import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ListProductsDto } from './list-products.dto';

describe('ListProductsDto', () => {
  it('acepta un brandId UUID', async () => {
    const dto = plainToInstance(ListProductsDto, {
      brandId: '4f53b30d-a566-4b4e-a103-b1b3482c0849',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rechaza un brandId que no sea UUID', async () => {
    const dto = plainToInstance(ListProductsDto, {
      brandId: 'nike',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isUuid');
  });
});
