// Axis math: category axis with automatic label interval (ECharts axisLabel.interval: 'auto')
// and a value axis whose number of splits follows the available length.

import { DEFAULT_FORMAT, type NumberFormat } from '../../shared/types.ts';
import { formatValue } from '../format.ts';
import { niceScale, type FixedBounds, type LinearScale } from '../scale.ts';

export interface CategoryAxis {
  count: number;
  /** distance between neighbouring categories (= band width when boundaryGap) */
  step: number;
  /** every `interval`-th label is shown (0, k, 2k, …) */
  interval: number;
  shownCount: number;
  pos(i: number): number;
  isShown(i: number): boolean;
}

/**
 * @param labelSize space one label needs along the axis (text width for a horizontal axis, line height for a vertical one)
 * @param boundaryGap true — categories sit in the middle of bands (bars); false — on the grid lines (line chart)
 */
export function categoryAxis(count: number, start: number, length: number, labelSize: number, minGap: number, boundaryGap: boolean): CategoryAxis {
  const step = boundaryGap ? length / Math.max(1, count) : count > 1 ? length / (count - 1) : length;
  const pos = boundaryGap
    ? (i: number) => start + step * (i + 0.5)
    : (i: number) => (count <= 1 ? start + length / 2 : start + i * step);
  const interval = count > 1 ? Math.max(1, Math.ceil((labelSize + minGap) / Math.max(step, 1e-6))) : 1;
  return {
    count,
    step,
    interval,
    shownCount: Math.ceil(count / interval),
    pos,
    isShown: (i) => i % interval === 0,
  };
}

export interface ValueAxis {
  scale: LinearScale;
  /** 0 at scale.min … 1 at scale.max */
  frac(v: number): number;
  ticks: { value: number; label: string }[];
}

export function valueAxis(
  min: number,
  max: number,
  length: number,
  density: number,
  maxSplit: number,
  includeZero = true,
  fixed: FixedBounds = {},
  format: NumberFormat = DEFAULT_FORMAT,
): ValueAxis {
  const split = Math.max(2, Math.min(maxSplit, Math.round(length / density)));
  const scale = niceScale(min, max, split, includeZero, fixed);
  const span = scale.max - scale.min || 1;
  return {
    scale,
    frac: (v) => (v - scale.min) / span,
    ticks: scale.ticks.map((value) => ({ value, label: formatValue(value, format) })),
  };
}
