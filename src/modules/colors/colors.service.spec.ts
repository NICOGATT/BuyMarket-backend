import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';

import { DEFAULT_COLORS } from './default-colors';
import { Color } from './entities/color.entity';
import { ColorsService } from './colors.service';

type MockRepository<T extends ObjectLiteral> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

describe('ColorsService', () => {
  let service: ColorsService;
  let repository: MockRepository<Color>;
  let queryBuilder: Record<string, jest.Mock>;

  const black = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Negro',
    hex: '#000000',
  } as Color;
  const white = {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Blanco',
    hex: '#FFFFFF',
  } as Color;
  const red = {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Rojo',
    hex: '#FF0000',
  } as Color;

  beforeEach(async () => {
    queryBuilder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    repository = {
      count: jest.fn(),
      create: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ColorsService,
        {
          provide: getRepositoryToken(Color),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(ColorsService);
  });

  it('carga el catalogo base cuando la tabla esta vacia', async () => {
    repository.count?.mockResolvedValue(0);

    await service.onApplicationBootstrap();

    expect(queryBuilder.values).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Negro',
          normalizedName: 'negro',
          hex: '#000000',
        }),
      ]),
    );
    expect(queryBuilder.values.mock.calls[0][0]).toHaveLength(
      DEFAULT_COLORS.length,
    );
    expect(queryBuilder.execute).toHaveBeenCalled();
  });

  it('no ejecuta el seed cuando ya existen colores', async () => {
    repository.count?.mockResolvedValue(1);

    await service.onApplicationBootstrap();

    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('normaliza nombre y HEX al crear', async () => {
    repository.find?.mockResolvedValue([]);
    repository.findOne?.mockResolvedValue({
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Rojo oscuro',
      hex: '#AA0011',
    });
    repository.create?.mockImplementation((value) => ({
      id: '44444444-4444-4444-8444-444444444444',
      ...value,
    }));
    repository.save?.mockImplementation((value) => Promise.resolve(value));

    const result = await service.create({
      name: ' Rojo oscuro ',
      hex: '#aa0011',
    });

    expect(repository.create).toHaveBeenCalledWith({
      name: 'Rojo oscuro',
      normalizedName: 'rojo oscuro',
      hex: '#AA0011',
    });
    expect(result).toEqual(
      expect.objectContaining({ hex: '#AA0011', name: 'Rojo oscuro' }),
    );
  });

  it('rechaza nombres o HEX duplicados', async () => {
    repository.find?.mockResolvedValue([red]);

    await expect(
      service.create({ name: 'ROJO', hex: '#AA0011' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('actualiza la referencia sin modificar snapshots de variantes', async () => {
    const updated = { ...red, name: 'Rojo intenso', hex: '#EE0000' } as Color;
    repository.findOne
      ?.mockResolvedValueOnce(red)
      .mockResolvedValueOnce(updated);
    repository.find?.mockResolvedValue([]);
    repository.save?.mockImplementation((value) => Promise.resolve(value));

    const result = await service.update(red.id, {
      name: ' Rojo intenso ',
      hex: '#ee0000',
    });

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Rojo intenso',
        normalizedName: 'rojo intenso',
        hex: '#EE0000',
      }),
    );
    expect(result).toEqual(updated);
  });

  it('rechaza un HEX invalido aun fuera del controller', async () => {
    await expect(service.recommend('rojo')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('devuelve una coincidencia exacta', async () => {
    repository.find?.mockResolvedValue([black, red, white]);

    await expect(service.recommend('#ff0000')).resolves.toEqual({
      inputHex: '#FF0000',
      color: red,
    });
  });

  it('recomienda perceptualmente el color mas cercano', async () => {
    repository.find?.mockResolvedValue([black, red, white]);

    const result = await service.recommend('#F20A08');

    expect(result.color).toEqual(red);
  });

  it('usa el primer color ordenado cuando hay empate', async () => {
    const first = { ...black, id: 'first', name: 'A' } as Color;
    const second = { ...black, id: 'second', name: 'B' } as Color;
    repository.find?.mockResolvedValue([first, second]);

    const result = await service.recommend('#000000');

    expect(result.color).toEqual(first);
  });

  it('responde unavailable cuando el catalogo esta vacio', async () => {
    repository.find?.mockResolvedValue([]);

    await expect(service.recommend('#000000')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('elimina una referencia sin alterar snapshots externos', async () => {
    repository.findOne?.mockResolvedValue(red);
    repository.remove?.mockResolvedValue(red);

    await expect(service.remove(red.id)).resolves.toEqual({
      message: 'Color eliminado',
    });
    expect(repository.remove).toHaveBeenCalledWith(red);
  });
});
