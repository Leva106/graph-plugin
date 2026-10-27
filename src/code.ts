// Figma sandbox entry.
import type { Prefs, Preset, SelectedChart, SelectedFrame, ToSandbox, ToUi } from './shared/messages';
import { migrateSpec } from './shared/migrate';
import { renderChart, SPEC_KEY } from './figma/render';
import { listTextStyles } from './figma/textStyles';
import { echartsTheme } from './theme/echarts';

const PREFS_KEY = 'prefs';
const PRESETS_KEY = 'presets';
const MAX_PRESETS = 50;
const post = (msg: ToUi) => figma.ui.postMessage(msg);

figma.showUI(__html__, { width: 380, height: 760, themeColors: true, title: 'Charts' });

/** Selected chart frame: the node itself or its closest ancestor carrying a chart spec. */
function findChart(): SelectedChart | null {
  const sel = figma.currentPage.selection;
  if (sel.length !== 1) return null;
  let node: BaseNode | null = sel[0];
  while (node && node.type !== 'PAGE') {
    if (node.type === 'FRAME') {
      const raw = node.getPluginData(SPEC_KEY);
      if (raw) {
        try {
          const spec = migrateSpec(JSON.parse(raw));
          return { id: node.id, name: node.name, spec, width: Math.round(node.width), height: Math.round(node.height) };
        } catch {
          return null;
        }
      }
    }
    node = node.parent;
  }
  return null;
}

/** A single selected plain frame (placeholder for «Вставить в фрейм»). */
function findFrame(): SelectedFrame | null {
  const sel = figma.currentPage.selection;
  if (sel.length !== 1 || sel[0].type !== 'FRAME') return null;
  const f = sel[0];
  return { id: f.id, name: f.name, width: Math.round(f.width), height: Math.round(f.height) };
}

function postSelection() {
  const chart = findChart();
  post({ type: 'selection', chart, frame: chart ? null : findFrame() });
}

async function loadPresets(): Promise<Preset[]> {
  const list = (await figma.clientStorage.getAsync(PRESETS_KEY)) as Preset[] | undefined;
  return Array.isArray(list) ? list.map((p) => ({ ...p, spec: migrateSpec(p.spec) })) : [];
}

async function savePresets(list: Preset[]) {
  await figma.clientStorage.setAsync(PRESETS_KEY, list);
  post({ type: 'presets', list });
}

async function init() {
  const [textStyles, vars, prefs, presets] = await Promise.all([
    listTextStyles(),
    figma.variables.getLocalVariablesAsync('COLOR'),
    figma.clientStorage.getAsync(PREFS_KEY) as Promise<Prefs | undefined>,
    loadPresets(),
  ]);
  post({ type: 'init', textStyles, colorVariableCount: vars.length, prefs: prefs ?? {}, presets });
  postSelection();
}

figma.on('selectionchange', postSelection);

function report(missing: string[], updated: boolean) {
  const what = updated ? 'График обновлён' : 'График создан';
  figma.notify(missing.length ? `${what}. Не найдено переменных: ${missing.length} — использованы hex` : what);
  post({ type: 'created', missingVariables: missing, updated });
}

/** Puts a new chart inside a placeholder frame: fills it and follows its size. */
function insertInto(parent: FrameNode, chart: FrameNode) {
  parent.appendChild(chart);
  if (parent.layoutMode !== 'NONE') {
    chart.layoutSizingHorizontal = 'FILL';
    chart.layoutSizingVertical = 'FILL';
  } else {
    chart.x = 0;
    chart.y = 0;
    chart.constraints = { horizontal: 'STRETCH', vertical: 'STRETCH' };
  }
}

figma.ui.onmessage = async (msg: ToSandbox) => {
  if (msg.type === 'save-prefs') {
    await figma.clientStorage.setAsync(PREFS_KEY, msg.prefs);
    return;
  }
  if (msg.type === 'save-preset') {
    const preset: Preset = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: msg.name, createdAt: Date.now(), spec: msg.spec };
    await savePresets([preset, ...(await loadPresets())].slice(0, MAX_PRESETS));
    figma.notify(`Пресет «${msg.name}» сохранён`);
    return;
  }
  if (msg.type === 'delete-preset') {
    await savePresets((await loadPresets()).filter((p) => p.id !== msg.id));
    return;
  }
  try {
    if (msg.type === 'create') {
      const parent = msg.parentId ? await figma.getNodeByIdAsync(msg.parentId) : null;
      if (msg.parentId && (!parent || parent.type !== 'FRAME')) throw new Error('Фрейм для вставки не найден — возможно, он удалён');
      const { frame, missingVariables } = await renderChart(msg.spec, echartsTheme);
      if (parent && parent.type === 'FRAME') {
        insertInto(parent, frame);
      } else {
        const center = figma.viewport.center;
        frame.x = Math.round(center.x - frame.width / 2);
        frame.y = Math.round(center.y - frame.height / 2);
        figma.viewport.scrollAndZoomIntoView([frame]);
      }
      figma.currentPage.selection = [frame];
      report(missingVariables, false);
    } else if (msg.type === 'update') {
      const node = await figma.getNodeByIdAsync(msg.id);
      if (!node || node.type !== 'FRAME') throw new Error('Выбранный график не найден — возможно, он удалён');
      const { frame, missingVariables } = await renderChart(msg.spec, echartsTheme, node);
      figma.currentPage.selection = [frame];
      report(missingVariables, true);
      postSelection();
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    figma.notify(`Ошибка: ${message}`, { error: true });
    post({ type: 'error', message });
  }
};

init();
