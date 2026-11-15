import type { CartesianLayout } from '../../../core/layout';
import { colorTokenName } from '../../../shared/types';
import { hex, Mark, type BodyProps } from './shared';

export function CartesianBody({ L, spec, theme }: BodyProps<CartesianLayout>) {
  const c = theme.colors;
  const o = spec.options;
  const g = L.grid;
  const font = theme.fonts.axis.size;
  const axis = hex(c.axisLine);
  const color = (si: number) => hex(colorTokenName(spec.series[si].color));

  const clip = L.clip ? `url(#plot-clip)` : undefined;
  return (
    <g>
      {L.clip && (
        <clipPath id="plot-clip">
          <rect x={g.x} y={g.y} width={g.w} height={g.h} />
        </clipPath>
      )}
      {L.splitY.map((y, i) => (
        <line key={`sy${i}`} x1={g.x} x2={g.x + g.w} y1={y} y2={y} stroke={hex(c.splitLine)} />
      ))}
      {L.splitX.map((x, i) => (
        <line key={`sx${i}`} x1={x} x2={x} y1={g.y} y2={g.y + g.h} stroke={hex(c.splitLine)} />
      ))}
      {L.yLabels.map((t, i) => (
        <text key={`yl${i}`} x={g.x - theme.axisLabelMargin} y={t.pos} text-anchor="end" dominant-baseline="central" font-size={font} fill={hex(c.axisLabel)}>
          {t.text}
        </text>
      ))}
      {L.xLabels.map((t, i) => (
        <text key={`xl${i}`} x={t.pos} y={g.y + g.h + theme.axisLabelMargin} text-anchor="middle" dominant-baseline="hanging" font-size={font} fill={hex(c.axisLabel)}>
          {t.text}
        </text>
      ))}

      <g clip-path={clip}>
      {L.bars.map((b, i) => (
        <rect key={`b${i}`} x={b.x} y={b.y} width={Math.max(0, b.w)} height={Math.max(0, b.h)} fill={color(b.series)} />
      ))}
      {L.lines.map((sl) => (
        <g key={`l${sl.series}`}>
          {sl.area && <path d={sl.area} fill={color(sl.series)} fill-opacity={o.areaOpacity} />}
          {sl.line && <path d={sl.line} fill="none" stroke={color(sl.series)} stroke-width={theme.lineWidth} stroke-linejoin="round" stroke-linecap="round" />}
        </g>
      ))}
      </g>
      {L.xLine !== null && <line x1={g.x} x2={g.x + g.w} y1={L.xLine} y2={L.xLine} stroke={axis} />}
      {L.yLine !== null && <line x1={L.yLine} x2={L.yLine} y1={g.y} y2={g.y + g.h} stroke={axis} />}
      {L.xLine !== null && L.xTicks.map((x, i) => <line key={`xt${i}`} x1={x} x2={x} y1={L.xLine!} y2={L.xLine! + theme.tickLength} stroke={axis} />)}
      {L.yLine !== null && L.yTicks.map((y, i) => <line key={`yt${i}`} x1={L.yLine! - theme.tickLength} x2={L.yLine!} y1={y} y2={y} stroke={axis} />)}

      <g clip-path={clip}>
      {L.lines.map((sl) =>
        sl.symbols.map((p, i) => (
          <circle key={`s${sl.series}-${i}`} cx={p.x} cy={p.y} r={theme.symbolSize / 2} fill={hex(c.symbolFill)} stroke={color(sl.series)} stroke-width={theme.symbolStrokeWidth} />
        )),
      )}
      {L.dots.map((d, i) => (
        <circle key={`d${i}`} cx={d.x} cy={d.y} r={o.symbolSize / 2} fill={color(d.series)} fill-opacity={theme.scatter.opacity} />
      ))}
      {L.labels.map((m, i) => (
        <Mark key={`v${i}`} m={m} size={font} fill={hex(c.valueLabel)} />
      ))}
      </g>
      {L.threshold && <g>
        <line x1={g.x} x2={g.x + g.w} y1={L.threshold.y} y2={L.threshold.y} stroke={hex(theme.threshold.color)} stroke-width={theme.threshold.width} stroke-dasharray={theme.threshold.dash.join(' ')} />
        <Mark m={L.threshold.label} size={font} fill={hex(theme.threshold.color)} />
      </g>}
      {L.titles.x && <Mark m={L.titles.x} size={font} fill={hex(c.axisLabel)} />}
      {L.titles.y && (
        <g transform={`rotate(-90 ${L.titles.y.x} ${L.titles.y.y})`}>
          <Mark m={L.titles.y} size={font} fill={hex(c.axisLabel)} />
        </g>
      )}
    </g>
  );
}
