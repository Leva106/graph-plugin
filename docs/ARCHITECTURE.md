# Архитектура graph-plugin

Схемы в Mermaid — рендерятся в VS Code (Markdown Preview Mermaid), GitHub, Obsidian.

## 1. Общая картина

```mermaid
flowchart LR
  subgraph Build["Сборка (Node)"]
    T["tokens/*.tokens.json<br/>экспорт variables из Figma"] -->|npm run tokens| G["src/theme/tokens.generated.ts<br/>имя → VariableID + hex light/dark"]
    B["build.mjs (esbuild)"] --> CJS["dist/code.js<br/>(ES2017, iife)"]
    B --> HTML["dist/ui.html<br/>(JS+CSS inline)"]
  end

  subgraph UI["UI iframe — Preact (src/ui)"]
    App["App.tsx<br/>сообщения, шапка, футер"]
    Ed["state.ts · useChartEditor<br/>type, source, table, meta, options, styles"]
    Tabs["tabs/DataTab · ViewTab<br/>CsvModal · PresetsMenu"]
    App --> Ed
    App --> Tabs
    Prev["preview/* (SVG)"]
    DT["DataTable.tsx"]
    App --> Prev
    App --> DT
  end

  subgraph Sandbox["Sandbox — Figma API (src/code.ts)"]
    Code["code.ts<br/>сообщения, selection"]
    R["figma/render.ts<br/>фрейм · заголовок · легенда"]
    RC["figma/cartesian.ts · polar.ts"]
    V["figma/variables.ts<br/>ColorResolver"]
    TS["figma/textStyles.ts"]
    Code --> R --> V
    R --> RC
    R --> TS
  end

  subgraph Shared["Общий код (без Figma API)"]
    Types["shared/types.ts<br/>ChartSpec v3 · migrate.ts"]
    Core["core/: scale · path · text<br/>layout/: common · axis · cartesian · pie · radar"]
    Theme["theme/: echarts.ts (ThemeSpec) · palette.ts"]
    Data["data/random.ts · table.ts · csv.ts<br/>(позже llm.ts)"]
  end

  App <-->|"postMessage<br/>shared/messages.ts"| Code
  App --> Data
  Prev --> Core
  R --> Core
  Core --> Theme
  Theme --> G
  V --> G
  R --> Doc[("Документ Figma<br/>фрейм + pluginData 'chartSpec'")]
  V -.->|bind| Vars[("Local variables<br/>chart/*, system/graphite/*")]
  TS -.->|apply| Styles[("Local text styles")]
```

Ключевая идея: **ChartSpec** (что рисуем) и **ThemeSpec** (как выглядит) разделены, а геометрия считается в
одном месте — `core/layout.ts`. Её используют и SVG-превью, и рендер в Figma, поэтому они совпадают.

## 2. Поток данных

```mermaid
flowchart LR
  Src["Источник данных<br/>random · table · CSV · (LLM)"] --> Spec["ChartSpec v3<br/>type, categories, series[] (null = пусто),<br/>options, categoryColors, textStyles, source, W×H"]
  Spec --> Layout["computeLayout(spec, theme)<br/>→ cartesian | pie | radar<br/>nice-scale, прореживание подписей, пути"]
  Theme["ThemeSpec (echarts)"] --> Layout
  Layout --> SVG["SVG-превью (UI)"]
  Layout --> Figma["render.ts → слои Figma"]
  Figma --> PD["frame.setPluginData('chartSpec')"]
  PD -->|"выделение фрейма → migrateSpec"| Spec
```

Прореживание: `categoryAxis` считает шаг категорий и показывает каждую k-ю подпись
(`k = ceil((макс. ширина подписи + minLabelGap) / шаг)`), `valueAxis` выбирает число делений по длине оси.
Точки и столбцы рисуются все. Подсказку «Подписей по оси: N из M» UI берёт из `layout.category`.

## 3. Сообщения UI ↔ sandbox

```mermaid
sequenceDiagram
  participant UI as UI (App.tsx)
  participant SB as Sandbox (code.ts)
  participant F as Figma document

  SB->>UI: init {textStyles, colorVariableCount, prefs, presets}
  SB->>UI: selection {chart | null, frame | null}
  Note over UI: chart ≠ null → режим «Редактирование»,<br/>все контролы восстановлены из spec.<br/>frame ≠ null (обычный фрейм) → «Вставить в фрейм»

  alt Создать
    UI->>SB: create {spec, parentId?}
    SB->>F: renderChart(spec) → новый фрейм в центре вьюпорта<br/>или дочерний в parentId (STRETCH / FILL)
    SB->>UI: created {missingVariables, updated:false}
    F-->>SB: selectionchange (новый фрейм выделен)
    SB->>UI: selection {chart}
  else Обновить
    UI->>SB: update {id, spec}
    SB->>F: удалить детей фрейма, отрисовать заново в тот же фрейм
    SB->>UI: created {missingVariables, updated:true}
  end

  Note over F: пользователь тянет фрейм руками
  F-->>SB: selectionchange
  SB->>UI: selection {тот же id, новые width/height}
  Note over UI: тот же id → обновляется только размер,<br/>несохранённые правки не теряются

  UI->>SB: save-prefs {textStyles} → figma.clientStorage
  UI->>SB: save-preset {name, spec} / delete-preset {id}
  SB->>UI: presets {list} (clientStorage 'presets')
```

## 4. Дерево слоёв графика и constraints

Декартовы типы (line, bar — вертикальный / горизонтальный, scatter):

```mermaid
flowchart TB
  F["Chart / {Type} — {title}<br/>FRAME W×H, fill system/graphite/0<br/>pluginData: chartSpec"]
  F --> Ti["Title<br/>CENTER / MIN"]
  F --> Pl["Plot<br/>STRETCH / STRETCH"]
  F --> AY["Axis Y<br/>MIN / STRETCH"]
  F --> AX["Axis X<br/>STRETCH / MAX"]
  F --> Lg["Legend (vertical auto layout)<br/>CENTER / MAX"]

  Pl --> Gr["Grid → Split (VECTOR, SCALE)<br/>горизонтальные и/или вертикальные"]
  Pl --> AL["Axis line (VECTOR, SCALE)<br/>только у оси категорий"]
  Pl --> S["Series / {name}<br/>STRETCH / STRETCH"]
  S --> Ar["line: Area (VECTOR, SCALE, layer opacity) + Line"]
  S --> Br["bar: Bar c (RECTANGLE, SCALE)"]
  S --> Pt["Point — якорь 2×2, SCALE<br/>└ Symbol (ELLIPSE, CENTER)"]
  S --> Lb["Label — якорь, SCALE<br/>└ TEXT"]

  AY --> YT["Tick — якорь MAX / SCALE<br/>└ TEXT; у горизонтального bar ещё деления"]
  AX --> XT["Tick / Label — якоря SCALE / MIN<br/>(деления у bar — на границах полос)"]
  Lg --> LR["Row i (horizontal auto layout)"] --> LI["item: Icon (line+circle / rect / circle) + TEXT"]
```

Полярные типы (pie / donut, radar) — тело растягивается как `Plot`, фигуры SCALE, тексты и точки в якорях
(при непропорциональном resize круг становится овалом, «Обновить» возвращает круг):

```mermaid
flowchart TB
  F["Chart / Pie · Donut · Radar"] --> G["Pie · Donut · Radar<br/>STRETCH / STRETCH"]
  G --> Sl["pie: Slices → Slice {c} — ELLIPSE + arcData, SCALE<br/>(innerRadius для donut)"]
  G --> LL["pie: Labels → Label line (VECTOR, SCALE) + якорь └ TEXT"]
  G --> RG["radar: Grid → Ring · Spoke (VECTOR, SCALE)"]
  G --> RI["radar: Indicators → якорь └ TEXT"]
  G --> RS["radar: Series / {name} → Area (layer opacity) · Line (VECTOR, SCALE) · Point / TEXT в якорях"]
  F --> Ti["Title"]
  F --> Lg["Legend"]
```

«Якорь» — прозрачный фрейм 2×2 с `SCALE`: при ручном resize его центр едет пропорционально данным,
а содержимое с `CENTER` не деформируется (круги остаются кругами, текст — текстом).

## 5. Где что лежит

| Файл | Ответственность |
|---|---|
| `src/code.ts` | точка входа sandbox: `showUI`, поиск графика в выделении (+ `migrateSpec`), `create` / `update` |
| `src/shared/types.ts` | ChartSpec v2, ChartType, ChartOptions (+ `DEFAULT_OPTIONS`) |
| `src/shared/migrate.ts` | спека из `pluginData` любой версии → текущая |
| `src/figma/render.ts` | `renderChart`: фрейм, заголовок, легенда, `pluginData`, пересборка в существующий фрейм |
| `src/figma/cartesian.ts` | line / bar / scatter → Plot, оси, серии |
| `src/figma/polar.ts` | pie (ELLIPSE + arcData) и radar |
| `src/figma/nodes.ts` | хелперы: container, anchor, pin, vector, stroke |
| `src/figma/variables.ts` | поиск переменной: VariableID → имя → имя без первой группы → hex-fallback |
| `src/figma/textStyles.ts` | список локальных text styles, создание текста со стилем или fallback-шрифтом |
| `src/core/scale.ts` | nice-scale как в ECharts, `formatNumber` (без `Intl`!) |
| `src/core/path.ts` | polyline / smooth (порт ECharts) / area / band / polygon / sector, `normalizePath`, `shiftPath` |
| `src/core/text.ts` | оценка ширины текста без DOM |
| `src/core/layout/*` | вся геометрия (общая для превью и Figma): `common` (фрейм, легенда с переносом, коллизии подписей), `axis` (прореживание, value-ось), `cartesian`, `pie`, `radar`, `index` (`computeLayout`) |
| `src/theme/echarts.ts` | ThemeSpec: отступы, размеры, какие токены за что отвечают, fallback-шрифты |
| `src/theme/palette.ts` | порядок цветов серий по умолчанию, hex для превью |
| `src/data/random.ts` | генерация данных (seed, пресеты категорий, scatter, `autoPoints`) |
| `src/data/csv.ts` | `parseCsv` / `parseCsvRows` (RFC 4180, номера строк, автоопределение разделителя), `toCsv(sep)`, `validateCsv` |
| `src/data/table.ts` | таблица: строки/серии, `parseCell`, вставка блока из Excel/Sheets, `gridToTable` (импорт CSV) |
| `src/ui/App.tsx` | сообщения sandbox, шапка (превью, тип, пресеты, вкладки), футер (создать / обновить / вставить в фрейм) |
| `src/ui/state.ts` | `useChartEditor` — состояние редактора и сборка spec; хелперы (generate, readText, download, copyText) |
| `src/ui/tabs/*` | вкладки «Данные» (размер, источник, таблица) и «Вид» (тип, оси, формат, фрейм, стили текста) |
| `src/ui/components/*` | контролы (Segmented, Chips, Collapsible, OptionalNumberField…), ColorPicker, DataTable, CsvModal, PresetsMenu, icons, `preview/*` |
| `src/core/format.ts` | `formatValue`: префикс / суффикс, знаки, k/M/B или тыс./млн, разделители — без `Intl` |
| `scripts/tokens-to-ts.mjs` | генерация `tokens.generated.ts` из `tokens/` |
| `scripts/test-core.ts` | проверки `core/` (`npm test`) |
| `scripts/serve.mjs` | UI в браузере на :5174 для вёрстки без Figma |
