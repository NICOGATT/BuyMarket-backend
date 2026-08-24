import { resolveDatabaseSynchronize } from './database-synchronize';

describe('resolveDatabaseSynchronize', () => {
  it.each([
    ['true', false],
    ['TRUE', false],
    ['1', false],
    [true, false],
    ['false', false],
    [undefined, false],
    ['', false],
    ['cualquier-valor', false],
  ])('en produccion con DB_SYNCHRONIZE=%p devuelve false', (value, expected) => {
    expect(
      resolveDatabaseSynchronize({ nodeEnv: 'production', dbSynchronize: value }),
    ).toBe(expected);
  });

  it('ignora mayusculas y espacios en NODE_ENV', () => {
    expect(
      resolveDatabaseSynchronize({
        nodeEnv: ' PRODUCTION ',
        dbSynchronize: 'true',
      }),
    ).toBe(false);
  });

  it('en desarrollo habilita solo con valor explicito verdadero', () => {
    expect(
      resolveDatabaseSynchronize({ nodeEnv: 'development', dbSynchronize: 'true' }),
    ).toBe(true);
    expect(
      resolveDatabaseSynchronize({ nodeEnv: 'development', dbSynchronize: true }),
    ).toBe(true);
    expect(
      resolveDatabaseSynchronize({
        nodeEnv: 'development',
        dbSynchronize: 'Yes',
      }),
    ).toBe(true);
  });

  it('en desarrollo el default es false', () => {
    expect(resolveDatabaseSynchronize({ nodeEnv: 'development' })).toBe(false);
    expect(
      resolveDatabaseSynchronize({ nodeEnv: 'development', dbSynchronize: '' }),
    ).toBe(false);
    expect(
      resolveDatabaseSynchronize({
        nodeEnv: 'development',
        dbSynchronize: 'false',
      }),
    ).toBe(false);
    expect(
      resolveDatabaseSynchronize({
        nodeEnv: 'development',
        dbSynchronize: '0',
      }),
    ).toBe(false);
  });

  it('sin NODE_ENV definido se comporta como ambiente no productivo', () => {
    expect(resolveDatabaseSynchronize({})).toBe(false);
    expect(resolveDatabaseSynchronize({ dbSynchronize: 'true' })).toBe(true);
  });

  it('en test respeta la configuracion explicita de cada prueba', () => {
    expect(resolveDatabaseSynchronize({ nodeEnv: 'test' })).toBe(false);
    expect(
      resolveDatabaseSynchronize({ nodeEnv: 'test', dbSynchronize: 'on' }),
    ).toBe(true);
  });
});
