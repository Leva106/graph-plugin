// Contract between UI, data sources (random / table / later CSV, LLM) and renderers (Figma, SVG preview).
// Deliberately close to an ECharts `option` so external configs can be mapped onto it later.

export interface ColorRef {
  hue: string; // chart hue from the DS, e.g. "indigo"
  tone: string; // "300" … "700"
}

export type StructuredType = 'heatmap' | 'graph' | 'treemap' | 'sankey' | 'gantt';
export type ChartType = 'line' | 'bar' | 'pie' | 'scatter' | 'radar' | StructuredType;
export const CHART_TYPES: ChartType[] = ['line', 'bar', 'pie', 'scatter', 'radar', 'heatmap', 'graph', 'treemap', 'sankey', 'gantt'];
export const isStructured = (type: ChartType): type is StructuredType => ['heatmap', 'graph', 'treemap', 'sankey', 'gantt'].includes(type);

export interface NetworkNode { id: string; name: string; group: string }
export interface NetworkLink { source: string; target: string }
export interface TreeItem { id: string; parent: string; name: string; value: number | null }
export interface GanttTask { id: string; name: string; start: number; end: number }
export type StructuredData =
  | { kind: 'heatmap'; hours: string[]; days: string[]; values: Value[][] }
  | { kind: 'graph'; nodes: NetworkNode[]; links: NetworkLink[] }
  | { kind: 'sankey'; nodes: NetworkNode[]; links: (NetworkLink & { value: number })[] }
  | { kind: 'treemap'; items: TreeItem[] }
  | { kind: 'gantt'; tasks: GanttTask[] };

/** `null` = empty table cell (skipped by the chart). */
export type Value = number | null;

export interface SeriesSpec {
  name: string;
  data: Value[];
  color: ColorRef;
}

/** One flat object for every chart type, so switching the type keeps the settings. */
export interface ChartOptions {
  directed: boolean;
  threshold: { enabled: boolean; value: number };
  topN: { enabled: boolean; count: number; series: number };
  // line (+ radar: area / areaOpacity / showSymbols)
  smooth: boolean;
  area: boolean;
  areaOpacity: number; // 0..1
  showSymbols: boolean;
  // line, bar
  stack: boolean;
  // bar: horizontal bars (categories on the Y axis)
  horizontal: boolean;
  // common
  showLabels: boolean; // value labels (line: last series, as in the ECharts stacked-area demo)
  showLegend: boolean;
  showTitle: boolean;
  // pie
  donut: boolean;
  maxSlices: number; // the rest is merged into «Другое»
  // scatter
  symbolSize: number;
  // numbers on value axes and value labels
  format: NumberFormat;
  // cartesian axes (+ radar: max, grid)
  axis: AxisOptions;
}

export type Decimals = 'auto' | 0 | 1 | 2 | 3;

export interface NumberFormat {
  prefix: string;
  suffix: string;
  decimals: Decimals;
  compact: boolean; // 1.2k / 3.4M (en) or 1,2 тыс. / 3,4 млн (ru)
  separators: 'en' | 'ru' | 'none'; // 1,234.5 · 1 234,5 · 1234.5
}

export interface AxisOptions {
  showX: boolean;
  showY: boolean;
  min: number | null; // null = auto
  max: number | null;
  titleX: string; // bottom axis title
  titleY: string; // left axis title
  grid: boolean; // split lines
  ticks: boolean; // tick marks on category axes
}

export const DEFAULT_FORMAT: NumberFormat = { prefix: '', suffix: '', decimals: 'auto', compact: false, separators: 'en' };
export const DEFAULT_AXIS: AxisOptions = { showX: true, showY: true, min: null, max: null, titleX: '', titleY: '', grid: true, ticks: true };

export const DEFAULT_OPTIONS: ChartOptions = {
  directed: false,
  threshold: { enabled: false, value: 0 },
  topN: { enabled: false, count: 10, series: 0 },
  smooth: true,
  area: false,
  areaOpacity: 0.3,
  showSymbols: true,
  stack: false,
  horizontal: false,
  showLabels: false,
  showLegend: true,
  showTitle: true,
  donut: false,
  maxSlices: 8,
  symbolSize: 10,
  format: DEFAULT_FORMAT,
  axis: DEFAULT_AXIS,
};

export interface TextStyleIds {
  title?: string;
  axis?: string;
  legend?: string;
}

/** How the data was produced — lets the UI restore its controls when a chart is re-opened. */
export type DataSource =
  | { kind: 'random'; seriesCount: number; points: number | 'auto'; min: number; max: number; seed: number; preset: string }
  | { kind: 'table' };

export const SPEC_VERSION = 5;

export interface ChartSpec {
  version: typeof SPEC_VERSION;
  type: ChartType;
  structured?: StructuredData;
  source?: DataSource;
  title: string;
  width: number;
  height: number;
  /** X categories; for scatter — numeric X values as strings */
  categories: string[];
  series: SeriesSpec[];
  /** pie: slice color per category (index = category index) */
  categoryColors?: ColorRef[];
  options: ChartOptions;
  textStyles: TextStyleIds;
}

/** `graphite` is the neutral system ramp (used for the pie «Другое» slice), everything else — `chart/*`. */
export const colorTokenName = (c: ColorRef) => (c.hue === 'graphite' ? `system/graphite/${c.tone}` : `chart/${c.hue}/${c.tone}`);
export const isValue = (v: Value | undefined): v is number => typeof v === 'number' && Number.isFinite(v);
