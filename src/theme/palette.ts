import type { ColorRef } from '../shared/types.ts';
import { CHART_HUES, COLOR_TOKENS } from './tokens.generated.ts';

export { CHART_HUES };
export const TONES = ['300', '400', '500', '600', '700'] as const;

/** DS equivalents of the ECharts default palette order (blue, green, yellow, red, light-blue, …). */
const ORDER = ['indigo', 'grass', 'yellow', 'tomato', 'navy', 'jade', 'mandarine', 'violet', 'pink', 'teal', 'gold', 'ruby'];

export function defaultColor(index: number): ColorRef {
  return { hue: ORDER[index % ORDER.length], tone: '500' };
}

/** Color of the merged «Другое» pie slice. */
export const OTHER_COLOR: ColorRef = { hue: 'graphite', tone: '400' };

/** Hex for previews / fallbacks. */
export function tokenHex(name: string, mode: 'light' | 'dark' = 'light'): string {
  return COLOR_TOKENS[name]?.[mode] ?? '#999999';
}
