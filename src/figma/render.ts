// ChartSpec → native Figma layers with DS variables bound.
//
// Frame-level parts live here (background, title, legend, pluginData); the chart body is drawn by
// cartesian.ts (line / bar / scatter) or polar.ts (pie / radar). Constraints keep the chart
// usable when the frame is resized by hand: Title (center/top) · body · Legend (center/bottom).

import { computeLayout, type FrameLayout } from '../core/layout';
import { colorTokenName, type ChartSpec, type ChartType } from '../shared/types';
import type { ThemeSpec } from '../theme/echarts';
import { renderCartesian } from './cartesian';
import { constrain, ellipse, stroke, vector, type Ctx } from './nodes';
import { renderPie, renderRadar } from './polar';
import { createText } from './textStyles';
import { ColorResolver } from './variables';

export const SPEC_KEY = 'chartSpec';

export const TYPE_NAMES: Record<ChartType, string> = {
  line: 'Line',
  bar: 'Bar',
  pie: 'Pie',
  scatter: 'Scatter',
  radar: 'Radar',
};

export interface RenderResult {
  frame: FrameNode;
  missingVariables: string[];
}

export async function renderChart(spec: ChartSpec, theme: ThemeSpec, target?: FrameNode): Promise<RenderResult> {
  const L = computeLayout(spec, theme);
  const colors = await ColorResolver.create();

  const frame = target ?? figma.createFrame();
  for (const child of [...frame.children]) child.remove();
  const typeName =
    spec.type === 'pie' && spec.options.donut ? 'Donut' : spec.type === 'bar' && spec.options.horizontal ? 'Bar horizontal' : TYPE_NAMES[spec.type];
  if (!target || frame.name.startsWith('Chart / ')) frame.name = `Chart / ${typeName}${spec.title ? ` — ${spec.title}` : ''}`;
  frame.layoutMode = 'NONE';
  frame.resize(spec.width, spec.height);
  frame.fills = [await colors.paint(theme.colors.background)];
  frame.clipsContent = true;

  const ctx: Ctx = { frame, spec, theme, colors };
  if (L.type === 'cartesian') await renderCartesian(ctx, L);
  else if (L.type === 'pie') await renderPie(ctx, L);
  else await renderRadar(ctx, L);

  // ---------- Title ----------
  if (spec.options.showTitle && spec.title) {
    const title = await createText(spec.title, spec.textStyles.title, theme.fonts.title, await colors.paint(theme.colors.title));
    frame.appendChild(title);
    title.name = 'Title';
    title.x = Math.round((spec.width - title.width) / 2);
    title.y = L.frame.titleY;
    constrain(title, 'CENTER', 'MIN');
  }

  await renderLegend(ctx, L.frame);

  frame.setPluginData(SPEC_KEY, JSON.stringify(spec));
  return { frame, missingVariables: [...colors.missing] };
}

/** Legend: vertical auto layout of centred rows (wrapping computed by the layout, same as the preview). */
async function renderLegend(ctx: Ctx, F: FrameLayout) {
  const { frame, spec, theme, colors } = ctx;
  if (!F.legend) return;
  const lg = theme.legend;
  const legend = figma.createFrame();
  frame.appendChild(legend);
  legend.name = 'Legend';
  legend.layoutMode = 'VERTICAL';
  legend.primaryAxisSizingMode = 'AUTO';
  legend.counterAxisSizingMode = 'AUTO';
  legend.counterAxisAlignItems = 'CENTER';
  legend.itemSpacing = 0;
  legend.fills = [];
  const legendText = await colors.paint(theme.colors.legendText);
  const symbolFill = await colors.paint(theme.colors.symbolFill);

  for (const [r, rowL] of F.legend.rows.entries()) {
    const row = figma.createFrame();
    legend.appendChild(row);
    row.name = `Row ${r + 1}`;
    row.layoutMode = 'HORIZONTAL';
    row.resize(Math.max(1, rowL.width), lg.rowHeight); // resize() fixes both axes — set sizing modes after it
    row.primaryAxisSizingMode = 'AUTO';
    row.counterAxisSizingMode = 'FIXED';
    row.counterAxisAlignItems = 'CENTER';
    row.itemSpacing = lg.itemGap;
    row.fills = [];

    for (const it of rowL.items) {
      const paint = await colors.paint(colorTokenName(it.color));
      const item = figma.createFrame();
      row.appendChild(item);
      item.name = it.label;
      item.layoutMode = 'HORIZONTAL';
      item.primaryAxisSizingMode = 'AUTO';
      item.counterAxisSizingMode = 'AUTO';
      item.counterAxisAlignItems = 'CENTER';
      item.itemSpacing = lg.textGap;
      item.fills = [];

      const icon = figma.createFrame();
      item.appendChild(icon);
      icon.name = 'Icon';
      icon.resize(lg.itemWidth, lg.itemHeight);
      icon.fills = [];
      icon.clipsContent = false;
      if (F.legend.icon === 'line') {
        const mid = lg.itemHeight / 2;
        stroke(vector(icon, `M 0 ${mid} L ${lg.itemWidth} ${mid}`, 'Line'), paint, theme.lineWidth);
        const d = lg.itemHeight * 0.6;
        const dot = ellipse(d, [symbolFill]);
        icon.appendChild(dot);
        dot.x = (lg.itemWidth - d) / 2;
        dot.y = (lg.itemHeight - d) / 2;
        stroke(dot, paint, theme.symbolStrokeWidth + 0.5);
      } else if (F.legend.icon === 'rect') {
        const rect = figma.createRectangle();
        icon.appendChild(rect);
        rect.resize(lg.itemWidth, lg.itemHeight);
        rect.cornerRadius = 3;
        rect.fills = [paint];
      } else {
        const d = lg.itemHeight - 2;
        const dot = ellipse(d, [paint]);
        icon.appendChild(dot);
        dot.x = (lg.itemWidth - d) / 2;
        dot.y = 1;
      }

      const txt = await createText(it.label, spec.textStyles.legend, theme.fonts.legend, legendText);
      item.appendChild(txt);
    }
  }
  legend.x = Math.round((spec.width - legend.width) / 2);
  legend.y = Math.round(F.legend.top);
  constrain(legend, 'CENTER', 'MAX');
}
