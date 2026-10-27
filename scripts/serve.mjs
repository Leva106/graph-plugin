// Serves dist/ui.html for previewing the plugin UI in a regular browser (outside Figma).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const port = Number(process.env.PORT ?? 5174);
createServer(async (_req, res) => {
  try {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(await readFile('dist/ui.html'));
  } catch {
    res.writeHead(500).end('run npm run build first');
  }
}).listen(port, () => console.log(`UI preview: http://localhost:${port}`));
