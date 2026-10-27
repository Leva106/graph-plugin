// Sanity checks for pure chart math: `npm test`
import assert from 'node:assert/strict';
import { niceScale, formatNumber, parseNumber } from '../src/core/scale.ts';
import { smoothPath, polylinePath, areaPath, bandPath, normalizePath, shiftPath } from '../src/core/path.ts';
import { randomSeries, randomScatter, makeCategories, autoPoints } from '../src/data/random.ts';
import { parseCsv, parseCsvRows, toCsv, detectDelimiter, validateCsv } from '../src/data/csv.ts';
import { formatValue } from '../src/core/format.ts';
import { categoryAxis, valueAxis } from '../src/core/layout/axis.ts';
import { computeLayout } from '../src/core/layout/index.ts';
import { pieSlices } from '../src/core/layout/pie.ts';
import { pasteBlock, addRow, removeRow, parseGrid, gridToTable } from '../src/data/table.ts';
import { migrateSpec } from '../src/shared/migrate.ts';
import { CHART_TYPES, DEFAULT_AXIS, DEFAULT_FORMAT, DEFAULT_OPTIONS, type ChartSpec, type NumberFormat } from '../src/shared/types.ts';
import { echartsTheme } from '../src/theme/echarts.ts';

const s = niceScale(0, 2573);
assert.deepEqual(s.ticks, [0, 500, 1000, 1500, 2000, 2500, 3000]);
assert.deepEqual(niceScale(3, 7.4).ticks, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
assert.deepEqual(niceScale(-120, 340).ticks, [-200, -100, 0, 100, 200, 300, 400]);
assert.equal(formatNumber(2500), '2,500');

const pts = [{ x: 0, y: 100 }, { x: 50, y: 20 }, { x: 100, y: 60 }, { x: 150, y: 10 }];
const sm = smoothPath(pts);
assert.ok(sm.startsWith('M 0 100'), sm);
assert.ok(sm.endsWith('150 10'), sm);
assert.ok(!sm.includes('NaN'), sm);
// no overshoot: every control point y must stay within data y-range
const nums = sm.replace(/[MC]/g, '').trim().split(/\s+/).map(Number);
for (let i = 1; i < nums.length; i += 2) assert.ok(nums[i] >= 10 && nums[i] <= 100, `overshoot ${nums[i]}`);

assert.equal(polylinePath(pts), 'M 0 100 L 50 20 L 100 60 L 150 10');
assert.ok(areaPath(pts, false, 120).endsWith('L 150 120 L 0 120 Z'));

const norm = normalizePath('M 10 20 L 30 5 C 12 8 14 9 40 25');
assert.deepEqual([norm.x, norm.y], [10, 5]);
assert.equal(norm.d, 'M 0 15 L 20 0 C 2 3 4 4 30 20');

const r1 = randomSeries({ seriesCount: 3, points: 7, min: 0, max: 1000, seed: 42 });
const r2 = randomSeries({ seriesCount: 3, points: 7, min: 0, max: 1000, seed: 42 });
assert.deepEqual(r1, r2);
assert.ok(r1.flat().every((v) => v >= 0 && v <= 1000));

console.log('core: all checks passed');

assert.equal(formatNumber(1234567), '1,234,567');
assert.equal(formatNumber(-2500), '-2,500');
assert.equal(formatNumber(0.25), '0.25');
assert.equal(formatNumber(999), '999');
console.log('formatNumber: ok');

// ---------- scale / parsing ----------
assert.deepEqual(niceScale(52, 97, 5, false).ticks, [50, 60, 70, 80, 90, 100]);
assert.equal(parseNumber('1 234,5'), 1234.5);
assert.equal(parseNumber('1,234.5'), 1234.5);
assert.equal(parseNumber('1,234,567'), 1234567);
assert.equal(parseNumber('-3,25'), -3.25);
assert.equal(parseNumber(''), null);
assert.equal(parseNumber('abc'), null);

// ---------- paths ----------
const band = bandPath([{ x: 0, y: 10 }, { x: 10, y: 5 }], [{ x: 0, y: 20 }, { x: 10, y: 20 }], false);
assert.equal(band, 'M 0 10 L 10 5 L 10 20 L 0 20 Z');
assert.equal(shiftPath('M 10 20 L 30 40', -10, -20), 'M 0 0 L 20 20');

// ---------- category axis: 30 labels on 400px are thinned, first label always shown ----------
const narrow = categoryAxis(30, 0, 400, 30, 12, false);
assert.ok(narrow.interval > 1, `interval ${narrow.interval}`);
assert.ok(narrow.isShown(0));
assert.equal(narrow.shownCount, Math.ceil(30 / narrow.interval));
const wide = categoryAxis(30, 0, 2400, 30, 12, false);
assert.ok(wide.interval < narrow.interval);
assert.equal(categoryAxis(7, 0, 700, 30, 12, false).interval, 1);
// fewer value splits on a short chart
assert.ok(valueAxis(0, 1000, 90, 48, 5).ticks.length < valueAxis(0, 1000, 300, 48, 5).ticks.length);

// ---------- layouts ----------
const indigo = { hue: 'indigo', tone: '500' };
const base = (over: Partial<ChartSpec>): ChartSpec => ({
  version: 3,
  type: 'line',
  title: 'T',
  width: 800,
  height: 420,
  categories: makeCategories('dates', 30),
  series: randomSeries({ seriesCount: 3, points: 30, min: 0, max: 1000, seed: 1 }).map((data, i) => ({ name: `S${i}`, data, color: indigo })),
  options: { ...DEFAULT_OPTIONS },
  textStyles: {},
  ...over,
});

const line = computeLayout(base({ width: 400 }), echartsTheme);
assert.equal(line.type, 'cartesian');
if (line.type === 'cartesian') {
  assert.ok(line.category!.interval > 1 && line.xLabels.length < 30, 'x labels thinned');
  assert.ok(!line.lines[0].line.includes('NaN'));
  assert.equal(line.lines[0].line.split(/[MLC]/).filter((x) => x.trim()).length, 30, 'all 30 points drawn');
}

const stacked = computeLayout(base({ options: { ...DEFAULT_OPTIONS, stack: true, area: true, showSymbols: true } }), echartsTheme);
if (stacked.type === 'cartesian') {
  assert.ok(stacked.lines[1].area!.endsWith('Z'));
  // the top series sits above (smaller y) the first one everywhere
  const y0 = stacked.lines[0].symbols;
  const y2 = stacked.lines[2].symbols;
  y0.forEach((p, i) => assert.ok(y2[i].y <= p.y + 1e-6));
}

const bars = computeLayout(
  base({
    type: 'bar',
    categories: ['a', 'b', 'c'],
    series: [
      { name: 'A', data: [10, -5, null], color: indigo },
      { name: 'B', data: [20, 5, 7], color: indigo },
    ],
  }),
  echartsTheme,
);
if (bars.type === 'cartesian') {
  assert.equal(bars.bars.length, 5, 'null skipped');
  assert.ok(bars.bars.every((b) => b.w > 0 && b.h >= 0));
}
const hbar = computeLayout(base({ type: 'bar', options: { ...DEFAULT_OPTIONS, horizontal: true, stack: true, showLabels: true } }), echartsTheme);
if (hbar.type === 'cartesian') {
  assert.ok(hbar.horizontal);
  assert.equal(hbar.bars.length, 90);
  assert.ok(hbar.yLine !== null && hbar.xLine === null);
}

const sc = randomScatter({ seriesCount: 2, points: 40, min: 0, max: 100, seed: 3 });
const scatter = computeLayout(base({ type: 'scatter', categories: sc.categories, series: sc.data.map((data, i) => ({ name: `S${i}`, data, color: indigo })) }), echartsTheme);
if (scatter.type === 'cartesian') {
  assert.equal(scatter.dots.length, 80);
  assert.ok(scatter.dots.every((d) => d.x >= scatter.grid.x - 0.01 && d.x <= scatter.grid.x + scatter.grid.w + 0.01));
}

const pieSpec = base({ type: 'pie', options: { ...DEFAULT_OPTIONS, maxSlices: 6, showLabels: true } });
const slices = pieSlices(pieSpec);
assert.equal(slices.length, 6);
assert.equal(slices[5].label, 'Другое');
assert.ok(Math.abs(slices[slices.length - 1].a1 - Math.PI * 2) < 1e-9);
assert.ok(Math.abs(slices.reduce((sum, x) => sum + x.percent, 0) - 1) < 1e-9);
const pie = computeLayout(pieSpec, echartsTheme);
if (pie.type === 'pie') assert.equal(pie.labels.length, 6);

const radar = computeLayout(base({ type: 'radar', categories: ['a', 'b', 'c', 'd', 'e'], series: [{ name: 'A', data: [1, 2, 3, 4, 5], color: indigo }] }), echartsTheme);
if (radar.type === 'radar') {
  assert.equal(radar.spokes.length, 5);
  assert.ok(radar.rings.length >= 2);
  const first = radar.series[0].points[0];
  assert.ok(Math.abs(first.x - radar.cx) < 1e-6 && first.y < radar.cy, 'first indicator at the top');
}
console.log('layouts: ok');

// ---------- table ----------
const t0 = { categories: ['a', 'b'], data: [[1, 2]] };
const pasted = pasteBlock(t0, 0, 0, 'Day\tSales\tCost\nMon\t1 200\t300,5\nTue\t1300\t\nWed\t1400\t310\n', 8);
assert.deepEqual(pasted.table.categories, ['Mon', 'Tue', 'Wed']);
assert.deepEqual(pasted.table.data, [[1200, 1300, 1400], [300.5, null, 310]]);
assert.deepEqual([...pasted.names.entries()], [[0, 'Sales'], [1, 'Cost']]);
assert.deepEqual(parseGrid('1;2\n3;4'), [['1', '2'], ['3', '4']]);
assert.deepEqual(addRow(t0).categories, ['a', 'b', '']);
assert.deepEqual(removeRow(t0, 0), { categories: ['b'], data: [[2]] });
console.log('table: ok');

// ---------- migration v1 → v2 ----------
const v1 = {
  version: 1,
  type: 'line',
  title: 'Old',
  width: 600,
  height: 300,
  categories: ['Mon'],
  series: [{ name: 'A', data: [5], color: indigo }],
  options: { smooth: true, area: false, areaOpacity: 0.3, showSymbols: true, showLabels: false, showLegend: true, showTitle: true },
  textStyles: {},
  source: { kind: 'random', seriesCount: 1, points: 1, min: 0, max: 10, seed: 1, preset: 'numbers' },
};
const m = migrateSpec(v1);
assert.equal(m.version, 3);
assert.equal(m.type, 'line');
assert.equal(m.options.stack, false);
assert.equal(m.options.maxSlices, DEFAULT_OPTIONS.maxSlices);
assert.equal(m.source?.kind, 'random');
console.log('migrate: ok');
const v2hbar = migrateSpec({ ...v1, version: 2, type: 'hbar', options: { ...v1.options, stack: true } });
assert.equal(v2hbar.type, 'bar');
assert.equal(v2hbar.options.horizontal, true);
assert.equal(v2hbar.options.stack, true);
assert.equal(migrateSpec({ ...v1, type: 'bar' }).options.horizontal, false);
console.log('migrate v2 → v3: ok');

// ---------- auto points ----------
assert.equal(autoPoints('weekdays-ru', 400, 12, 12), 7);
assert.equal(autoPoints('months-en', 2000, 12, 12), 12);
const dNarrow = autoPoints('dates', 300, 12, 12);
const dWide = autoPoints('dates', 1100, 12, 12);
assert.ok(dNarrow >= 2 && dNarrow < dWide && dWide <= 90, `${dNarrow} ${dWide}`);
// auto count really fits: no label thinning on a line chart of that width
const fit = computeLayout(base({ width: 1100 + 104, categories: makeCategories('dates', dWide), series: [{ name: 'A', data: makeCategories('dates', dWide).map((_, i) => i), color: indigo }] }), echartsTheme);
if (fit.type === 'cartesian') assert.equal(fit.category!.interval, 1);
console.log('autoPoints: ok');

// ---------- CSV ----------
assert.equal(detectDelimiter('a;b\n1,5;2,5\n'), ';');
assert.equal(detectDelimiter('a,b\n1,2\n'), ',');
assert.equal(detectDelimiter('a\tb\n1\t2\n'), '\t');
assert.deepEqual(parseCsv('\uFEFFДата;Выручка\r\n01.10;"1 200,5"\r\n02.10;1300\r\n'), [['Дата', 'Выручка'], ['01.10', '1 200,5'], ['02.10', '1300']]);
assert.deepEqual(parseCsv('name,note\n"Smith, J","say ""hi""\nnext line"\n'), [['name', 'note'], ['Smith, J', 'say "hi"\nnext line']]);
const imp = gridToTable(parseCsv('Дата;Выручка;Расходы\n01.10;1 200,5;300\n02.10;1300;\n'), 8);
assert.deepEqual(imp.table, { categories: ['01.10', '02.10'], data: [[1200.5, 1300], [300, null]] });
assert.deepEqual([...imp.names.values()], ['Выручка', 'Расходы']);
assert.equal(imp.firstHeader, 'Дата');
const wideCsv = gridToTable([['x', ...Array.from({ length: 10 }, (_, i) => `s${i}`)], ['a', ...Array.from({ length: 10 }, () => '1')]], 8);
assert.equal(wideCsv.table.data.length, 8);
assert.equal(wideCsv.truncatedSeries, 2);
const single = gridToTable([['5'], ['7']], 8);
assert.deepEqual(single.table, { categories: ['1', '2'], data: [[5, 7]] });
// round trip: export → import gives the same table and names
const tbl = { categories: ['Mon', 'Tue, late'], data: [[1.5, null], [3, 4]] };
const back = gridToTable(parseCsv(toCsv(tbl, ['A "x"', 'B'], 'Day')), 8);
assert.deepEqual(back.table, tbl);
assert.deepEqual([...back.names.values()], ['A "x"', 'B']);
console.log('csv: ok');

// ---------- number format ----------
const F = (over: Partial<NumberFormat>): NumberFormat => ({ ...DEFAULT_FORMAT, ...over });
assert.equal(formatValue(1234.5, F({})), '1,234.5');
assert.equal(formatValue(1234.5, F({ separators: 'ru' })), '1\u00a0234,5');
assert.equal(formatValue(1234.5, F({ separators: 'none' })), '1234.5');
assert.equal(formatValue(1234567, F({ compact: true })), '1.2M');
assert.equal(formatValue(1500, F({ compact: true, separators: 'ru' })), '1,5\u00a0тыс.');
assert.equal(formatValue(999, F({ compact: true })), '999');
assert.equal(formatValue(-1200, F({ prefix: '$' })), '-$1,200');
assert.equal(formatValue(12.3456, F({ decimals: 2, suffix: '%' })), '12.35%');
assert.equal(formatValue(5, F({ decimals: 1 })), '5.0');
assert.equal(formatValue(-0.001, F({ decimals: 0 })), '0');
for (const v of [0, 7, 2500, -120, 0.25, 1234567]) assert.equal(formatValue(v, DEFAULT_FORMAT), formatNumber(v), `default = formatNumber for ${v}`);
console.log('format: ok');

// ---------- fixed axis bounds ----------
const fx = niceScale(0, 2573, 5, true, { min: 500, max: 2800 });
assert.equal(fx.min, 500);
assert.equal(fx.max, 2800);
assert.deepEqual(fx.ticks, [500, 1000, 1500, 2000, 2500, 2800]);
assert.deepEqual(niceScale(0, 2573, 5, true, { min: 10, max: 5 }).ticks, niceScale(0, 2573).ticks, 'min >= max → auto');
const onlyMax = niceScale(0, 2573, 5, true, { max: 2000 });
assert.equal(onlyMax.min, 0);
assert.equal(onlyMax.max, 2000);
console.log('fixed bounds: ok');

// ---------- axis options in the layout ----------
const plain = computeLayout(base({}), echartsTheme);
const titled = computeLayout(base({ options: { ...DEFAULT_OPTIONS, axis: { ...DEFAULT_AXIS, titleX: 'Дни', titleY: 'Выручка', grid: false, ticks: false, min: 100 } } }), echartsTheme);
if (plain.type === 'cartesian' && titled.type === 'cartesian') {
  assert.ok(titled.grid.h < plain.grid.h && titled.grid.x > plain.grid.x, 'titles take space');
  assert.equal(titled.titles.x?.text, 'Дни');
  assert.equal(titled.titles.y?.text, 'Выручка');
  assert.equal(titled.splitY.length, 0);
  assert.equal(titled.xTicks.length, 0);
  assert.ok(titled.clip && !plain.clip);
  assert.equal(titled.yLabels[0].text, '100');
}
const fmtd = computeLayout(base({ options: { ...DEFAULT_OPTIONS, format: F({ prefix: '$', compact: true }) } }), echartsTheme);
if (fmtd.type === 'cartesian') assert.ok(fmtd.yLabels.some((l) => l.text === '$1k'), fmtd.yLabels.map((l) => l.text).join(' '));
console.log('axis options: ok');

// ---------- degenerate data never breaks a layout ----------
for (const type of CHART_TYPES) {
  for (const over of [
    { categories: [], series: [] },
    { categories: ['a', 'b'], series: [] },
    { categories: [], series: [{ name: 'A', data: [], color: indigo }] },
    { categories: ['a', 'b', 'c'], series: [{ name: 'A', data: [null, null, null], color: indigo }] },
    { categories: ['a'], series: [{ name: 'A', data: [5], color: indigo }] },
  ] as Partial<ChartSpec>[]) {
    const L = computeLayout(base({ type, ...over, options: { ...DEFAULT_OPTIONS, showLabels: true, area: true } }), echartsTheme);
    const json = JSON.stringify(L, (_, x) => (typeof x === 'number' && !Number.isFinite(x) ? 'BAD' : x));
    assert.ok(!json.includes('NaN') && !json.includes('BAD') && !json.includes('Infinity'), `${type} ${JSON.stringify(over)}: ${json.slice(0, 200)}`);
  }
}
console.log('degenerate data: ok');

// ---------- CSV validation ----------
const v = (t: string, type: ChartSpec['type'] = 'line') => validateCsv(t, type, 8);
assert.equal(v('').errors.length, 1);
assert.equal(v('   \n  ').result, null);
assert.match(v('Дата,Выручка\n').errors[0].message, /заголовков/);
assert.match(v('a,b\nx,y\nz,w\n').errors[0].message, /ни одного числа/);
const ok = v('Дата,Выручка,Расходы\n01.10,100,50\n02.10,abc,60\n03.10,120\n');
assert.equal(ok.errors.length, 0);
assert.ok(ok.result);
assert.ok(ok.warnings.some((w) => w.line === 4 && /2 колонки вместо 3/.test(w.message)), JSON.stringify(ok.warnings));
assert.ok(ok.warnings.some((w) => w.line === 3 && /«abc»/.test(w.message)));
assert.match(ok.summary, /3 строки × 2 серии/);
assert.ok(v('X,Y\na,1\nb,2\n', 'scatter').warnings.some((w) => /1…N/.test(w.message)));
const pieCheck = v('Сектор,A,B\nx,5,1\ny,-2,1\n', 'pie');
assert.ok(pieCheck.warnings.some((w) => /первой серии/.test(w.message)) && pieCheck.warnings.some((w) => /≤ 0/.test(w.message)));
const many = v('a,b\n' + Array.from({ length: 12 }, (_, i) => `r${i},x${i}`).join('\n') + '\nz,1\n');
assert.ok(many.warnings.some((w) => /ещё 7/.test(w.message)), 'capped list');
// line numbers survive blank lines and quoted line breaks
assert.deepEqual(parseCsvRows('a,b\n\n"x\ny",1\nz,2').map((r) => r.line), [1, 3, 5]);
// delimiter-specific export
const t2 = { categories: ['Mon'], data: [[1.5]] };
assert.equal(toCsv(t2, ['A'], 'Day', ';'), 'Day;A\nMon;1,5\n');
assert.equal(toCsv(t2, ['A'], 'Day', '\t'), 'Day\tA\nMon\t1.5\n');
assert.deepEqual(gridToTable(parseCsv(toCsv(t2, ['A'], 'Day', ';')), 8).table, t2);
console.log('csv validation: ok');

// ---------- migration fills nested option groups ----------
const mg = migrateSpec({ ...v1, options: { ...v1.options, format: { prefix: '₽' } } });
assert.equal(mg.options.format.prefix, '₽');
assert.equal(mg.options.format.separators, 'en');
assert.deepEqual(mg.options.axis, DEFAULT_AXIS);
console.log('migrate nested: ok');
