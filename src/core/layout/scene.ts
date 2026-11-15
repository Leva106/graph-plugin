import { formatValue } from '../format.ts';
import { estimateTextWidth } from '../text.ts';
import type { ChartSpec } from '../../shared/types.ts';
import type { ThemeSpec } from '../../theme/echarts.ts';
import { colorTokenName } from '../../shared/types.ts';
import { defaultColor } from '../../theme/palette.ts';
import { graphOrder, validateStructured } from '../../data/structured.ts';
import { frameLayout, markBox, type FrameLayout, type Rect, type TextMark } from './common.ts';

type PaintStyle = { fill?: string; stroke?: string; width?: number; opacity?: number };
export type SceneMark = ({ name: string } & PaintStyle) & (
  | ({ kind: 'rect' } & Rect)
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'path'; d: string }
  | ({ kind: 'text'; size: number } & TextMark)
);
export interface SceneLayout { type: 'scene'; frame: FrameLayout; marks: SceneMark[]; warnings: string[]; errors: string[] }

export function computeSceneLayout(spec: ChartSpec, theme: ThemeSpec): SceneLayout {
  const data = spec.structured;
  const groups = data?.kind === 'graph' || data?.kind === 'sankey' ? [...new Set(data.nodes.map(n => n.group).filter(Boolean))] : [];
  const F = frameLayout(spec, theme, groups.map((label, i) => ({ label, color: defaultColor(i) })), 'circle');
  const L: SceneLayout = { type: 'scene', frame: F, marks: [], warnings: [], errors: [] };
  if (!data || data.kind !== spec.type) { L.errors.push('Нет данных для выбранного типа графика.'); return L; }
  L.errors = validateStructured(data);
  if (L.errors.length) return L;
  const font = theme.fonts.axis.size;
  const body: Rect = { x: 16, y: F.body.y, w: Math.max(1, spec.width - 32), h: Math.max(1, F.body.h) };
  const color = (i: number) => colorTokenName(defaultColor(i));
  const num = (v: number) => formatValue(v, spec.options.format);
  const rect = (name: string, r: Rect, fill: string, stroke?: string, opacity = 1) => L.marks.push({ kind: 'rect', name, ...r, fill, stroke, width: 1, opacity });
  const path = (name: string, d: string, style: PaintStyle) => L.marks.push({ kind: 'path', name, d, ...style });
  const text = (name: string, value: string, x: number, y: number, ax: 0 | 0.5 | 1 = 0, ay: 0 | 0.5 | 1 = 0, fill = theme.colors.axisLabel) => L.marks.push({ kind: 'text', name, text: value, x, y, ax, ay, size: font, fill });
  const fit = (value: string, width: number) => {
    if (estimateTextWidth(value, font) <= width) return value;
    let s = value;
    while (s.length && estimateTextWidth(s + '…', font) > width) s = s.slice(0, -1);
    return s ? s + '…' : '';
  };
  const warning = (s: string) => { if (!L.warnings.includes(s)) L.warnings.push(s); };

  if (data.kind === 'heatmap') {
    const left = Math.min(body.w / 3, Math.max(28, ...data.days.map(d => estimateTextWidth(d, font) + 10)));
    const box = { x: body.x + left, y: body.y, w: Math.max(1, body.w - left), h: Math.max(1, body.h - 64) };
    const cw = box.w / data.hours.length, ch = box.h / data.days.length;
    const values = data.values.flat().filter((v): v is number => v !== null);
    const max = Math.max(0, ...values);
    const tones = ['100', '200', '300', '400', '500', '600', '700', '800'];
    data.days.forEach((d, row) => {
      text(`Day ${row}`, fit(d, left - 8), box.x - 8, box.y + (row + 0.5) * ch, 1, 0.5);
      data.hours.forEach((hour, col) => {
        const value = data.values[row][col];
        const fill = value === null ? theme.colors.background : `chart/indigo/${tones[max > 0 ? Math.min(7, Math.floor(value / max * 7)) : 0]}`;
        rect(`Cell ${d} ${hour}${value === null ? ' / missing' : ` / ${value}`}`, { x: box.x + col * cw + 0.5, y: box.y + row * ch + 0.5, w: Math.max(0.1, cw - 1), h: Math.max(0.1, ch - 1) }, fill, value === null ? theme.colors.splitLine : undefined);
        if (spec.options.showLabels && value !== null && ch > font + 4 && cw > estimateTextWidth(num(value), font) + 4) text(`Value ${row} ${col}`, num(value), box.x + (col + 0.5) * cw, box.y + (row + 0.5) * ch, 0.5, 0.5, max > 0 && value / max >= 0.55 ? 'system/graphite/0' : 'system/graphite/900');
      });
    });
    const stride = Math.max(1, Math.ceil(estimateTextWidth('00:00', font) / cw));
    data.hours.forEach((h, i) => { if (i % stride === 0) text(`Hour ${i}`, h, box.x + (i + 0.5) * cw, box.y + box.h + 6, 0.5); });
    const sw = Math.min(box.w, 192) / tones.length, sy = box.y + box.h + 32;
    tones.forEach((tone, i) => rect(`Scale ${tone}`, { x: box.x + sw * i, y: sy, w: sw, h: 8 }, `chart/indigo/${tone}`));
    text('Scale min', '0', box.x, sy + 12);
    text('Scale max', num(max), box.x + sw * tones.length, sy + 12, 1);
    if (ch < font + 4 || cw < 4) warning('Увеличьте размер графика: ячейки или подписи расположены слишком тесно.');
  }

  if (data.kind === 'graph') {
    const n = data.nodes.length, cx = body.x + body.w / 2, cy = body.y + body.h / 2, nodeR = 7;
    const maxLabel = Math.min(body.w * 0.25, Math.max(...data.nodes.map(n => estimateTextWidth(n.name, font)), 0));
    const radius = Math.max(0, Math.min(body.w / 2 - maxLabel - nodeR - 12, body.h / 2 - font * 2 - nodeR));
    const points = new Map(data.nodes.map((node, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n;
      return [node.id, { x: n === 1 ? cx : cx + radius * Math.cos(a), y: n === 1 ? cy : cy + radius * Math.sin(a) }];
    }));
    data.links.forEach((l, i) => {
      const s = points.get(l.source)!, t = points.get(l.target)!;
      const d = Math.hypot(t.x - s.x, t.y - s.y);
      if (d < nodeR * 2) { warning('Увеличьте размер графика: узлы расположены слишком тесно.'); return; }
      const ux = (t.x - s.x) / d, uy = (t.y - s.y) / d;
      const sx = s.x + ux * nodeR, sy = s.y + uy * nodeR, tx = t.x - ux * nodeR, ty = t.y - uy * nodeR;
      path(`Link ${l.source} → ${l.target}`, `M ${sx} ${sy} L ${tx} ${ty}`, { stroke: theme.colors.axisLine, width: 1 });
      if (spec.options.directed) path(`Arrow ${i}`, `M ${tx} ${ty} L ${tx - ux * 7 + uy * 3} ${ty - uy * 7 - ux * 3} L ${tx - ux * 7 - uy * 3} ${ty - uy * 7 + ux * 3} Z`, { fill: theme.colors.axisLine });
    });
    data.nodes.forEach((node, i) => {
      const p = points.get(node.id)!;
      L.marks.push({ kind: 'circle', name: `Node ${node.id} / ${node.name}`, ...p, r: nodeR, fill: color(node.group ? Math.max(0, groups.indexOf(node.group)) : 0) });
      const side = n === 1 ? 0 : Math.cos(-Math.PI / 2 + i * 2 * Math.PI / n);
      const ax = side > 0.1 ? 0 : side < -0.1 ? 1 : 0.5;
      text(`Node label ${node.id}`, fit(node.name, maxLabel), p.x + (ax === 0 ? 12 : ax === 1 ? -12 : 0), p.y + (ax === 0.5 ? (p.y <= cy ? -14 : 14) : 0), ax, ax === 0.5 ? (p.y <= cy ? 1 : 0) : 0.5);
      if (estimateTextWidth(node.name, font) > maxLabel) warning('Некоторые подписи сокращены. Увеличьте ширину графика.');
    });
    const labels = L.marks.filter((m): m is SceneMark & { kind: 'text' } => m.kind === 'text');
    labels.forEach((label, i) => {
      const a = markBox(label, font);
      if (a.x < 0 || a.y < body.y || a.x + a.w > spec.width || a.y + a.h > body.y + body.h) warning('Увеличьте размер графика: подписи не помещаются.');
      for (const other of labels.slice(0, i)) { const b = markBox(other, font); if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) warning('Подписи узлов пересекаются. Увеличьте размер графика.'); }
    });
  }

  if (data.kind === 'treemap') {
    const children = new Map<string, typeof data.items>();
    data.items.forEach(n => children.set(n.parent, [...(children.get(n.parent) ?? []), n]));
    const sums = new Map<string, number>();
    const total = (id: string): number => { if (sums.has(id)) return sums.get(id)!; const list = children.get(id); const n = list ? list.reduce((s, n) => s + total(n.id), 0) : data.items.find(n => n.id === id)?.value ?? 0; sums.set(id, n); return n; };
    const roots = children.get('') ?? [];
    const rootColors = new Map(roots.map((n, i) => [n.id, color(i)]));
    const partition = (items: typeof data.items, box: Rect, rootColor?: string) => {
      items = items.filter(n => total(n.id) > 0);
      if (!items.length || box.w <= 0 || box.h <= 0) return;
      if (items.length > 1) {
        const sum = items.reduce((s, n) => s + total(n.id), 0);
        let cut = 1, left = total(items[0].id);
        while (cut < items.length - 1 && left + total(items[cut].id) <= sum / 2) { left += total(items[cut].id); cut++; }
        const f = left / sum;
        if (box.w >= box.h) { partition(items.slice(0, cut), { ...box, w: box.w * f }, rootColor); partition(items.slice(cut), { ...box, x: box.x + box.w * f, w: box.w * (1 - f) }, rootColor); }
        else { partition(items.slice(0, cut), { ...box, h: box.h * f }, rootColor); partition(items.slice(cut), { ...box, y: box.y + box.h * f, h: box.h * (1 - f) }, rootColor); }
        return;
      }
      const node = items[0], nested = children.get(node.id), fill = rootColor ?? rootColors.get(node.id)!;
      const r = { x: box.x + 1, y: box.y + 1, w: Math.max(0.1, box.w - 2), h: Math.max(0.1, box.h - 2) };
      rect(`Tile ${node.id} / ${node.name}`, r, fill, theme.colors.background, nested ? 0.22 : 1);
      const label = fit(spec.options.showLabels ? `${node.name}: ${num(total(node.id))}` : node.name, r.w - 10);
      if (label && r.h > font + 8) text(`Tile label ${node.id}`, label, r.x + 5, r.y + 4, 0, 0, nested ? theme.colors.title : 'system/graphite/0');
      else warning('Некоторые подписи не помещаются. Увеличьте размер графика.');
      if (nested) partition(nested, { x: r.x + 3, y: r.y + font + 10, w: r.w - 6, h: r.h - font - 13 }, fill);
    };
    partition(roots, body);
  }

  if (data.kind === 'sankey') {
    const ids = data.nodes.map(n => n.id), order = graphOrder(ids, data.links)!;
    const depths = new Map(ids.map(id => [id, 0]));
    for (const id of order) for (const l of data.links.filter(l => l.source === id)) depths.set(l.target, Math.max(depths.get(l.target)!, depths.get(id)! + 1));
    const depthMax = Math.max(0, ...depths.values());
    const columns = Array.from({ length: depthMax + 1 }, (_, i) => data.nodes.filter(n => depths.get(n.id) === i));
    const weights = new Map(ids.map(id => [id, Math.max(data.links.filter(l => l.source === id).reduce((s, l) => s + l.value, 0), data.links.filter(l => l.target === id).reduce((s, l) => s + l.value, 0))]));
    const maxRows = Math.max(...columns.map(c => c.length));
    const gap = Math.min(16, body.h / Math.max(1, maxRows * 3));
    const zeroH = Math.min(10, body.h / Math.max(1, maxRows * 3));
    const scales = columns.map(c => { const sum = c.reduce((s, n) => s + weights.get(n.id)!, 0); return sum > 0 ? Math.max(0.001, body.h - gap * Math.max(0, c.length - 1) - c.filter(n => !weights.get(n.id)).length * zeroH) / sum : Infinity; });
    const k = Math.min(...scales.filter(Number.isFinite), body.h);
    const nw = 12, positions = new Map<string, Rect>();
    columns.forEach((col, ci) => {
      const heights = col.map(n => weights.get(n.id)! * k || zeroH);
      let y = body.y + (body.h - heights.reduce((s, h) => s + h, 0) - gap * Math.max(0, col.length - 1)) / 2;
      col.forEach((n, i) => { positions.set(n.id, { x: body.x + (depthMax ? ci / depthMax : 0.5) * (body.w - nw), y, w: nw, h: heights[i] }); y += heights[i] + gap; });
    });
    const out = new Map(ids.map(id => [id, 0])), incoming = new Map(ids.map(id => [id, 0]));
    const nodeColor = (id: string) => { const i = ids.indexOf(id), n = data.nodes[i]; return color(n.group ? Math.max(0, groups.indexOf(n.group)) : i); };
    data.links.forEach((l, i) => {
      const a = positions.get(l.source)!, b = positions.get(l.target)!, h = l.value * k;
      const x1 = a.x + a.w, x2 = b.x, y1 = a.y + out.get(l.source)!, y2 = b.y + incoming.get(l.target)!, bend = (x2 - x1) * 0.5;
      path(`Flow ${i} / ${l.source} → ${l.target}`, `M ${x1} ${y1} C ${x1 + bend} ${y1} ${x2 - bend} ${y2} ${x2} ${y2} L ${x2} ${y2 + h} C ${x2 - bend} ${y2 + h} ${x1 + bend} ${y1 + h} ${x1} ${y1 + h} Z`, { fill: nodeColor(l.source), opacity: 0.3 });
      out.set(l.source, out.get(l.source)! + h); incoming.set(l.target, incoming.get(l.target)! + h);
    });
    data.nodes.forEach(n => {
      const r = positions.get(n.id)!; rect(`Node ${n.id} / ${n.name}`, r, nodeColor(n.id));
      const last = depthMax > 0 && depths.get(n.id) === depthMax;
      const room = Math.min(160, depthMax ? (body.w - nw) / depthMax - nw - 12 : body.w / 2 - nw);
      const label = fit(spec.options.showLabels ? `${n.name}: ${num(weights.get(n.id)!)}` : n.name, room);
      if (label && r.h >= font) text(`Node label ${n.id}`, label, last ? r.x - 6 : r.x + r.w + 6, r.y + r.h / 2, last ? 1 : 0, 0.5);
      else warning('Некоторые подписи не помещаются. Увеличьте размер графика.');
    });
  }

  if (data.kind === 'gantt') {
    const lo = Math.min(...data.tasks.map(t => t.start)), hi = Math.max(...data.tasks.map(t => t.end));
    const left = Math.min(body.w * 0.35, Math.max(60, ...data.tasks.map(t => estimateTextWidth(t.name, font) + 12)));
    const box = { x: body.x + left, y: body.y + 30, w: Math.max(1, body.w - left - 6), h: Math.max(1, body.h - 30) };
    const x = (v: number) => box.x + (v - lo) / (hi - lo) * box.w;
    const count = Math.max(1, Math.floor(box.w / 125));
    const formatTime = (v: number) => { const d = new Date(v); const date = `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`; return hi - lo <= 2 * 86400000 ? `${date} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` : `${date}.${d.getUTCFullYear()}`; };
    for (let i = 0; i <= count; i++) {
      const time = lo + (hi - lo) * i / count, tx = x(time);
      path(`Time grid ${i}`, `M ${tx} ${box.y} L ${tx} ${box.y + box.h}`, { stroke: theme.colors.splitLine, width: 1 });
      text(`Time tick ${i}`, formatTime(time), tx, box.y - 8, i === 0 ? 0 : i === count ? 1 : 0.5, 1);
    }
    const rh = box.h / data.tasks.length;
    data.tasks.forEach((task, i) => {
      const y = box.y + i * rh;
      text(`Task label ${task.id}`, fit(task.name, left - 12), box.x - 8, y + rh / 2, 1, 0.5);
      const h = Math.max(0.1, Math.min(24, rh * 0.6));
      rect(`Task ${task.id} / ${task.name}`, { x: x(task.start), y: y + (rh - h) / 2, w: Math.max(0.1, x(task.end) - x(task.start)), h }, color(0));
    });
    if (rh < font + 4) warning('Увеличьте высоту графика: подписи задач расположены слишком тесно.');
  }
  return L;
}
