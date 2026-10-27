// "Nice" linear scale, same rules as ECharts value axis (scale: false → always includes 0).

/** ECharts numberUtil.nice */
export function nice(val: number, round: boolean): number {
  const exponent = Math.floor(Math.log10(val));
  const exp10 = Math.pow(10, exponent);
  const f = val / exp10;
  let nf: number;
  if (round) {
    if (f < 1.5) nf = 1;
    else if (f < 2.5) nf = 2;
    else if (f < 4) nf = 3;
    else if (f < 7) nf = 5;
    else nf = 10;
  } else {
    if (f < 1) nf = 1;
    else if (f < 2) nf = 2;
    else if (f < 3) nf = 3;
    else if (f < 5) nf = 5;
    else nf = 10;
  }
  const result = nf * exp10;
  return exponent >= -20 ? +result.toFixed(exponent < 0 ? -exponent : 0) : result;
}

export interface LinearScale {
  min: number;
  max: number;
  interval: number;
  ticks: number[];
}

export interface FixedBounds {
  min?: number | null;
  max?: number | null;
}

/**
 * `includeZero: false` — like ECharts `scale: true` (used by scatter axes).
 * `fixed` — user-set bounds (ECharts `min` / `max`): used as is, ticks between them stay on the nice step,
 * and a nice tick closer than 0.3 step to a fixed bound is dropped so the labels do not collide.
 */
export function niceScale(dataMin: number, dataMax: number, splitNumber = 5, includeZero = true, fixed: FixedBounds = {}): LinearScale {
  let fMin = Number.isFinite(fixed.min) ? (fixed.min as number) : null;
  let fMax = Number.isFinite(fixed.max) ? (fixed.max as number) : null;
  if (fMin !== null && fMax !== null && fMin >= fMax) fMin = fMax = null; // invalid pair → auto
  let min = fMin ?? (includeZero ? Math.min(0, dataMin) : dataMin);
  let max = fMax ?? (includeZero ? Math.max(0, dataMax) : dataMax);
  if (min >= max) {
    // one bound fixed on the wrong side of the data, or flat data
    if (fMin !== null) max = fMin + (Math.abs(fMin) || 1);
    else if (fMax !== null) min = fMax - (Math.abs(fMax) || 1);
    else {
      const pad = includeZero ? 0 : Math.abs(min) * 0.1 || 1;
      min -= pad;
      max += pad || 1;
    }
  }
  const interval = nice((max - min) / splitNumber, true);
  const precision = Math.max(0, -Math.floor(Math.log10(interval)));
  const fix = (v: number) => +v.toFixed(precision);
  min = fMin ?? fix(Math.floor(min / interval) * interval);
  max = fMax ?? fix(Math.ceil(max / interval) * interval);
  const eps = interval * (fMin !== null || fMax !== null ? 0.3 : 1e-6);
  const ticks: number[] = [min];
  for (let v = Math.ceil(min / interval) * interval; v < max - eps; v += interval) if (v > min + eps) ticks.push(fix(v));
  ticks.push(max);
  return { min, max, interval, ticks };
}

/**
 * ECharts default axis label formatting: thousands separators.
 * Hand-rolled because the Figma sandbox has no `Intl`.
 */
export function formatNumber(v: number): string {
  const [int, frac] = String(+v.toFixed(4)).split('.');
  const sign = int.startsWith('-') ? '-' : '';
  const digits = sign ? int.slice(1) : int;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + grouped + (frac ? `.${frac}` : '');
}

/**
 * Lenient number parsing for user input / pasted spreadsheet cells:
 * spaces as thousand separators, `,` as decimal separator ("1 234,5"), "1,234.5". Empty/garbage → null.
 */
export function parseNumber(raw: string): number | null {
  let s = raw.replace(/[\s\u00a0\u202f']/g, '');
  if (!s) return null;
  const commas = (s.match(/,/g) ?? []).length;
  if (s.includes('.') || commas > 1) s = s.replace(/,/g, ''); // "1,234.5", "1,234,567"
  else s = s.replace(',', '.'); // "1234,5"
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}
