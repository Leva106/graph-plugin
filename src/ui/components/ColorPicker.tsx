import { useEffect, useRef, useState } from 'preact/hooks';
import { colorTokenName, type ColorRef } from '../../shared/types';
import { CHART_HUES, TONES, tokenHex } from '../../theme/palette';

const POPOVER_W = 316;

/**
 * Round swatch; click opens a popover with the DS chart palette (hue × tone).
 * The popover is `position: fixed` next to the swatch, so scrolling containers (data table) do not clip it.
 */
export function ColorPicker({ value, onChange, small }: { value: ColorRef; onChange: (c: ColorRef) => void; small?: boolean }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pos) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPos(null);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setPos(null);
    const drop = () => setPos(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    window.addEventListener('resize', drop);
    document.addEventListener('scroll', drop, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('resize', drop);
      document.removeEventListener('scroll', drop, true);
    };
  }, [pos]);

  const toggle = () => {
    if (pos || !btn.current) return setPos(null);
    const r = btn.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left - 8, window.innerWidth - POPOVER_W - 8));
    const below = r.bottom + 6;
    const top = below + 140 > window.innerHeight ? Math.max(8, r.top - 146) : below; // flip up near the bottom edge
    setPos({ top, left });
  };

  const name = colorTokenName(value);
  return (
    <div class="color-picker" ref={ref}>
      <button type="button" ref={btn} class={`swatch${small ? ' small' : ''}`} style={{ background: tokenHex(name) }} title={name} onClick={toggle} />
      {pos && (
        <div class="popover" role="dialog" style={{ top: `${pos.top}px`, left: `${pos.left}px` }}>
          <div class="popover-title">{name}</div>
          <div class="palette" style={{ '--cols': CHART_HUES.length }}>
            {TONES.map((tone) =>
              CHART_HUES.map((hue) => {
                const selected = hue === value.hue && tone === value.tone;
                return (
                  <button
                    type="button"
                    key={`${hue}-${tone}`}
                    class={`chip${selected ? ' selected' : ''}`}
                    style={{ background: tokenHex(`chart/${hue}/${tone}`) }}
                    title={`chart/${hue}/${tone}`}
                    onClick={() => {
                      onChange({ hue, tone });
                      setPos(null);
                    }}
                  />
                );
              }),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
