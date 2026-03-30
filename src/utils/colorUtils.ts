function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Converts `#RRGGBB` (or `#RGB`) to `rgba(r,g,b,a)`.
 * Returns the input unchanged if it isn't a supported hex color.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const trimmed = hex.trim();
  const normalizedAlpha = clamp01(alpha);

  const matchLong = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
  if (matchLong) {
    const value = matchLong[1];
    const r = Number.parseInt(value.slice(0, 2), 16);
    const g = Number.parseInt(value.slice(2, 4), 16);
    const b = Number.parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha})`;
  }

  const matchShort = /^#([0-9a-fA-F]{3})$/.exec(trimmed);
  if (matchShort) {
    const value = matchShort[1];
    const r = Number.parseInt(value[0] + value[0], 16);
    const g = Number.parseInt(value[1] + value[1], 16);
    const b = Number.parseInt(value[2] + value[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha})`;
  }

  return trimmed;
}

