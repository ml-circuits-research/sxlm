import { createServer } from 'node:http';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.md': 'text/plain', '.sop': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png' };
export function serveDocs(port = 3211) {
const server = createServer((request, response) => {
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end(); return; }
    let path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (path === '/') { response.writeHead(302, { Location: '/docs/' }); response.end(); return; }
    if (path.endsWith('/')) path += 'index.html';
    const file = realpathSync(resolve(root, '.' + path));
    if (!file.startsWith(root + sep) || !statSync(file).isFile()) throw new Error('Outside documentation checkout');
    if (!types[extname(file)]) throw new Error('Unsupported document type');
    response.writeHead(200, { 'Content-Type': types[extname(file)] + '; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : readFileSync(file));
  } catch { response.writeHead(404, { 'Content-Type': 'text/plain' }); response.end('Not found'); }
});
return new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', () => resolve(server));
});
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await serveDocs(Number(process.argv[2] ?? 3211));
  console.log(`SXLM documentation: http://127.0.0.1:${server.address().port}/docs/`);
}
