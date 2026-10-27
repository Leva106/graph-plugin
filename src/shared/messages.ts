import type { ChartSpec, TextStyleIds } from './types';

export interface TextStyleInfo {
  id: string;
  name: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: string;
}

export interface Prefs {
  textStyles?: TextStyleIds;
}

/** A saved chart (full spec with data and size) — `figma.clientStorage`, shared across files. */
export interface Preset {
  id: string;
  name: string;
  createdAt: number;
  spec: ChartSpec;
}

/** A chart frame found in the current selection; width/height are the frame's current (possibly hand-resized) size. */
export interface SelectedChart {
  id: string;
  name: string;
  spec: ChartSpec;
  width: number;
  height: number;
}

/** A plain frame (not a chart) selected — the chart can be inserted into it as a placeholder. */
export interface SelectedFrame {
  id: string;
  name: string;
  width: number;
  height: number;
}

/** sandbox → UI */
export type ToUi =
  | { type: 'init'; textStyles: TextStyleInfo[]; colorVariableCount: number; prefs: Prefs; presets: Preset[] }
  | { type: 'selection'; chart: SelectedChart | null; frame: SelectedFrame | null }
  | { type: 'presets'; list: Preset[] }
  | { type: 'created'; missingVariables: string[]; updated: boolean }
  | { type: 'error'; message: string };

/** UI → sandbox */
export type ToSandbox =
  | { type: 'create'; spec: ChartSpec; parentId?: string }
  | { type: 'update'; id: string; spec: ChartSpec }
  | { type: 'save-prefs'; prefs: Prefs }
  | { type: 'save-preset'; name: string; spec: ChartSpec }
  | { type: 'delete-preset'; id: string };
