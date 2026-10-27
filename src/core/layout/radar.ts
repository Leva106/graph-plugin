// Radar: categories = indicators (spokes), one shared nice max, polygon rings, series polygons.

import { isValue, type ChartSpec } from '../../shared/types.ts';
import type { ThemeSpec } from '../../theme/echarts.ts';
import { polar, polygonPath, polylinePath, type Pt } from '../path.ts';
import { formatValue } from '../format.ts';
import { niceScale } from '../scale.ts';
import { estimateTextWidth, lineHeight } from '../text.ts';
import { dropOverlapping, type FrameLayout, type TextMark } from './common.ts';

export interface RadarLayout {
  type: 'radar';
  frame: FrameLayout;
  cx: number;
  cy: number;
  r: number;
  rings: string[];
  spokes: string[];
  axisLabels: TextMark[];
  series: { series: number; path: string; points: (Pt & { index: number })[] }[];
  labels: (TextMark & { series: number })[];
}

export function computeRadarLayout(spec: ChartSpec, theme: ThemeSpec, frame: FrameLayout): RadarLayout {
  const o = spec.options;
  const font = theme.fonts.axis.size;
  const gap = theme.radar.labelGap;
  const b = frame.body;
  const n = spec.categories.length;
  const maxLabelW = spec.categories.reduce((m, c) => Math.max(m, estimateTextWidth(c, font)), 0);
  const r = Math.max(
    20,
    Math.min((Math.min(b.w, b.h) / 2) * theme.radar.radius, b.h / 2 - lineHeight(font) - gap, b.w / 2 - maxLabelW - gap - 8),
  );
  const cx = spec.width / 2;
  const cy = b.y + b.h / 2;
  const angle = (i: number) => (n ? (Math.PI * 2 * i) / n : 0);

  let vMax = 0;
  for (const s of spec.series) for (const v of s.data.slice(0, n)) if (isValue(v)) vMax = Math.max(vMax, v);
  const scale = niceScale(0, vMax, theme.splitNumber, true, { max: o.axis.max });
  const radiusOf = (v: number) => (Math.min(Math.max(0, v), scale.max) / (scale.max || 1)) * r; // clamp to a user-set max

  const ring = (rr: number) => polygonPath(Array.from({ length: n }, (_, i) => polar(cx, cy, rr, angle(i))));
  const rings = n >= 3 && o.axis.grid ? scale.ticks.filter((t) => t > 0).map((t) => ring(radiusOf(t))) : [];
  const spokes = Array.from({ length: n }, (_, i) => polylinePath([{ x: cx, y: cy }, polar(cx, cy, r, angle(i))]));

  const axisLabels: TextMark[] = spec.categories.map((text, i) => {
    const a = angle(i);
    const p = polar(cx, cy, r + gap, a);
    const sin = Math.sin(a);
    const cos = Math.cos(a);
    return { x: p.x, y: p.y, text, ax: sin > 0.05 ? 0 : sin < -0.05 ? 1 : 0.5, ay: cos > 0.05 ? 1 : cos < -0.05 ? 0 : 0.5 };
  });

  const labels: (TextMark & { series: number })[] = [];
  const series = spec.series.map((s, si) => {
    const points = Array.from({ length: n }, (_, i) => {
      const v = s.data[i];
      return { ...polar(cx, cy, radiusOf(isValue(v) ? v : 0), angle(i)), index: i };
    });
    if (o.showLabels && si === spec.series.length - 1) {
      points.forEach((p, i) => {
        const v = s.data[i];
        if (isValue(v)) labels.push({ x: p.x, y: p.y - theme.valueLabelOffset, text: formatValue(v, o.format), ax: 0.5, ay: 1, series: si });
      });
    }
    return { series: si, path: polygonPath(points), points };
  });

  return {
    type: 'radar',
    frame,
    cx,
    cy,
    r,
    rings,
    spokes,
    axisLabels: dropOverlapping(axisLabels, font, 4),
    series,
    labels: dropOverlapping(labels, font),
  };
}
