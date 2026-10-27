// Number formatting for axis and value labels (no `Intl` — the Figma sandbox has none).

import type { NumberFormat } from '../shared/types.ts';

const SEPARATORS: Record<NumberFormat['separators'], [thousands: string, decimal: string]> = {
  en: [',', '.'],
  ru: [' ', ','],
  none: ['', '.'],
};

const UNITS: Record<'en' | 'ru', [number, string][]> = {
  en: [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'k'],
  ],
  ru: [
    [1e9, ' млрд'],
    [1e6, ' млн'],
    [1e3, ' тыс.'],
  ],
};

/** Digits after the point needed to show `v` (up to `max`, trailing zeros dropped). */
export function precisionOf(v: number, max = 4): number {
  const s = String(+Math.abs(v).toFixed(max));
  const dot = s.indexOf('.');
  return dot < 0 ? 0 : s.length - dot - 1;
}

/**
 * 1234.5 → "1,234.5" (en) · "1 234,5" (ru) · "1234.5" (none); compact → "1.2k" / "1,2 тыс.";
 * prefix / suffix wrap the number, the minus goes first: −$1,200 → "-$1,200".
 */
export function formatValue(v: number, f: NumberFormat): string {
  if (!Number.isFinite(v)) return '';
  let abs = Math.abs(v);
  let unit = '';
  if (f.compact) {
    for (const [k, u] of UNITS[f.separators === 'ru' ? 'ru' : 'en']) {
      if (abs >= k) {
        abs /= k;
        unit = u;
        break;
      }
    }
  }
  const decimals = f.decimals === 'auto' ? (unit ? Math.min(precisionOf(abs), 1) : precisionOf(abs)) : f.decimals;
  const fixed = abs.toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const [thousands, decimal] = SEPARATORS[f.separators] ?? SEPARATORS.en;
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  const sign = v < 0 && +fixed !== 0 ? '-' : '';
  return `${sign}${f.prefix}${grouped}${frac ? decimal + frac : ''}${unit}${f.suffix}`;
}
