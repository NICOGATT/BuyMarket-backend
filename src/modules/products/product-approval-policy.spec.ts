import { requiresManualProductApproval } from './product-approval-policy';

describe('requiresManualProductApproval', () => {
  it.each([
    ['Deportes', 'Palo de hockey'],
    ['Bebés', 'Cochecitos'],
    ['Computación', 'Computadoras de escritorio'],
    ['Mascotas', 'Camas y cuchas'],
    ['Juguetes', 'Casa de muñecas'],
    ['Librería', 'Caballetes y tableros de dibujo'],
    ['Cotillón', 'Equipo para fiestas'],
    ['Limpieza', 'Separadores de reciclaje'],
    ['Deco Bazar', 'Relojes de pared'],
    ['Videojuegos', 'Máquinas arcade'],
    ['Textiles', 'Alfombras grandes'],
  ])('requiere aprobación para %s / %s', (category, subCategory) => {
    expect(requiresManualProductApproval(category, subCategory)).toBe(true);
  });

  it.each([
    ['Jardinería', 'Macetas'],
    ['Jardinerias', 'Herramientas'],
    ['Gimnasio', 'Mancuernas'],
    ['Gimnasios', 'Bancos'],
  ])(
    'requiere aprobación para toda la categoría %s',
    (category, subCategory) => {
      expect(requiresManualProductApproval(category, subCategory)).toBe(true);
    },
  );

  it.each([
    ['Deportes', 'Otros'],
    ['Computación', ' OTROS '],
    ['Categoría futura', 'Ótros'],
  ])('requiere aprobación para Otros en %s', (category, subCategory) => {
    expect(requiresManualProductApproval(category, subCategory)).toBe(true);
  });

  it.each([
    ['COMPUTACION', 'coollers'],
    ['Juguetes', 'Piscinas inflbles'],
    ['Deco y Bazar', 'espejos'],
    ['Bebes', 'Butaca para auto'],
  ])('acepta el alias normalizado %s / %s', (category, subCategory) => {
    expect(requiresManualProductApproval(category, subCategory)).toBe(true);
  });

  it.each([
    ['Deportes', 'Pelotas'],
    ['Computación', 'Notebooks'],
    ['Mascotas', 'Alimento'],
    ['Juguetes', 'Inflables pequeños'],
    ['Hogar', 'Espejos'],
    ['Textiles', 'Alfombras pequeñas'],
    ['Otro', 'Producto'],
  ])('publica automáticamente %s / %s', (category, subCategory) => {
    expect(requiresManualProductApproval(category, subCategory)).toBe(false);
  });

  it('no usa coincidencias parciales', () => {
    expect(
      requiresManualProductApproval('Deportes', 'Fundas para sillas plegables'),
    ).toBe(false);
    expect(requiresManualProductApproval('Hogar y Jardinería', 'Macetas')).toBe(
      false,
    );
  });
});
