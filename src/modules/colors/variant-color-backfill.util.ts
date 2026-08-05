import { deltaE76, hexToLab } from './color-distance.util';

export interface BackfillColor {
  id: string;
  name: string;
  normalizedName: string;
  hex: string;
}

export interface BackfillVariant {
  color?: string | null;
  colorHex?: string | null;
  catalogColorId?: string | null;
}

export function resolveVariantCatalogColor(
  variant: BackfillVariant,
  colors: BackfillColor[],
) {
  if (variant.catalogColorId || colors.length === 0) {
    return null;
  }

  const normalizedHex = variant.colorHex?.trim().toUpperCase();

  if (normalizedHex && /^#[0-9A-F]{6}$/.test(normalizedHex)) {
    const inputLab = hexToLab(normalizedHex);
    let closest = colors[0];
    let closestDistance = deltaE76(inputLab, hexToLab(closest.hex));

    for (const color of colors.slice(1)) {
      const distance = deltaE76(inputLab, hexToLab(color.hex));

      if (distance < closestDistance) {
        closest = color;
        closestDistance = distance;
      }
    }

    return closest;
  }

  const normalizedName = variant.color?.trim().toLocaleLowerCase('es-AR');

  return normalizedName
    ? (colors.find((color) => color.normalizedName === normalizedName) ?? null)
    : null;
}
