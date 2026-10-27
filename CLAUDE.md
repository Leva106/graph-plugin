# graph-plugin

Локальный Figma-плагин (dev mode, не публикуется): генерирует графики в стиле ECharts (line, bar, pie, scatter, radar)
из нативных слоёв Figma,
цвета — локальные variables дизайн-системы, текст — локальные text styles.

**Перед работой прочитать:**
- `docs/ARCHITECTURE.md` — схемы: модули, поток данных, сообщения UI↔sandbox, дерево слоёв и constraints.
- `docs/DECISIONS.md` — контекст, ограничения среды и журнал решений. **Каждое значимое решение дописывать туда** (сверху, с датой).

## Команды
- `npm run dev` — сборка + watch; `npm run build`; `npm run typecheck`; `npm test` (проверки `src/core`).
- `node scripts/serve.mjs` — UI в браузере на http://localhost:5174 (сообщения от sandbox эмулировать через `window.postMessage({pluginMessage: …})`).
- `npm run tokens` — пересобрать `src/theme/tokens.generated.ts` из `tokens/` (файл не править руками).

## Правила
- Код для sandbox (`src/code.ts`, `src/figma/*`, всё, что они импортируют из `core/`, `theme/`, `shared/`) — без `Intl`, DOM и прочих браузерных API.
- Геометрию считать только в `src/core/layout/*`, чтобы SVG-превью и рендер в Figma совпадали. Новый тип графика →
  layout в `core/layout/`, рендер в `figma/`, превью в `ui/components/preview/`.
- Новые источники данных (CSV, LLM) → `src/data/*`, на выходе ChartSpec. Новый визуал → новый `ThemeSpec`.
- Изменение формата `ChartSpec` — учитывать уже созданные графики (`pluginData 'chartSpec'`, поле `version`,
  миграция в `src/shared/migrate.ts`).
- Модули, которые импортирует `npm test` (`core/`, `data/`, `shared/`, `theme/palette.ts`), импортируют друг друга
  с расширением `.ts` — иначе node `--experimental-strip-types` их не найдёт.
- UI — минимализм в духе Apple; стили в `src/ui/styles.css`.
- Рендер в Figma из сессии проверить нельзя — просить пользователя проверить и прислать скриншот/консоль.
