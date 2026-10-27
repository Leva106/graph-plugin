import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { computeLayout } from '../../core/layout';
import { toCsv, validateCsv, type Delimiter, type Issue } from '../../data/csv';
import type { ImportResult } from '../../data/table';
import type { ChartSpec } from '../../shared/types';
import { echartsTheme } from '../../theme/echarts';
import { copyText, download, fileName, firstHeaderFor, MAX_SERIES, readText, specWithTable } from '../state';
import { Segmented } from './controls';
import { Preview } from './preview/Preview';

const DELIMS: { id: Delimiter; label: string }[] = [
  { id: ',', label: ',' },
  { id: ';', label: ';' },
  { id: '\t', label: 'Tab' },
];

interface Props {
  spec: ChartSpec; // the chart as it is now in the plugin
  onApply: (res: ImportResult) => void;
  onClose: () => void;
}

/** The current data as an import result (the «last valid» draft before any edit). */
function currentResult(spec: ChartSpec): ImportResult {
  return {
    table: { categories: spec.categories, data: spec.series.map((s) => s.data) },
    names: new Map(spec.series.map((s, i) => [i, s.name])),
    truncatedRows: 0,
    truncatedSeries: 0,
  };
}

const serialize = (spec: ChartSpec, res: ImportResult, sep: Delimiter) =>
  toCsv(
    res.table,
    res.table.data.map((_, i) => res.names.get(i) ?? spec.series[i]?.name ?? `Серия ${i + 1}`),
    firstHeaderFor(spec.type),
    sep,
  );

/**
 * CSV window: the chart data as text — copy it out, paste new data in (Ctrl/Cmd+A, C, V), open or save a file.
 * The draft is isolated: the chart in the plugin changes only on «Применить», which is disabled while the text
 * has errors (empty field included), so clearing the field can never break the chart.
 */
export function CsvModal({ spec, onApply, onClose }: Props) {
  const initial = useMemo(() => currentResult(spec), []);
  const [sep, setSep] = useState<Delimiter>(',');
  const [text, setText] = useState(() => serialize(spec, initial, ','));
  const [lastValid, setLastValid] = useState<ImportResult>(initial);
  const [copied, setCopied] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);

  const check = useMemo(() => validateCsv(text, spec.type, MAX_SERIES), [text, spec.type]);
  const valid = !check.errors.length && check.result;
  useEffect(() => {
    if (check.result && !check.errors.length) setLastValid(check.result);
  }, [check]);

  const draftSpec = specWithTable(spec, lastValid.table, lastValid.names);
  const draftLayout = computeLayout(draftSpec, echartsTheme);

  const apply = () => {
    if (!valid) return;
    onApply(check.result!);
    onClose();
  };

  useEffect(() => {
    area.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        apply();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const changeSep = (s: Delimiter) => {
    setSep(s);
    setText(serialize(spec, valid ? check.result! : lastValid, s)); // re-serialize the last valid draft
  };

  const copy = async () => {
    const ok = await copyText(text, area.current);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 1500);
  };

  const openFile = async (f: File) => setText(await readText(f));

  /** Select line `n` (1-based) in the text field. */
  const goToLine = (n: number) => {
    const el = area.current;
    if (!el) return;
    const lines = text.split('\n');
    const start = lines.slice(0, n - 1).reduce((s, l) => s + l.length + 1, 0);
    el.focus();
    el.setSelectionRange(start, start + (lines[n - 1]?.length ?? 0));
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 16;
    el.scrollTop = Math.max(0, (n - 3) * lh);
  };

  const issue = (kind: 'error' | 'warn') => (it: Issue, i: number) =>
    it.line ? (
      <button type="button" key={`${kind}${i}`} class={`issue ${kind} link-like`} onClick={() => goToLine(it.line!)} title={`Перейти к строке ${it.line}`}>
        {it.message}
      </button>
    ) : (
      <div key={`${kind}${i}`} class={`issue ${kind}`}>
        {it.message}
      </div>
    );

  return (
    <div class="modal" role="dialog" aria-modal="true" aria-label="Данные CSV">
      <header class="modal-head">
        <h1>Данные CSV</h1>
        <button type="button" class="icon-btn" aria-label="Закрыть" title="Закрыть (Esc)" onClick={onClose}>
          ×
        </button>
      </header>

      <div class={`preview modal-preview${valid ? '' : ' stale'}`}>
        <Preview spec={draftSpec} theme={echartsTheme} layout={draftLayout} />
        {!valid && (
          <div class="preview-overlay">
            <span>{text.trim() ? 'Исправьте ошибки — на превью последние корректные данные' : 'Нет данных — вставьте CSV (Ctrl+V) или откройте файл'}</span>
            <button type="button" class="link" onClick={() => setText(serialize(spec, initial, sep))}>
              Вернуть текущие данные
            </button>
          </div>
        )}
      </div>

      <div class="modal-toolbar">
        <Segmented value={text.trim() ? check.delimiter : sep} options={DELIMS} onChange={changeSep} />
        <div class="aside-links">
          <button type="button" class="link" onClick={copy}>
            {copied ? 'Скопировано ✓' : 'Копировать'}
          </button>
          <button type="button" class="link" onClick={() => file.current?.click()}>
            Открыть…
          </button>
          <button type="button" class="link" onClick={() => download(fileName(spec.title, 'csv'), text)}>
            Скачать
          </button>
        </div>
        <input
          ref={file}
          type="file"
          accept=".csv,.tsv,.txt,text/csv"
          hidden
          onChange={(e) => {
            const input = e.target as HTMLInputElement;
            const f = input.files?.[0];
            if (f) openFile(f);
            input.value = '';
          }}
        />
      </div>

      <textarea
        ref={area}
        class={`csv-text${check.errors.length ? ' invalid' : ''}`}
        value={text}
        wrap="off"
        spellcheck={false}
        placeholder={'Категория,Серия 1,Серия 2\nЯнв,120,80\nФев,135,95'}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
      />

      <div class="issues" aria-live="polite">
        {check.errors.map(issue('error'))}
        {check.warnings.map(issue('warn'))}
        {valid && <div class="issue ok">{check.summary}</div>}
      </div>

      <footer class="modal-foot">
        <span class="kbd-hint">⌘/Ctrl+Enter — применить<br />Esc — закрыть</span>
        <div class="actions">
          <button type="button" class="secondary" onClick={onClose}>
            Отмена
          </button>
          <button type="button" class="primary" disabled={!valid} onClick={apply}>
            Применить
          </button>
        </div>
      </footer>
    </div>
  );
}
