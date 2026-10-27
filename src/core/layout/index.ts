// Pure geometry: ChartSpec + ThemeSpec → pixel coordinates.
// Shared by the Figma renderer and the SVG preview so both look the same.

import type { ChartSpec } from '../../shared/types.ts';
import type { ThemeSpec } from '../../theme/echarts.ts';
import { computeCartesianLayout, type CartesianLayout } from './cartesian.ts';
import { frameLayout, type LegendIcon } from './common.ts';
import { computePieLayout, pieSlices, type PieLayout } from './pie.ts';
import { computeRadarLayout, type RadarLayout } from './radar.ts';

export type { CartesianLayout, PieLayout, RadarLayout };
export type { FrameLayout, LegendIcon, Rect, TextMark } from './common.ts';
export { OTHER_LABEL, sliceColor } from './pie.ts';

export type ChartLayout = CartesianLayout | PieLayout | RadarLayout;

export const legendIcon = (type: ChartSpec['type']): LegendIcon =>
  type === 'line' || type === 'radar' ? 'line' : type === 'scatter' ? 'circle' : 'rect';

export function computeLayout(spec: ChartSpec, theme: ThemeSpec): ChartLayout {
  const entries =
    spec.type === 'pie' ? pieSlices(spec).map((s) => ({ label: s.label, color: s.color })) : spec.series.map((s) => ({ label: s.name, color: s.color }));
  const frame = frameLayout(spec, theme, entries, legendIcon(spec.type));
  if (spec.type === 'pie') return computePieLayout(spec, theme, frame);
  if (spec.type === 'radar') return computeRadarLayout(spec, theme, frame);
  return computeCartesianLayout(spec, theme, frame);
}
