// Brings a spec read from `pluginData` (any older version) to the current ChartSpec shape.

import { defaultColor } from '../theme/palette.ts';
import { CHART_TYPES, DEFAULT_AXIS, DEFAULT_FORMAT, DEFAULT_OPTIONS, SPEC_VERSION, type ChartSpec, type ChartType, type Value } from './types.ts';

const toValue = (v: unknown): Value => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function migrateSpec(raw: any): ChartSpec {
  const s = raw && typeof raw === 'object' ? raw : {};
  // v1: type 'line' only, `options` = LineOptions (no stack / pie / scatter fields), data without nulls
  // v2: separate 'hbar' type → v3: 'bar' + options.horizontal
  const hbar = s.type === 'hbar';
  const type: ChartType = hbar ? 'bar' : CHART_TYPES.includes(s.type) ? s.type : 'line';
  const series = Array.isArray(s.series) ? s.series : [];
  return {
    version: SPEC_VERSION,
    type,
    structured: s.structured?.kind === type ? s.structured : undefined,
    source: s.source?.kind === 'random' || s.source?.kind === 'table' ? s.source : undefined,
    title: typeof s.title === 'string' ? s.title : '',
    width: Number(s.width) || 800,
    height: Number(s.height) || 420,
    categories: Array.isArray(s.categories) ? s.categories.map(String) : [],
    series: series.map((x: any, i: number) => ({
      name: String(x?.name ?? `Серия ${i + 1}`),
      color: x?.color?.hue ? x.color : defaultColor(i),
      data: Array.isArray(x?.data) ? x.data.map(toValue) : [],
    })),
    categoryColors: Array.isArray(s.categoryColors) ? s.categoryColors : undefined,
    options: {
      ...DEFAULT_OPTIONS,
      ...(s.options ?? {}),
      ...(hbar ? { horizontal: true } : {}),
      // nested groups added later: fill missing fields one by one
      format: { ...DEFAULT_FORMAT, ...(s.options?.format ?? {}) },
      axis: { ...DEFAULT_AXIS, ...(s.options?.axis ?? {}) },
      threshold: { ...DEFAULT_OPTIONS.threshold, ...(s.options?.threshold ?? {}) },
      topN: { ...DEFAULT_OPTIONS.topN, ...(s.options?.topN ?? {}) },
    },
    textStyles: s.textStyles ?? {},
  };
}
