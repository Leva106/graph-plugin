// Pie / donut and radar → Figma layers.
//
// Same resize model as the cartesian charts: the body group stretches with the frame, shapes (sectors, rings,
// spokes, polygons, label lines) scale, points and texts sit in SCALE anchors so they follow the data without
// distortion. A non-proportional resize turns the circle into an oval — «Обновить» refits a true circle.

import type { PieLayout, RadarLayout } from '../core/layout';
import { polylinePath, shiftPath } from '../core/path';
import { colorTokenName } from '../shared/types';
import { anchor, constrain, container, ellipse, markText, pin, stroke, vector, type Ctx } from './nodes';

/** Body group + a stretching sub-container helper, all in body-local coordinates. */
function bodyGroup(ctx: Ctx, name: string, b: { x: number; y: number; w: number; h: number }) {
  const group = container(ctx.frame, name, b.x, b.y, b.w, b.h);
  constrain(group, 'STRETCH', 'STRETCH');
  const layer = (n: string) => {
    const f = container(group, n, 0, 0, b.w, b.h);
    constrain(f, 'STRETCH', 'STRETCH');
    return f;
  };
  return { group, layer };
}

export async function renderPie(ctx: Ctx, L: PieLayout) {
  const { theme, colors } = ctx;
  const b = L.frame.body;
  const { layer } = bodyGroup(ctx, ctx.spec.options.donut ? 'Donut' : 'Pie', b);
  const slicesBox = layer('Slices');
  const cx = L.cx - b.x;
  const cy = L.cy - b.y;
  const border = await colors.paint(theme.colors.background);

  for (const s of L.slices) {
    const e = ellipse(L.r * 2, [await colors.paint(colorTokenName(s.color))]);
    slicesBox.appendChild(e);
    e.name = `Slice ${s.label}`;
    e.x = cx - L.r;
    e.y = cy - L.r;
    // Figma arcs start at 3 o'clock and go clockwise; ours start at 12 o'clock
    e.arcData = { startingAngle: s.a0 - Math.PI / 2, endingAngle: s.a1 - Math.PI / 2, innerRadius: L.r ? L.r0 / L.r : 0 };
    if (theme.pie.borderWidth && L.slices.length > 1) stroke(e, border, theme.pie.borderWidth);
    constrain(e, 'SCALE', 'SCALE');
  }

  if (L.labels.length) {
    const labelsBox = layer('Labels');
    const labelPaint = await colors.paint(theme.colors.valueLabel);
    for (const m of L.labels) {
      const line = vector(labelsBox, shiftPath(polylinePath(m.line), -b.x, -b.y), 'Label line');
      line.fills = [];
      stroke(line, await colors.paint(colorTokenName(m.color)), 1);
      constrain(line, 'SCALE', 'SCALE');
      await markText(ctx, labelsBox, m, labelPaint, -b.x, -b.y);
    }
  }
}

export async function renderRadar(ctx: Ctx, L: RadarLayout) {
  const { spec, theme, colors } = ctx;
  const o = spec.options;
  const b = L.frame.body;
  const { layer } = bodyGroup(ctx, 'Radar', b);
  const local = (d: string) => shiftPath(d, -b.x, -b.y);

  const gridBox = layer('Grid');
  const splitPaint = await colors.paint(theme.colors.splitLine);
  for (const d of L.rings) {
    const v = vector(gridBox, local(d), 'Ring');
    v.fills = [];
    stroke(v, splitPaint, 1);
    constrain(v, 'SCALE', 'SCALE');
  }
  const axisPaint = await colors.paint(theme.colors.axisLine);
  for (const d of L.spokes) {
    const v = vector(gridBox, local(d), 'Spoke');
    stroke(v, axisPaint, 1);
    constrain(v, 'SCALE', 'SCALE');
  }

  const axisText = await colors.paint(theme.colors.axisLabel);
  const labelsBox = layer('Indicators');
  for (const m of L.axisLabels) await markText(ctx, labelsBox, m, axisText, -b.x, -b.y, 'Indicator');

  const symbolFill = await colors.paint(theme.colors.symbolFill);
  const valuePaint = await colors.paint(theme.colors.valueLabel);
  for (const sl of L.series) {
    if (!sl.path) continue;
    const s = spec.series[sl.series];
    const seriesPaint = await colors.paint(colorTokenName(s.color));
    const box = layer(`Series / ${s.name}`);
    if (o.area) {
      const area = vector(box, local(sl.path), 'Area');
      area.fills = [seriesPaint];
      area.strokes = [];
      area.opacity = o.areaOpacity; // layer opacity (see cartesian Area)
      constrain(area, 'SCALE', 'SCALE');
    }
    const line = vector(box, local(sl.path), 'Line');
    line.fills = [];
    stroke(line, seriesPaint, theme.lineWidth);
    line.strokeJoin = 'ROUND';
    constrain(line, 'SCALE', 'SCALE');
    if (o.showSymbols) {
      for (const p of sl.points) {
        const e = ellipse(theme.symbolSize, [symbolFill]);
        e.name = 'Symbol';
        stroke(e, seriesPaint, theme.symbolStrokeWidth);
        pin(anchor(box, `Point ${spec.categories[p.index]}`, p.x - b.x, p.y - b.y), e, 0.5, 0.5);
      }
    }
    for (const m of L.labels) if (m.series === sl.series) await markText(ctx, box, m, valuePaint, -b.x, -b.y);
  }
}
