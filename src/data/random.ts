// Random data source. Other sources (table.ts, csv.ts, later llm.ts) produce the same shape:
// categories + raw series values; colors/names are merged in by the UI.

import { estimateTextWidth } from '../core/text.ts';

export type CategoryPreset = 'weekdays-en' | 'weekdays-ru' | 'months-en' | 'months-ru' | 'dates' | 'numbers';

export const CATEGORY_PRESETS: { id: CategoryPreset; label: string }[] = [
  { id: 'weekdays-en', label: 'Mon – Sun' },
  { id: 'weekdays-ru', label: 'Пн – Вс' },
  { id: 'months-en', label: 'Jan – Dec' },
  { id: 'months-ru', label: 'Янв – Дек' },
  { id: 'dates', label: '01.09, 02.09 …' },
  { id: 'numbers', label: '1 … N' },
];

const LISTS: Record<'weekdays-en' | 'weekdays-ru' | 'months-en' | 'months-ru', string[]> = {
  'weekdays-en': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  'weekdays-ru': ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  'months-en': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  'months-ru': ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
};

const pad2 = (v: number) => (v < 10 ? `0${v}` : String(v));

/** Consecutive days "DD.MM" starting on 1 September (no Intl). */
function dates(count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 1 + i));
    return `${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}`;
  });
}

export function makeCategories(preset: CategoryPreset, count: number): string[] {
  if (preset === 'numbers') return Array.from({ length: count }, (_, i) => String(i + 1));
  if (preset === 'dates') return dates(count);
  const list = LISTS[preset];
  return Array.from({ length: count }, (_, i) => list[i % list.length]);
}

/** mulberry32 — small deterministic PRNG so the same seed gives the same chart. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RandomParams {
  seriesCount: number;
  points: number;
  min: number;
  max: number;
  seed: number;
}

const rounder = (span: number) => (span >= 20 ? (v: number) => Math.round(v) : (v: number) => Math.round(v * 100) / 100);

/** Random walk per series, clamped to [min, max], rounded to integers when the range is large. */
export function randomSeries({ seriesCount, points, min, max, seed }: RandomParams): number[][] {
  const rand = rng(seed);
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const span = hi - lo || 1;
  const round = rounder(span);
  return Array.from({ length: seriesCount }, () => {
    let v = lo + span * (0.2 + rand() * 0.6);
    return Array.from({ length: points }, () => {
      v += (rand() - 0.5) * span * 0.35;
      v = Math.min(hi, Math.max(lo, v));
      return round(v);
    });
  });
}

/** Scatter: shared random X (0…100, sorted) and a noisy trend per series. Returns categories = X as strings. */
export function randomScatter({ seriesCount, points, min, max, seed }: RandomParams): { categories: string[]; data: number[][] } {
  const rand = rng(seed ^ 0x5eed);
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const span = hi - lo || 1;
  const round = rounder(span);
  const xs = Array.from({ length: points }, () => Math.round(rand() * 1000) / 10).sort((a, b) => a - b);
  const data = Array.from({ length: seriesCount }, () => {
    const slope = (rand() - 0.3) * 0.8;
    const base = 0.2 + rand() * 0.3;
    return xs.map((x) => round(Math.min(hi, Math.max(lo, lo + span * (base + (slope * x) / 100 + (rand() - 0.5) * 0.3)))));
  });
  return { categories: xs.map(String), data };
}

/**
 * «Точки: авто». Weekdays / months → the natural list length; dates and 1…N → as many points as fit the plot
 * width with every label shown (no thinning), within 2…90.
 */
export function autoPoints(preset: CategoryPreset, plotWidth: number, fontSize: number, minGap: number): number {
  if (preset === 'weekdays-en' || preset === 'weekdays-ru') return 7;
  if (preset === 'months-en' || preset === 'months-ru') return 12;
  for (let n = 90; n > 2; n--) {
    const labels = makeCategories(preset, n);
    const need = labels.reduce((m, c) => Math.max(m, estimateTextWidth(c, fontSize)), 0) + minGap;
    if (plotWidth / n >= need) return n;
  }
  return 2;
}

/** Points for scatter in auto mode (no labels to fit). */
export const AUTO_SCATTER_POINTS = 30;
