#!/usr/bin/env node
/* servidor local do clone.

     node serve.mjs [porta]

   Não é obrigatório para o site funcionar: quem resolve os /api no navegador é o
   sw.js. Este servidor existe para duas coisas — desenvolvimento sem precisar do
   truque da recarga do service worker, e hospedar a pasta em qualquer lugar que
   aceite um processo Node. A tabela lida é a mesma routes.json do sw.js, então o
   comportamento é igual nos dois caminhos. */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const PORTA = Number(process.argv[2] || process.env.PORT || 4173);
const { rotas } = JSON.parse(fs.readFileSync(path.join(RAIZ, 'routes.json'), 'utf8'));
const LOGOS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'mirror', 'logo-index.json'), 'utf8'));

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.bmp': 'image/bmp', '.avif': 'image/avif',
  '.webmanifest': 'application/manifest+json',
};
const tipo = (nome) => TIPOS[path.extname(nome).toLowerCase()] || 'application/octet-stream';

/* caminho da URL -> o que responder. Mesma ordem do sw.js. */
function resolver(url) {
  let p = decodeURIComponent(url.split('?')[0].split('#')[0]);
  if (p !== '/' && p.endsWith('/')) p = p.slice(0, -1);

  // 1. arquivo que existe de verdade na pasta
  const disco = path.join(RAIZ, '.' + p);
  if (p !== '/' && disco.startsWith(RAIZ) && fs.existsSync(disco) && fs.statSync(disco).isFile()) {
    return { file: p.slice(1), type: tipo(disco), status: 200 };
  }

  // 2. ícone de serviço: o bundle pede /api/logo/<código>, aqui é um arquivo
  const icone = /^\/api\/logo\/(.+)$/.exec(p);
  if (icone) {
    const codigo = decodeURIComponent(icone[1]).toLowerCase();
    const ext = LOGOS[codigo];
    if (ext) return { file: `mirror/logo/${codigo}${ext}`, type: tipo(ext), status: 200 };
    // sem ícone: 1x1 vazio, e o próprio site mostra as iniciais do nome
    return { body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
             type: 'image/svg+xml', status: 404 };
  }

  // 3. tabela congelada: /api/*, /marca/*, bandeiras, páginas de artigo
  const hit = rotas[p] || rotas[p + '.svg'] || rotas[p + '.png'];
  if (hit) return hit;

  // 4. rota interna do React (/painel, /pedido/01H..., /admin): a casca resolve
  return { body: fs.readFileSync(path.join(RAIZ, 'index.html')),
           type: 'text/html; charset=utf-8', status: 200 };
}

const server = http.createServer((req, res) => {
  const inicio = Date.now();
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {   // POST /api/site/visita e afins
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end('{}');
    }
    const alvo = resolver(req.url);
    const imutavel = /^(\/assets\/|\/mirror\/|\/fonts\/)/.test(req.url);
    res.writeHead(alvo.status, {
      'content-type': alvo.type,
      'cache-control': imutavel ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (alvo.body !== undefined) {
      return res.end(Buffer.isBuffer(alvo.body) ? alvo.body : Buffer.from(alvo.body));
    }
    fs.createReadStream(path.join(RAIZ, alvo.file)).pipe(res);
    console.log(`${String(alvo.status).padStart(3)} ${req.url.padEnd(44)} ${Date.now() - inicio}ms`);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(String(err && err.message));
  }
});

server.listen(PORTA, () => {
  console.log(`\n  clone no ar      http://localhost:${PORTA}/`);
  console.log(`  índice carregado ${Object.keys(rotas).length} caminhos + ${Object.keys(LOGOS).length} ícones\n`);
});
