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
    </svg>
  );
}
