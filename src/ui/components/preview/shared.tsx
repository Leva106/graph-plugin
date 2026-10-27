import type { TextMark } from '../../../core/layout';
import type { ChartSpec } from '../../../shared/types';
import type { ThemeSpec } from '../../../theme/echarts';
import { tokenHex } from '../../../theme/palette';

export const hex = (name: string) => tokenHex(name);

export interface BodyProps<L> {
  L: L;
  spec: ChartSpec;
  theme: ThemeSpec;
}

/** SVG text for a TextMark (anchor point → text-anchor / dominant-baseline). */
export function Mark({ m, size, fill }: { m: TextMark; size: number; fill: string }) {
  return (
    <text
      x={m.x}
      y={m.y}
      text-anchor={m.ax === 0 ? 'start' : m.ax === 1 ? 'end' : 'middle'}
      dominant-baseline={m.ay === 0 ? 'hanging' : m.ay === 1 ? 'text-after-edge' : 'central'}
      font-size={size}
      fill={fill}
    >
      {m.text}
    </text>
  );
}
