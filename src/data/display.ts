import { isValue, type ChartSpec } from '../shared/types.ts';

/** Derived view only: never replace the source table or persisted spec with this. */
export function displaySpec(spec: ChartSpec): ChartSpec {
  const n = spec.options.topN;
  if (spec.type !== 'bar' || !spec.options.horizontal || !n.enabled) return spec;
  const series = spec.series[Math.max(0, Math.min(spec.series.length - 1, n.series))];
  const rows = spec.categories.map((label, i) => ({ label, i, value: series?.data[i] }))
    .filter((r): r is { label: string; i: number; value: number } => isValue(r.value))
    .sort((a, b) => b.value - a.value || a.i - b.i)
    .slice(0, Math.max(1, Math.floor(n.count)));
  return { ...spec, categories: rows.map(r => r.label),
    series: series ? [{ ...series, data: rows.map(r => r.value) }] : [],
    options: { ...spec.options, stack: false, topN: { ...n, enabled: false } } };
}
