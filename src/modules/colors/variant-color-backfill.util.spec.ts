import {
  BackfillColor,
  resolveVariantCatalogColor,
} from './variant-color-backfill.util';

describe('resolveVariantCatalogColor', () => {
  const colors: BackfillColor[] = [
    {
      id: 'black',
      name: 'Negro',
      normalizedName: 'negro',
      hex: '#000000',
    },
    {
      id: 'red',
      name: 'Rojo',
      normalizedName: 'rojo',
      hex: '#FF0000',
    },
  ];

  it('resuelve el color mas cercano por HEX', () => {
    expect(resolveVariantCatalogColor({ colorHex: '#F20A08' }, colors)).toEqual(
      colors[1],
    );
  });

  it('usa el nombre normalizado cuando no hay HEX', () => {
    expect(resolveVariantCatalogColor({ color: ' ROJO ' }, colors)).toEqual(
      colors[1],
    );
  });

  it('no modifica una variante que ya tiene relacion', () => {
    expect(
      resolveVariantCatalogColor(
        { colorHex: '#FF0000', catalogColorId: 'existing' },
        colors,
      ),
    ).toBeNull();
  });

  it('deja sin resolver datos desconocidos', () => {
    expect(
      resolveVariantCatalogColor({ color: 'inexistente' }, colors),
    ).toBeNull();
  });
});
