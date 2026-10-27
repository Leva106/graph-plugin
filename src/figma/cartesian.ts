// Line / bar / scatter → Figma layers.
//
//   Plot (stretches both ways): Grid split lines, Axis line, Series / {name} (area, line, points, bars, labels)
//   Axis Y (left strip, stretches vertically) · Axis X (bottom strip, stretches horizontally)
// Vectors and bars scale; points and labels sit in tiny SCALE anchors whose content is centred,
// so circles and text keep their size while following the data.

import type { CartesianLayout } from '../core/layout';
import { shiftPath } from '../core/path';
import { colorTokenName } from '../shared/types';
import { anchor, constrain, container, ellipse, markText, pin, stroke, vector, type Ctx } from './nodes';
import { createText } from './textStyles';

export async function renderCartesian(ctx: Ctx, L: CartesianLayout) {
  const { frame, spec, theme, colors } = ctx;
  const c = theme.colors;
  const o = spec.options;
  const g = L.grid;
  const lx = (x: number) => x - g.x;
  const ly = (y: number) => y - g.y;
  const local = (d: string) => shiftPath(d, -g.x, -g.y);

  const plot = container(frame, 'Plot', g.x, g.y, g.w, g.h);
  constrain(plot, 'STRETCH', 'STRETCH');
  plot.clipsContent = L.clip; // user-set axis bounds cut the series, like ECharts

  // ---------- grid ----------
  const splitPaint = await colors.paint(c.splitLine);
  const gridBox = container(plot, 'Grid', 0, 0, g.w, g.h);
  constrain(gridBox, 'STRETCH', 'STRETCH');
  for (const y of L.splitY) {
    const v = vector(gridBox, `M 0 ${ly(y)} L ${g.w} ${ly(y)}`, 'Split');
    stroke(v, splitPaint, 1);
    constrain(v, 'SCALE', 'SCALE');
  }
  for (const x of L.splitX) {
    const v = vector(gridBox, `M ${lx(x)} 0 L ${lx(x)} ${g.h}`, 'Split');
    stroke(v, splitPaint, 1);
    constrain(v, 'SCALE', 'SCALE');
  }

  const axisPaint = await colors.paint(c.axisLine);
  if (L.xLine !== null) {
    const v = vector(plot, `M 0 ${ly(L.xLine)} L ${g.w} ${ly(L.xLine)}`, 'Axis line');
    stroke(v, axisPaint, 1);
    constrain(v, 'SCALE', 'SCALE');
  }
  if (L.yLine !== null) {
    const v = vector(plot, `M ${lx(L.yLine)} 0 L ${lx(L.yLine)} ${g.h}`, 'Axis line');
    stroke(v, axisPaint, 1);
    constrain(v, 'SCALE', 'SCALE');
  }

  // ---------- series ----------
  const symbolFill = await colors.paint(c.symbolFill);
  const labelPaint = await colors.paint(c.valueLabel);
  for (let si = 0; si < spec.series.length; si++) {
    const s = spec.series[si];
    const token = colorTokenName(s.color);
    const seriesPaint = await colors.paint(token);
    const box = container(plot, `Series / ${s.name}`, 0, 0, g.w, g.h);
    constrain(box, 'STRETCH', 'STRETCH');

    const sl = L.lines.find((x) => x.series === si);
    if (sl) {
      if (sl.area) {
        const area = vector(box, local(sl.area), 'Area');
        area.fills = [seriesPaint];
        area.strokes = [];
        area.opacity = o.areaOpacity; // layer opacity: stays visible and editable in Figma
        constrain(area, 'SCALE', 'SCALE');
      }
      if (sl.line) {
        const line = vector(box, local(sl.line), 'Line');
        line.fills = [];
        stroke(line, seriesPaint, theme.lineWidth);
        line.strokeJoin = 'ROUND';
        line.strokeCap = 'ROUND';
        constrain(line, 'SCALE', 'SCALE');
      }
      for (const p of sl.symbols) {
        const e = ellipse(theme.symbolSize, [symbolFill]);
        e.name = 'Symbol';
        stroke(e, seriesPaint, theme.symbolStrokeWidth);
        pin(anchor(box, `Point ${spec.categories[p.index]}`, lx(p.x), ly(p.y)), e, 0.5, 0.5);
      }
    }

    for (const b of L.bars) {
      if (b.series !== si) continue;
      const r = figma.createRectangle();
      box.appendChild(r);
      r.name = `Bar ${spec.categories[b.index]}`;
      r.resize(Math.max(0.01, b.w), Math.max(0.01, b.h));
      r.x = lx(b.x);
      r.y = ly(b.y);
      r.fills = [seriesPaint];
      constrain(r, 'SCALE', 'SCALE');
    }

    for (const d of L.dots) {
      if (d.series !== si) continue;
      const e = ellipse(o.symbolSize, [seriesPaint]);
      e.name = 'Symbol';
      e.opacity = theme.scatter.opacity;
      pin(anchor(box, `Point ${spec.categories[d.index]}`, lx(d.x), ly(d.y)), e, 0.5, 0.5);
    }

    for (const m of L.labels) if (m.series === si) await markText(ctx, box, m, labelPaint, -g.x, -g.y);
  }

  // ---------- Axis Y: strip left of the plot, stretches vertically ----------
  const axisTextPaint = await colors.paint(c.axisLabel);
  const yStrip = container(frame, 'Axis Y', 0, g.y, g.x, g.h);
  constrain(yStrip, 'MIN', 'STRETCH');
  for (const t of L.yLabels) {
    const txt = await createText(t.text, spec.textStyles.axis, theme.fonts.axis, axisTextPaint);
    txt.textAlignHorizontal = 'RIGHT';
    pin(anchor(yStrip, `Tick ${t.text}`, g.x - theme.axisLabelMargin, ly(t.pos), 'MAX', 'SCALE'), txt, 1, 0.5);
  }
  if (L.yLine !== null) {
    for (const y of L.yTicks) {
      const tick = vector(yStrip, `M 0 0 L ${theme.tickLength} 0`, 'Tick');
      stroke(tick, axisPaint, 1);
      pin(anchor(yStrip, 'Tick', L.yLine, ly(y), 'MAX', 'SCALE'), tick, 1, 0.5);
    }
  }

  // ---------- Axis X: strip under the plot, stretches horizontally ----------
  const xStrip = container(frame, 'Axis X', g.x, g.y + g.h, g.w, theme.xLabelHeight);
  constrain(xStrip, 'STRETCH', 'MAX');
  if (L.xLine !== null) {
    const baseOffset = L.xLine - (g.y + g.h); // 0 unless the axis sits inside the plot (negative data)
    for (const x of L.xTicks) {
      const tick = vector(xStrip, `M 0 0 L 0 ${theme.tickLength}`, 'Tick');
      stroke(tick, axisPaint, 1);
      pin(anchor(xStrip, 'Tick', lx(x), 0, 'SCALE', 'MIN'), tick, 0.5, 0, 0, baseOffset);
    }
  }
  for (const t of L.xLabels) {
    const txt = await createText(t.text, spec.textStyles.axis, theme.fonts.axis, axisTextPaint);
    txt.textAlignHorizontal = 'CENTER';
    pin(anchor(xStrip, `Label ${t.text}`, lx(t.pos), 0, 'SCALE', 'MIN'), txt, 0.5, 0, 0, theme.axisLabelMargin);
  }

  // ---------- Axis titles ----------
  if (L.titles.x) {
    const t = await createText(L.titles.x.text, spec.textStyles.axis, theme.fonts.axis, axisTextPaint);
    frame.appendChild(t);
    t.name = 'Axis title X';
    t.textAlignHorizontal = 'CENTER';
    t.x = Math.round(L.titles.x.x - t.width / 2);
    t.y = Math.round(L.titles.x.y);
    constrain(t, 'CENTER', 'MAX');
  }
  if (L.titles.y) {
    const t = await createText(L.titles.y.text, spec.textStyles.axis, theme.fonts.axis, axisTextPaint);
    frame.appendChild(t);
    t.name = 'Axis title Y';
    t.textAlignHorizontal = 'CENTER';
    const w = t.width;
    const h = t.height;
    t.rotation = 90; // counter-clockwise around the top-left corner: the text now spans (x, y − w) … (x + h, y)
    t.x = Math.round(L.titles.y.x - h / 2);
    t.y = Math.round(L.titles.y.y + w / 2);
    constrain(t, 'MIN', 'CENTER');
  }
}
