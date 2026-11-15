import type { SceneLayout } from '../core/layout/scene';
import { anchor, constrain, container, ellipse, markText, pin, stroke, vector, type Ctx } from './nodes';

/** Native primitives; all geometry and label placement come from the shared scene. */
export async function renderScene(ctx: Ctx, L: SceneLayout) {
  const body = container(ctx.frame, ctx.spec.type, 0, 0, ctx.spec.width, ctx.spec.height);
  constrain(body, 'STRETCH', 'STRETCH');
  for (const m of L.marks) {
    const fill = m.fill ? await ctx.colors.paint(m.fill) : null;
    if (m.kind === 'text') { await markText(ctx, body, m, fill!, 0, 0, m.name); continue; }
    let node: RectangleNode | EllipseNode | VectorNode;
    if (m.kind === 'circle') {
      node = ellipse(m.r * 2, fill ? [fill] : []);
      pin(anchor(body, m.name, m.x, m.y), node, 0.5, 0.5);
    } else if (m.kind === 'rect') {
      node = figma.createRectangle(); body.appendChild(node);
      node.resize(Math.max(0.01, m.w), Math.max(0.01, m.h)); node.x = m.x; node.y = m.y;
      constrain(node, 'SCALE', 'SCALE');
    } else { node = vector(body, m.d, m.name); constrain(node, 'SCALE', 'SCALE'); }
    node.name = m.name;
    node.fills = fill ? [fill] : [];
    node.strokes = [];
    node.opacity = m.opacity ?? 1;
    if (m.stroke) stroke(node, await ctx.colors.paint(m.stroke), m.width ?? 1);
  }
}
