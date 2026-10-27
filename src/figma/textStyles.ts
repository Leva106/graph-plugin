import type { TextStyleInfo } from '../shared/messages';
import type { FontFallback } from '../theme/echarts';

export async function listTextStyles(): Promise<TextStyleInfo[]> {
  const styles = await figma.getLocalTextStylesAsync();
  return styles.map((s) => ({
    id: s.id,
    name: s.name,
    fontSize: s.fontSize,
    fontFamily: s.fontName.family,
    fontStyle: s.fontName.style,
  }));
}

const loaded = new Map<string, Promise<boolean>>();

function loadFont(font: FontName): Promise<boolean> {
  const key = `${font.family}::${font.style}`;
  if (!loaded.has(key)) {
    loaded.set(key, figma.loadFontAsync(font).then(() => true, () => false));
  }
  return loaded.get(key)!;
}

const INTER: FontName = { family: 'Inter', style: 'Regular' };

/** Creates a text node with a local text style (by id) or the theme fallback font. */
export async function createText(chars: string, styleId: string | undefined, fallback: FontFallback, fill: Paint): Promise<TextNode> {
  await loadFont(INTER); // default font of a fresh text node
  const node = figma.createText();
  let styled = false;

  if (styleId) {
    const style = await figma.getStyleByIdAsync(styleId);
    if (style && style.type === 'TEXT' && (await loadFont(style.fontName))) {
      await node.setTextStyleIdAsync(style.id);
      styled = true;
    }
  }
  if (!styled) {
    const font = { family: fallback.family, style: fallback.style };
    node.fontName = (await loadFont(font)) ? font : INTER;
    node.fontSize = fallback.size;
  }

  node.characters = chars;
  node.textAutoResize = 'WIDTH_AND_HEIGHT';
  node.fills = [fill];
  return node;
}
