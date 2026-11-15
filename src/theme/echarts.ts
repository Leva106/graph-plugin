// Visual theme mimicking ECharts' default look. Every color is a DS variable name;
// swapping the look for another chart library = adding another ThemeSpec.

export interface FontFallback {
  family: string;
  style: string;
  size: number;
}

export interface ThemeSpec {
  id: string;
  /** insets from the frame edge to the plot area (title/legend/x-labels are added on top); `left` is a minimum */
  padding: { top: number; right: number; bottom: number; left: number };
  titleHeight: number;
  xLabelHeight: number;
  axisTitleHeight: number;
  axisLabelMargin: number; // ECharts axisLabel.margin
  tickLength: number;
  splitNumber: number; // max value-axis splits; fewer on small charts
  /** px per value-axis split: vertical axis / horizontal axis (horizontal labels are wider) */
  splitDensity: { vertical: number; horizontal: number };
  /** min free space between neighbouring category labels (ECharts auto interval) */
  minLabelGap: number;
  lineWidth: number;
  threshold: { color: string; width: number; dash: number[] };
  symbolSize: number;
  symbolStrokeWidth: number;
  smoothness: number;
  valueLabelOffset: number;
  legend: { itemWidth: number; itemHeight: number; itemGap: number; textGap: number; rowHeight: number; marginTop: number; sidePadding: number };
  bar: { categoryGap: number; seriesGap: number }; // ECharts barCategoryGap 20%, barGap 30%
  pie: { radius: number; radiusNoLabels: number; donutRatio: number; labelLine: [number, number]; borderWidth: number };
  radar: { radius: number; labelGap: number };
  scatter: { opacity: number };
  colors: {
    background: string;
    title: string;
    axisLabel: string;
    axisLine: string;
    splitLine: string;
    legendText: string;
    symbolFill: string;
    valueLabel: string;
  };
  fonts: { title: FontFallback; axis: FontFallback; legend: FontFallback };
}

export const echartsTheme: ThemeSpec = {
  id: 'echarts',
  padding: { top: 24, right: 40, bottom: 16, left: 64 },
  titleHeight: 40,
  xLabelHeight: 24,
  axisTitleHeight: 20,
  axisLabelMargin: 8,
  tickLength: 5,
  splitNumber: 5,
  splitDensity: { vertical: 48, horizontal: 90 },
  minLabelGap: 12,
  lineWidth: 2,
  threshold: { color: 'system/graphite/600', width: 1, dash: [5, 4] },
  symbolSize: 6,
  symbolStrokeWidth: 1.5,
  smoothness: 0.5,
  valueLabelOffset: 6,
  legend: { itemWidth: 25, itemHeight: 14, itemGap: 16, textGap: 5, rowHeight: 20, marginTop: 16, sidePadding: 16 },
  bar: { categoryGap: 0.2, seriesGap: 0.3 },
  pie: { radius: 0.75, radiusNoLabels: 0.9, donutRatio: 0.55, labelLine: [12, 12], borderWidth: 1 },
  radar: { radius: 0.8, labelGap: 8 },
  scatter: { opacity: 0.8 },
  colors: {
    background: 'system/graphite/0',
    title: 'system/graphite/800',
    axisLabel: 'system/graphite/600',
    axisLine: 'system/graphite/400',
    splitLine: 'system/graphite/100',
    legendText: 'system/graphite/700',
    symbolFill: 'system/graphite/0',
    valueLabel: 'system/graphite/700',
  },
  fonts: {
    title: { family: 'Inter', style: 'Semi Bold', size: 16 },
    axis: { family: 'Inter', style: 'Regular', size: 12 },
    legend: { family: 'Inter', style: 'Regular', size: 12 },
  },
};
