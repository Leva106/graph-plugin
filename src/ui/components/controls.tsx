import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

export function Section({ title, children, aside }: { title: string; children: ComponentChildren; aside?: ComponentChildren }) {
  return (
    <section class="section">
      <header class="section-head">
        <h2>{title}</h2>
        {aside}
      </header>
      <div class="card">{children}</div>
    </section>
  );
}

/** Section whose card folds away; `summary` is shown in the header while folded. */
export function Collapsible({ title, summary, children, defaultOpen = false }: { title: string; summary?: string; children: ComponentChildren; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section class={`section collapsible${open ? ' open' : ''}`}>
      <button type="button" class="section-head section-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <h2>
          <svg class="chevron" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
            <path d="M2.5 1 5.5 4l-3 3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {title}
        </h2>
        {!open && summary && <span class="section-summary">{summary}</span>}
      </button>
      {open && <div class="card">{children}</div>}
    </section>
  );
}

/** Row of small toggle chips (size presets etc.). */
export function Chips<T extends string>({ items, active, onPick }: { items: { id: T; label: string; title?: string }[]; active?: T | null; onPick: (id: T) => void }) {
  return (
    <div class="chips">
      {items.map((it) => (
        <button type="button" key={it.id} class={`chip-btn${it.id === active ? ' on' : ''}`} title={it.title} onClick={() => onPick(it.id)}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** Number field that can be empty (= auto). Invalid text is ignored, the field is marked. */
export function OptionalNumberField({ value, onChange, placeholder = 'авто', invalid }: { value: number | null; onChange: (v: number | null) => void; placeholder?: string; invalid?: boolean }) {
  return (
    <label class={`field${invalid ? ' invalid' : ''}`}>
      <input
        type="text"
        inputMode="decimal"
        value={value === null ? '' : String(value)}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = (e.target as HTMLInputElement).value.trim().replace(',', '.');
          if (!raw) return onChange(null);
          const v = Number(raw);
          if (Number.isFinite(v)) onChange(v);
          else (e.target as HTMLInputElement).value = value === null ? '' : String(value);
        }}
      />
    </label>
  );
}

export function Row({ label, children }: { label: ComponentChildren; children: ComponentChildren }) {
  return (
    <div class="row">
      <span class="row-label">{label}</span>
      <div class="row-control">{children}</div>
    </div>
  );
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} class={`toggle${checked ? ' on' : ''}`} onClick={() => onChange(!checked)}>
      <span class="knob" />
    </button>
  );
}

export function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div class="stepper">
      <button type="button" disabled={value <= min} onClick={() => set(value - 1)} aria-label="Меньше">−</button>
      <span class="stepper-value">{value}</span>
      <button type="button" disabled={value >= max} onClick={() => set(value + 1)} aria-label="Больше">+</button>
    </div>
  );
}

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  icon?: ComponentChildren; // shown instead of the label (label becomes the tooltip)
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: SegmentedOption<T>[]; onChange: (v: T) => void }) {
  const idx = Math.max(0, options.findIndex((o) => o.id === value));
  return (
    <div class="segmented" style={{ '--count': options.length, '--index': idx }}>
      <span class="segmented-thumb" />
      {options.map((o) => (
        <button
          type="button"
          key={o.id}
          class={`${o.id === value ? 'active' : ''}${o.icon ? ' icon' : ''}`}
          title={o.icon ? o.label : undefined}
          aria-label={o.label}
          onClick={() => onChange(o.id)}
        >
          {o.icon ?? o.label}
        </button>
      ))}
    </div>
  );
}

export function Select<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div class="select">
      <select value={value} onChange={(e) => onChange((e.target as HTMLSelectElement).value as T)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
      <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden="true"><path d="M1 4.5 4 1.5l3 3M1 7.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </div>
  );
}

export function NumberField({ value, onChange, min, max, suffix, disabled }: { value: number; onChange: (v: number) => void; min?: number; max?: number; suffix?: string; disabled?: boolean }) {
  return (
    <label class="field">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          const v = parseFloat((e.target as HTMLInputElement).value);
          if (Number.isFinite(v)) onChange(v);
        }}
      />
      {suffix && <span class="field-suffix">{suffix}</span>}
    </label>
  );
}

export function TextField({ value, onInput, placeholder, small }: { value: string; onInput: (v: string) => void; placeholder?: string; small?: boolean }) {
  return (
    <input class={`text-field${small ? ' small' : ''}`} type="text" value={value} placeholder={placeholder} onInput={(e) => onInput((e.target as HTMLInputElement).value)} />
  );
}

export function Slider({ value, min, max, step, onChange, format }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div class="slider">
      <input type="range" min={min} max={max} step={step} value={value} style={{ '--pct': `${pct}%` }} onInput={(e) => onChange(parseFloat((e.target as HTMLInputElement).value))} />
      <span class="slider-value">{format ? format(value) : value}</span>
    </div>
  );
}
