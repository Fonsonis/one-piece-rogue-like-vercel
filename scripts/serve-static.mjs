import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const root = fileURLToPath(new URL(args.includes('--production') ? '../dist/' : '../public/', import.meta.url));
const portArg = args.indexOf('--port');
const hostArg = args.indexOf('--host');
const port = Number(portArg < 0 ? process.env.PORT || 4173 : args[portArg + 1]);
const host = hostArg < 0 ? '127.0.0.1' : args[hostArg + 1];
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.woff2':'font/woff2' };
const server = createServer(async (req, res) => {
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405, {Allow:'GET, HEAD'}).end(); return; }
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/' || pathname === '/index.html') pathname = '/play.html';
    const path = resolve(root, '.' + pathname);
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep) || pathname.split('/').some(p => p.startsWith('.'))) {
      res.writeHead(403).end('Forbidden'); return;
    }
    const info = await stat(path);
    if (!info.isFile()) throw new Error('Not a file');
    res.writeHead(200, {'Content-Type':mime[extname(path)] || 'application/octet-stream', 'Content-Length':info.size, 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff'});
    if (req.method === 'HEAD') res.end();
    else createReadStream(path).on('error', () => res.destroy()).pipe(res);
  } catch { res.writeHead(404).end('Not found'); }
});
server.listen(port, host, () => console.log(`Local: http://${host}:${server.address().port}`));
