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
import { tratarBackend, inicializar as inicializarBackend } from './backend.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

// .env opcional: pode ficar ao lado deste arquivo ou na raiz do projeto.
// Sem ele, tudo segue funcionando igual; valores que já existem no ambiente (ou
// argumento na linha de comando) têm prioridade sobre os do arquivo.
for (const p of [path.join(RAIZ, '.env'), path.join(RAIZ, '..', '.env')]) {
  let linhas;
  try { linhas = fs.readFileSync(p, 'utf8'); } catch { continue; }
  for (const l of linhas.split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue; // ignora linhas vazias e comentários
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"') && v.length >= 2) || (v.startsWith("'") && v.endsWith("'") && v.length >= 2)) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

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

// ── ponte com a API real ───────────────────────────────────────────────────────
// Com API_BASE+API_KEY no .env, o painel deixa de falar com o espelho congelado:
// o serve.mjs traduz os endpoints para a API v1, injeta a chave aqui (ela nunca
// sai do servidor) e devolve a resposta no formato que o front espera. Sem a
// chave, nada muda em relação ao comportamento anterior.
const API_BASE = (process.env.API_BASE || '').replace(/\/+$/, '');
const API_KEY = process.env.API_KEY || '';
const TEM_API = Boolean(API_BASE && API_KEY);
const PAINEL = TEM_API && process.env.PAINEL_ADMIN !== '0';   // '0' → volta a exigir login
const ADMIN_ROLE = process.env.ADMIN_ROLE || 'super_admin';

const json = (status, dados) => ({ status, type: 'application/json; charset=utf-8', body: JSON.stringify(dados), live: true });

function lerCorpo(req) {
  return new Promise((ok, falha) => {
    const partes = [];
    req.on('data', (d) => partes.push(d));
    req.on('end', () => ok(Buffer.concat(partes).toString('utf8')));
    req.on('error', falha);
  });
}

async function chamar(url, metodo, corpo, extra = {}) {
  const r = await fetch(url, {
    method: metodo,
    headers: { authorization: `Bearer ${API_KEY}`, accept: 'application/json', ...extra },
    body: corpo || undefined,
    signal: AbortSignal.timeout(20000),
  });
  const texto = await r.text();
  let dados = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch {}
  return { status: r.status, texto, dados };
}

/* v1 (snake_case) → o formato que o painel espera */
const servicoV1 = (s) => ({ code: s.code, name: s.name, country: s.country, icon: s.icon ?? null, featured: 0, sort_order: 0, priceCents: s.price_cents ?? 0, stock: s.stock ?? 0, available: s.available !== false, aliases: s.aliases ?? [], promo: false, outroServidor: null, maisBarato: null });
const servidorV1 = (s) => ({ id: s.id, name: s.name, popular: Array.isArray(s.badges) && s.badges.includes('popular'), priceCents: s.price_cents ?? null, stock: s.stock ?? 0, available: s.available !== false, best: false });
const pedidoV1 = (o) => ({ ...o, ulid: o.ulid ?? o.id, smsCode: o.smsCode ?? o.sms_code });

function mapaPonte(p, metodo) {
  if (p === '/api/catalog/services') return { alvo: '/services', tipo: 'servicos', query: true };
  if (p === '/api/catalog/servers') return { alvo: '/servers', tipo: 'servidores' };
  if (p === '/api/orders') return { alvo: '/orders', tipo: 'pedidos' };
  const cancela = /^\/api\/orders\/([\w-]+)\/cancel$/.exec(p);
  if (cancela) return { alvo: `/orders/${cancela[1]}/cancel`, tipo: 'objeto' };
  const um = /^\/api\/orders\/([\w-]+)$/.exec(p);
  if (um) return { alvo: `/orders/${um[1]}`, tipo: 'objeto' };
  if (p === '/api/rentals' || p === '/api/rent') return { alvo: '/rentals', tipo: 'lista' };
  if (p === '/api/rent/servidores') return { alvo: '/servers', tipo: 'servidores', query: true };
  if (p === '/api/rent/paises') return { congelada: '/api/catalog/countries' };
  if (p === '/api/keys' && metodo === 'GET') return { pronto: [] };
  if (p === '/api/wallet/deposits' || p === '/api/wallet/history') return { pronto: [] };
  if (p === '/api/wallet/checkout') return { pronto: {} };
  return null;
}

/* responde um /api/ falando com a API real, ou null para seguir o fluxo normal
   (arquivo, espelho congelado, casca). Nunca é chamado sem TEM_API. */
async function tratarApi(p, req, inicio) {
  const log = (status) => console.log(`${String(status).padStart(3)} ${req.url.padEnd(44)} ${Date.now() - inicio}ms (API)`);
  const caiu = (e) => { log(502); return json(502, { error: { code: 'api_indisponivel', message: `Não consegui falar com a API: ${e.message}` } }); };

  if (p === '/api/auth/me') {
    if (!PAINEL) return null;               // painel desligado: tabela congelada (401 → tela de login)
    try {
      const r = await chamar(`${API_BASE}/api/v1/me`, 'GET');
      const u = r.dados && r.dados.data ? r.dados.data : {};
      const saldo = Number.isFinite(u.balance_cents) ? u.balance_cents : 0;
      log(200);
      return json(200, {
        user: { id: u.id ?? 'local', name: u.name ?? 'Admin', email: u.email ?? '', phone: '', role: ADMIN_ROLE, status: 'active', referral_code: '', last_login_at: new Date().toISOString(), balance_cents: saldo, currency: u.currency ?? 'BRL' },
        balanceCents: saldo,
      });
    } catch (e) { return caiu(e); }
  }

  const m = mapaPonte(p, req.method);
  if (!m) {
    if (rotas[p]) return null;             // tem versão congelada (ex.: /api/site): o espelho manda
    try {
      const corpo = req.method !== 'GET' && req.method !== 'HEAD' ? await lerCorpo(req) : '';
      const extra = {};
      if (corpo && req.headers['content-type']) extra['content-type'] = req.headers['content-type'];
      const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      const r = await chamar(`${API_BASE}${p}${q}`, req.method, corpo, extra);
      log(r.status);
      return { status: r.status, type: 'application/json; charset=utf-8', body: r.texto || 'null', live: true };
    } catch (e) { return caiu(e); }
  }
  if (m.congelada) return rotas[m.congelada] ?? json(404, { error: { code: 'nao_encontrado' } });
  if (m.pronto !== undefined) { log(200); return json(200, m.pronto); }

  try {
    const corpo = req.method !== 'GET' && req.method !== 'HEAD' ? await lerCorpo(req) : '';
    const extra = {};
    if (req.headers['idempotency-key']) extra['idempotency-key'] = req.headers['idempotency-key'];
    if (corpo && req.headers['content-type']) extra['content-type'] = req.headers['content-type'];
    const q = m.query && req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const r = await chamar(`${API_BASE}/api/v1${m.alvo}${q}`, req.method, corpo, extra);
    if (r.status >= 400) { log(r.status); return json(r.status, r.dados ?? { error: { code: 'erro_api', message: r.texto || r.status } }); }
    let saida;
    if (m.tipo === 'servicos') saida = (r.dados?.data ?? []).map(servicoV1);
    else if (m.tipo === 'servidores') saida = (r.dados?.data ?? []).map(servidorV1);
    else if (m.tipo === 'pedidos') saida = (r.dados?.data ?? []).map(pedidoV1);
    else if (m.tipo === 'lista') saida = r.dados?.data ?? [];
    else saida = r.dados?.data ?? r.dados ?? null;
    log(200);
    return json(200, saida);
  } catch (e) { return caiu(e); }
}

/* caminho da URL -> o que responder. Mesma ordem do sw.js. */
async function resolver(url, req, inicio) {
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

  // 3. ponte com a API real (.env: API_BASE+API_KEY) — antes da tabela congelada
  if (TEM_API && p.startsWith('/api/')) {
    const ponte = await tratarApi(p, req, inicio);
    if (ponte) return ponte;
  }

  // 4. tabela congelada: /api/*, /marca/*, bandeiras, páginas de artigo
  const hit = rotas[p] || rotas[p + '.svg'] || rotas[p + '.png'];
  if (hit) return hit;

  // 5. rota interna do React (/painel, /pedido/01H..., /admin): a casca resolve
  return { body: fs.readFileSync(path.join(RAIZ, 'index.html')),
           type: 'text/html; charset=utf-8', status: 200 };
}

const server = http.createServer(async (req, res) => {
  const inicio = Date.now();
  try {
    let alvo = null;
    let p0 = '/';
    try { p0 = decodeURIComponent((req.url || '/').split('?')[0]); } catch {}

    // 1º turno: o backend local cuida do que é de sessão (auth, carteira, pedidos, chaves).
    // O que ele não conhece cai para a ponte (API real) e depois para o espelho/congelado.
    if (p0.startsWith('/api/') && !p0.startsWith('/api/logo/') && !p0.startsWith('/api/flag/')) {
      const assumiu = await tratarBackend(req, res);
      if (assumiu) { console.log(`${req.method.padEnd(6)} ${p0.padEnd(40)} ${Date.now() - inicio}ms (backend)`); return; }
    }

    if (req.method === 'GET' || req.method === 'HEAD') alvo = await resolver(req.url, req, inicio);
    else if (TEM_API && p0.startsWith('/api/') && !p0.startsWith('/api/logo/')) {
      alvo = await tratarApi(p0, req, inicio);   // escrita do painel (compra, cancelamento) vai à API real
    }
    if (!alvo) {                                  // qualquer outro POST etc.: engole como antes
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end('{}');
    }
    const imutavel = /^(\/assets\/|\/mirror\/|\/fonts\/)/.test(req.url);
    res.writeHead(alvo.status, {
      'content-type': alvo.type,
      'cache-control': imutavel ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (alvo.body !== undefined) {
      return res.end(Buffer.isBuffer(alvo.body) ? alvo.body : Buffer.from(alvo.body));
    }
    fs.createReadStream(path.join(RAIZ, alvo.file)).pipe(res);
    console.log(`${String(alvo.status).padStart(3)} ${req.url.padEnd(44)} ${Date.now() - inicio}ms${alvo.live ? ' (API)' : ''}`);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(String(err && err.message));
  }
});

inicializarBackend(msg => console.log(msg));

server.listen(PORTA, () => {
  console.log(`\n  clone no ar      http://localhost:${PORTA}/`);
  console.log(`  índice carregado ${Object.keys(rotas).length} caminhos + ${Object.keys(LOGOS).length} ícones`);
  if (TEM_API) console.log(`  API conectada    ${API_BASE} · painel admin ${PAINEL ? 'logado (PAINEL_ADMIN=1)' : 'desligado (PAINEL_ADMIN=0)'}`);
  console.log('');
});
