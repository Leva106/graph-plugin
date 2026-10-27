import { CATEGORY_PRESETS } from '../../data/random';
import { addSeries, removeSeries } from '../../data/table';
import type { SelectedFrame } from '../../shared/messages';
import { ColorPicker } from '../components/ColorPicker';
import { Chips, NumberField, Row, Section, Segmented, Select, Stepper, TextField } from '../components/controls';
import { DataTable } from '../components/DataTable';
import { firstHeaderFor, MAX_POINTS, MAX_SERIES, newSeed, SIZE_PRESETS, type Editor, type SourceKind } from '../state';

const SOURCES: { id: SourceKind; label: string }[] = [
  { id: 'random', label: 'Случайные' },
  { id: 'table', label: 'Таблица' },
];

export function DataTab({ ed, frame, onOpenCsv }: { ed: Editor; frame: SelectedFrame | null; onOpenCsv: () => void }) {
  const { type, params, table, meta, layout } = ed;
  const cat = layout.type === 'cartesian' ? layout.category : null;

  const sizeChips = [
    ...SIZE_PRESETS.map((p) => ({ id: `${p.w}x${p.h}`, label: p.label, title: `${p.w} × ${p.h}` })),
    ...(frame ? [{ id: `${frame.width}x${frame.height}`, label: `Как «${frame.name}»`, title: `${frame.width} × ${frame.height}` }] : []),
  ];
  const pickSize = (id: string) => {
    const [w, h] = id.split('x').map(Number);
    ed.setSize(w, h);
  };

  return (
    <>
      <Section title="Размер">
        <div class="row row-wrap">
          <Chips items={sizeChips} active={`${ed.width}x${ed.height}`} onPick={pickSize} />
        </div>
        <Row label="Ширина × высота">
          <div class="pair">
            <NumberField value={ed.width} min={200} max={4000} onChange={ed.setWidth} suffix="W" />
            <button
              type="button"
              class={`icon-btn lock${ed.ratio ? ' on' : ''}`}
              title={ed.ratio ? 'Пропорции закреплены' : 'Закрепить пропорции'}
              aria-pressed={!!ed.ratio}
              onClick={ed.toggleRatio}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <rect x="2.5" y="5.5" width="7" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" />
                <path d={ed.ratio ? 'M4 5.5V4a2 2 0 0 1 4 0v1.5' : 'M4 5.5V4a2 2 0 0 1 3.8-.9'} fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
              </svg>
            </button>
            <NumberField value={ed.height} min={150} max={4000} onChange={ed.setHeight} suffix="H" />
          </div>
        </Row>
        {cat && cat.total > 1 && (
          <p class="hint">
            {cat.interval > 1
              ? `Подписей по оси: ${cat.shown} из ${cat.total} (каждая ${cat.interval}-я). На графике все ${cat.total} точек.`
              : `Подписей по оси: все ${cat.total}.`}
          </p>
        )}
      </Section>

      <Section
        title="Данные"
        aside={
          <div class="aside-links">
            <button type="button" class="link" onClick={onOpenCsv} title="Текст CSV: скопировать, вставить, открыть файл">
              CSV…
            </button>
            {ed.sourceKind === 'random' && (
              <button type="button" class="link" onClick={() => ed.setParam('seed', newSeed())}>
                Сгенерировать
              </button>
            )}
          </div>
        }
      >
        <div class="row">
          <Segmented value={ed.sourceKind} options={SOURCES} onChange={ed.changeSource} />
        </div>
        {ed.sourceKind === 'random' ? (
          <>
            <Row label="Серии">
              <Stepper value={params.seriesCount} min={1} max={MAX_SERIES} onChange={(v) => ed.setParam('seriesCount', v)} />
            </Row>
            <Row label="Точки">
              <div class="pair">
                <button
                  type="button"
                  class={`auto-chip${params.points === 'auto' ? ' on' : ''}`}
                  title="Количество точек по пресету и ширине графика"
                  onClick={() => (params.points === 'auto' ? ed.setParams({ ...params, points: ed.resolvedPoints }) : ed.setParam('points', 'auto'))}
                >
                  Авто
                </button>
                <NumberField
                  value={ed.resolvedPoints}
                  min={2}
                  max={MAX_POINTS}
                  disabled={params.points === 'auto'}
                  onChange={(v) => ed.setParam('points', Math.min(MAX_POINTS, Math.max(2, Math.round(v))))}
                />
              </div>
            </Row>
            <Row label="Диапазон">
              <div class="pair">
                <NumberField value={params.min} onChange={(v) => ed.setParam('min', v)} />
                <span class="dash">–</span>
                <NumberField value={params.max} onChange={(v) => ed.setParam('max', v)} />
              </div>
            </Row>
            {type !== 'scatter' && (
              <Row label="Категории">
                <Select value={params.preset} options={CATEGORY_PRESETS} onChange={(v) => ed.setParam('preset', v)} />
              </Row>
            )}
            {type !== 'pie' &&
              table.data.map((_, i) => (
                <div class="series-row" key={i}>
                  <ColorPicker value={meta[i].color} onChange={(color) => ed.updateMeta(i, { color })} />
                  <TextField value={meta[i].name} onInput={(name) => ed.updateMeta(i, { name })} />
                </div>
              ))}
          </>
        ) : (
          <DataTable
            table={table}
            names={meta.map((m) => m.name)}
            colors={type === 'pie' ? undefined : meta.map((m) => m.color)}
            onColor={(i, color) => ed.updateMeta(i, { color })}
            firstHeader={firstHeaderFor(type)}
            onOpenCsv={onOpenCsv}
            maxSeries={MAX_SERIES}
            onChange={ed.setTable}
            onPaste={(t, names) => {
              ed.setTable(t);
              ed.renameSeries(names);
            }}
            onRename={(i, name) => ed.updateMeta(i, { name })}
            onAddSeries={() => ed.setTable((t) => (t.data.length < MAX_SERIES ? addSeries(t) : t))}
            onRemoveSeries={(i) => {
              ed.setTable((t) => removeSeries(t, i));
              ed.removeSeriesMeta(i);
            }}
          />
        )}
      </Section>
      {ed.sourceKind === 'table' && <p class="hint pad">Вставьте диапазон из Excel или Google Sheets в любую ячейку — таблица расширится. Первая строка без чисел станет названиями серий.</p>}
      {type === 'pie' && table.data.length > 1 && <p class="hint pad">Круговая диаграмма строится по первой серии. Цвета секторов — во вкладке «Вид».</p>}
      {type === 'scatter' && ed.sourceKind === 'table' && <p class="hint pad">Первая колонка — значения X (числа).</p>}
    </>
  );
}
