import type { SceneLayout } from '../../../core/layout/scene';
import { Mark, hex } from './shared';

export function SceneBody({ L }: { L: SceneLayout }) {
  return <g>{L.marks.map((m, i) => {
    const style = { fill: m.fill ? hex(m.fill) : 'none', stroke: m.stroke ? hex(m.stroke) : 'none', 'stroke-width': m.width ?? 0, opacity: m.opacity ?? 1 };
    if (m.kind === 'rect') return <rect key={i} x={m.x} y={m.y} width={m.w} height={m.h} {...style} />;
    if (m.kind === 'circle') return <circle key={i} cx={m.x} cy={m.y} r={m.r} {...style} />;
    if (m.kind === 'path') return <path key={i} d={m.d} {...style} />;
    return <Mark key={i} m={m} size={m.size} fill={m.fill ? hex(m.fill) : '#000'} />;
  })}</g>;
}
