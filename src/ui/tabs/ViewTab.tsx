import { formatValue } from '../../core/format';
import type { TextStyleInfo } from '../../shared/messages';
import type { Decimals, NumberFormat, TextStyleIds } from '../../shared/types';
import { defaultColor } from '../../theme/palette';
import { ColorPicker } from '../components/ColorPicker';
import { Collapsible, NumberField, OptionalNumberField, Row, Section, Segmented, Select, Slider, Stepper, TextField, Toggle } from '../components/controls';
import type { Editor } from '../state';

const MAX_SLICE_ROWS = 60;

const DECIMALS: { id: string; label: string }[] = [
  { id: 'auto', label: 'Авто' },
  { id: '0', label: '0' },
  { id: '1', label: '1' },
  { id: '2', label: '2' },
  { id: '3', label: '3' },
];

const SEPARATORS: { id: NumberFormat['separators']; label: string }[] = [
  { id: 'en', label: '1,234.5' },
  { id: 'ru', label: '1 234,5' },
  { id: 'none', label: '1234.5' },
];

interface Props {
  ed: Editor;
  textStyles: TextStyleInfo[];
  onStyle: (k: keyof TextStyleIds, id: string) => void;
}

export function ViewTab({ ed, textStyles, onStyle }: Props) {
  const { type, options: o, table } = ed;
  const cartesian = type === 'line' || type === 'bar' || type === 'scatter';
  const f = o.format;
  const ax = o.axis;
  const badRange = ax.min !== null && ax.max !== null && ax.min >= ax.max;

  const styleOptions = [{ id: '', label: 'Inter (по умолчанию)' }, ...textStyles.map((s) => ({ id: s.id, label: `${s.name} · ${s.fontSize}` }))];
  const styleName = (id?: string) => textStyles.find((s) => s.id === id)?.name ?? 'Inter';
  const opacity = (
    <Row label="Прозрачность">
      <Slider value={o.areaOpacity} min={0.05} max={1} step={0.05} onChange={(v) => ed.setOpt('areaOpacity', v)} format={(v) => `${Math.round(v * 100)}%`} />
    </Row>
  );

  return (
    <>
      {type === 'line' && (
        <Section title="Линии">
          <Row label="Линия">
            <Segmented
              value={o.smooth ? 'smooth' : 'straight'}
              options={[
                { id: 'straight', label: 'Прямая' },
                { id: 'smooth', label: 'Сглаженная' },
              ]}
              onChange={(v) => ed.setOpt('smooth', v === 'smooth')}
            />
          </Row>
          <Row label="Заливка">
            <Toggle checked={o.area} onChange={(v) => ed.setOpt('area', v)} />
          </Row>
          {o.area && opacity}
          <Row label="Накопление">
            <Toggle checked={o.stack} onChange={(v) => ed.setOpt('stack', v)} />
          </Row>
          <Row label="Точки">
            <Toggle checked={o.showSymbols} onChange={(v) => ed.setOpt('showSymbols', v)} />
          </Row>
          <Row label="Порог">
            <div class="pair">
              {o.threshold.enabled && <NumberField value={o.threshold.value} onChange={(value) => ed.setOpt('threshold', { ...o.threshold, value })} />}
              <Toggle checked={o.threshold.enabled} onChange={(enabled) => ed.setOpt('threshold', { ...o.threshold, enabled })} />
            </div>
          </Row>
        </Section>
      )}

      {type === 'bar' && (
        <Section title="Столбцы">
          <Row label="Ориентация">
            <Segmented
              value={o.horizontal ? 'h' : 'v'}
              options={[
                { id: 'v', label: 'Вертикально' },
                { id: 'h', label: 'Горизонтально' },
              ]}
              onChange={(v) => ed.setOpt('horizontal', v === 'h')}
            />
          </Row>
          {!(o.horizontal && o.topN.enabled) && <Row label="Накопление">
            <Toggle checked={o.stack} onChange={(v) => ed.setOpt('stack', v)} />
          </Row>}
          {o.horizontal && <>
            <Row label="Top‑N"><Toggle checked={o.topN.enabled} onChange={(enabled) => ed.setOpt('topN', { ...o.topN, enabled })} /></Row>
            {o.topN.enabled && <>
              <Row label="Количество"><NumberField value={o.topN.count} min={1} max={500} onChange={(count) => ed.setOpt('topN', { ...o.topN, count: Math.max(1, Math.min(500, Math.round(count))) })} /></Row>
              {table.data.length > 1 && <Row label="Показатель"><Select value={String(Math.min(o.topN.series, table.data.length - 1))} options={table.data.map((_, i) => ({ id: String(i), label: ed.meta[i].name }))} onChange={(series) => ed.setOpt('topN', { ...o.topN, series: Number(series) })} /></Row>}
            </>}
          </>}
        </Section>
      )}

      {type === 'pie' && (
        <>
          <Section title="Круговая">
            <Row label="Кольцо">
              <Toggle checked={o.donut} onChange={(v) => ed.setOpt('donut', v)} />
            </Row>
            <Row label="Макс. секторов">
              <Stepper value={o.maxSlices} min={2} max={20} onChange={(v) => ed.setOpt('maxSlices', v)} />
            </Row>
          </Section>
          <Collapsible title="Цвета секторов" summary={`${table.categories.length}`}>
            {table.categories.slice(0, MAX_SLICE_ROWS).map((c, i) => (
              <div class="series-row" key={i}>
                <ColorPicker value={ed.catColors[i] ?? defaultColor(i)} onChange={(color) => ed.setSliceColor(i, color)} />
                <span class="series-label">{c || `#${i + 1}`}</span>
              </div>
            ))}
            {table.categories.length > MAX_SLICE_ROWS && <p class="hint">Показаны первые {MAX_SLICE_ROWS} категорий.</p>}
          </Collapsible>
        </>
      )}

      {type === 'scatter' && (
        <Section title="Точки">
          <Row label="Размер">
            <Slider value={o.symbolSize} min={4} max={24} step={1} onChange={(v) => ed.setOpt('symbolSize', v)} format={(v) => `${v}px`} />
          </Row>
        </Section>
      )}

      {type === 'radar' && (
        <Section title="Радар">
          <Row label="Заливка">
            <Toggle checked={o.area} onChange={(v) => ed.setOpt('area', v)} />
          </Row>
          {o.area && opacity}
          <Row label="Точки">
            <Toggle checked={o.showSymbols} onChange={(v) => ed.setOpt('showSymbols', v)} />
          </Row>
        </Section>
      )}
      {type === 'graph' && <Section title="Связи"><Row label="Стрелки"><Toggle checked={o.directed} onChange={(v) => ed.setOpt('directed', v)} /></Row></Section>}

      {(cartesian || type === 'radar') && (
        <Section title="Оси">
          {cartesian && <>
            <Row label="Ось X"><Toggle checked={ax.showX} onChange={(showX) => ed.setAxis({ showX })} /></Row>
            <Row label="Ось Y"><Toggle checked={ax.showY} onChange={(showY) => ed.setAxis({ showY })} /></Row>
          </>}
          <Row label={type === 'radar' ? 'Максимум' : 'Мин – макс'}>
            <div class="pair">
              {type !== 'radar' && (
                <>
                  <OptionalNumberField value={ax.min} invalid={badRange} onChange={(v) => ed.setAxis({ min: v })} />
                  <span class="dash">–</span>
                </>
              )}
              <OptionalNumberField value={ax.max} invalid={badRange} onChange={(v) => ed.setAxis({ max: v })} />
            </div>
          </Row>
          {badRange && <p class="hint error">Минимум должен быть меньше максимума — сейчас используется авто.</p>}
          {cartesian && (
            <>
              {ax.showX && <Row label="Название оси X">
                <TextField small value={ax.titleX} placeholder="нет" onInput={(v) => ed.setAxis({ titleX: v })} />
              </Row>}
              {ax.showY && <Row label="Название оси Y">
                <TextField small value={ax.titleY} placeholder="нет" onInput={(v) => ed.setAxis({ titleY: v })} />
              </Row>}
            </>
          )}
          <Row label="Сетка">
            <Toggle checked={ax.grid} onChange={(v) => ed.setAxis({ grid: v })} />
          </Row>
          {type !== 'scatter' && type !== 'radar' && (
            <Row label="Деления">
              <Toggle checked={ax.ticks} onChange={(v) => ed.setAxis({ ticks: v })} />
            </Row>
          )}
        </Section>
      )}

      {type !== 'pie' && type !== 'graph' && type !== 'gantt' && (
        <Section title="Формат чисел" aside={<span class="section-summary">{formatValue(-1234567.891, f)}</span>}>
          <Row label="Префикс · суффикс">
            <div class="pair">
              <TextField small value={f.prefix} placeholder="$" onInput={(v) => ed.setFormat({ prefix: v })} />
              <TextField small value={f.suffix} placeholder="%" onInput={(v) => ed.setFormat({ suffix: v })} />
            </div>
          </Row>
          <Row label="Знаков после запятой">
            <Select value={String(f.decimals)} options={DECIMALS} onChange={(v) => ed.setFormat({ decimals: (v === 'auto' ? 'auto' : Number(v)) as Decimals })} />
          </Row>
          <Row label="Сокращать (1.2k)">
            <Toggle checked={f.compact} onChange={(v) => ed.setFormat({ compact: v })} />
          </Row>
          <Row label="Разделители">
            <Segmented value={f.separators} options={SEPARATORS} onChange={(v) => ed.setFormat({ separators: v })} />
          </Row>
        </Section>
      )}

      <Section title="Фрейм">
        {type !== 'graph' && type !== 'gantt' && <Row label={type === 'pie' ? 'Подписи' : 'Значения'}>
          <Toggle checked={o.showLabels} onChange={(v) => ed.setOpt('showLabels', v)} />
        </Row>}
        {!['heatmap', 'treemap', 'gantt'].includes(type) && <Row label="Легенда">
          <Toggle checked={o.showLegend} onChange={(v) => ed.setOpt('showLegend', v)} />
        </Row>}
        <Row label="Заголовок">
          <Toggle checked={o.showTitle} onChange={(v) => ed.setOpt('showTitle', v)} />
        </Row>
        {o.showTitle && (
          <div class="row">
            <TextField value={ed.title} onInput={ed.setTitle} placeholder="Заголовок графика" />
          </div>
        )}
      </Section>

      <Collapsible title="Стили текста" summary={[ed.styleIds.title, ed.styleIds.axis, ed.styleIds.legend].map(styleName).join(' · ')}>
        {textStyles.length === 0 && <p class="hint">В файле нет локальных text styles — будет использован Inter.</p>}
        <Row label="Заголовок">
          <Select value={ed.styleIds.title ?? ''} options={styleOptions} onChange={(v) => onStyle('title', v)} />
        </Row>
        <Row label="Оси и значения">
          <Select value={ed.styleIds.axis ?? ''} options={styleOptions} onChange={(v) => onStyle('axis', v)} />
        </Row>
        <Row label="Легенда">
          <Select value={ed.styleIds.legend ?? ''} options={styleOptions} onChange={(v) => onStyle('legend', v)} />
        </Row>
      </Collapsible>
    </>
  );
}
