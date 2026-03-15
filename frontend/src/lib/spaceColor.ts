/**
 * Deterministic color generation from a space name.
 * Uses a simple hash to pick a hue, with fixed saturation/lightness
 * that looks good on both light and dark backgrounds.
 */

const PRESET_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f43f5e", // rose
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#a855f7", // purple
];

export const COLOR_PALETTE = PRESET_COLORS;

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Returns the effective color for a space (custom or generated from name). */
export function getSpaceColor(
  name: string,
  customColor?: string | null,
): string {
  if (customColor) return customColor;
  return PRESET_COLORS[hashString(name) % PRESET_COLORS.length];
}
