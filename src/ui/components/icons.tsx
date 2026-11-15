import type { ChartType } from '../../shared/types';

const P = { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;

/** 16×16 glyphs for the chart type picker. */
export function ChartIcon({ type }: { type: ChartType }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      {type === 'line' && <path d="M1.5 12 5.5 7l3 3 6-6.5" {...P} />}
      {type === 'bar' && (
        <g fill="currentColor">
          <rect x="2" y="7" width="3" height="7" rx="0.8" />
          <rect x="6.5" y="3" width="3" height="11" rx="0.8" />
          <rect x="11" y="9" width="3" height="5" rx="0.8" />
        </g>
      )}
      {type === 'pie' && (
        <g>
          <circle cx="8" cy="8" r="6" {...P} />
          <path d="M8 2v6l4.6 3.8" {...P} />
        </g>
      )}
      {type === 'scatter' && (
        <g fill="currentColor">
          <circle cx="3.5" cy="11.5" r="1.5" />
          <circle cx="7" cy="8" r="1.5" />
          <circle cx="12" cy="4" r="1.5" />
          <circle cx="11" cy="10" r="1.5" />
          <circle cx="5" cy="4.5" r="1.5" />
        </g>
      )}
      {type === 'radar' && (
        <g>
          <path d="M8 1.5 14.2 6 11.8 13.5H4.2L1.8 6Z" {...P} />
          <path d="M8 5 11 7.2 9.8 11H6.4L5.2 7.3Z" fill="currentColor" opacity="0.5" />
        </g>
      )}
      {type === 'graph' && <g {...P}><circle cx="8" cy="3" r="1.5" /><circle cx="3" cy="12" r="1.5" /><circle cx="13" cy="12" r="1.5" /><path d="M7 4.5 4 10.5M9 4.5l3 6M4.5 12h7" /></g>}
      {type === 'heatmap' && <g fill="currentColor">{[0, 1, 2].flatMap(r => [0, 1, 2].map(c => <rect key={`${r}${c}`} x={1 + c * 5} y={1 + r * 5} width="4" height="4" opacity={0.25 + (r + c) * 0.18} />))}</g>}
      {type === 'treemap' && <g {...P}><rect x="1.5" y="1.5" width="13" height="13" /><path d="M7 1.5v13M7 8h7.5" /></g>}
      {type === 'sankey' && <g {...P}><path d="M2 2v12M14 2v12M2 4C8 4 8 10 14 10M2 10C8 10 8 4 14 4" /></g>}
      {type === 'gantt' && <g stroke="currentColor" stroke-width="3"><path d="M1 3h6M5 8h6M9 13h6" /></g>}
    </svg>
  );
}
