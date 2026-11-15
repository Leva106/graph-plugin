import assert from 'node:assert/strict';
import { dataSheets, demoData, importSheet, parseSheets, parseTime, pasteSheet, sheetCsv, validateStructured } from '../src/data/structured.ts';
import { computeLayout } from '../src/core/layout/index.ts';
import { migrateSpec } from '../src/shared/migrate.ts';
import { DEFAULT_OPTIONS, SPEC_VERSION, type ChartSpec, type StructuredData, type StructuredType } from '../src/shared/types.ts';
import { echartsTheme } from '../src/theme/echarts.ts';
import { COLOR_TOKENS } from '../src/theme/tokens.generated.ts';

const types: StructuredType[] = ['heatmap', 'graph', 'treemap', 'sankey', 'gantt'];
const spec = (data: StructuredData, patch: Partial<ChartSpec> = {}): ChartSpec => ({ version: SPEC_VERSION, type: data.kind, structured: data, title: '', width: 800, height: 420, categories: [], series: [], options: { ...DEFAULT_OPTIONS, showTitle: false }, textStyles: {}, ...patch });
const layout = (data: StructuredData, patch: Partial<ChartSpec> = {}) => {
  const l = computeLayout(spec(data, patch), echartsTheme);
  assert.equal(l.type, 'scene');
  if (l.type !== 'scene') throw new Error('scene expected');
  return l;
};
for (const type of types) {
  const data = demoData(type);
  assert.deepEqual(validateStructured(data), [], `${type}: demo valid`);
  const sheets = dataSheets(data);
  assert.deepEqual(parseSheets(type, sheets), { data, errors: [] }, `${type}: table round trip`);
  assert.deepEqual(parseSheets(type, sheets.map(s => importSheet(s, sheetCsv(s)))).data, data, `${type}: CSV round trip`);
  assert.deepEqual(migrateSpec(JSON.parse(JSON.stringify(spec(data)))).structured, data, `${type}: reopen`);
  for (const [width, height] of [[800, 420], [380, 240], [64, 40], [1200, 600]]) {
    const l = layout(data, { width, height });
    assert.deepEqual(l.errors, []);
    assert.ok(l.marks.length > 0);
    for (const mark of l.marks) {
      for (const [k, v] of Object.entries(mark)) if (typeof v === 'number') assert.ok(Number.isFinite(v), `${type}: ${k} finite`);
      if (mark.kind === 'path') assert.ok(!/NaN|Infinity/.test(mark.d), type);
      if (mark.kind === 'rect') assert.ok(mark.w > 0 && mark.h > 0);
      for (const c of [mark.fill, mark.stroke]) if (c) assert.ok(COLOR_TOKENS[c], `Missing token ${c}`);
    }
  }
}

for (const n of [1, 2, 20]) {
  const data: StructuredData = { kind: 'graph', nodes: Array.from({ length: n }, (_, i) => ({ id: String(i), name: `N${i}`, group: '' })), links: [] };
  const l = layout(data), again = layout(data);
  assert.deepEqual(l, again, 'deterministic circular');
  const nodes = l.marks.filter(m => m.kind === 'circle');
  assert.equal(nodes.length, n);
  const cx = 400, cy = (l.frame.body.y * 2 + l.frame.body.h) / 2;
  if (n === 1) { assert.equal(nodes[0].x, cx); assert.equal(nodes[0].y, cy); }
  else {
    assert.ok(Math.abs(nodes[0].x - cx) < 1e-8 && nodes[0].y < cy);
    const radii = nodes.map(m => Math.hypot(m.x - cx, m.y - cy));
    assert.ok(radii.every(r => Math.abs(r - radii[0]) < 1e-8));
  }
}
const g = demoData('graph');
assert.equal(g.kind, 'graph');
if (g.kind === 'graph') {
  assert.equal(validateStructured({ ...g, nodes: [...g.nodes, g.nodes[0]] }).length > 0, true);
  assert.ok(validateStructured({ ...g, links: [{ source: 'missing', target: '1' }] }).some(e => /не найден/.test(e)));
  assert.ok(validateStructured({ ...g, links: [{ source: '1', target: '1' }] }).some(e => /петли/.test(e)));
  assert.ok(validateStructured({ ...g, links: [g.links[0], g.links[0]] }).some(e => /повторная/.test(e)));
  assert.ok(validateStructured({ ...g, nodes: Array.from({ length: 21 }, (_, i) => ({ id: String(i), name: 'N', group: '' })), links: [] }).some(e => /20/.test(e)));
  const arrows = layout(g, { options: { ...DEFAULT_OPTIONS, directed: true } }).marks.filter(m => m.name.startsWith('Arrow'));
  assert.equal(arrows.length, g.links.length);
  assert.equal(validateStructured(g).length, 0, 'cycles in a graph are allowed');
}

const heat: StructuredData = { kind: 'heatmap', hours: ['00:00', '01:00'], days: ['Пн'], values: [[null, 0]] };
const cells = layout(heat).marks.filter(m => m.name.startsWith('Cell'));
assert.notEqual(cells[0].fill, cells[1].fill, 'missing is not zero');
assert.ok(validateStructured({ ...heat, hours: ['25:00', '01:00'] }).length);
const brokenHeat = dataSheets(heat); brokenHeat[0].rows[0][1] = 'oops';
assert.ok(parseSheets('heatmap', brokenHeat).errors.length);

const tree: StructuredData = { kind: 'treemap', items: [{ id: 'p', name: 'Parent', parent: '', value: 999 }, { id: 'a', name: 'A', parent: 'p', value: 3 }, { id: 'b', name: 'B', parent: 'p', value: 1 }] };
const tiles = layout(tree, { options: { ...DEFAULT_OPTIONS, showLabels: true } }).marks;
assert.ok(tiles.some(m => m.kind === 'text' && m.text === 'Parent: 4'), 'parents sum leaves, ignoring supplied parent values');
assert.ok(validateStructured({ kind: 'treemap', items: [{ id: 'a', name: 'A', parent: 'b', value: 1 }, { id: 'b', name: 'B', parent: 'a', value: 1 }] }).some(e => /цикл/.test(e)));
assert.ok(validateStructured({ kind: 'treemap', items: [{ id: 'a', name: 'A', parent: 'missing', value: 1 }] }).length);

const sankey = demoData('sankey');
if (sankey.kind === 'sankey') {
  assert.ok(validateStructured({ ...sankey, links: [...sankey.links, { source: '4', target: '1', value: 1 }] }).some(e => /цикл/.test(e)));
  assert.ok(validateStructured({ ...sankey, links: [{ source: '1', target: '3', value: -1 }] }).length);
  const l = layout(sankey), middle = l.marks.find(m => m.kind === 'rect' && m.name.startsWith('Node 3'));
  assert.ok(middle?.kind === 'rect');
  if (middle?.kind === 'rect') {
    const sources = l.marks.filter(m => m.kind === 'rect' && /^Node [12] /.test(m.name));
    assert.ok(Math.abs(sources.reduce((n, m) => n + (m.kind === 'rect' ? m.h : 0), 0) - middle.h) < 1e-6, 'flow widths conserve values');
  }
}
assert.equal(parseTime('2026-11-06'), Date.UTC(2026, 10, 6));
assert.equal(parseTime('2026-11-06T03:00:00+03:00'), Date.UTC(2026, 10, 6));
assert.equal(parseTime('2026-02-30'), null);
assert.equal(parseTime('06.11.2026'), null);
const gantt = demoData('gantt');
if (gantt.kind === 'gantt') {
  assert.ok(validateStructured({ ...gantt, tasks: [{ ...gantt.tasks[0], end: gantt.tasks[0].start - 1 }] }).length);
  const d = { ...gantt, tasks: [{ id: '1', name: 'A', start: 0, end: 100 }, { id: '2', name: 'B', start: 25, end: 75 }] };
  const bars = layout(d).marks.filter(m => m.kind === 'rect');
  assert.ok(bars[0].kind === 'rect' && bars[1].kind === 'rect' && Math.abs(bars[0].w / bars[1].w - 2) < 1e-9);
}
const nodes = dataSheets(demoData('graph'))[0];
const pasted = pasteSheet(nodes, 0, 0, 'ID\tНазвание\tГруппа\r\nX\tNode X\tGroup\r\nY\tNode Y\tGroup');
assert.deepEqual(pasted.rows.slice(0, 2), [['X', 'Node X', 'Group'], ['Y', 'Node Y', 'Group']]);
assert.throws(() => importSheet(nodes, 'wrong,header\na,b'));
assert.throws(() => pasteSheet(nodes, 0, 2, 'a\tb\tc'));
assert.ok(parseSheets('graph', [{ ...nodes, rows: [['1', '', '']] }, dataSheets(g)[1]]).errors.length);
console.log('structured charts: demos, CSV, validation, geometry, migration passed');
