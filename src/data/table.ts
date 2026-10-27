// Table data source: pure helpers behind the editable data grid in the UI.
// Column 0 = categories (X values for scatter), columns 1… = series. Values are series-major like ChartSpec.

import { parseNumber } from '../core/scale.ts';
import type { Value } from '../shared/types.ts';

export const MAX_ROWS = 500;

export interface TableData {
  categories: string[];
  data: Value[][]; // [series][row]
}

export const parseCell = (text: string): Value => parseNumber(text);

export function formatCell(v: Value | undefined): string {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
}

/** Splits clipboard text from Excel / Google Sheets / CSV into rows × cells. */
export function parseGrid(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n');
  const sep = text.includes('\t') ? '\t' : text.includes(';') ? ';' : null;
  return lines.map((l) => (sep ? l.split(sep) : [l]).map((c) => c.trim().replace(/^"(.*)"$/, '$1')));
}

const rowCount = (t: TableData) => t.categories.length;

export function addRow(t: TableData, at = rowCount(t)): TableData {
  if (rowCount(t) >= MAX_ROWS) return t;
  const categories = [...t.categories];
  categories.splice(at, 0, '');
  return { categories, data: t.data.map((s) => { const c = [...s]; c.splice(at, 0, null); return c; }) };
}

export function removeRow(t: TableData, at: number): TableData {
  if (rowCount(t) <= 1) return t;
  return { categories: t.categories.filter((_, i) => i !== at), data: t.data.map((s) => s.filter((_, i) => i !== at)) };
}

export function addSeries(t: TableData): TableData {
  return { ...t, data: [...t.data, t.categories.map(() => null)] };
}

export function removeSeries(t: TableData, at: number): TableData {
  if (t.data.length <= 1) return t;
  return { ...t, data: t.data.filter((_, i) => i !== at) };
}

export function setCell(t: TableData, row: number, col: number, text: string): TableData {
  if (col === 0) return { ...t, categories: t.categories.map((c, i) => (i === row ? text : c)) };
  return { ...t, data: t.data.map((s, si) => (si === col - 1 ? s.map((v, i) => (i === row ? parseCell(text) : v)) : s)) };
}

/** A first row without numbers in the series columns (col ≥ 1 of the table) is a header row. */
function isHeader(grid: string[][], col: number): boolean {
  const cells = grid[0]?.filter((_, c) => col + c >= 1) ?? [];
  return grid.length > 1 && cells.some((c) => c) && cells.every((c) => parseCell(c) === null);
}

export interface ImportResult {
  table: TableData;
  names: Map<number, string>;
  firstHeader?: string;
  truncatedRows: number;
  truncatedSeries: number;
}

/**
 * Whole grid (CSV file) → a new table. Column 0 = categories, the rest = series; a header row gives series names.
 * A single column of numbers becomes one series with categories 1…N.
 */
export function gridToTable(input: string[][], maxSeries: number): ImportResult {
  let grid = input.filter((r) => r.some((c) => c.trim()));
  const names = new Map<number, string>();
  let firstHeader: string | undefined;
  let width = Math.max(1, ...grid.map((r) => r.length));
  if (width > 1 && isHeader(grid, 0)) {
    width = Math.max(2, grid[0].length); // the header defines the columns; extra cells in longer rows are ignored
    firstHeader = grid[0][0] || undefined;
    grid[0].slice(1, maxSeries + 1).forEach((c, i) => c && names.set(i, c));
    grid = grid.slice(1);
  }
  const rows = grid.slice(0, MAX_ROWS);
  const truncatedRows = grid.length - rows.length;
  if (width === 1) {
    return {
      table: { categories: rows.map((_, i) => String(i + 1)), data: [rows.map((r) => parseCell(r[0] ?? ''))] },
      names,
      firstHeader,
      truncatedRows,
      truncatedSeries: 0,
    };
  }
  const series = Math.min(maxSeries, width - 1);
  return {
    table: {
      categories: rows.map((r) => r[0] ?? ''),
      data: Array.from({ length: series }, (_, si) => rows.map((r) => parseCell(r[si + 1] ?? ''))),
    },
    names,
    firstHeader,
    truncatedRows,
    truncatedSeries: width - 1 - series,
  };
}

/**
 * Pastes a block of cells with its top-left corner at (row, col), growing the table as needed.
 * A first pasted row without numbers in the series columns is treated as a header → series names.
 */
export function pasteBlock(t: TableData, row: number, col: number, text: string, maxSeries: number): { table: TableData; names: Map<number, string> } {
  let grid = parseGrid(text);
  const names = new Map<number, string>();
  if (isHeader(grid, col)) {
    grid[0].forEach((c, k) => {
      if (col + k >= 1 && col + k - 1 < maxSeries && c) names.set(col + k - 1, c);
    });
    grid = grid.slice(1);
  }
  const categories = [...t.categories];
  const data = t.data.map((s) => [...s]);
  const width = Math.max(0, ...grid.map((r) => r.length));
  const needSeries = Math.min(maxSeries, Math.max(data.length, col - 1 + width));
  while (data.length < needSeries) data.push(categories.map(() => null));
  const rows = Math.min(MAX_ROWS, Math.max(categories.length, row + grid.length));
  while (categories.length < rows) {
    categories.push('');
    for (const s of data) s.push(null);
  }
  grid.forEach((cells, r) => {
    const ri = row + r;
    if (ri >= rows) return;
    cells.forEach((c, k) => {
      const ci = col + k;
      if (ci === 0) categories[ri] = c;
      else if (ci - 1 < data.length) data[ci - 1][ri] = parseCell(c);
    });
  });
  return { table: { categories, data }, names };
}
