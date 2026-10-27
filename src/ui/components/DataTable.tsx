import { addRow, formatCell, MAX_ROWS, pasteBlock, removeRow, setCell, type TableData } from '../../data/table';
import type { ColorRef } from '../../shared/types';
import { ColorPicker } from './ColorPicker';

interface Props {
  table: TableData;
  names: string[];
  /** series colors — a swatch in each column header; omitted (pie) → no swatches */
  colors?: ColorRef[];
  onColor?: (series: number, color: ColorRef) => void;
  firstHeader: string;
  maxSeries: number;
  onChange: (t: TableData) => void;
  onPaste: (t: TableData, names: Map<number, string>) => void;
  onRename: (series: number, name: string) => void;
  onAddSeries: () => void;
  onRemoveSeries: (series: number) => void;
  onOpenCsv: () => void;
}

const focusCell = (r: number, c: number) => {
  const el = document.querySelector<HTMLInputElement>(`.data-table input[data-r="${r}"][data-c="${c}"]`);
  el?.focus();
  el?.select();
};

/** Editable grid: column 0 = categories, then one column per series. Pasting a block from Excel/Sheets fills cells. */
export function DataTable({ table, names, colors, onColor, firstHeader, maxSeries, onChange, onPaste, onRename, onAddSeries, onRemoveSeries, onOpenCsv }: Props) {
  const rows = table.categories.length;
  const series = table.data.length;

  const cellProps = (r: number, c: number) => ({
    'data-r': r,
    'data-c': c,
    onChange: (e: Event) => onChange(setCell(table, r, c, (e.target as HTMLInputElement).value)),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || (e.key === 'ArrowDown' && !e.altKey)) {
        e.preventDefault();
        (e.target as HTMLInputElement).blur(); // commit
        if (r + 1 < rows) focusCell(r + 1, c);
        else if (e.key === 'Enter' && rows < MAX_ROWS) {
          onChange(addRow(setCell(table, r, c, (e.target as HTMLInputElement).value)));
          setTimeout(() => focusCell(r + 1, c));
        }
      } else if (e.key === 'ArrowUp' && r > 0) {
        e.preventDefault();
        (e.target as HTMLInputElement).blur();
        focusCell(r - 1, c);
      }
    },
    onPaste: (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text') ?? '';
      if (!/[\t\n]/.test(text.replace(/\n+$/, ''))) return; // single value — let the input handle it
      e.preventDefault();
      const res = pasteBlock(table, r, c, text, maxSeries);
      onPaste(res.table, res.names);
    },
  });

  return (
    <div class="data-table">
      <div class="data-table-scroll">
        <table>
          <thead>
            <tr>
              <th class="idx" />
              <th class="cat">{firstHeader}</th>
              {table.data.map((_, si) => (
                <th key={si}>
                  <div class="th-series">
                    {colors?.[si] && onColor && <ColorPicker small value={colors[si]} onChange={(c) => onColor(si, c)} />}
                    <input class="th-name" value={names[si] ?? ''} onInput={(e) => onRename(si, (e.target as HTMLInputElement).value)} />
                    {series > 1 && (
                      <button type="button" class="x" title="Удалить серию" onClick={() => onRemoveSeries(si)}>
                        ×
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.categories.map((cat, r) => (
              <tr key={r}>
                <td class="idx">
                  <span>{r + 1}</span>
                  {rows > 1 && (
                    <button type="button" class="x" title="Удалить строку" onClick={() => onChange(removeRow(table, r))}>
                      ×
                    </button>
                  )}
                </td>
                <td class="cat">
                  <input value={cat} {...cellProps(r, 0)} />
                </td>
                {table.data.map((s, si) => (
                  <td key={si}>
                    <input class="num" inputMode="decimal" value={formatCell(s[r])} {...cellProps(r, si + 1)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div class="data-table-foot">
        <button type="button" class="link" disabled={rows >= MAX_ROWS} onClick={() => onChange(addRow(table))}>
          + Строка
        </button>
        <button type="button" class="link" disabled={series >= maxSeries} onClick={onAddSeries}>
          + Серия
        </button>
        <button type="button" class="link" onClick={onOpenCsv}>
          CSV…
        </button>
        <span class="data-table-count">
          {rows} × {series}
        </span>
      </div>
    </div>
  );
}
