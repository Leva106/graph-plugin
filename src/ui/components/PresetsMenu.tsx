import { useEffect, useRef, useState } from 'preact/hooks';
import type { Preset } from '../../shared/messages';
import { ChartIcon } from './icons';

interface Props {
  presets: Preset[];
  defaultName: string;
  onSave: (name: string) => void;
  onApply: (p: Preset) => void;
  onDelete: (id: string) => void;
}

const pad2 = (v: number) => (v < 10 ? `0${v}` : String(v));
const date = (ms: number) => {
  const d = new Date(ms);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;
};

/**
 * Saved charts (full spec with data and size). Pick one → it is loaded into the editor to tweak and create /
 * update a chart. Presets are not updated in place: save a new one, delete the old one.
 */
export function PresetsMenu({ presets, defaultName, onSave, onApply, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const save = () => {
    onSave(name.trim() || defaultName);
    setName('');
  };

  return (
    <div class="presets" ref={ref}>
      <button
        type="button"
        class={`icon-btn presets-btn${open ? ' on' : ''}`}
        title="Пресеты графиков"
        aria-label="Пресеты графиков"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          setConfirm(null);
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M3.5 1.5h7a.5.5 0 0 1 .5.5v10.4a.3.3 0 0 1-.48.24L7 10.1l-3.52 2.54a.3.3 0 0 1-.48-.24V2a.5.5 0 0 1 .5-.5Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
        </svg>
        {presets.length > 0 && <span class="badge">{presets.length}</span>}
      </button>

      {open && (
        <div class="popover presets-pop" role="dialog" aria-label="Пресеты">
          <div class="popover-title">Пресеты</div>
          {presets.length === 0 ? (
            <p class="hint presets-empty">Пока пусто. Сохраните текущий график — потом его можно выбрать и настроить иначе.</p>
          ) : (
            <ul class="presets-list">
              {presets.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    class="preset-item"
                    onClick={() => {
                      onApply(p);
                      setOpen(false);
                    }}
                  >
                    <span class="preset-icon">
                      <ChartIcon type={p.spec.type} />
                    </span>
                    <span class="preset-text">
                      <span class="preset-name">{p.name}</span>
                      <span class="preset-meta">
                        {p.spec.width}×{p.spec.height} · {p.spec.categories.length}×{p.spec.series.length} · {date(p.createdAt)}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    class={`preset-del${confirm === p.id ? ' confirm' : ''}`}
                    title="Удалить пресет"
                    onClick={() => {
                      if (confirm === p.id) {
                        onDelete(p.id);
                        setConfirm(null);
                      } else setConfirm(p.id);
                    }}
                  >
                    {confirm === p.id ? 'Удалить?' : '×'}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div class="presets-save">
            <input
              class="text-field"
              type="text"
              value={name}
              placeholder={defaultName}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
            />
            <button type="button" class="primary small" onClick={save}>
              Сохранить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
