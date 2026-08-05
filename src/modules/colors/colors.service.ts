import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { deltaE76, hexToLab } from './color-distance.util';
import { DEFAULT_COLORS } from './default-colors';
import { CreateColorDto } from './dto/create-color.dto';
import { UpdateColorDto } from './dto/update-color.dto';
import { Color } from './entities/color.entity';

export interface ColorRecommendation {
  inputHex: string;
  color: Color;
}

@Injectable()
export class ColorsService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(Color)
    private readonly colorsRepository: Repository<Color>,
  ) {}

  async onApplicationBootstrap() {
    if ((await this.colorsRepository.count()) > 0) {
      return;
    }

    const colors = DEFAULT_COLORS.map((color) => ({
      ...color,
      normalizedName: this.normalizeName(color.name),
    }));

    await this.colorsRepository
      .createQueryBuilder()
      .insert()
      .into(Color)
      .values(colors)
      .orIgnore()
      .execute();
  }

  private normalizeName(name: string) {
    return name.trim().toLocaleLowerCase('es-AR');
  }

  normalizeHex(hex: string) {
    const normalizedHex = hex.trim().toUpperCase();

    if (!/^#[0-9A-F]{6}$/.test(normalizedHex)) {
      throw new BadRequestException('hex debe tener el formato #RRGGBB');
    }

    return normalizedHex;
  }

  async findByNames(names: string[]) {
    const normalizedNames = Array.from(
      new Set(names.map((name) => this.normalizeName(name)).filter(Boolean)),
    );

    if (normalizedNames.length === 0) {
      return new Map<string, Color>();
    }

    const colors = await this.colorsRepository.find({
      where: { normalizedName: In(normalizedNames) },
      select: {
        id: true,
        name: true,
        normalizedName: true,
        hex: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return new Map(colors.map((color) => [color.normalizedName, color]));
  }

  private async ensureAvailable(
    normalizedName: string,
    hex: string,
    currentId?: string,
  ) {
    const existing = await this.colorsRepository.find({
      where: [{ normalizedName }, { hex }],
      select: {
        id: true,
        normalizedName: true,
        hex: true,
      },
    });

    if (existing.some((color) => color.id !== currentId)) {
      throw new ConflictException('Ya existe un color con ese nombre o HEX');
    }
  }

  async create(createColorDto: CreateColorDto) {
    const name = createColorDto.name.trim();
    const hex = this.normalizeHex(createColorDto.hex);
    const normalizedName = this.normalizeName(name);

    await this.ensureAvailable(normalizedName, hex);

    const savedColor = await this.colorsRepository.save(
      this.colorsRepository.create({ name, normalizedName, hex }),
    );

    return this.findOne(savedColor.id);
  }

  findAll() {
    return this.colorsRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const color = await this.colorsRepository.findOne({ where: { id } });

    if (!color) {
      throw new NotFoundException('Color no encontrado');
    }

    return color;
  }

  async update(id: string, updateColorDto: UpdateColorDto) {
    const color = await this.findOne(id);
    const name = updateColorDto.name?.trim() ?? color.name;
    const hex = updateColorDto.hex
      ? this.normalizeHex(updateColorDto.hex)
      : color.hex;
    const normalizedName = this.normalizeName(name);

    await this.ensureAvailable(normalizedName, hex, id);

    Object.assign(color, { name, normalizedName, hex });

    const savedColor = await this.colorsRepository.save(color);

    return this.findOne(savedColor.id);
  }

  async remove(id: string) {
    const color = await this.findOne(id);
    await this.colorsRepository.remove(color);

    return { message: 'Color eliminado' };
  }

  async recommend(hex: string) {
    const [recommendation] = await this.recommendMany([hex]);

    return recommendation;
  }

  async recommendMany(hexes: string[]): Promise<ColorRecommendation[]> {
    if (hexes.length === 0) {
      return [];
    }

    const normalizedHexes = hexes.map((hex) => this.normalizeHex(hex));
    const colors = await this.colorsRepository.find({
      order: { name: 'ASC' },
    });

    if (colors.length === 0) {
      throw new ServiceUnavailableException(
        'No hay colores configurados para generar recomendaciones',
      );
    }

    const references = colors.map((color) => ({
      color,
      lab: hexToLab(color.hex),
    }));

    return normalizedHexes.map((inputHex) => {
      const inputLab = hexToLab(inputHex);
      let closest = references[0];
      let closestDistance = deltaE76(inputLab, closest.lab);

      for (const reference of references.slice(1)) {
        const distance = deltaE76(inputLab, reference.lab);

        if (distance < closestDistance) {
          closest = reference;
          closestDistance = distance;
        }
      }

      return { inputHex, color: closest.color };
    });
  }
}
