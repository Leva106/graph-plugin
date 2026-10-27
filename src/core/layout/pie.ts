// Pie / donut: first series, categories = slices. Small slices beyond `maxSlices` merge into «Другое».
// Angles: 0 = 12 o'clock, clockwise (ECharts startAngle 90).

import { isValue, type ChartSpec, type ColorRef } from '../../shared/types.ts';
import type { ThemeSpec } from '../../theme/echarts.ts';
import { defaultColor, OTHER_COLOR } from '../../theme/palette.ts';
import { polar, type Pt } from '../path.ts';
import { formatNumber } from '../scale.ts';
import { estimateTextWidth, lineHeight } from '../text.ts';
import type { FrameLayout, TextMark } from './common.ts';

export const OTHER_LABEL = 'Другое';

export interface PieSlice {
  index: number; // category index, -1 for «Другое»
  label: string;
  value: number;
  percent: number; // 0..1
  a0: number;
  a1: number;
  color: ColorRef;
}

export interface PieLabel extends TextMark {
  line: Pt[];
  color: ColorRef;
}

export interface PieLayout {
  type: 'pie';
  frame: FrameLayout;
  cx: number;
  cy: number;
  r: number;
  r0: number;
  slices: PieSlice[];
  labels: PieLabel[];
}

export const sliceColor = (spec: ChartSpec, i: number): ColorRef => spec.categoryColors?.[i] ?? defaultColor(i);

/** Slices with values > 0, top-N by value (original order kept) + «Другое». */
export function pieSlices(spec: ChartSpec): PieSlice[] {
  const data = spec.series[0]?.data ?? [];
  const items = spec.categories
    .map((label, index) => ({ index, label, value: data[index] }))
    .filter((x): x is { index: number; label: string; value: number } => isValue(x.value) && x.value > 0);
  const max = Math.max(2, spec.options.maxSlices);
  let kept = items;
  let other = 0;
  if (items.length > max) {
    const top = new Set([...items].sort((a, b) => b.value - a.value).slice(0, max - 1).map((x) => x.index));
    kept = items.filter((x) => top.has(x.index));
    other = items.filter((x) => !top.has(x.index)).reduce((s, x) => s + x.value, 0);
  }
  const slices: PieSlice[] = kept.map((x) => ({ ...x, percent: 0, a0: 0, a1: 0, color: sliceColor(spec, x.index) }));
  if (other > 0) slices.push({ index: -1, label: OTHER_LABEL, value: other, percent: 0, a0: 0, a1: 0, color: OTHER_COLOR });
  const total = slices.reduce((s, x) => s + x.value, 0);
  let a = 0;
  for (const s of slices) {
    s.percent = total ? s.value / total : 0;
    s.a0 = a;
    a += s.percent * Math.PI * 2;
    s.a1 = a;
  }
  return slices;
}

const pieText = (s: PieSlice) => `${s.label}: ${formatNumber(Math.round(s.percent * 1000) / 10)}%`;

export function computePieLayout(spec: ChartSpec, theme: ThemeSpec, frame: FrameLayout): PieLayout {
  const o = spec.options;
  const t = theme.pie;
  const font = theme.fonts.axis.size;
  const b = frame.body;
  const slices = pieSlices(spec);
  const [l1, l2] = t.labelLine;
  const bw = b.w - 32;
  const bh = b.h - 8;
  const rMax = Math.min(bw, bh) / 2;
  let r: number;
  if (o.showLabels && slices.length) {
    const maxLabelW = slices.reduce((m, s) => Math.max(m, estimateTextWidth(pieText(s), font)), 0);
    r = Math.min(rMax * t.radius, bw / 2 - maxLabelW - l1 - l2 - 6, bh / 2 - l1 - font);
  } else {
    r = rMax * t.radiusNoLabels;
  }
  r = Math.max(16, r);
  const cx = spec.width / 2;
  const cy = b.y + b.h / 2;

  const labels: PieLabel[] = [];
  if (o.showLabels) {
    const h = lineHeight(font) + 2;
    const sides: { s: PieSlice; p0: Pt; p1: Pt; y: number; right: boolean }[][] = [[], []];
    for (const s of slices) {
      const mid = (s.a0 + s.a1) / 2;
      const right = Math.sin(mid) >= 0;
      const p1 = polar(cx, cy, r + l1, mid);
      sides[right ? 0 : 1].push({ s, p0: polar(cx, cy, r, mid), p1, y: p1.y, right });
    }
    // push overlapping labels apart vertically, then pull the column back inside the body
    for (const side of sides) {
      side.sort((a, z) => a.y - z.y);
      for (let i = 1; i < side.length; i++) side[i].y = Math.max(side[i].y, side[i - 1].y + h);
      const overflow = side.length ? side[side.length - 1].y + h / 2 - (b.y + b.h) : 0;
      if (overflow > 0) {
        side[side.length - 1].y -= overflow;
        for (let i = side.length - 2; i >= 0; i--) side[i].y = Math.min(side[i].y, side[i + 1].y - h);
      }
      for (const it of side) {
        const x2 = it.p1.x + (it.right ? l2 : -l2);
        labels.push({
          x: x2 + (it.right ? 3 : -3),
          y: it.y,
          text: pieText(it.s),
          ax: it.right ? 0 : 1,
          ay: 0.5,
          line: [it.p0, it.p1, { x: x2, y: it.y }],
          color: it.s.color,
        });
      }
    }
  }

  return { type: 'pie', frame, cx, cy, r, r0: o.donut ? r * t.donutRatio : 0, slices, labels };
}
