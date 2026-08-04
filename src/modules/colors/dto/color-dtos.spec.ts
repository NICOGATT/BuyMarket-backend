import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateColorDto } from './create-color.dto';
import { RecommendColorDto } from './recommend-color.dto';

describe('Color DTOs', () => {
  it('normaliza un HEX valido', async () => {
    const dto = plainToInstance(RecommendColorDto, { hex: ' #aabbcc ' });

    expect(dto.hex).toBe('#AABBCC');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rechaza formatos HEX invalidos', async () => {
    const dto = plainToInstance(RecommendColorDto, { hex: '#ABC' });

    await expect(validate(dto)).resolves.toHaveLength(1);
  });

  it('exige nombre y HEX al crear', async () => {
    const dto = plainToInstance(CreateColorDto, {});
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['name', 'hex']),
    );
  });
});
