import esbuild from 'esbuild';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { gzipSync } from 'node:zlib';

const version = JSON.parse(readFileSync('./package.json', 'utf8')).version;
const options = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2019',
  outfile: 'dist/lt-widget.min.js',
  define: { LT_WIDGET_VERSION: JSON.stringify(version) },
  legalComments: 'none',
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css' };

if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/mock-lead') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        console.log('[mock-lead]', body);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end('{"ok":true}');
      });
      return;
    }
    let path = req.url.split('?')[0];
    if (path === '/') path = '/demo/index.html';
    const file = join(process.cwd(), path);
    if (existsSync(file) && statSync(file).isFile() && !file.includes('..')) {
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(readFileSync(file));
    } else {
      res.writeHead(404);
      res.end('not found');
    }
  }).listen(4173, () => console.log('dev server: http://localhost:4173'));
} else {
  await esbuild.build(options);
  const out = readFileSync(options.outfile);
  console.log(`${options.outfile}: ${out.length} bytes, ${gzipSync(out).length} bytes gzip`);
}
