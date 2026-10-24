import http from 'node:http';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    const { size } = await stat(file);
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
    if (req.headers.range) {
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!range || (!range[1] && !range[2])) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
      const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start >= size || end < start) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
      res.writeHead(206, { ...headers, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${size}` });
      if (req.method === 'HEAD') return res.end();
      createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { ...headers, 'Content-Length': size });
      if (req.method === 'HEAD') return res.end();
      createReadStream(file).pipe(res);
    }
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(3000, '0.0.0.0', () => console.log('mono is running at http://localhost:3000'));
