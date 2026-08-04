import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { SearchProductsDto } from './search-products.dto';

describe('SearchProductsDto', () => {
  it('recorta la consulta y usa un limite predeterminado de 10', async () => {
    const dto = plainToInstance(SearchProductsDto, { q: '  Nike roja  ' });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toEqual({ q: 'Nike roja', limit: 10 });
  });

  it.each([{}, { q: '' }, { q: '   ' }])(
    'rechaza una consulta ausente o vacia: %p',
    async (input) => {
      const dto = plainToInstance(SearchProductsDto, input);

      expect(await validate(dto)).not.toHaveLength(0);
    },
  );

  it.each([0, 51, 1.5])('rechaza el limite invalido %p', async (limit) => {
    const dto = plainToInstance(SearchProductsDto, { q: 'zapatillas', limit });

    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('transforma un limite valido recibido como texto', async () => {
    const dto = plainToInstance(SearchProductsDto, {
      q: 'zapatillas',
      limit: '25',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.limit).toBe(25);
  });
});
