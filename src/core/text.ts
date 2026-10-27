// Text metrics without a DOM (the Figma sandbox has none): rough per-glyph widths for Inter-like fonts.
// Used for layout decisions (label thinning, legend wrapping, axis insets) — real widths are measured in Figma.

const NARROW = /[.,:;'|!ilj1()[\]{}\-–—/ ]/;
const WIDE = /[MWmwЖЩШЮФжщшюфМ@%]/;
const UPPER = /[A-ZА-ЯЁ0-9]/;

export function estimateTextWidth(text: string, size: number): number {
  let w = 0;
  for (const ch of text) {
    if (NARROW.test(ch)) w += 0.32;
    else if (WIDE.test(ch)) w += 0.82;
    else if (UPPER.test(ch)) w += 0.64;
    else w += 0.56;
  }
  return w * size;
}

export const lineHeight = (size: number) => Math.round(size * 1.25);
