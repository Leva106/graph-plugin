// Resolves DS color token names to local Figma variables and builds bound paints.
// Lookup order: variable id from the token export → exact name → name without the top group.
// If nothing matches, the hex from tokens.generated.ts is used and the name is reported as missing.

import { COLOR_TOKENS } from '../theme/tokens.generated';

export class ColorResolver {
  readonly missing = new Set<string>();
  private cache = new Map<string, Variable | null>();

  private constructor(private byName: Map<string, Variable>) {}

  static async create(): Promise<ColorResolver> {
    const vars = await figma.variables.getLocalVariablesAsync('COLOR');
    return new ColorResolver(new Map(vars.map((v) => [v.name, v])));
  }

  get localCount() {
    return this.byName.size;
  }

  private async find(name: string): Promise<Variable | null> {
    if (this.cache.has(name)) return this.cache.get(name)!;
    let found: Variable | null = null;
    const id = COLOR_TOKENS[name]?.id;
    if (id) {
      try {
        const v = await figma.variables.getVariableByIdAsync(id);
        if (v && v.resolvedType === 'COLOR' && !v.remote) found = v;
      } catch {
        /* id from another file */
      }
    }
    found ??= this.byName.get(name) ?? this.byName.get(name.split('/').slice(1).join('/')) ?? null;
    this.cache.set(name, found);
    return found;
  }

  /** Solid paint bound to the variable `name` (or hex fallback). */
  async paint(name: string, opacity = 1): Promise<SolidPaint> {
    const hex = COLOR_TOKENS[name]?.light ?? '#999999';
    const { r, g, b, a } = parseHex(hex);
    const base: SolidPaint = { type: 'SOLID', color: { r, g, b }, opacity: a * opacity };
    const variable = await this.find(name);
    if (!variable) {
      this.missing.add(name);
      return base;
    }
    // variable alpha is carried by the binding, so paint opacity is only the extra one.
    // setBoundVariableForPaint drops the paint opacity — put it back on the returned copy.
    const bound = figma.variables.setBoundVariableForPaint({ ...base, opacity }, 'color', variable);
    return { ...bound, opacity };
  }
}

function parseHex(hex: string) {
  const h = hex.replace('#', '');
  const c = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  return { r: c(0), g: c(2), b: c(4), a: h.length >= 8 ? c(6) : 1 };
}
