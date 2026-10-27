import type { PieLayout, RadarLayout } from '../../../core/layout';
import { polylinePath, sectorPath } from '../../../core/path';
import { colorTokenName } from '../../../shared/types';
import { hex, Mark, type BodyProps } from './shared';

export function PieBody({ L, theme }: BodyProps<PieLayout>) {
  const c = theme.colors;
  const font = theme.fonts.axis.size;
  return (
    <g>
      {L.slices.map((s, i) => (
        <path
          key={i}
          d={sectorPath(L.cx, L.cy, L.r, L.r0, s.a0, s.a1)}
          fill={hex(colorTokenName(s.color))}
          fill-rule="evenodd"
          stroke={L.slices.length > 1 ? hex(c.background) : 'none'}
          stroke-width={theme.pie.borderWidth}
        />
      ))}
      {L.labels.map((m, i) => (
        <g key={`l${i}`}>
          <path d={polylinePath(m.line)} fill="none" stroke={hex(colorTokenName(m.color))} />
          <Mark m={m} size={font} fill={hex(c.valueLabel)} />
        </g>
      ))}
    </g>
  );
}

export function RadarBody({ L, spec, theme }: BodyProps<RadarLayout>) {
  const c = theme.colors;
  const o = spec.options;
  const font = theme.fonts.axis.size;
  return (
    <g>
      {L.rings.map((d, i) => (
        <path key={`r${i}`} d={d} fill="none" stroke={hex(c.splitLine)} />
      ))}
      {L.spokes.map((d, i) => (
        <path key={`k${i}`} d={d} stroke={hex(c.axisLine)} />
      ))}
      {L.axisLabels.map((m, i) => (
        <Mark key={`a${i}`} m={m} size={font} fill={hex(c.axisLabel)} />
      ))}
      {L.series.map((sl) => {
        const color = hex(colorTokenName(spec.series[sl.series].color));
        return (
          <g key={sl.series}>
            <path d={sl.path} fill={o.area ? color : 'none'} fill-opacity={o.areaOpacity} stroke={color} stroke-width={theme.lineWidth} stroke-linejoin="round" />
            {o.showSymbols &&
              sl.points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={theme.symbolSize / 2} fill={hex(c.symbolFill)} stroke={color} stroke-width={theme.symbolStrokeWidth} />)}
          </g>
        );
      })}
      {L.labels.map((m, i) => (
        <Mark key={`v${i}`} m={m} size={font} fill={hex(c.valueLabel)} />
      ))}
    </g>
  );
}
