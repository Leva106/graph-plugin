// Chart editor state for the UI: everything that becomes a ChartSpec, plus helpers shared by the tabs,
// the CSV window and the presets menu. App.tsx owns messaging with the sandbox; tabs get the `Editor` object.

import { useEffect, useRef, useState } from 'preact/hooks';
import { computeLayout } from '../core/layout';
import { AUTO_SCATTER_POINTS, autoPoints, makeCategories, randomScatter, randomSeries, type CategoryPreset } from '../data/random';
import type { ImportResult, TableData } from '../data/table';
import type { TextStyleInfo } from '../shared/messages';
import { DEFAULT_OPTIONS, SPEC_VERSION, isStructured, type StructuredType, type StructuredData, type ChartOptions, type ChartSpec, type ChartType, type ColorRef, type TextStyleIds, type Value } from '../shared/types';
import { dataSheets, demoData, parseSheets, type DataSheet } from '../data/structured';
import { echartsTheme } from '../theme/echarts';
import { defaultColor } from '../theme/palette';

export interface SeriesMeta {
  name: string;
  color: ColorRef;
}

export interface GenParams {
  seriesCount: number;
  points: number | 'auto';
  min: number;
  max: number;
  seed: number;
  preset: CategoryPreset;
}

export type SourceKind = 'random' | 'table';

export const MAX_SERIES = 8;
export const MAX_POINTS = 365;
export const MIN_W = 64;
export const MIN_H = 40;
export const MAX_SIZE = 4000;

export const TYPE_LABELS: Record<ChartType, string> = {
  line: 'Линейный',
  bar: 'Столбчатый',
  pie: 'Круговая',
  scatter: 'Точечная',
  radar: 'Радар',
  heatmap: 'Heatmap', graph: 'Граф связей', treemap: 'Treemap', sankey: 'Sankey', gantt: 'Диаграмма Ганта',
};

export const DEFAULT_TITLES: Record<ChartType, string> = {
  line: 'Line Chart',
  bar: 'Bar Chart',
  pie: 'Pie Chart',
  scatter: 'Scatter Chart',
  radar: 'Radar Chart',
  heatmap: 'Heatmap', graph: 'Граф связей', treemap: 'Treemap', sankey: 'Sankey', gantt: 'Диаграмма Ганта',
};

export const SIZE_PRESETS = [
  { label: '800×420', w: 800, h: 420 },
  { label: '1200×600', w: 1200, h: 600 },
  { label: '16:9', w: 960, h: 540 },
  { label: '4:3', w: 800, h: 600 },
  { label: '1:1', w: 600, h: 600 },
];

export const newSeed = () => Math.floor(Math.random() * 1e9);
export const metaFor = (i: number): SeriesMeta => ({ name: `Серия ${i + 1}`, color: defaultColor(i) });
export const firstHeaderFor = (type: ChartType) => (type === 'scatter' ? 'X' : type === 'pie' ? 'Сектор' : 'Категория');
const clampSize = (v: number, min: number) => Math.min(MAX_SIZE, Math.max(min, Math.round(v)));

/** Number of generated points; «авто» depends on the preset and the plot width (see autoPoints). */
export function resolvePoints(p: GenParams, type: ChartType, width: number): number {
  if (p.points !== 'auto') return p.points;
  if (type === 'scatter') return AUTO_SCATTER_POINTS;
  const t = echartsTheme;
  return autoPoints(p.preset, width - t.padding.left - t.padding.right, t.fonts.axis.size, t.minLabelGap);
}

/** Random data for the given chart type (scatter needs numeric X instead of category presets). */
export function generate(p: GenParams, type: ChartType, width: number): TableData {
  const q = { ...p, points: resolvePoints(p, type, width) };
  if (type === 'scatter') return randomScatter(q);
  return { categories: makeCategories(q.preset, q.points), data: randomSeries(q) };
}

/** Pads / trims every series to the category count. */
export const aligned = (categories: string[], data: Value[][]): Value[][] => data.map((d) => categories.map((_, i) => d[i] ?? null));

/** The same chart with another data table (CSV window preview). */
export function specWithTable(spec: ChartSpec, table: TableData, names: Map<number, string>): ChartSpec {
  return {
    ...spec,
    categories: table.categories,
    series: aligned(table.categories, table.data).map((data, i) => ({
      name: names.get(i) ?? spec.series[i]?.name ?? `Серия ${i + 1}`,
      color: spec.series[i]?.color ?? defaultColor(i),
      data,
    })),
    categoryColors: spec.type === 'pie' ? table.categories.map((_, i) => spec.categoryColors?.[i] ?? defaultColor(i)) : undefined,
  };
}

/** Picks a sensible default text style: closest size, bonus for matching words in the name. */
export function guessStyle(styles: TextStyleInfo[], size: number, words: RegExp): string | undefined {
  let best: TextStyleInfo | undefined;
  let bestScore = Infinity;
  for (const s of styles) {
    const score = Math.abs(s.fontSize - size) - (words.test(s.name) ? 3 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best?.id;
}

/** Reads a text file: UTF-8, or Windows-1251 (Excel on RU Windows) when it is not valid UTF-8. */
export async function readText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1251').decode(buf);
  }
}

export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })); // BOM: Excel reads UTF-8
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Clipboard write that also works where the async Clipboard API is blocked (Figma plugin iframe). */
export async function copyText(text: string, fallback?: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = fallback ?? document.createElement('textarea');
    const temp = !fallback;
    if (temp) {
      el.value = text;
      el.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(el);
    }
    el.focus();
    el.select();
    const ok = document.execCommand('copy');
    if (temp) el.remove();
    return ok;
  }
}

export const fileName = (title: string, ext: string) => `${(title || 'chart').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'chart'}.${ext}`;

const INITIAL_PARAMS: GenParams = { seriesCount: 3, points: 'auto', min: 0, max: 1000, seed: newSeed(), preset: 'weekdays-en' };

export function useChartEditor() {
  const [type, setType] = useState<ChartType>('line');
  const [sourceKind, setSourceKind] = useState<SourceKind>('random');
  const [params, setParams] = useState<GenParams>(INITIAL_PARAMS);
  // data is state (not derived) so a re-opened chart keeps its exact values until regenerated
  const [table, setTable] = useState<TableData>(() => generate(INITIAL_PARAMS, 'line', 800));
  const [meta, setMeta] = useState<SeriesMeta[]>(() => Array.from({ length: MAX_SERIES }, (_, i) => metaFor(i)));
  const [catColors, setCatColors] = useState<(ColorRef | undefined)[]>([]);
  const [title, setTitle] = useState(DEFAULT_TITLES.line);
  const [width, setWidthRaw] = useState(800);
  const [height, setHeightRaw] = useState(420);
  const [ratio, setRatio] = useState<number | null>(null); // locked W / H
  const [options, setOptions] = useState<ChartOptions>(DEFAULT_OPTIONS);
  const [styleIds, setStyleIds] = useState<TextStyleIds>({});
  const [sheetsByType, setSheetsByType] = useState<Partial<Record<StructuredType, DataSheet[]>>>({});
  const validData = useRef<Partial<Record<StructuredType, StructuredData>>>({});
  const [typeNotice, setTypeNotice] = useState('');

  const regenerate = (next: GenParams, t: ChartType = type) => {
    setParams(next);
    setTable(generate(next, t, width));
  };
  const setParam = <K extends keyof GenParams>(k: K, v: GenParams[K]) => regenerate({ ...params, [k]: v });

  // «Точки: авто» follows the width: regenerate (same seed) when the resolved count changes
  const resolvedPoints = resolvePoints(params, type, width);
  useEffect(() => {
    if (!isStructured(type) && sourceKind === 'random' && params.points === 'auto' && table.categories.length !== resolvedPoints) setTable(generate(params, type, width));
  }, [resolvedPoints, sourceKind, params.points]);

  const setSize = (w: number, h: number) => {
    setWidthRaw(clampSize(w, MIN_W));
    setHeightRaw(clampSize(h, MIN_H));
  };
  const setWidth = (w: number) => (ratio ? setSize(w, w / ratio) : setWidthRaw(clampSize(w, MIN_W)));
  const setHeight = (h: number) => (ratio ? setSize(h * ratio, h) : setHeightRaw(clampSize(h, MIN_H)));
  const toggleRatio = () => setRatio(ratio ? null : width / height);

  const changeType = (t: ChartType) => {
    if (t === type) return;
    if (!isStructured(type) && !isStructured(t) && sourceKind === 'random' && (t === 'scatter') !== (type === 'scatter')) regenerate(params, t);
    if (isStructured(t)) {
      if (!sheetsByType[t]) setSheetsByType(s => ({ ...s, [t]: dataSheets(demoData(t)) }));
      setTypeNotice(sheetsByType[t] ? 'Восстановлены данные этого типа графика.' : 'Загружен пример для этого типа. Данные предыдущего типа сохранены отдельно.');
    } else if (isStructured(type)) setTypeNotice('Восстановлена таблица обычных графиков.');
    else setTypeNotice('');
    if (title === DEFAULT_TITLES[type]) setTitle(DEFAULT_TITLES[t]);
    setType(t);
  };

  const changeSource = (k: SourceKind) => {
    if (k === sourceKind) return;
    setSourceKind(k);
    if (k === 'random') regenerate({ ...params, seriesCount: Math.max(1, table.data.length) });
    else setTable((t) => ({ categories: t.categories, data: aligned(t.categories, t.data) })); // start from the current data
  };

  const setOpt = <K extends keyof ChartOptions>(k: K, v: ChartOptions[K]) => setOptions((o) => ({ ...o, [k]: v }));
  const setFormat = (patch: Partial<ChartOptions['format']>) => setOptions((o) => ({ ...o, format: { ...o.format, ...patch } }));
  const setAxis = (patch: Partial<ChartOptions['axis']>) => setOptions((o) => ({ ...o, axis: { ...o.axis, ...patch } }));
  const updateMeta = (i: number, patch: Partial<SeriesMeta>) => setMeta((m) => m.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const renameSeries = (names: Map<number, string>) => {
    if (names.size) setMeta((m) => m.map((x, i) => (names.has(i) ? { ...x, name: names.get(i)! } : x)));
  };
  const removeSeriesMeta = (i: number) => setMeta((m) => [...m.filter((_, j) => j !== i), metaFor(MAX_SERIES - 1)]);
  const setSliceColor = (i: number, color: ColorRef) =>
    setCatColors((cc) => {
      const n = [...cc];
      n[i] = color;
      return n;
    });

  /** Replaces the data with an imported table (CSV window / file). */
  const applyImport = (res: ImportResult) => {
    setSourceKind('table');
    setTable(res.table);
    renameSeries(res.names);
  };

  /** Restores every control from a spec (selected chart or preset). `styles` filters text style ids of this file. */
  const loadSpec = (s: ChartSpec, size: { width: number; height: number }, styles: (ids: TextStyleIds) => TextStyleIds = (x) => x) => {
    const src = s.source?.kind === 'random' ? s.source : undefined;
    setType(s.type);
    setTypeNotice('');
    if (isStructured(s.type)) {
      const d = s.structured?.kind === s.type ? s.structured : demoData(s.type);
      setSheetsByType(prev => ({ ...prev, [s.type]: dataSheets(d) }));
      validData.current[d.kind] = d;
    }
    if (!isStructured(s.type)) {
      setSourceKind(src ? 'random' : 'table');
      const values = s.series.flatMap((x) => x.data).filter((v): v is number => typeof v === 'number');
      setParams({
      seriesCount: Math.max(1, s.series.length),
      points: src?.points ?? Math.max(2, s.categories.length),
      min: src?.min ?? 0,
      max: src?.max ?? Math.max(1, ...values),
      seed: src?.seed ?? newSeed(),
      preset: (src?.preset as CategoryPreset) ?? 'numbers',
    });
    setTable({ categories: s.categories, data: aligned(s.categories, s.series.map((x) => x.data)) });
    setMeta(Array.from({ length: MAX_SERIES }, (_, i) => (s.series[i] ? { name: s.series[i].name, color: s.series[i].color } : metaFor(i))));
      setCatColors(s.categoryColors ?? []);
    }
    setTitle(s.title);
    setOptions({ ...DEFAULT_OPTIONS, ...s.options });
    setStyleIds((cur) => ({ ...cur, ...styles(s.textStyles) }));
    setRatio(null);
    setSize(size.width, size.height);
  };

  const { categories, data } = table;
  const structuredType = isStructured(type) ? type : null;
  const sheets = structuredType ? sheetsByType[structuredType] ?? dataSheets(demoData(structuredType)) : [];
  const parsed = structuredType ? parseSheets(structuredType, sheets) : null;
  if (parsed && !parsed.errors.length) validData.current[parsed.data.kind] = parsed.data;
  const errors = parsed?.errors ?? [];
  const structured = structuredType ? validData.current[structuredType] ?? demoData(structuredType) : undefined;
  const setSheets = (next: DataSheet[]) => { if (structuredType) setSheetsByType(prev => ({ ...prev, [structuredType]: next })); };
  const spec: ChartSpec = {
    version: SPEC_VERSION,
    type,
    source: !structuredType && sourceKind === 'random' ? { kind: 'random', ...params } : { kind: 'table' },
    structured,
    title,
    width,
    height,
    categories: structuredType ? [] : categories,
    series: structuredType ? [] : aligned(categories, data).map((d, i) => ({ name: meta[i].name, color: meta[i].color, data: d })),
    categoryColors: type === 'pie' ? categories.map((_, i) => catColors[i] ?? defaultColor(i)) : undefined,
    options,
    textStyles: styleIds,
  };
  const layout = computeLayout(spec, echartsTheme);

  return {
    sheets, setSheets, errors, typeNotice,
    type,
    sourceKind,
    params,
    table,
    meta,
    catColors,
    title,
    width,
    height,
    ratio,
    options,
    styleIds,
    spec,
    layout,
    resolvedPoints,
    setTable,
    setTitle,
    setStyleIds,
    setParams,
    setParam,
    regenerate,
    changeType,
    changeSource,
    setSize,
    setWidth,
    setHeight,
    toggleRatio,
    setOpt,
    setFormat,
    setAxis,
    updateMeta,
    renameSeries,
    removeSeriesMeta,
    setSliceColor,
    applyImport,
    loadSpec,
  };
}

export type Editor = ReturnType<typeof useChartEditor>;
