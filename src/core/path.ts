// SVG path builders. Output uses only M/L/C/Z with space-separated numbers,
// which is the format Figma's `vectorPaths` accepts as well.

export interface Pt {
  x: number;
  y: number;
}

const n = (v: number) => String(Math.round(v * 100) / 100);

export function polylinePath(pts: Pt[]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'} ${n(p.x)} ${n(p.y)}`).join(' ');
}

/**
 * Smooth curve through points — port of the ECharts `smooth` algorithm (poly.ts drawSegment):
 * control points follow the neighbour direction and are clamped between neighbours,
 * so the curve never overshoots the data (important for charts).
 */
export function smoothPath(pts: Pt[], smooth = 0.5): string {
  if (pts.length < 3) return polylinePath(pts);
  let d = `M ${n(pts[0].x)} ${n(pts[0].y)}`;
  let cpx0 = pts[0].x;
  let cpy0 = pts[0].y;

  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const p = pts[i];
    const next = pts[i + 1] ?? p;
    let cpx1: number;
    let cpy1: number;
    let nextCpx0: number;
    let nextCpy0: number;

    if (next === p) {
      // last point: incoming control point sits on the point itself (like ECharts end caps)
      cpx1 = p.x;
      cpy1 = p.y;
      nextCpx0 = p.x;
      nextCpy0 = p.y;
    } else {
      let vx = next.x - prev.x;
      let vy = next.y - prev.y;
      const lenPrev = Math.hypot(p.x - prev.x, p.y - prev.y);
      const lenNext = Math.hypot(next.x - p.x, next.y - p.y);
      const ratioNext = lenNext + lenPrev ? lenNext / (lenNext + lenPrev) : 0.5;

      nextCpx0 = p.x + vx * smooth * ratioNext;
      nextCpy0 = p.y + vy * smooth * ratioNext;
      nextCpx0 = clamp(nextCpx0, p.x, next.x);
      nextCpy0 = clamp(nextCpy0, p.y, next.y);

      vx = nextCpx0 - p.x;
      vy = nextCpy0 - p.y;
      const k = lenNext ? lenPrev / lenNext : 0;
      cpx1 = clamp(p.x - vx * k, prev.x, p.x);
      cpy1 = clamp(p.y - vy * k, prev.y, p.y);

      // keep the tangent symmetric after clamping the incoming side
      vx = p.x - cpx1;
      vy = p.y - cpy1;
      const k2 = lenPrev ? lenNext / lenPrev : 0;
      nextCpx0 = p.x + vx * k2;
      nextCpy0 = p.y + vy * k2;
    }

    d += ` C ${n(cpx0)} ${n(cpy0)} ${n(cpx1)} ${n(cpy1)} ${n(p.x)} ${n(p.y)}`;
    cpx0 = nextCpx0;
    cpy0 = nextCpy0;
  }
  return d;
}

function clamp(v: number, a: number, b: number) {
  return Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));
}

export function linePath(pts: Pt[], smooth: boolean): string {
  return smooth ? smoothPath(pts) : polylinePath(pts);
}

/** Closed area under the line down to `baseY`. */
export function areaPath(pts: Pt[], smooth: boolean, baseY: number): string {
  if (!pts.length) return '';
  const first = pts[0];
  const last = pts[pts.length - 1];
  return `${linePath(pts, smooth)} L ${n(last.x)} ${n(baseY)} L ${n(first.x)} ${n(baseY)} Z`;
}

/** Translates a path so its bbox starts at 0,0 (Figma vectors are positioned by node x/y). */
export function normalizePath(d: string): { d: string; x: number; y: number } {
  const tokens = d.split(' ');
  const nums: { i: number; axis: 0 | 1 }[] = [];
  let axis: 0 | 1 = 0;
  tokens.forEach((t, i) => {
    if (/^[MLCZ]$/.test(t)) {
      axis = 0;
      return;
    }
    nums.push({ i, axis });
    axis = axis === 0 ? 1 : 0;
  });
  let minX = Infinity;
  let minY = Infinity;
  for (const { i, axis } of nums) {
    const v = parseFloat(tokens[i]);
    if (axis === 0) minX = Math.min(minX, v);
    else minY = Math.min(minY, v);
  }
  if (!isFinite(minX)) return { d, x: 0, y: 0 };
  for (const { i, axis } of nums) {
    tokens[i] = n(parseFloat(tokens[i]) - (axis === 0 ? minX : minY));
  }
  return { d: tokens.join(' '), x: minX, y: minY };
}

/** Closed band between an upper line and a lower line (stacked area). Both run left → right. */
export function bandPath(top: Pt[], bottom: Pt[], smooth: boolean): string {
  if (!top.length) return '';
  const back = linePath([...bottom].reverse(), smooth).replace(/^M/, 'L');
  return `${linePath(top, smooth)} ${back} Z`;
}

/** Closed polygon (radar rings / series). */
export function polygonPath(pts: Pt[]): string {
  return pts.length ? `${polylinePath(pts)} Z` : '';
}

/** Shifts every x y pair of an M/L/C/Z path (numbers always come in pairs). */
export function shiftPath(d: string, dx: number, dy: number): string {
  return d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x: string, y: string) => `${n(parseFloat(x) + dx)} ${n(parseFloat(y) + dy)}`);
}

/** Point at `angle` (0 = 12 o'clock, clockwise) on a circle — screen coordinates (y down). */
export function polar(cx: number, cy: number, r: number, angle: number): Pt {
  return { x: cx + r * Math.sin(angle), y: cy - r * Math.cos(angle) };
}

/** Pie/donut sector for the SVG preview (uses arcs — Figma gets a native ellipse with arcData instead). */
export function sectorPath(cx: number, cy: number, r: number, r0: number, a0: number, a1: number): string {
  if (a1 - a0 >= Math.PI * 2 - 1e-6) {
    // full ring: two half arcs
    const outer = `M ${n(cx)} ${n(cy - r)} A ${n(r)} ${n(r)} 0 1 1 ${n(cx)} ${n(cy + r)} A ${n(r)} ${n(r)} 0 1 1 ${n(cx)} ${n(cy - r)} Z`;
    if (!r0) return outer;
    return `${outer} M ${n(cx)} ${n(cy - r0)} A ${n(r0)} ${n(r0)} 0 1 0 ${n(cx)} ${n(cy + r0)} A ${n(r0)} ${n(r0)} 0 1 0 ${n(cx)} ${n(cy - r0)} Z`;
  }
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  let d = `M ${n(p0.x)} ${n(p0.y)} A ${n(r)} ${n(r)} 0 ${large} 1 ${n(p1.x)} ${n(p1.y)}`;
  if (r0) {
    const q1 = polar(cx, cy, r0, a1);
    const q0 = polar(cx, cy, r0, a0);
    d += ` L ${n(q1.x)} ${n(q1.y)} A ${n(r0)} ${n(r0)} 0 ${large} 0 ${n(q0.x)} ${n(q0.y)} Z`;
  } else {
    d += ` L ${n(cx)} ${n(cy)} Z`;
  }
  return d;
}
