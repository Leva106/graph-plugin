// Contract test with a small Figma API double. Does not replace visual testing in Figma.
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundled = await build({ stdin: { contents: `export { renderChart } from './src/figma/render'; export { computeLayout } from './src/core/layout'; export { demoData } from './src/data/structured'; export { migrateSpec } from './src/shared/migrate'; export { DEFAULT_OPTIONS, SPEC_VERSION } from './src/shared/types'; export { echartsTheme } from './src/theme/echarts'; export { COLOR_TOKENS } from './src/theme/tokens.generated';`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
let nextId = 0;
class Node {
  constructor(type) { this.id = String(++nextId); this.type = type; this.children = []; this.width = 100; this.height = 100; this.x = 0; this.y = 0; this.name = type; this.data = {}; this.fills = []; this.strokes = []; this.fontSize = 12; }
  appendChild(n) { if (n.parent) n.parent.children = n.parent.children.filter(c => c !== n); this.children.push(n); n.parent = this; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null; }
  resize(w, h) { assert.ok(Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0); this.width = w; this.height = h; }
  set characters(s) { this._characters = s; this.width = Math.max(1, s.length * this.fontSize * 0.6); this.height = this.fontSize * 1.2; }
  get characters() { return this._characters; }
  set vectorPaths(paths) { for (const p of paths) { assert.ok(!/NaN|Infinity|[eE]/.test(p.data), p.data); assert.ok(!/[A-BD-KN-Y]/.test(p.data), p.data); } this._paths = paths; }
  get vectorPaths() { return this._paths; }
  setPluginData(k, v) { this.data[k] = v; }
  getPluginData(k) { return this.data[k] ?? ''; }
  async setTextStyleIdAsync(id) { this.textStyleId = id; }
}
const vars = Object.keys(api.COLOR_TOKENS).map(name => ({ id: name, name, resolvedType: 'COLOR', remote: false }));
globalThis.figma = {
  createFrame: () => new Node('FRAME'), createText: () => new Node('TEXT'), createVector: () => new Node('VECTOR'), createEllipse: () => new Node('ELLIPSE'), createRectangle: () => new Node('RECTANGLE'),
  loadFontAsync: async () => {}, getStyleByIdAsync: async id => ({ id, type: 'TEXT', fontName: { family: 'Inter', style: 'Regular' } }),
  variables: { getLocalVariablesAsync: async () => vars, getVariableByIdAsync: async () => null, setBoundVariableForPaint: (paint, key, variable) => ({ ...paint, boundVariables: { [key]: { type: 'VARIABLE_ALIAS', id: variable.id } } }) },
};
const all = n => [n, ...n.children.flatMap(all)];
const spec = type => ({ version: api.SPEC_VERSION, type, title: type, width: 800, height: 420, categories: [], series: [], structured: api.demoData(type), options: { ...api.DEFAULT_OPTIONS, directed: true }, textStyles: { title: 'title-style', axis: 'axis-style', legend: 'legend-style' } });
for (const type of ['heatmap', 'graph', 'treemap', 'sankey', 'gantt']) {
  const s = spec(type);
  const { frame, missingVariables } = await api.renderChart(s, api.echartsTheme);
  assert.deepEqual(missingVariables, []);
  assert.deepEqual(JSON.parse(frame.getPluginData('chartSpec')), s);
  const layout = api.computeLayout(s, api.echartsTheme);
  const nodes = all(frame);
  assert.equal(nodes.filter(n => n.type === 'TEXT' && n.textStyleId === 'axis-style').length, layout.marks.filter(m => m.kind === 'text').length);
  for (const mark of layout.marks.filter(m => m.kind !== 'text')) assert.ok(nodes.some(n => n.name === mark.name), `${type}: ${mark.name}`);
  for (const n of nodes) {
    assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y));
    for (const paint of [...n.fills, ...n.strokes]) assert.ok(paint.boundVariables?.color, 'colors must keep variable bindings');
  }
  frame.x = 125; frame.y = 250; frame.name = 'Owned chart';
  const id = frame.id, count = nodes.length;
  const reloaded = api.migrateSpec(JSON.parse(frame.getPluginData('chartSpec')));
  const update = await api.renderChart(reloaded, api.echartsTheme, frame);
  assert.equal(update.frame.id, id); assert.equal(frame.name, 'Owned chart');
  assert.equal(frame.x, 125); assert.equal(frame.y, 250); assert.equal(all(frame).length, count);
  if (type === 'graph') {
    const savedChildren = [...frame.children];
    await assert.rejects(api.renderChart({ ...s, structured: { ...s.structured, links: [{ source: 'unknown', target: '1' }] } }, api.echartsTheme, frame));
    assert.deepEqual(frame.children, savedChildren, 'validation happens before existing layers are removed');
  }
}
const ranked = { ...spec('graph'), type: 'bar', structured: undefined, categories: ['a', 'b', 'c'], series: [{ name: 'A', data: [2, 10, 5], color: { hue: 'indigo', tone: '500' } }, { name: 'B', data: [100, 200, 300], color: { hue: 'grass', tone: '500' } }], options: { ...api.DEFAULT_OPTIONS, horizontal: true, topN: { enabled: true, count: 2, series: 0 } } };
const { frame } = await api.renderChart(ranked, api.echartsTheme);
assert.equal(all(frame).filter(n => n.type === 'RECTANGLE' && n.name.startsWith('Bar ')).length, 2);
assert.deepEqual(JSON.parse(frame.getPluginData('chartSpec')).categories, ['a', 'b', 'c']);
const threshold = { ...ranked, type: 'line', options: { ...api.DEFAULT_OPTIONS, threshold: { enabled: true, value: 500 } } };
const line = (await api.renderChart(threshold, api.echartsTheme)).frame;
assert.ok(all(line).some(n => n.name === 'Threshold' && n.dashPattern?.length === 2));
console.log('native renderer contract: bound variables, text styles, layers, persistence, update and validation passed');
