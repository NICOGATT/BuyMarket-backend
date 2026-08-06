const normalizeCatalogName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const aliases = (...names: string[]): Set<string> =>
  new Set(names.map(normalizeCatalogName));

const CATEGORY_ALIASES = {
  sports: aliases('Deportes'),
  babies: aliases('Bebés', 'Bebes', 'Bebé', 'Bebe'),
  computing: aliases('Computación', 'Computacion'),
  pets: aliases('Mascotas'),
  toys: aliases('Juguetes'),
  gardening: aliases('Jardinería', 'Jardineria', 'Jardinerías', 'Jardinerias'),
  bookstore: aliases('Librería', 'Libreria'),
  party: aliases('Cotillón', 'Cotillon'),
  cleaning: aliases('Limpieza'),
  decor: aliases('Deco Bazar', 'Deco y Bazar'),
  gym: aliases('Gimnasio', 'Gimnasios'),
  videogames: aliases('Videojuegos', 'Video Juegos'),
  textiles: aliases('Textiles'),
};

const SUBCATEGORY_ALIASES = {
  sports: aliases(
    'Palo de hockey',
    'Palos de hockey',
    'Bate de béisbol',
    'Bates de béisbol',
    'Carpa',
    'Carpas',
    'Silla plegable',
    'Sillas plegables',
  ),
  babies: aliases(
    'Cochecito',
    'Cochecitos',
    'Paraguas de paseo',
    'Paraguas de paseos',
    'Huevito',
    'Huevitos',
    'Butaca para auto',
    'Butacas para auto',
    'Butaca para autos',
    'Butacas para autos',
  ),
  computing: aliases(
    'Computadora de escritorio',
    'Computadoras de escritorio',
    'Computadora de escritorios',
    'Computadoras de escritorios',
    'PC gamer',
    'PCs gamer',
    'All in one',
    'Monitor',
    'Monitores',
    'Soporte para monitor',
    'Soportes para monitor',
    'Soporte para monitores',
    'Soportes para monitores',
    'CPU',
    'CPUs',
    'Gabinete',
    'Gabinetes',
    'Gabinete gamer',
    'Gabinetes gamer',
    'Silla gamer',
    'Sillas gamer',
    'Placa madre',
    'Placas madre',
    'Cooler',
    'Coolers',
    'Cooller',
    'Coollers',
    'Impresora',
    'Impresoras',
  ),
  pets: aliases(
    'Cama y cucha',
    'Camas y cuchas',
    'Rascador',
    'Rascadores',
    'Arenero',
    'Areneros',
    'Jaula',
    'Jaulas',
    'Casa y refugio',
    'Casas y refugios',
    'Pecera y acuario',
    'Peceras y acuarios',
    'Túnel',
    'Túneles',
    'Colchoneta',
    'Colchonetas',
  ),
  toys: aliases(
    'Tren',
    'Trenes',
    'Pista de auto',
    'Pistas de auto',
    'Casa de muñeca',
    'Casa de muñecas',
    'Cocinita',
    'Cocinitas',
    'Monopatín',
    'Monopatines',
    'Patineta',
    'Patinetas',
    'Piscina inflable',
    'Piscinas inflables',
    'Piscina inflble',
    'Piscinas inflbles',
  ),
  bookstore: aliases(
    'Caballete y tablero de dibujo',
    'Caballetes y tableros de dibujo',
  ),
  party: aliases(
    'Equipo para fiesta',
    'Equipos para fiesta',
    'Equipo para fiestas',
    'Equipos para fiestas',
  ),
  cleaning: aliases(
    'Cesto de basura',
    'Cestos de basura',
    'Cesto de basuras',
    'Cestos de basuras',
    'Contenedor',
    'Contenedores',
    'Separador de reciclaje',
    'Separadores de reciclaje',
    'Dispenser',
    'Dispensers',
  ),
  decor: aliases(
    'Espejo',
    'Espejos',
    'Reloj de pared',
    'Relojes de pared',
    'Perchero',
    'Percheros',
    'Estante',
    'Estantes',
    'Zapatero',
    'Zapateros',
    'Valija',
    'Valijas',
  ),
  videogames: aliases(
    'Mobiliario gamer',
    'Silla gamer',
    'Sillas gamer',
    'Escritorio',
    'Escritorios',
    'Pantalla verde',
    'Pantallas verdes',
    'Máquina arcade',
    'Máquinas arcade',
  ),
  textiles: aliases('Alfombra grande', 'Alfombras grandes'),
};

const CATEGORY_RULES = [
  [CATEGORY_ALIASES.sports, SUBCATEGORY_ALIASES.sports],
  [CATEGORY_ALIASES.babies, SUBCATEGORY_ALIASES.babies],
  [CATEGORY_ALIASES.computing, SUBCATEGORY_ALIASES.computing],
  [CATEGORY_ALIASES.pets, SUBCATEGORY_ALIASES.pets],
  [CATEGORY_ALIASES.toys, SUBCATEGORY_ALIASES.toys],
  [CATEGORY_ALIASES.bookstore, SUBCATEGORY_ALIASES.bookstore],
  [CATEGORY_ALIASES.party, SUBCATEGORY_ALIASES.party],
  [CATEGORY_ALIASES.cleaning, SUBCATEGORY_ALIASES.cleaning],
  [CATEGORY_ALIASES.decor, SUBCATEGORY_ALIASES.decor],
  [CATEGORY_ALIASES.videogames, SUBCATEGORY_ALIASES.videogames],
  [CATEGORY_ALIASES.textiles, SUBCATEGORY_ALIASES.textiles],
] as const;

export const requiresManualProductApproval = (
  categoryName: string,
  subCategoryName: string,
): boolean => {
  const category = normalizeCatalogName(categoryName);
  const subCategory = normalizeCatalogName(subCategoryName);

  if (subCategory === normalizeCatalogName('Otros')) {
    return true;
  }

  if (
    CATEGORY_ALIASES.gardening.has(category) ||
    CATEGORY_ALIASES.gym.has(category)
  ) {
    return true;
  }

  return CATEGORY_RULES.some(
    ([categories, subCategories]) =>
      categories.has(category) && subCategories.has(subCategory),
  );
};
