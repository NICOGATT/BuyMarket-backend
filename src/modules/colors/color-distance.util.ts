type LabColor = {
  l: number;
  a: number;
  b: number;
};

function rgbChannelToLinear(channel: number) {
  const normalized = channel / 255;

  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

export function hexToLab(hex: string): LabColor {
  const red = rgbChannelToLinear(Number.parseInt(hex.slice(1, 3), 16));
  const green = rgbChannelToLinear(Number.parseInt(hex.slice(3, 5), 16));
  const blue = rgbChannelToLinear(Number.parseInt(hex.slice(5, 7), 16));

  const x = (red * 0.4124 + green * 0.3576 + blue * 0.1805) / 0.95047;
  const y = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  const z = (red * 0.0193 + green * 0.1192 + blue * 0.9505) / 1.08883;

  const pivot = (value: number) =>
    value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
  const fx = pivot(x);
  const fy = pivot(y);
  const fz = pivot(z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function deltaE76(first: LabColor, second: LabColor) {
  return Math.sqrt(
    Math.pow(first.l - second.l, 2) +
      Math.pow(first.a - second.a, 2) +
      Math.pow(first.b - second.b, 2),
  );
}
