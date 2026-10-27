// Small node helpers shared by all chart renderers.

import { normalizePath } from '../core/path';
import type { TextMark } from '../core/layout';
import type { ChartSpec } from '../shared/types';
import type { ThemeSpec } from '../theme/echarts';
import { createText } from './textStyles';
import type { ColorResolver } from './variables';

export const ANCHOR = 2; // anchor frame size, px

export type C = ConstraintType;

/** Everything a renderer needs. */
export interface Ctx {
  frame: FrameNode;
  spec: ChartSpec;
  theme: ThemeSpec;
  colors: ColorResolver;
}

export function constrain(node: ConstraintMixin, horizontal: C, vertical: C) {
  node.constraints = { horizontal, vertical };
}

/** Transparent, non-clipping container frame. */
export function container(parent: FrameNode, name: string, x: number, y: number, w: number, h: number): FrameNode {
  const f = figma.createFrame();
  parent.appendChild(f);
  f.name = name;
  f.fills = [];
  f.clipsContent = false;
  f.resize(Math.max(0.01, w), Math.max(0.01, h));
  f.x = x;
  f.y = y;
  return f;
}

/** Small frame centred on (x, y) that follows the data when the parent is resized. */
export function anchor(parent: FrameNode, name: string, x: number, y: number, h: C = 'SCALE', v: C = 'SCALE'): FrameNode {
  const a = container(parent, name, x - ANCHOR / 2, y - ANCHOR / 2, ANCHOR, ANCHOR);
  constrain(a, h, v);
  return a;
}

const edge = (f: number): C => (f === 0 ? 'MIN' : f === 1 ? 'MAX' : 'CENTER');

/** Puts `node` into anchor `a` so that point (ax, ay) of its box sits at the anchor centre + (dx, dy). */
export function pin(a: FrameNode, node: SceneNode & ConstraintMixin, ax: number, ay: number, dx = 0, dy = 0) {
  a.appendChild(node);
  node.x = ANCHOR / 2 + dx - ax * node.width;
  node.y = ANCHOR / 2 + dy - ay * node.height;
  constrain(node, edge(ax), edge(ay));
}

export function vector(parent: FrameNode, d: string, name: string): VectorNode {
  const norm = normalizePath(d);
  const v = figma.createVector();
  parent.appendChild(v);
  v.name = name;
  v.vectorPaths = [{ windingRule: 'NONZERO', data: norm.d }];
  v.x = norm.x;
  v.y = norm.y;
  return v;
}

export function stroke(node: VectorNode | EllipseNode | RectangleNode, paint: Paint, weight: number) {
  node.strokes = [paint];
  node.strokeWeight = weight;
  node.strokeAlign = 'CENTER';
}

export function ellipse(size: number, fills: Paint[]): EllipseNode {
  const e = figma.createEllipse();
  e.resize(size, size);
  e.fills = fills;
  return e;
}

/** Axis-font text for a TextMark, placed in its own anchor (follows the data on resize). */
export async function markText(ctx: Ctx, parent: FrameNode, m: TextMark, paint: Paint, dx = 0, dy = 0, name = 'Label'): Promise<TextNode> {
  const txt = await createText(m.text, ctx.spec.textStyles.axis, ctx.theme.fonts.axis, paint);
  txt.textAlignHorizontal = m.ax === 0 ? 'LEFT' : m.ax === 1 ? 'RIGHT' : 'CENTER';
  const a = anchor(parent, `${name} ${m.text}`, m.x + dx, m.y + dy);
  pin(a, txt, m.ax, m.ay);
  return txt;
}
