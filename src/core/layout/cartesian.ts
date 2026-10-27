// Cartesian charts: line, bar (vertical or horizontal), scatter.
// Every data point is drawn; only axis labels / ticks / symbols / value labels are thinned to fit the size.

import { isValue, type ChartSpec, type NumberFormat, type Value } from '../../shared/types.ts';
import type { ThemeSpec } from '../../theme/echarts.ts';
import { areaPath, bandPath, linePath, type Pt } from '../path.ts';
import { formatValue } from '../format.ts';
import { parseNumber } from '../scale.ts';
import { estimateTextWidth, lineHeight } from '../text.ts';
import { categoryAxis, valueAxis, type CategoryAxis, type ValueAxis } from './axis.ts';
import { dropOverlapping, frameLayout, type FrameLayout, type Rect, type TextMark } from './common.ts';

export interface AxisLabel {
  pos: number; // x for the bottom axis, y for the left axis (frame coordinates)
  text: string;
}

export interface LineSeriesLayout {
  series: number;
  line: string;
  area: string | null;
  symbols: (Pt & { index: number })[];
}

export interface BarItem {
  series: number;
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DotItem {
  series: number;
  index: number;
  x: number;
  y: number;
}

export interface CartesianLayout {
  type: 'cartesian';
  chart: 'line' | 'bar' | 'scatter';
  /** bar with categories on the Y axis */
  horizontal: boolean;
  frame: FrameLayout;
  grid: Rect;
  xLabels: AxisLabel[];
  yLabels: AxisLabel[];
  xTicks: number[]; // tick marks on the bottom (category) axis, x positions
  yTicks: number[]; // tick marks on the left (category) axis, y positions
  xLine: number | null; // y of the horizontal category axis line
  yLine: number | null; // x of the vertical category axis line (horizontal bars)
  splitX: number[]; // vertical split lines (horizontal value axis)
  splitY: number[]; // horizontal split lines (vertical value axis)
  /** label thinning of the category axis, for the UI hint */
  category: { total: number; shown: number; interval: number } | null;
  lines: LineSeriesLayout[];
  bars: BarItem[];
  dots: DotItem[];
  labels: (TextMark & { series: number })[];
  /** axis titles: X centred under the labels, Y rotated −90° (reads bottom → top) centred on the plot */
  titles: { x: TextMark | null; y: TextMark | null };
  /** user-set value bounds → the plot clips the series */
  clip: boolean;
}

const at = (data: Value[], i: number): Value => (i < data.length ? data[i] : null);

/** X values of a scatter chart: numeric categories, or 1…N when some are not numbers. */
export function scatterX(categories: string[]): number[] {
  const nums = categories.map(parseNumber);
  return nums.every((v) => v !== null) ? (nums as number[]) : categories.map((_, i) => i + 1);
}

/** Min / max of plotted values (stack-aware: positive and negative stacks separately, like ECharts bars). */
function valueRange(spec: ChartSpec, count: number): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  const stack = spec.options.stack && spec.type !== 'scatter';
  for (let i = 0; i < count; i++) {
    let pos = 0;
    let neg = 0;
    for (const s of spec.series) {
      const v = at(s.data, i);
      if (!isValue(v)) continue;
      if (stack) {
        if (v >= 0 || spec.type === 'line') pos += v;
        else neg += v;
        lo = Math.min(lo, pos, neg);
        hi = Math.max(hi, pos, neg);
      } else {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
  }
  return Number.isFinite(lo) ? [lo, hi] : [0, 1];
}

export function computeCartesianLayout(spec: ChartSpec, theme: ThemeSpec, frame: FrameLayout = frameLayout(spec, theme, [], 'line')): CartesianLayout {
  const chart = spec.type as CartesianLayout['chart'];
  const o = spec.options;
  const p = theme.padding;
  const font = theme.fonts.axis.size;
  const W = spec.width;
  const b = frame.body;
  const count = spec.categories.length;
  const horizontal = chart === 'bar' && o.horizontal;

  const ax = o.axis;
  const fmt = o.format;
  const fixed = { min: ax.min, max: ax.max };
  const titleX = ax.titleX.trim();
  const titleY = ax.titleY.trim();
  const top = b.y;
  const bottom = b.y + b.h - theme.xLabelHeight - (titleX ? theme.axisTitleHeight : 0);
  const gh = Math.max(10, bottom - top);

  // ---- vertical (left) axis first: its label width sets the left inset ----
  const [vMin, vMax] = valueRange(spec, count);
  let yCat: CategoryAxis | null = null;
  let yVal: ValueAxis | null = null;
  let leftLabelW: number;
  const xs = chart === 'scatter' ? scatterX(spec.categories) : [];
  if (horizontal) {
    yCat = categoryAxis(count, top, gh, lineHeight(font), theme.minLabelGap / 2, true);
    leftLabelW = spec.categories.reduce((m, c) => Math.max(m, estimateTextWidth(c, font)), 0);
  } else {
    yVal = valueAxis(vMin, vMax, gh, theme.splitDensity.vertical, theme.splitNumber, chart !== 'scatter', fixed, fmt);
    leftLabelW = yVal.ticks.reduce((m, t) => Math.max(m, estimateTextWidth(t.label, font)), 0);
  }
  const titleW = titleY ? theme.axisTitleHeight : 0;
  const left = titleW + Math.min(Math.max(p.left, Math.ceil(leftLabelW + theme.axisLabelMargin + 12)), W * 0.4);
  const gw = Math.max(10, W - left - p.right);
  const grid: Rect = { x: left, y: top, w: gw, h: gh };

  // ---- horizontal (bottom) axis ----
  let xCat: CategoryAxis | null = null;
  let xVal: ValueAxis | null = null;
  if (horizontal) {
    xVal = valueAxis(vMin, vMax, gw, theme.splitDensity.horizontal, theme.splitNumber, true, fixed, fmt);
  } else if (chart === 'scatter') {
    xVal = valueAxis(xs.length ? Math.min(...xs) : 0, xs.length ? Math.max(...xs) : 1, gw, theme.splitDensity.horizontal, theme.splitNumber, false, {}, fmt);
  } else {
    const maxW = spec.categories.reduce((m, c) => Math.max(m, estimateTextWidth(c, font)), 0);
    xCat = categoryAxis(count, left, gw, maxW, theme.minLabelGap, chart === 'bar');
  }

  const yOf = (v: number) => grid.y + grid.h - (yVal ? yVal.frac(v) : 0) * grid.h;
  const xOf = (v: number) => grid.x + (xVal ? xVal.frac(v) : 0) * grid.w;
  const zero = (a: ValueAxis) => Math.min(Math.max(0, a.scale.min), a.scale.max);

  const L: CartesianLayout = {
    type: 'cartesian',
    chart,
    horizontal,
    frame,
    grid,
    xLabels: [],
    yLabels: [],
    xTicks: [],
    yTicks: [],
    xLine: null,
    yLine: null,
    splitX: [],
    splitY: [],
    category: null,
    lines: [],
    bars: [],
    dots: [],
    labels: [],
    titles: {
      x: titleX ? { x: grid.x + grid.w / 2, y: grid.y + grid.h + theme.xLabelHeight + 2, text: titleX, ax: 0.5, ay: 0 } : null,
      y: titleY ? { x: b.x + 4 + theme.axisTitleHeight / 2, y: grid.y + grid.h / 2, text: titleY, ax: 0.5, ay: 0.5 } : null,
    },
    clip: ax.min !== null || ax.max !== null,
  };

  // axes → labels, ticks, split lines
  if (yVal) {
    for (const t of yVal.ticks) L.yLabels.push({ pos: yOf(t.value), text: t.label });
    L.splitY = yVal.ticks.map((t) => yOf(t.value));
  }
  if (xVal) {
    for (const t of xVal.ticks) L.xLabels.push({ pos: xOf(t.value), text: t.label });
    L.splitX = xVal.ticks.map((t) => xOf(t.value));
  }
  const catTicks = (a: CategoryAxis, start: number, boundaryGap: boolean): number[] => {
    const out: number[] = [];
    for (let i = 0; i < a.count; i++) if (a.isShown(i)) out.push(boundaryGap ? start + a.step * i : a.pos(i));
    if (boundaryGap && a.count) out.push(start + a.step * a.count);
    return out;
  };
  if (xCat) {
    for (let i = 0; i < count; i++) if (xCat.isShown(i)) L.xLabels.push({ pos: xCat.pos(i), text: spec.categories[i] });
    L.xTicks = catTicks(xCat, grid.x, chart === 'bar');
    L.xLine = yOf(zero(yVal!));
    L.splitY = L.splitY.filter((y) => Math.abs(y - L.xLine!) > 0.5); // the axis line replaces that split line
    L.category = { total: count, shown: xCat.shownCount, interval: xCat.interval };
  }
  if (yCat) {
    for (let i = 0; i < count; i++) if (yCat.isShown(i)) L.yLabels.push({ pos: yCat.pos(i), text: spec.categories[i] });
    L.yTicks = catTicks(yCat, grid.y, true);
    L.yLine = xOf(zero(xVal!));
    L.splitX = L.splitX.filter((x) => Math.abs(x - L.yLine!) > 0.5);
    L.category = { total: count, shown: yCat.shownCount, interval: yCat.interval };
  }

  if (!ax.grid) {
    L.splitX = [];
    L.splitY = [];
  }
  if (!ax.ticks) {
    L.xTicks = [];
    L.yTicks = [];
  }

  const labels: (TextMark & { series: number })[] = [];
  const off = theme.valueLabelOffset;
  const num = (v: number) => formatValue(v, fmt);

  if (chart === 'line' && xCat) {
    const base = yOf(zero(yVal!));
    const acc = new Array<number>(count).fill(0);
    const denseSymbols = xCat.step < theme.symbolSize * 2.5;
    spec.series.forEach((s, si) => {
      const pts: (Pt & { index: number; value: number })[] = [];
      const lower: Pt[] = [];
      for (let i = 0; i < count; i++) {
        const raw = at(s.data, i);
        if (o.stack) {
          const v = acc[i] + (isValue(raw) ? raw : 0);
          lower.push({ x: xCat!.pos(i), y: yOf(acc[i]) });
          acc[i] = v;
          pts.push({ x: xCat!.pos(i), y: yOf(v), index: i, value: isValue(raw) ? raw : NaN });
        } else if (isValue(raw)) {
          pts.push({ x: xCat!.pos(i), y: yOf(raw), index: i, value: raw });
        }
      }
      const area = o.area && pts.length > 1 ? (o.stack ? bandPath(pts, lower, o.smooth) : areaPath(pts, o.smooth, base)) : null;
      L.lines.push({
        series: si,
        line: pts.length > 1 ? linePath(pts, o.smooth) : '', // a lone point is shown by its symbol only
        area,
        symbols: o.showSymbols ? pts.filter((q) => isValue(q.value) && (!denseSymbols || xCat!.isShown(q.index))).map(({ x, y, index }) => ({ x, y, index })) : [],
      });
      if (o.showLabels && si === spec.series.length - 1) {
        for (const q of pts) if (isValue(q.value)) labels.push({ x: q.x, y: q.y - off, text: num(q.value), ax: 0.5, ay: 1, series: si });
      }
    });
  }

  if (chart === 'bar' && (xCat || yCat)) {
    const cat = (xCat ?? yCat)!;
    const n = spec.series.length;
    const groups = o.stack ? 1 : Math.max(1, n);
    const inner = cat.step * (1 - theme.bar.categoryGap);
    const barW = Math.max(1, inner / (groups + (groups - 1) * theme.bar.seriesGap));
    const groupW = barW * groups + barW * theme.bar.seriesGap * (groups - 1);
    const valOf = horizontal ? xOf : yOf;
    const valueScale = (horizontal ? xVal : yVal)!;
    const base = zero(valueScale); // bars grow from 0, or from the nearest bound when 0 is out of range
    const totals: { i: number; pos: number; neg: number; any: boolean }[] = [];
    for (let i = 0; i < count; i++) {
      const start = cat.pos(i) - groupW / 2;
      let pos = 0;
      let neg = 0;
      let any = false;
      spec.series.forEach((s, si) => {
        const v = at(s.data, i);
        if (!isValue(v)) return;
        any = true;
        const offset = o.stack ? 0 : si * barW * (1 + theme.bar.seriesGap);
        const from = o.stack ? (v >= 0 ? pos : neg) : base;
        const to = from + v;
        if (o.stack) {
          if (v >= 0) pos = to;
          else neg = to;
        }
        const a = valOf(from);
        const z = valOf(to);
        const item: BarItem = horizontal
          ? { series: si, index: i, x: Math.min(a, z), y: start + offset, w: Math.abs(z - a), h: barW }
          : { series: si, index: i, x: start + offset, y: Math.min(a, z), w: barW, h: Math.abs(z - a) };
        L.bars.push(item);
        if (o.showLabels && !o.stack) labels.push({ ...barLabel(item, v, horizontal, off, fmt), series: si });
      });
      totals.push({ i, pos, neg, any });
    }
    if (o.showLabels && o.stack) {
      // stacked: one total per category at the end of the stack
      for (const t of totals) {
        if (!t.any) continue;
        const total = t.pos + t.neg;
        const end = total >= 0 ? t.pos : t.neg;
        const c = cat.pos(t.i);
        const e = valOf(end);
        const item: BarItem = horizontal ? { series: n - 1, index: t.i, x: Math.min(e, valOf(0)), y: c, w: Math.abs(e - valOf(0)), h: 0 } : { series: n - 1, index: t.i, x: c, y: Math.min(e, valOf(0)), w: 0, h: Math.abs(e - valOf(0)) };
        labels.push({ ...barLabel(item, total, horizontal, off, fmt), series: n - 1 });
      }
    }
  }

  if (chart === 'scatter') {
    spec.series.forEach((s, si) => {
      for (let i = 0; i < count; i++) {
        const v = at(s.data, i);
        if (!isValue(v)) continue;
        const d = { series: si, index: i, x: xOf(xs[i]), y: yOf(v) };
        L.dots.push(d);
        if (o.showLabels) labels.push({ x: d.x, y: d.y - o.symbolSize / 2 - 2, text: num(v), ax: 0.5, ay: 1, series: si });
      }
    });
  }

  L.labels = dropOverlapping(labels, font);
  return L;
}

/** Value label outside the end of a bar (above / below / right / left depending on sign and orientation). */
function barLabel(r: BarItem, v: number, horizontal: boolean, off: number, fmt: NumberFormat): TextMark {
  const text = formatValue(v, fmt);
  if (horizontal) {
    const cy = r.y + r.h / 2;
    return v >= 0 ? { x: r.x + r.w + off, y: cy, text, ax: 0, ay: 0.5 } : { x: r.x - off, y: cy, text, ax: 1, ay: 0.5 };
  }
  const cx = r.x + r.w / 2;
  return v >= 0 ? { x: cx, y: r.y - off, text, ax: 0.5, ay: 1 } : { x: cx, y: r.y + r.h + off, text, ax: 0.5, ay: 0 };
}
