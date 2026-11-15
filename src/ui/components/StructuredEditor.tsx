import { useEffect, useRef, useState } from 'preact/hooks';
import { dataSheets, demoData, importSheet, MAX_STRUCTURED_ROWS, parseSheets, pasteSheet, sheetCsv, type DataSheet } from '../../data/structured';
import { isStructured } from '../../shared/types';
import { copyText, download, readText, type Editor } from '../state';
import { Section } from './controls';

export function StructuredEditor({ ed }: { ed: Editor }) {
  const [csvKey, setCsvKey] = useState<string | null>(null);
  const [pasteError, setPasteError] = useState('');
  const type = ed.type;
  if (!isStructured(type)) return null;
  const replace = (sheet: DataSheet) => ed.setSheets(ed.sheets.map(s => s.key === sheet.key ? sheet : s));
  return <>
    <div class="row"><span class="hint">{ed.typeNotice || 'Данные сохраняются вместе с графиком.'}</span></div>
    <p class="hint">{type === 'gantt' ? 'Дата: ГГГГ-ММ-ДД или ISO с временем. Без часового пояса — UTC; ось отображает UTC.' : type === 'treemap' ? 'У корня поле «Родитель» пустое. Значения родителей вычисляются из листьев.' : type === 'heatmap' ? 'Пустая ячейка — нет данных. 0 — нулевое значение. Заголовки часов можно заменить через CSV.' : type === 'graph' ? 'До 20 узлов. Порядок строк задаёт порядок на окружности.' : 'Положительные значения связей задают ширину потоков. Циклы не поддерживаются.'}</p>
    {ed.sheets.map(s => <Section key={s.key} title={s.title} aside={<button type="button" class="link" onClick={() => setCsvKey(s.key)}>CSV…</button>}>
      <div class="sheet-scroll"><table class="structured-table"><thead><tr>{s.columns.map((c, i) => <th key={i}>{c}</th>)}<th aria-label="Удаление строки" /></tr></thead><tbody>
        {s.rows.map((row, r) => <tr key={r}>{s.columns.map((col, c) => <td key={c}><input aria-label={`${s.title}, ${col}, строка ${r + 1}`} value={row[c] ?? ''}
          onInput={e => { const rows = s.rows.map(x => [...x]); rows[r][c] = e.currentTarget.value; replace({ ...s, rows }); }}
          onPaste={e => {
            const text = e.clipboardData?.getData('text/plain') ?? '';
            if (!/[\t\n\r]/.test(text)) return;
            e.preventDefault();
            try { replace(pasteSheet(s, r, c, text)); setPasteError(''); } catch (error) { setPasteError(String((error as Error).message)); }
          }} /></td>)}<td><button type="button" class="link remove-row" aria-label={`Удалить строку ${r + 1}`} onClick={() => replace({ ...s, rows: s.rows.filter((_, i) => i !== r) })}>×</button></td></tr>)}
      </tbody></table></div>
      <div class="data-table-foot"><button type="button" class="link" disabled={s.rows.length >= (type === 'graph' && s.key === 'nodes' ? 20 : type === 'heatmap' ? 31 : MAX_STRUCTURED_ROWS)} onClick={() => replace({ ...s, rows: [...s.rows, s.columns.map(() => '')] })}>+ Строка</button><span class="hint">{s.rows.length} строк</span></div>
    </Section>)}
    {pasteError && <p class="hint error" role="alert">{pasteError}</p>}
    {!!ed.errors.length && <div class="data-errors" role="alert"><p>Исправьте данные. Превью показывает последние корректные значения.</p>{ed.errors.slice(0, 8).map((e, i) => <p key={i}>{e}</p>)}{ed.errors.length > 8 && <p>Ещё ошибок: {ed.errors.length - 8}</p>}</div>}
    <button type="button" class="link" onClick={() => { ed.setSheets(dataSheets(demoData(type))); setPasteError(''); }}>Восстановить пример</button>
    {csvKey && <SheetCsv key={csvKey} ed={ed} sheet={ed.sheets.find(s => s.key === csvKey)!} onApply={replace} onClose={() => setCsvKey(null)} />}
  </>;
}

function SheetCsv({ ed, sheet, onApply, onClose }: { ed: Editor; sheet: DataSheet; onApply: (s: DataSheet) => void; onClose: () => void }) {
  const [text, setText] = useState(() => sheetCsv(sheet));
  const [fileError, setFileError] = useState('');
  const [copied, setCopied] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null), file = useRef<HTMLInputElement>(null);
  let draft: DataSheet | null = null, errors: string[] = [];
  try {
    draft = importSheet(sheet, text);
    if (isStructured(ed.type)) errors = parseSheets(ed.type, ed.sheets.map(s => s.key === sheet.key ? draft! : s)).errors;
  } catch (e) { errors = [(e as Error).message]; }
  // Linked tables are imported separately. Cross-table errors block chart creation,
  // not loading the first sheet (the second import may resolve the references).
  const apply = () => { if (draft) { onApply(draft); onClose(); } };
  useEffect(() => { area.current?.focus(); }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); apply(); } };
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key);
  });
  return <div class="modal" role="dialog" aria-modal="true" aria-label={`CSV: ${sheet.title}`}>
    <header class="modal-head"><h1>{sheet.title}: CSV</h1><button type="button" class="icon-btn" aria-label="Закрыть" onClick={onClose}>×</button></header>
    <div class="modal-toolbar"><div class="aside-links">
      <button type="button" class="link" onClick={async () => setCopied(await copyText(text, area.current))}>{copied ? 'Скопировано' : 'Копировать'}</button>
      <button type="button" class="link" onClick={() => file.current?.click()}>Открыть…</button>
      <button type="button" class="link" onClick={() => download(`${ed.type}-${sheet.key}.csv`, text)}>Скачать</button>
    </div></div>
    <input ref={file} type="file" accept=".csv,.tsv,.txt" hidden onChange={async e => { const f = e.currentTarget.files?.[0]; if (f) try { setText(await readText(f)); setFileError(''); } catch (error) { setFileError((error as Error).message); } }} />
    <textarea ref={area} class="csv-text sheet-csv" aria-label="Данные CSV" spellcheck={false} value={text} onInput={e => { setText(e.currentTarget.value); setCopied(false); }} />
    <div class="sheet-issues" role="status">{[...errors, ...(fileError ? [fileError] : [])].slice(0, 8).map((e, i) => <p class="hint error" key={i}>{e}</p>)}<p class="hint">{draft && errors.length ? 'Таблицу можно загрузить в редактор. До создания графика исправьте ошибки или загрузите связанную таблицу.' : !errors.length ? 'Данные проверены. Изменения применятся по кнопке.' : ''}</p></div>
    <div class="actions"><button type="button" class="secondary" onClick={onClose}>Отмена</button><button type="button" class="primary" disabled={!draft} onClick={apply}>Применить</button></div>
  </div>;
}
