import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const watch = process.argv.includes('--watch');
await mkdir('dist', { recursive: true });

/** Wraps the bundled UI script + css into a single dist/ui.html (Figma loads one html file). */
const inlineHtml = {
  name: 'inline-html',
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length) return;
      const js = result.outputFiles.find((f) => f.path.endsWith('.js'))?.text ?? '';
      const css = result.outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? '';
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>` +
        `<body><div id="root"></div><script>${js.replace(/<\/script>/g, '<\\/script>')}</script></body></html>`;
      await writeFile('dist/ui.html', html);
      console.log(`[ui] built ${new Date().toLocaleTimeString()}`);
    });
  },
};

const logEnd = (name) => ({
  name: 'log',
  setup(build) {
    build.onEnd((r) => { if (!r.errors.length) console.log(`[${name}] built ${new Date().toLocaleTimeString()}`); });
  },
});

const codeOptions = {
  entryPoints: ['src/code.ts'],
  bundle: true,
  outfile: 'dist/code.js',
  target: 'es2017',
  format: 'iife',
  logLevel: 'warning',
  plugins: [logEnd('code')],
};

const uiOptions = {
  entryPoints: ['src/ui/ui.tsx'],
  bundle: true,
  outdir: 'dist/ui-tmp',
  write: false,
  target: 'es2020',
  format: 'iife',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  minify: !watch,
  logLevel: 'warning',
  plugins: [inlineHtml],
};

if (watch) {
  const [c, u] = await Promise.all([esbuild.context(codeOptions), esbuild.context(uiOptions)]);
  await Promise.all([c.watch(), u.watch()]);
  console.log('watching…');
} else {
  await Promise.all([esbuild.build(codeOptions), esbuild.build(uiOptions)]);
}
