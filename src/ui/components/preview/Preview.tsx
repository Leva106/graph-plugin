import type { ChartLayout, FrameLayout } from '../../../core/layout';
import { displaySpec } from '../../../data/display';
import { colorTokenName, type ChartSpec } from '../../../shared/types';
import type { ThemeSpec } from '../../../theme/echarts';
import { CartesianBody } from './Cartesian';
import { SceneBody } from './Scene';
import { PieBody, RadarBody } from './Polar';
import { hex } from './shared';

/** SVG preview built from the same layout as the Figma renderer. */
export function Preview({ spec, theme, layout: L }: { spec: ChartSpec; theme: ThemeSpec; layout: ChartLayout }) {
  spec = displaySpec(spec);
  const c = theme.colors;
  return (
    <svg class="preview-svg" viewBox={`0 0 ${spec.width} ${spec.height}`} preserveAspectRatio="xMidYMid meet" font-family="Inter, -apple-system, 'Segoe UI', sans-serif">
      <rect width={spec.width} height={spec.height} fill={hex(c.background)} />
      {L.type === 'cartesian' && <CartesianBody L={L} spec={spec} theme={theme} />}
      {L.type === 'pie' && <PieBody L={L} spec={spec} theme={theme} />}
      {L.type === 'radar' && <RadarBody L={L} spec={spec} theme={theme} />}
      {L.type === 'scene' && <SceneBody L={L} />}
      {spec.options.showTitle && spec.title && (
        <text x={spec.width / 2} y={L.frame.titleY} text-anchor="middle" dominant-baseline="hanging" font-size={theme.fonts.title.size} font-weight="600" fill={hex(c.title)}>
          {spec.title}
        </text>
      )}
      <Legend F={L.frame} theme={theme} />
    </svg>
  );
}

function Legend({ F, theme }: { F: FrameLayout; theme: ThemeSpec }) {
  if (!F.legend) return null;
  const lg = theme.legend;
  const c = theme.colors;
  const icon = F.legend.icon;
  return (
    <g>
      {F.legend.rows.flatMap((row) =>
        row.items.map((it, i) => {
          const color = hex(colorTokenName(it.color));
          const x = it.x;
          const cy = row.y;
          return (
            <g key={`${row.y}-${i}`}>
              {icon === 'line' && (
                <>
                  <line x1={x} x2={x + lg.itemWidth} y1={cy} y2={cy} stroke={color} stroke-width={theme.lineWidth} />
                  <circle cx={x + lg.itemWidth / 2} cy={cy} r={lg.itemHeight * 0.3} fill={hex(c.symbolFill)} stroke={color} stroke-width={theme.symbolStrokeWidth + 0.5} />
                </>
              )}
              {icon === 'rect' && <rect x={x} y={cy - lg.itemHeight / 2} width={lg.itemWidth} height={lg.itemHeight} rx={3} fill={color} />}
              {icon === 'circle' && <circle cx={x + lg.itemWidth / 2} cy={cy} r={(lg.itemHeight - 2) / 2} fill={color} />}
              <text x={x + lg.itemWidth + lg.textGap} y={cy} dominant-baseline="central" font-size={theme.fonts.legend.size} fill={hex(c.legendText)}>
                {it.label}
              </text>
            </g>
          );
        }),
      )}
    </g>
  );
}
