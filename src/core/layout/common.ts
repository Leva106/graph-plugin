// Frame-level layout shared by every chart type: title band, wrapped legend rows, the body left for the chart.

import type { ChartSpec, ColorRef } from '../../shared/types.ts';
import type { ThemeSpec } from '../../theme/echarts.ts';
import { estimateTextWidth } from '../text.ts';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Text placed so that point (ax, ay) of its box — 0 = left/top, 0.5 = centre, 1 = right/bottom — is at x, y. */
export interface TextMark {
  x: number;
  y: number;
  text: string;
  ax: 0 | 0.5 | 1;
  ay: 0 | 0.5 | 1;
}

export type LegendIcon = 'line' | 'rect' | 'circle';

export interface LegendItem {
  label: string;
  color: ColorRef;
  x: number; // left edge of the icon
  width: number; // estimated (icon + gap + text)
}

export interface LegendRow {
  y: number; // vertical centre
  width: number;
  items: LegendItem[];
}

export interface FrameLayout {
  width: number;
  height: number;
  titleY: number;
  /** area between title and legend */
  body: Rect;
  legend: { icon: LegendIcon; top: number; rows: LegendRow[] } | null;
}

export function frameLayout(spec: ChartSpec, theme: ThemeSpec, entries: { label: string; color: ColorRef }[], icon: LegendIcon): FrameLayout {
  const { width: W, height: H, options: o } = spec;
  const compact = spec.type === 'line' && !o.axis.showX && !o.axis.showY && !o.showTitle && !o.showLegend;
  const p = compact ? { top: 8, bottom: 8 } : theme.padding;
  const lg = theme.legend;
  const top = p.top + (o.showTitle && spec.title ? theme.titleHeight : 0);

  const rows: LegendRow[] = [];
  if (o.showLegend && entries.length) {
    const maxW = Math.max(40, W - lg.sidePadding * 2);
    let cur: LegendItem[] = [];
    let curW = 0;
    const flush = () => {
      rows.push({ y: 0, width: curW, items: cur });
      cur = [];
      curW = 0;
    };
    for (const e of entries) {
      const w = lg.itemWidth + lg.textGap + estimateTextWidth(e.label, theme.fonts.legend.size);
      if (cur.length && curW + lg.itemGap + w > maxW) flush();
      const x = cur.length ? curW + lg.itemGap : 0;
      cur.push({ label: e.label, color: e.color, x, width: w });
      curW = x + w;
    }
    flush();
  }

  const legendTop = H - p.bottom - rows.length * lg.rowHeight;
  rows.forEach((row, r) => {
    row.y = legendTop + lg.rowHeight * (r + 0.5);
    const x0 = (W - row.width) / 2;
    for (const it of row.items) it.x += x0;
  });
  const bottom = rows.length ? legendTop - lg.marginTop : H - p.bottom;

  return {
    width: W,
    height: H,
    titleY: p.top,
    body: { x: 0, y: top, w: W, h: Math.max(10, bottom - top) },
    legend: rows.length ? { icon, top: legendTop, rows } : null,
  };
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Estimated bounding box of a text mark. */
export function markBox(m: TextMark, fontSize: number): Box {
  const w = estimateTextWidth(m.text, fontSize);
  const h = fontSize * 1.2;
  return { x: m.x - m.ax * w, y: m.y - m.ay * h, w, h };
}

/** Greedy label collision removal (keeps the first of overlapping marks, left → right). */
export function dropOverlapping<T extends TextMark>(marks: T[], fontSize: number, gap = 2): T[] {
  const items = marks.map((m) => ({ m, b: markBox(m, fontSize) })).sort((a, b) => a.b.x - b.b.x);
  const maxW = items.reduce((s, it) => Math.max(s, it.b.w), 0);
  const kept: typeof items = [];
  for (const it of items) {
    let hit = false;
    for (let k = kept.length - 1; k >= 0; k--) {
      const o = kept[k].b;
      if (o.x + maxW + gap < it.b.x) break; // sorted by x: nothing earlier can reach
      if (o.x < it.b.x + it.b.w + gap && it.b.x < o.x + o.w + gap && o.y < it.b.y + it.b.h && it.b.y < o.y + o.h) {
        hit = true;
        break;
      }
    }
    if (!hit) kept.push(it);
  }
  return kept.map((it) => it.m);
}
