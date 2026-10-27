// CSV source: RFC 4180 parsing (quotes, "" escapes, line breaks inside quotes) with delimiter auto-detection,
// validation with line numbers (CSV window) and export of the data table. Pure functions; file / clipboard IO
// lives in the UI.

import { parseNumber } from '../core/scale.ts';
import { isValue, type ChartType } from '../shared/types.ts';
import { formatCell, gridToTable, MAX_ROWS, type ImportResult, type TableData } from './table.ts';

export type Delimiter = ',' | ';' | '\t';
const DELIMITERS: Delimiter[] = ['\t', ';', ','];

export interface CsvRow {
  cells: string[];
  line: number; // 1-based line where the row starts
}

function parseWith(text: string, sep: string, maxRows = Infinity): CsvRow[] {
  const rows: CsvRow[] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  for (let i = 0; i < text.length && rows.length < maxRows; i++) {
    const ch = text[i];
    if (ch === '\n' || (ch === '\r' && text[i + 1] !== '\n')) line++;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') {
        i++;
        line++;
      }
      row.push(cell);
      rows.push({ cells: row, line: rowLine });
      row = [];
      cell = '';
      rowLine = line;
    } else cell += ch;
  }
  if (rows.length < maxRows && (cell !== '' || row.length)) {
    row.push(cell);
    rows.push({ cells: row, line: rowLine });
  }
  return rows;
}

const stripBom = (text: string) => text.replace(/^﻿/, '');

/**
 * Delimiter: the first of tab, `;`, `,` that splits the first lines into a consistent number (> 1) of columns.
 * `;` goes before `,` because `,` is also the decimal separator in RU/EU exports ("1,5;2,3").
 */
export function detectDelimiter(text: string): Delimiter {
  for (const sep of DELIMITERS) {
    const sample = parseWith(text, sep, 10).filter((r) => r.cells.some((c) => c.trim()));
    if (sample.length && sample.every((r) => r.cells.length > 1 && r.cells.length === sample[0].cells.length)) return sep;
  }
  for (const sep of DELIMITERS) if ((parseWith(text, sep, 1)[0]?.cells.length ?? 0) > 1) return sep;
  return ',';
}

/** CSV / TSV text → non-empty rows with trimmed cells and their line numbers. */
export function parseCsvRows(text: string, sep: Delimiter = detectDelimiter(stripBom(text))): CsvRow[] {
  return parseWith(stripBom(text), sep)
    .map((r) => ({ line: r.line, cells: r.cells.map((c) => c.trim()) }))
    .filter((r) => r.cells.some((c) => c));
}

/** CSV / TSV text → rows × trimmed cells, empty rows dropped. */
export function parseCsv(text: string): string[][] {
  return parseCsvRows(text).map((r) => r.cells);
}

/**
 * Table → CSV. Header row = first column title + series names.
 * `;` uses the decimal comma (RU / EU Excel), `,` and Tab — the decimal point.
 */
export function toCsv(table: TableData, names: string[], firstHeader: string, sep: Delimiter = ','): string {
  const escape = (v: string) => (v.includes(sep) || /["\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const num = (v: TableData['data'][number][number]) => (sep === ';' ? formatCell(v).replace('.', ',') : formatCell(v));
  const lines = [[firstHeader, ...table.data.map((_, i) => names[i] ?? `Серия ${i + 1}`)]];
  table.categories.forEach((c, r) => lines.push([c, ...table.data.map((s) => num(s[r]))]));
  return lines.map((l) => l.map(escape).join(sep)).join('\n') + '\n';
}

// ---------- validation ----------

export interface Issue {
  line?: number;
  message: string;
}

export interface CsvCheck {
  /** parsed table — null when there are errors */
  result: ImportResult | null;
  errors: Issue[];
  warnings: Issue[];
  delimiter: Delimiter;
  summary: string;
}

const MAX_ISSUES = 5;
const DELIM_NAMES: Record<Delimiter, string> = { ',': 'запятая', ';': 'точка с запятой', '\t': 'Tab' };

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};

/** Pushes at most MAX_ISSUES items of a kind, then one «ещё N» line. */
function capped(out: Issue[], items: Issue[], rest: (n: number) => string) {
  out.push(...items.slice(0, MAX_ISSUES));
  if (items.length > MAX_ISSUES) out.push({ message: rest(items.length - MAX_ISSUES) });
}

/** Everything the CSV window shows under the text field. Errors block «Применить», warnings do not. */
export function validateCsv(text: string, type: ChartType, maxSeries: number): CsvCheck {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const clean = stripBom(text);
  const delimiter = clean.trim() ? detectDelimiter(clean) : ',';
  const fail = (message: string, line?: number): CsvCheck => ({ result: null, errors: [{ line, message }], warnings, delimiter, summary: '' });

  if (!clean.trim()) return fail('Поле пустое — вставьте данные (Ctrl+V) или откройте файл.');
  const rows = parseCsvRows(clean, delimiter);
  if (rows.length === 1 && rows[0].cells.length > 1 && rows[0].cells.slice(1).every((c) => parseNumber(c) === null)) {
    return fail('Есть только строка заголовков — добавьте строки с данными.', rows[0].line);
  }
  const res = gridToTable(
    rows.map((r) => r.cells),
    maxSeries,
  );
  const header = res.names.size > 0;
  const dataRows = header ? rows.slice(1) : rows;
  const { categories, data } = res.table;

  if (!categories.length) return fail('Есть только строка заголовков — добавьте строки с данными.', rows[0]?.line);
  if (!data.some((s) => s.some(isValue))) {
    return fail(
      rows[0].cells.length < 2
        ? 'Нет чисел. Формат: первая колонка — категории, дальше по колонке на серию.'
        : 'В колонках серий нет ни одного числа — проверьте разделитель и формат чисел.',
      dataRows[0]?.line,
    );
  }

  // column count
  const width = header ? rows[0].cells.length : Math.max(...rows.map((r) => r.cells.length));
  capped(
    warnings,
    dataRows
      .filter((r) => r.cells.length !== width)
      .map((r) => ({
        line: r.line,
        message: `Строка ${r.line}: ${r.cells.length} ${plural(r.cells.length, 'колонка', 'колонки', 'колонок')} вместо ${width}${header && r.cells.length > width ? ' — лишние не попадут' : ''}`,
      })),
    (n) => `…и ещё ${n} ${plural(n, 'строка', 'строки', 'строк')} с другим числом колонок`,
  );

  // non-numeric cells in series columns
  const singleColumn = width === 1;
  const bad: Issue[] = [];
  dataRows.slice(0, MAX_ROWS).forEach((r) => {
    const cells = singleColumn ? r.cells.slice(0, 1) : r.cells.slice(1, 1 + data.length);
    cells.forEach((c, k) => {
      if (c && parseNumber(c) === null) {
        const series = res.names.get(k) ?? `Серия ${k + 1}`;
        bad.push({ line: r.line, message: `Строка ${r.line}, «${series}»: «${c}» — не число, будет пусто` });
      }
    });
  });
  capped(warnings, bad, (n) => `…и ещё ${n} ${plural(n, 'нечисловая ячейка', 'нечисловые ячейки', 'нечисловых ячеек')}`);

  if (res.truncatedRows) warnings.push({ message: `Строк больше ${MAX_ROWS} — лишние ${res.truncatedRows} не загрузятся` });
  if (res.truncatedSeries) warnings.push({ message: `Серий больше ${maxSeries} — лишние ${res.truncatedSeries} не загрузятся` });

  // categories
  const emptyCats = categories.filter((c) => !c).length;
  if (emptyCats && !singleColumn) warnings.push({ message: `Пустых категорий: ${emptyCats}` });
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const c of categories) (seen.has(c) ? dup : seen).add(c);
  dup.delete('');
  if (dup.size && type !== 'scatter') warnings.push({ message: `Повторяются категории: ${[...dup].slice(0, 4).join(', ')}${dup.size > 4 ? '…' : ''}` });

  // chart-specific
  if (type === 'scatter' && !singleColumn && categories.some((c) => parseNumber(c) === null)) {
    warnings.push({ message: 'Первая колонка (X) — не числа: по оси X будет 1…N' });
  }
  if (type === 'pie') {
    if (data.length > 1) warnings.push({ message: 'Круговая строится по первой серии, остальные не видны' });
    const skipped = data[0].filter((v) => isValue(v) && v <= 0).length;
    if (skipped) warnings.push({ message: `Значения ≤ 0 не попадут на круговую: ${skipped}` });
  }

  const summary = `${categories.length} ${plural(categories.length, 'строка', 'строки', 'строк')} × ${data.length} ${plural(data.length, 'серия', 'серии', 'серий')} · разделитель: ${DELIM_NAMES[delimiter]}`;
  return { result: res, errors, warnings, delimiter, summary };
}
