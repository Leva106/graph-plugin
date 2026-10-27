import { useEffect, useRef, useState } from 'preact/hooks';
import type { Preset, SelectedFrame, TextStyleInfo, ToSandbox, ToUi } from '../shared/messages';
import type { ChartType, TextStyleIds } from '../shared/types';
import { echartsTheme } from '../theme/echarts';
import { Segmented, type SegmentedOption } from './components/controls';
import { CsvModal } from './components/CsvModal';
import { ChartIcon } from './components/icons';
import { PresetsMenu } from './components/PresetsMenu';
import { Preview } from './components/preview/Preview';
import { guessStyle, TYPE_LABELS, useChartEditor } from './state';
import { DataTab } from './tabs/DataTab';
import { ViewTab } from './tabs/ViewTab';

const send = (msg: ToSandbox) => parent.postMessage({ pluginMessage: msg }, '*');

type Tab = 'data' | 'view';
const TABS: { id: Tab; label: string }[] = [
  { id: 'data', label: 'Данные' },
  { id: 'view', label: 'Вид' },
];

const TYPE_OPTIONS: SegmentedOption<ChartType>[] = (Object.keys(TYPE_LABELS) as ChartType[]).map((id) => ({ id, label: TYPE_LABELS[id], icon: <ChartIcon type={id} /> }));

type Status = { kind: 'ok' | 'warn' | 'error'; text: string } | null;

export function App() {
  const ed = useChartEditor();
  const [textStyles, setTextStyles] = useState<TextStyleInfo[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [varCount, setVarCount] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('data');
  const [csvOpen, setCsvOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [frame, setFrame] = useState<SelectedFrame | null>(null);
  const editingId = useRef<string | null>(null);
  const stylesRef = useRef<TextStyleInfo[]>([]);

  /** Keeps only text style ids that exist in this file (presets may come from another file). */
  const localStyles = (ids: TextStyleIds): TextStyleIds => {
    const ok = (id?: string) => (id && stylesRef.current.some((s) => s.id === id) ? id : undefined);
    const out: TextStyleIds = {};
    for (const k of ['title', 'axis', 'legend'] as const) if (ok(ids[k])) out[k] = ids[k];
    return out;
  };

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const msg = e.data?.pluginMessage as ToUi | undefined;
      if (!msg) return;
      if (msg.type === 'init') {
        setTextStyles(msg.textStyles);
        stylesRef.current = msg.textStyles;
        setVarCount(msg.colorVariableCount);
        setPresets(msg.presets ?? []);
        const saved = msg.prefs.textStyles ?? {};
        const exists = (id?: string) => (id && msg.textStyles.some((s) => s.id === id) ? id : undefined);
        ed.setStyleIds((cur) => ({
          title: cur.title ?? exists(saved.title) ?? guessStyle(msg.textStyles, 16, /title|head|заголов/i),
          axis: cur.axis ?? exists(saved.axis) ?? guessStyle(msg.textStyles, 12, /caption|label|small|подпис/i),
          legend: cur.legend ?? exists(saved.legend) ?? guessStyle(msg.textStyles, 12, /caption|label|body|подпис/i),
        }));
      } else if (msg.type === 'selection') {
        const chart = msg.chart;
        setFrame(msg.frame ?? null);
        if (!chart) {
          editingId.current = null;
          setEditing(null);
        } else if (chart.id === editingId.current) {
          // same chart (e.g. a layer inside it selected, or frame resized by hand): only sync the size
          ed.setSize(chart.width, chart.height);
          setEditing({ id: chart.id, name: chart.name });
        } else {
          editingId.current = chart.id;
          setEditing({ id: chart.id, name: chart.name });
          ed.loadSpec(chart.spec, chart);
          setStatus(null);
        }
      } else if (msg.type === 'presets') {
        setPresets(msg.list);
      } else if (msg.type === 'created') {
        setBusy(false);
        const done = msg.updated ? 'График обновлён' : 'График создан';
        setStatus(
          msg.missingVariables.length
            ? { kind: 'warn', text: `${done}. Нет переменных в файле: ${msg.missingVariables.slice(0, 3).join(', ')}${msg.missingVariables.length > 3 ? '…' : ''}` }
            : { kind: 'ok', text: done },
        );
      } else if (msg.type === 'error') {
        setBusy(false);
        setStatus({ kind: 'error', text: msg.message });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const setStyle = (k: keyof TextStyleIds, id: string) => {
    const next = { ...ed.styleIds, [k]: id || undefined };
    ed.setStyleIds(next);
    send({ type: 'save-prefs', prefs: { textStyles: next } });
  };

  const submit = (mode: 'create' | 'update' | 'insert') => {
    setBusy(true);
    setStatus(null);
    if (mode === 'update' && editing) send({ type: 'update', id: editing.id, spec: ed.spec });
    else if (mode === 'insert' && frame) send({ type: 'create', spec: { ...ed.spec, width: frame.width, height: frame.height }, parentId: frame.id });
    else send({ type: 'create', spec: ed.spec });
  };

  const applyPreset = (p: Preset) => {
    ed.loadSpec(p.spec, p.spec, localStyles);
    setStatus({ kind: 'ok', text: `Пресет «${p.name}» загружен — настройте и создайте или обновите график` });
  };

  return (
    <div class="app">
      <div class="top">
        <div class="preview">
          <Preview spec={ed.spec} theme={echartsTheme} layout={ed.layout} />
          <span class="preview-size">
            {ed.width} × {ed.height}
          </span>
        </div>
        {editing ? (
          <div class="editing-badge" title={editing.name}>
            <span class="dot" />
            <span class="editing-name">{editing.name}</span>
          </div>
        ) : (
          frame && (
            <div class="editing-badge frame" title={frame.name}>
              <span class="dot" />
              <span class="editing-name">
                Фрейм «{frame.name}» {frame.width}×{frame.height} — можно вставить график
              </span>
            </div>
          )
        )}
        <div class="type-row">
          <div class="type-picker">
            <Segmented value={ed.type} options={TYPE_OPTIONS} onChange={ed.changeType} />
          </div>
          <PresetsMenu
            presets={presets}
            defaultName={ed.title || TYPE_LABELS[ed.type]}
            onSave={(name) => send({ type: 'save-preset', name, spec: ed.spec })}
            onApply={applyPreset}
            onDelete={(id) => send({ type: 'delete-preset', id })}
          />
        </div>
        <Segmented value={tab} options={TABS} onChange={setTab} />
      </div>

      <div class="scroll">
        {tab === 'data' && <DataTab ed={ed} frame={frame} onOpenCsv={() => setCsvOpen(true)} />}
        {tab === 'view' && <ViewTab ed={ed} textStyles={textStyles} onStyle={setStyle} />}
        {varCount === 0 && <p class="hint pad">В файле нет локальных color variables — цвета будут вставлены как hex.</p>}
      </div>

      <footer class="footer">
        {status && <div class={`status ${status.kind}`}>{status.text}</div>}
        {editing ? (
          <div class="actions">
            <button type="button" class="secondary" disabled={busy} onClick={() => submit('create')}>
              Создать новый
            </button>
            <button type="button" class="primary" disabled={busy} onClick={() => submit('update')}>
              {busy ? 'Обновляю…' : 'Обновить график'}
            </button>
          </div>
        ) : frame ? (
          <div class="actions">
            <button type="button" class="secondary" disabled={busy} onClick={() => submit('create')}>
              Создать отдельно
            </button>
            <button type="button" class="primary" disabled={busy} onClick={() => submit('insert')} title={`${frame.width} × ${frame.height}, растягивается вместе с фреймом`}>
              {busy ? 'Вставляю…' : `Вставить в «${frame.name}»`}
            </button>
          </div>
        ) : (
          <button type="button" class="primary" disabled={busy} onClick={() => submit('create')}>
            {busy ? 'Создаю…' : 'Создать график'}
          </button>
        )}
      </footer>

      {csvOpen && (
        <CsvModal
          spec={ed.spec}
          onClose={() => setCsvOpen(false)}
          onApply={(res) => {
            ed.applyImport(res);
            setStatus({ kind: 'ok', text: `Данные CSV применены: ${res.table.categories.length} × ${res.table.data.length}` });
          }}
        />
      )}
    </div>
  );
}
