import { parseNumber } from '../core/scale.ts';
import { parseCsv, parseCsvRows, detectDelimiter } from './csv.ts';
import type { StructuredData, StructuredType } from '../shared/types.ts';

export interface DataSheet { key: string; title: string; columns: string[]; rows: string[][] }
export const MAX_STRUCTURED_ROWS = 500;
const sheet = (key: string, title: string, columns: string[], rows: string[][]): DataSheet => ({ key, title, columns, rows });

export function demoData(type: StructuredType): StructuredData {
  switch (type) {
    case 'heatmap': return { kind: type, hours: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`), days: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], values: Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => d === 6 && h < 4 ? null : Math.round((h >= 8 && h <= 18 ? 50 : 8) * (0.3 + ((d * 17 + h * 7) % 19) / 19)))) };
    case 'graph': return { kind: type, nodes: ['Сервер', 'Пользователь', 'Устройство', 'Приложение', 'Адрес', 'Событие'].map((name, i) => ({ id: String(i + 1), name, group: i < 3 ? 'Объекты' : 'Активность' })), links: [{ source: '1', target: '2' }, { source: '1', target: '3' }, { source: '2', target: '4' }, { source: '3', target: '5' }, { source: '4', target: '6' }, { source: '6', target: '1' }] };
    case 'sankey': return { kind: type, nodes: ['Источник A', 'Источник B', 'Обработка', 'Результат A', 'Результат B'].map((name, i) => ({ id: String(i + 1), name, group: '' })), links: [{ source: '1', target: '3', value: 60 }, { source: '2', target: '3', value: 40 }, { source: '3', target: '4', value: 70 }, { source: '3', target: '5', value: 30 }] };
    case 'treemap': return { kind: type, items: [{ id: 'a', parent: '', name: 'Сервисы', value: null }, { id: 'b', parent: '', name: 'Данные', value: null }, { id: '1', parent: 'a', name: 'Приложения', value: 45 }, { id: '2', parent: 'a', name: 'Инфраструктура', value: 25 }, { id: '3', parent: 'b', name: 'Хранилище', value: 20 }, { id: '4', parent: 'b', name: 'Архив', value: 10 }] };
    case 'gantt': return { kind: type, tasks: ['Исследование', 'Проектирование', 'Разработка', 'Проверка'].map((name, i) => ({ id: String(i + 1), name, start: Date.UTC(2026, 10, 1 + i * 3), end: Date.UTC(2026, 10, 5 + i * 3) })) };
  }
}

export function dataSheets(data: StructuredData): DataSheet[] {
  switch (data.kind) {
    case 'heatmap': return [sheet('matrix', 'Значения по часам', ['День', ...data.hours], data.days.map((d, i) => [d, ...data.hours.map((_, j) => data.values[i]?.[j] == null ? '' : String(data.values[i][j]))]))];
    case 'graph': case 'sankey': return [
      sheet('nodes', 'Узлы', ['ID', 'Название', 'Группа'], data.nodes.map(n => [n.id, n.name, n.group])),
      sheet('links', 'Связи', ['Откуда', 'Куда', ...(data.kind === 'sankey' ? ['Значение'] : [])], data.links.map(l => [l.source, l.target, ...('value' in l ? [String(l.value)] : [])])),
    ];
    case 'treemap': return [sheet('items', 'Иерархия', ['ID', 'Родитель', 'Название', 'Значение'], data.items.map(n => [n.id, n.parent, n.name, n.value == null ? '' : String(n.value)]))];
    case 'gantt': return [sheet('tasks', 'Задачи', ['ID', 'Название', 'Начало', 'Конец'], data.tasks.map(t => [t.id, t.name, new Date(t.start).toISOString(), new Date(t.end).toISOString()]))];
  }
}

/** Dates without a zone are UTC, never the host machine's local timezone. */
export function parseTime(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(s)) return null;
  if (s.length > 10 && (Number(s.slice(11, 13)) > 23 || Number(s.slice(14, 16)) > 59 || (s[16] === ':' && Number(s.slice(17, 19)) > 59))) return null;
  const date = s.slice(0, 10);
  const d = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== date) return null;
  const iso = s.length === 10 ? `${s}T00:00:00Z` : s.replace(' ', 'T') + (/(Z|[+-]\d{2}:\d{2})$/.test(s) ? '' : 'Z');
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : null;
}

/** Kahn ordering is shared by validation and Sankey layout. */
export function graphOrder(ids: string[], links: { source: string; target: string }[]): string[] | null {
  const degree = new Map(ids.map(id => [id, 0]));
  const next = new Map(ids.map(id => [id, [] as string[]]));
  for (const l of links) {
    if (!degree.has(l.source) || !degree.has(l.target)) return null;
    degree.set(l.target, degree.get(l.target)! + 1); next.get(l.source)!.push(l.target);
  }
  const queue = ids.filter(id => degree.get(id) === 0);
  for (let i = 0; i < queue.length; i++) for (const id of next.get(queue[i])!) {
    degree.set(id, degree.get(id)! - 1); if (degree.get(id) === 0) queue.push(id);
  }
  return queue.length === ids.length ? queue : null;
}

export function validateStructured(data: StructuredData): string[] {
  const errors: string[] = [];
  const unique = (ids: string[], name: string) => {
    if (ids.some(id => !id.trim())) errors.push(`${name}: ID не может быть пустым.`);
    if (new Set(ids).size !== ids.length) errors.push(`${name}: ID должны быть уникальны.`);
    if (ids.length > MAX_STRUCTURED_ROWS) errors.push(`${name}: максимум ${MAX_STRUCTURED_ROWS} строк.`);
  };
  if (data.kind === 'heatmap') {
    if (!data.hours.length || !data.days.length) errors.push('Матрица должна содержать дни и часы.');
    if (data.hours.length > 24 || data.days.length > 31) errors.push('Матрица: максимум 24 часа и 31 день.');
    if (data.days.some(d => !d.trim()) || new Set(data.days).size !== data.days.length) errors.push('Названия дней должны быть заполнены и уникальны.');
    if (data.hours.some(h => !/^([01]\d|2[0-3]):00$/.test(h)) || new Set(data.hours).size !== data.hours.length) errors.push('Часы должны быть уникальными, в формате 00:00…23:00.');
    if (data.values.length !== data.days.length || data.values.some(row => row.length !== data.hours.length || row.some(v => v !== null && (!Number.isFinite(v) || v < 0)))) errors.push('Матрица: нужны неотрицательные числа или пустые ячейки.');
  } else if (data.kind === 'graph' || data.kind === 'sankey') {
    const ids = data.nodes.map(n => n.id); unique(ids, 'Узлы');
    if (!ids.length) errors.push('Добавьте хотя бы один узел.');
    if (data.kind === 'graph' && ids.length > 20) errors.push('Граф связей: максимум 20 узлов.');
    if (data.nodes.some(n => !n.name.trim())) errors.push('Заполните названия узлов.');
    if (data.links.length > MAX_STRUCTURED_ROWS) errors.push('Максимум 500 связей.');
    const idSet = new Set(ids), pairs = new Set<string>();
    data.links.forEach((l, i) => {
      const key = JSON.stringify([l.source, l.target]);
      if (!idSet.has(l.source) || !idSet.has(l.target)) errors.push(`Связь ${i + 1}: узел не найден.`);
      if (l.source === l.target) errors.push(`Связь ${i + 1}: петли не поддерживаются.`);
      if (pairs.has(key)) errors.push(`Связь ${i + 1}: повторная связь.`); pairs.add(key);
      if ('value' in l && (typeof l.value !== 'number' || !Number.isFinite(l.value) || l.value <= 0)) errors.push(`Связь ${i + 1}: значение должно быть больше нуля.`);
    });
    if (data.kind === 'sankey' && !errors.length && !graphOrder(ids, data.links)) errors.push('Sankey: циклы не поддерживаются.');
  } else if (data.kind === 'treemap') {
    const ids = data.items.map(n => n.id); unique(ids, 'Иерархия');
    const idSet = new Set(ids), parents = new Set(data.items.map(n => n.parent).filter(Boolean));
    if (!ids.length) errors.push('Добавьте элементы иерархии.');
    data.items.forEach((n, i) => {
      if (!n.name.trim()) errors.push(`Строка ${i + 1}: заполните название.`);
      if (n.parent && !idSet.has(n.parent)) errors.push(`Строка ${i + 1}: родитель не найден.`);
      if (!parents.has(n.id) && (n.value === null || !Number.isFinite(n.value) || n.value < 0)) errors.push(`Строка ${i + 1}: листу нужно неотрицательное значение.`);
    });
    if (!errors.length && !graphOrder(ids, data.items.filter(n => n.parent).map(n => ({ source: n.parent, target: n.id })))) errors.push('Иерархия содержит цикл.');
    if (!errors.length && !data.items.some(n => !parents.has(n.id) && (n.value ?? 0) > 0)) errors.push('Нужно хотя бы одно положительное значение листа.');
  } else {
    unique(data.tasks.map(t => t.id), 'Задачи');
    if (!data.tasks.length) errors.push('Добавьте хотя бы одну задачу.');
    data.tasks.forEach((t, i) => {
      if (!t.name.trim()) errors.push(`Задача ${i + 1}: заполните название.`);
      if (!Number.isFinite(t.start) || !Number.isFinite(t.end)) errors.push(`Задача ${i + 1}: некорректная дата.`);
      else if (t.end <= t.start) errors.push(`Задача ${i + 1}: конец должен быть позже начала.`);
    });
  }
  return errors;
}

export function parseSheets(type: StructuredType, sheets: DataSheet[]): { data: StructuredData; errors: string[] } {
  const errors: string[] = [];
  const rows = (key: string) => sheets.find(s => s.key === key)?.rows.filter(r => r.some(c => c.trim())) ?? [];
  const str = (r: string[], i: number) => (r[i] ?? '').trim();
  const num = (r: string[], i: number, label: string) => {
    const value = parseNumber(str(r, i));
    if (str(r, i) && value === null) errors.push(`${label}: «${str(r, i)}» — не число.`);
    return value;
  };
  let data: StructuredData;
  if (type === 'heatmap') {
    const hours = sheets.find(s => s.key === 'matrix')?.columns.slice(1) ?? [];
    const matrix = rows('matrix');
    data = { kind: type, hours, days: matrix.map(r => str(r, 0)), values: matrix.map((r, i) => hours.map((_, j) => num(r, j + 1, `Строка ${i + 1}`))) };
  } else if (type === 'graph' || type === 'sankey') {
    const nodes = rows('nodes').map(r => ({ id: str(r, 0), name: str(r, 1), group: str(r, 2) }));
    data = type === 'graph' ? { kind: type, nodes, links: rows('links').map(r => ({ source: str(r, 0), target: str(r, 1) })) } :
      { kind: type, nodes, links: rows('links').map((r, i) => ({ source: str(r, 0), target: str(r, 1), value: num(r, 2, `Связь ${i + 1}`) ?? 0 })) };
  } else if (type === 'treemap') {
    data = { kind: type, items: rows('items').map((r, i) => ({ id: str(r, 0), parent: str(r, 1), name: str(r, 2), value: num(r, 3, `Строка ${i + 1}`) })) };
  } else {
    data = { kind: type, tasks: rows('tasks').map(r => ({ id: str(r, 0), name: str(r, 1), start: parseTime(str(r, 2)) ?? NaN, end: parseTime(str(r, 3)) ?? NaN })) };
  }
  return { data, errors: [...errors, ...validateStructured(data)] };
}

export function sheetCsv(s: DataSheet): string {
  const quote = (v: string) => /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  return [s.columns, ...s.rows].map(r => r.map(quote).join(',')).join('\r\n') + '\r\n';
}

export function importSheet(s: DataSheet, text: string): DataSheet {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error('CSV пуст.');
  const header = rows.shift()!.map(v => v.trim());
  if (s.key === 'matrix') {
    if (header[0] !== 'День' || header.length < 2 || header.length > 25) throw new Error('Первая строка: День, затем часы 00:00…23:00.');
  } else if (header.join('\t') !== s.columns.join('\t')) throw new Error(`Ожидаются заголовки: ${s.columns.join(', ')}.`);
  if (rows.length > MAX_STRUCTURED_ROWS || rows.some(r => r.length !== header.length)) throw new Error('Проверьте число колонок; максимум 500 строк.');
  return { ...s, columns: header, rows };
}

export function pasteSheet(s: DataSheet, row: number, col: number, text: string): DataSheet {
  const block = parseCsvRows(text, text.includes('\t') ? '\t' : detectDelimiter(text)).map(r => r.cells);
  if (row === 0 && col === 0 && block[0]?.join('\t') === s.columns.join('\t')) block.shift();
  if (row + block.length > MAX_STRUCTURED_ROWS || block.some(r => col + r.length > s.columns.length)) throw new Error('Диапазон не помещается в таблицу (максимум 500 строк).');
  const out = s.rows.map(r => [...r]);
  block.forEach((r, i) => { while (out.length <= row + i) out.push(s.columns.map(() => '')); r.forEach((v, j) => { out[row + i][col + j] = v; }); });
  return { ...s, rows: out };
}
