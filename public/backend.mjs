/* backend.mjs — backend completo do clone ROBSONSMS, sem dependências externas.

   O front do site fala a API de *sessão* (/api/auth, /api/wallet, /api/orders...)
   com cookie de login. Este módulo implementa esses endpoints com persistência
   local (data/db.json) e sessões por cookie, e — quando MODO=real — compra
   números de verdade na API v1 do allansms usando a API_KEY do .env.

   Fluxos cobertos (testáveis):
     · cadastrar conta, entrar, sair, trocar senha/dados
     · recarga via PIX (auto-confirma após alguns segundos) + bônus de faixas
     · comprar número (real ou simulado) → recebe SMS → cancelar com estorno
     · chave de API própria (sk_live_...) para integrar no painel
     · favoritos do catálogo
   O que este módulo não implementa cai de volta para a ponte/espelho do
   serve.mjs (catálogo, site, logos, bandeiras e demais rotas). */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
// dados ficam fora de public/ pra não irem junto no deploy estático
const ARQ_DB = process.env.DB_ARQUIVO || path.join(RAIZ, '..', 'data', 'db.json');

const MODO = (process.env.MODO || 'simulado').toLowerCase();   // 'simulado' | 'real'
const AUTO_PIX = (process.env.AUTO_PIX || '1') !== '0';        // confere o PIX sozinho p/ testar
const PIX_AGUARDA_MS = Number(process.env.PIX_AGUARDA_MS || 6000);

const API_BASE = (process.env.API_BASE || '').replace(/\/+$/, '');
const API_KEY = process.env.API_KEY || '';
const REAL = MODO === 'real' && Boolean(API_BASE && API_KEY);

/* ── persistência ──────────────────────────────────────────────────────────── */
let DB = null;
function carregarDB() {
  if (DB) return DB;
  let d = {};
  try { d = JSON.parse(fs.readFileSync(ARQ_DB, 'utf8')); } catch {}
  DB = Object.assign({ usuarios: {}, sessoes: {}, pedidos: {}, deposits: {}, chaves: {}, favoritos: {}, visitas: {}, paginas: {} }, d);
  return DB;
}
function salvar() {
  try {
    fs.mkdirSync(path.dirname(ARQ_DB), { recursive: true });
    fs.writeFileSync(ARQ_DB, JSON.stringify(DB, null, 2));
  } catch (e) { console.error('db salvar:', e.message); }
}

/* ── utilidades ────────────────────────────────────────────────────────────── */
export function ulid() {
  const t = Date.now().toString(36).toUpperCase().padStart(8, '0').slice(-8);
  return (t + crypto.randomBytes(16).toString('hex')).replace(/[^A-Z0-9]/gi, c => c.toUpperCase()).slice(0, 26);
}
const agora = () => new Date().toISOString();

function hashSenha(senha, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(senha, salt, 32).toString('hex');
  return `${salt}:${h}`;
}
function confereSenha(senha, guardado) {
  const [salt, h] = String(guardado || '').split(':');
  if (!salt || !h) return false;
  const t = crypto.scryptSync(senha, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(t));
}

function lerCorpo(req) {
  return new Promise((ok, falha) => {
    const p = []; req.on('data', c => p.push(c)); req.on('end', () => ok(Buffer.concat(p).toString('utf8'))); req.on('error', falha);
  });
}
async function jsonCorpo(req) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return {};
  const bruto = await lerCorpo(req);
  if (!bruto) return {};
  try { return JSON.parse(bruto); } catch { return {}; }
}

function envia(res, status, obj, extraHeaders = {}) {
  if (res.writableEnded) return;
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extraHeaders });
  res.end(JSON.stringify(obj));
}
const erro = (res, status, message, code) =>
  envia(res, status, { message, error: { code: code || `erro_${status}`, message } });

function usuarioPublico(u) {
  const { senha, ...resto } = u;
  return { ...resto, balance_cents: u.saldo ?? 0 };
}

/* sessão por cookie httpOnly */
function setSessao(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  carregarDB().sessoes[token] = { userId, criadoEm: agora() };
  salvar();
  const maxAge = 30 * 24 * 3600;
  return [`rs_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}`];
}
function getSessao(req) {
  const c = String(req.headers.cookie || '');
  const m = /(?:^|;\s*)rs_session=([a-f0-9]{40,})/.exec(c);
  if (!m) return null;
  const s = carregarDB().sessoes[m[1]];
  return s ? { token: m[1], userId: s.userId } : null;
}
function fimSessao(req, res) {
  const s = getSessao(req);
  if (s) { delete carregarDB().sessoes[s.token]; salvar(); }
  return ['rs_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0'];
}
function exigeUser(req, res) {
  const s = getSessao(req);
  if (!s) { erro(res, 401, 'não autenticado', 'unauthorized'); return null; }
  const u = carregarDB().usuarios[s.userId];
  if (!u) { erro(res, 401, 'não autenticado', 'unauthorized'); return null; }
  return u;
}

/* ── catálogo local (preço/estoque) pra validar compra e montar pedido ─────── */
let CATALOGO = null;
function catalogo() {
  if (CATALOGO) return CATALOGO;
  const p = path.join(RAIZ, 'mirror', 'api__catalog__services.json');
  try { CATALOGO = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { CATALOGO = []; }
  return CATALOGO;
}
function itemCatalogo(code) {
  catalogo(); // garante que está carregado
  return (CATALOGO || []).find(s => (s.code || '').toLowerCase() === String(code).toLowerCase()) || null;
}

/* ── simulação de número + SMS (MODO=simulado) ─────────────────────────────── */
function numeroFake() {
  const ddd = ['11', '21', '31', '41', '47', '51'][Math.floor(Math.random() * 6)];
  let n = '9';
  for (let i = 0; i < 8; i++) n += Math.floor(Math.random() * 10);
  return `+55 ${ddd} ${n.slice(0, 4)}-${n.slice(4)}`;
}
const TXT = [
  'Seu código de verificação é',
  'Use o código',
  'Código de acesso:',
  'Sua senha temporária é',
];
function agendarSimulacao(pedidoId) {
  const D = carregarDB();
  const p = D.pedidos[pedidoId];
  if (!p) return;
  setTimeout(() => { if (D.pedidos[pedidoId] && D.pedidos[pedidoId].status === 'searching_number') { D.pedidos[pedidoId].status = 'active'; salvar(); } }, 4000);
  setTimeout(() => {
    const q = D.pedidos[pedidoId];
    if (!q || ['cancelled', 'refunded', 'expired', 'failed'].includes(q.status)) return;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    q.messages = [{ text: `${TXT[Math.floor(Math.random() * TXT.length)]} ${code}. Não informe a ninguém.`, code, received_at: agora() }];
    q.smsCode = code; q.status = 'sms_received'; q.is_final = true;
    salvar();
  }, 9000 + Math.floor(Math.random() * 6000));
}

/* sincronização lenta com a API real quando MODO=real */
async function v1(caminho, metodo = 'GET', corpo, idem) {
  const r = await fetch(`${API_BASE}/api/v1${caminho}`, {
    method: metodo,
    headers: { authorization: `Bearer ${API_KEY}`, accept: 'application/json', ...(idem ? { 'idempotency-key': idem } : {}), ...(corpo ? { 'content-type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const texto = await r.text();
  let dados = null; try { dados = texto ? JSON.parse(texto) : null; } catch {}
  return { status: r.status, dados, texto };
}

/* ── mapa de rotas que este módulo assume ──────────────────────────────────── */
const R = {
  '/api/auth/register': 'POST', '/api/auth/login': 'POST', '/api/auth/logout': 'POST',
  '/api/auth/me': 'GET', '/api/auth/profile': 'POST', '/api/auth/password': 'POST',
  '/api/auth/forgot': 'POST', '/api/auth/reset': 'POST',
  '/api/wallet/checkout': 'GET', '/api/wallet/bonus-tiers': 'GET', '/api/wallet/coupon-preview': 'POST',
  '/api/wallet/deposit': 'POST', '/api/wallet/deposits': 'GET', '/api/wallet/history': 'GET',
  '/api/orders': 'BOTH',
  '/api/keys': 'BOTH',
  '/api/catalog/favorites': 'GET',
};

/* responde o pedido se este módulo cuida dele; senão retorna false.
   Sempre passa (req, res) e já envia a resposta quando assume. */
export async function tratarBackend(req, res) {
  let p = '/';
  try { p = decodeURIComponent((req.url || '/').split('?')[0]); } catch {}
  if (!p.startsWith('/api/')) return false;

  try {
    return await despacha(p, req, res);
  } catch (e) {
    console.error('backend:', e.message);
    const st = Number.isInteger(e.httpStatus) ? e.httpStatus : 500;
    return erro(res, st, e.httpStatus ? e.message : 'falha interna ao processar', 'internal'), true;
  }
}

async function despacha(p, req, res) {
  const M = req.method;
  const D = carregarDB();

  /* ---------- AUTH ---------- */
  if (p === '/api/auth/register' && M === 'POST') {
    const b = await jsonCorpo(req);
    const nome = String(b.name || '').trim();
    const email = String(b.email || '').trim().toLowerCase();
    const senha = String(b.password || '');
    if (!nome) return erro(res, 400, 'informe seu nome', 'invalido'), true;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return erro(res, 400, 'e-mail inválido', 'invalido'), true;
    if (senha.length < 8) return erro(res, 400, 'a senha precisa ter no mínimo 8 caracteres', 'invalido'), true;
    if (Object.values(D.usuarios).some(u => u.email === email)) return erro(res, 409, 'este e-mail já está cadastrado', 'duplicado'), true;
    const id = ulid();
    D.usuarios[id] = {
      id, name: nome, email, phone: b.phone ? String(b.phone) : '', role: 'user', status: 'active',
      saldo: 0, referral_code: crypto.randomBytes(3).toString('hex').toUpperCase(),
      createdAt: agora(), last_login_at: agora(), senha: hashSenha(senha),
    };
    const sc = setSessao(res, id); salvar();
    return envia(res, 201, { user: usuarioPublico(D.usuarios[id]) }, { 'set-cookie': sc }), true;
  }

  if (p === '/api/auth/login' && M === 'POST') {
    const b = await jsonCorpo(req);
    const email = String(b.email || '').trim().toLowerCase();
    const u = Object.values(D.usuarios).find(x => x.email === email);
    if (!u || !confereSenha(String(b.password || ''), u.senha)) return erro(res, 401, 'e-mail ou senha incorretos', 'credenciais'), true;
    u.last_login_at = agora(); salvar();
    const sc = setSessao(res, u.id);
    return envia(res, 200, { user: usuarioPublico(u) }, { 'set-cookie': sc }), true;
  }

  if (p === '/api/auth/logout' && M === 'POST') {
    const sc = fimSessao(req, res);
    return envia(res, 200, { ok: true }, { 'set-cookie': sc }), true;
  }

  if (p === '/api/auth/me' && M === 'GET') {
    const u = exigeUser(req, res);
    if (!u) return true;
    return envia(res, 200, { user: usuarioPublico(u), balanceCents: u.saldo ?? 0 }), true;
  }

  if (p === '/api/auth/profile' && M === 'POST') {
    const u = exigeUser(req, res); if (!u) return true;
    const b = await jsonCorpo(req);
    if (b.name) u.name = String(b.name).trim();
    if (b.phone !== undefined) u.phone = String(b.phone || '');
    if (b.email) u.email = String(b.email).toLowerCase();
    salvar();
    return envia(res, 200, { user: usuarioPublico(u) }), true;
  }

  if (p === '/api/auth/password' && M === 'POST') {
    const u = exigeUser(req, res); if (!u) return true;
    const b = await jsonCorpo(req);
    if (b.currentPassword && !confereSenha(String(b.currentPassword), u.senha)) return erro(res, 400, 'senha atual incorreta', 'invalida'), true;
    if (String(b.newPassword || '').length < 8) return erro(res, 400, 'a nova senha precisa ter no mínimo 8 caracteres', 'invalida'), true;
    u.senha = hashSenha(String(b.newPassword)); salvar();
    return envia(res, 200, { ok: true }), true;
  }

  if ((p === '/api/auth/forgot' || p === '/api/auth/reset') && M === 'POST') {
    // sem provedor de e-mail nesta instalação: responde ok para o fluxo não travar
    return envia(res, 200, { ok: true, message: 'se o e-mail existir, você receberá as instruções.' }), true;
  }

  /* ---------- CARTEIRA / RECARGA ---------- */
  if (p === '/api/wallet/checkout' && M === 'GET') {
    const u = exigeUser(req, res); if (!u) return true;
    return envia(res, 200, { meios: [{ metodo: 'pix', nome: 'PIX', ativo: true, principal: true }] }), true;
  }

  if (p === '/api/wallet/bonus-tiers' && M === 'GET') {
    const u = exigeUser(req, res); if (!u) return true;
    return envia(res, 200, [
      { minCents: 10000, bonusCents: 300, label: '+R$ 3,00' },
      { minCents: 30000, bonusCents: 1200, label: '+R$ 12,00' },
      { minCents: 100000, bonusCents: 6000, label: '+R$ 60,00' },
    ]), true;
  }

  if (p === '/api/wallet/coupon-preview' && M === 'POST') {
    const u = exigeUser(req, res); if (!u) return true;
    const b = await jsonCorpo(req);
    const bon = cupomBonus(String(b.code || ''), Number(b.amountCents) || 0);
    if (bon == null) return erro(res, 404, 'cupom inválido ou expirado', 'cupom'), true;
    return envia(res, 200, { bonusCents: bon }), true;
  }

  if (p === '/api/wallet/deposit' && M === 'POST') {
    const u = exigeUser(req, res); if (!u) return true;
    const b = await jsonCorpo(req);
    const valor = Math.round(Number(b.amountCents));
    if (!Number.isFinite(valor) || valor < 500) return erro(res, 400, 'valor mínimo de recarga: R$ 5,00', 'minimo'), true;
    const bon = cupomBonus(String(b.couponCode || ''), valor) ?? bônusFaixa(valor);
    const dep = {
      ulid: ulid(), userId: u.id, amountCents: valor, bonusCents: bon, status: 'pending',
      metodo: b.metodo || 'pix', cpf: b.cpf || '', criadoEm: agora(),
      qrCopyPaste: pixFake(valor),
    };
    D.deposits[dep.ulid] = dep; salvar();
    if (AUTO_PIX) setTimeout(() => confirmaDeposit(dep.ulid), PIX_AGUARDA_MS);
    const { userId, ...pub } = dep;
    return envia(res, 201, pub), true;
  }

  if (p === '/api/wallet/deposits' && M === 'GET') {
    const u = exigeUser(req, res); if (!u) return true;
    const lista = Object.values(D.deposits).filter(d => d.userId === u.id)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).map(d => d);
    return envia(res, 200, lista), true;
  }

  const depDetalhe = /^\/api\/wallet\/deposits\/([\w-]+)$/.exec(p);
  if (depDetalhe && M === 'GET') {
    const u = exigeUser(req, res); if (!u) return true;
    const d = D.deposits[depDetalhe[1]];
    if (!d || d.userId !== u.id) return erro(res, 404, 'recarga não encontrada', 'nao_encontrado'), true;
    return envia(res, 200, d), true;
  }

  if (p === '/api/wallet/history' && M === 'GET') {
    const u = exigeUser(req, res); if (!u) return true;
    return envia(res, 200, extratoDo(u)), true;
  }

  /* ---------- PEDIDOS / NÚMEROS ---------- */
  if (p === '/api/orders' && M === 'GET') {
    const u = exigeUser(req, res); if (!u) return true;
    const lista = Object.values(D.pedidos).filter(x => x.userId === u.id)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).map(o => pedidoPublico(o));
    return envia(res, 200, lista), true;
  }

  if (p === '/api/orders' && M === 'POST') {
    const u = exigeUser(req, res); if (!u) return true;
    const b = await jsonCorpo(req);
    const country = b.country || 'brazil';
    const service = String(b.service || '').toLowerCase();
    const item = itemCatalogo(service);
    if (!item) return erro(res, 404, 'serviço não encontrado no catálogo', 'servico'), true;
    if (item.available === false) return erro(res, 400, 'sem estoque agora', 'estoque'), true;
    const preco = item.priceCents;
    if (Number.isFinite(preco) && (u.saldo ?? 0) < preco) return erro(res, 402, 'saldo insuficiente — recarge para continuar', 'saldo'), true;

    const id = ulid();
    const pedido = {
      ulid: id, userId: u.id, country, service: item.code, operator: b.operator || '', server: b.server || 'auto',
      phone: numeroFake(), status: 'searching_number', priceCents: preco,
      messages: [], smsCode: '', is_final: false, cancel_in: 120,
      criadoEm: agora(), expiresAt: new Date(Date.now() + 20 * 60000).toISOString(),
      real: !!REAL, v1id: null,
    };
    if (REAL) {
      try {
        const r = await v1('/orders', 'POST', { service: item.code, country, server: b.server || undefined, max_price_cents: b.expectedPriceCents ?? preco }, crypto.randomUUID());
        if (r.status >= 400) throw Object.assign(new Error(r.dados?.error?.message || r.texto || 'erro na compra'), { code: r.dados?.error?.code });
        const d = r.dados?.data ?? r.dados ?? {};
        pedido.v1id = d.id || null; pedido.phone = d.phone || pedido.phone;
        if (d.price_cents != null) pedido.priceCents = d.price_cents;
      } catch (e) {
        return erro(res, 502, `não consegui comprar o número: ${e.message}`, 'compra'), true;
      }
    }
    u.saldo = (u.saldo ?? 0) - (pedido.priceCents || 0);
    D.pedidos[id] = pedido; registrarExtrato(u, 'order_debit', -(pedido.priceCents || 0));
    salvar();
    if (!REAL) agendarSimulacao(id);
    return envia(res, 201, pedidoPublico(pedido)), true;
  }

  const pedDetalhe = /^\/api\/orders\/([\w-]+)(?:\/(cancel|finish))?$/g;
  let mm; pedDetalhe.lastIndex = 0;
  while ((mm = pedDetalhe.exec(p))) {
    const [, id, acao] = mm;
    if (M === 'GET' && !acao) {
      const u = exigeUser(req, res); if (!u) return true;
      let o = D.pedidos[id];
      if (o && o.real && o.v1id) o = await sincronizaReal(o) || o;
      if (!o || o.userId !== u.id) return erro(res, 404, 'pedido não encontrado', 'nao_encontrado'), true;
      return envia(res, 200, pedidoPublico(o)), true;
    }
    if (M === 'POST' && (acao === 'cancel' || acao === 'finish')) {
      const u = exigeUser(req, res); if (!u) return true;
      const o = D.pedidos[id];
      if (!o || o.userId !== u.id) return erro(res, 404, 'pedido não encontrado', 'nao_encontrado'), true;
      if (acao === 'finish') return envia(res, 200, pedidoPublico(o)), true;
      const podeCancelar = !o.messages?.length && !['completed', 'cancelled', 'refunded'].includes(o.status);
      if (!podeCancelar) return erro(res, 400, 'já não dá mais para cancelar este número', 'cancelado'), true;
      if (o.real && o.v1id) { try { await v1(`/orders/${o.v1id}/cancel`, 'POST', {}); } catch {} }
      o.status = 'refunded';
      u.saldo = (u.saldo ?? 0) + (o.priceCents || 0);
      registrarExtrato(u, 'refund', o.priceCents || 0); salvar();
      return envia(res, 200, pedidoPublico(o)), true;
    }
  }

  /* ---------- CHAVES DE API ---------- */
  if (p === '/api/keys' && M === 'GET') {
    const u = exigeUser(req, res); if (!u) return true;
    const lista = (D.chaves[u.id] || []).map(k => ({ ulid: k.ulid, name: k.name, prefix: k.prefix, revoked: k.revoked, criadoEm: k.criadoEm, ultimaUso: k.ultimaUso || null }));
    return envia(res, 200, lista), true;
  }
  if (p === '/api/keys' && M === 'POST') {
    const u = exigeUser(req, res); if (!u) return true;
    const b = await jsonCorpo(req);
    const nome = String(b.name || 'principal').trim() || 'principal';
    const bruta = 'sk_live_' + crypto.randomBytes(20).toString('base64url');
    const k = { ulid: ulid(), name: nome, value: bruta, prefix: bruta.slice(0, 12), revoked: false, criadoEm: agora() };
    D.chaves[u.id] = D.chaves[u.id] || [];
    // cria uma nova e desliga a anterior ativa
    for (const x of D.chaves[u.id]) if (!x.revoked) { x.revoked = true; }
    D.chaves[u.id].unshift(k); salvar();
    const { value, ...pub } = k;
    return envia(res, 201, { key: bruta, ...pub }), true;
  }
  const chaveId = /^\/api\/keys\/([\w-]+)$/.exec(p);
  if (chaveId && M === 'DELETE') {
    const u = exigeUser(req, res); if (!u) return true;
    const arr = D.chaves[u.id] || [];
    const i = arr.findIndex(k => k.ulid === chaveId[1]);
    if (i >= 0) { arr[i].revoked = true; salvar(); }
    return envia(res, 200, { ok: true }), true;
  }

  /* ---------- ADMIN (dados locais do backend de teste) ---------- */
  if (p.startsWith('/api/admin/')) {
    const u = exigeUser(req, res); if (!u) return true;
    const admin = ['admin', 'super_admin'].includes(u.role);
    if (!admin) return erro(res, 403, 'acesso restrito a administradores', 'admin'), true;
    const r = adminRoute(p, req);
    if (r && r.__csv) {
      res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="orders.csv"' });
      res.end(r.__csv); return true;
    }
    if (r !== undefined) { envia(res, 200, r); return true; }
    return false; // admin não mapeado: deixa cair para a ponte/espelho
  }

  /* ---------- VISITAS (contador local para as métricas do painel admin) ---------- */
  if (p === '/api/site/visita') {
    const V = carregarDB();
    const k = diaLocalKey();
    V.visitas = V.visitas || {}; V.paginas = V.paginas || {};
    V.visitas[k] = (V.visitas[k] || 0) + 1;
    V.paginas[k] = (V.paginas[k] || 0) + 1;
    salvar();
    if (!res.writableEnded) { res.writeHead(204); res.end(''); }
    return true;
  }

  /* ---------- FAVORITOS ---------- */
  if (p === '/api/catalog/favorites' && M === 'GET') {
    const u = exigeUser(req, res); if (!u) return true;
    return envia(res, 200, D.favoritos[u.id] || []), true;
  }
  const favId = /^\/api\/catalog\/favorites\/([\w-]+)$/.exec(p);
  if (favId && (M === 'POST' || M === 'DELETE')) {
    const u = exigeUser(req, res); if (!u) return true;
    D.favoritos[u.id] = D.favoritos[u.id] || [];
    const code = favId[1];
    if (M === 'DELETE') D.favoritos[u.id] = D.favoritos[u.id].filter(c => c !== code);
    else if (!D.favoritos[u.id].includes(code)) D.favoritos[u.id].push(code);
    salvar();
    return envia(res, 200, D.favoritos[u.id]), true;
  }

  return false; // não é do meu conhecimento: deixa o serve.mjs resolver
}

/* ── auxiliares de negócio ─────────────────────────────────────────────────── */
function cupomBonus(code, valor) {
  const c = code.trim().toUpperCase();
  if (!c) return null;
  if (c === 'BEMVINDO10') return Math.min(2000, Math.round(valor * 0.10));
  if (c === 'TESTE5') return 500;
  return null;
}
function bônusFaixa(valor) {
  const faixas = [[100000, 6000], [30000, 1200], [10000, 300]];
  for (const [min, bon] of faixas) if (valor >= min) return bon;
  return 0;
}
function pixFake(valorCents) {
  // código BR Code plausível (estrutura CRC não validada aqui, é para exibição)
  const valor = (valorCents / 100).toFixed(2);
  const base = `00020126580014br.gov.bcb.pix0136robsonsms-pix-${Date.now()}520400005303986540${valor.length}${valor}5802BR5910ROBSONSMS6009FLORIANOP62070503***6304ABCD`;
  return base;
}
function confirmaDeposit(ulid) {
  const D = carregarDB();
  const d = D.deposits[ulid];
  if (!d || d.status === 'paid') return;
  d.status = 'paid'; d.pagoEm = agora();
  const u = D.usuarios[d.userId];
  if (u) { u.saldo = (u.saldo ?? 0) + d.amountCents + (d.bonusCents || 0); registrarExtrato(u, 'deposit', d.amountCents + (d.bonusCents || 0)); }
  salvar();
}
function registrarExtrato(u, type, amountCents) {
  u.extrato = u.extrato || [];
  u.extrato.unshift({ ulid: ulid(), type, amountCents, saldo: u.saldo ?? 0, em: agora() });
  if (u.extrato.length > 200) u.extrato.length = 200;
}
function extratoDo(u) {
  const movs = [...(u.extrato || [])];
  for (const d of Object.values(carregarDB().deposits).filter(x => x.userId === u.id && x.status === 'paid')) {
    if (!movs.some(m => m.type === 'deposit' && m.em === d.pagoEm)) { /* já registrado na confirmação */ }
  }
  return movs;
}
function pedidoPublico(o) {
  return {
    ulid: o.ulid, service: o.service, country: o.country, operator: o.operator || '', server: o.server,
    phone: o.phone, status: o.status, smsCode: o.smsCode || '', messages: o.messages || [],
    is_final: !!o.is_final, priceCents: o.priceCents ?? 0, cancel_in: o.cancel_in ?? null,
    createdAt: o.criadoEm, updatedAt: o.updatedAt || o.criadoEm, expiresAt: o.expiresAt,
  };
}
async function sincronizaReal(o) {
  try {
    const r = await v1(`/orders/${o.v1id}`);
    const d = r.dados?.data ?? r.dados ?? {};
    o.phone = d.phone || o.phone;
    o.messages = (d.messages || []).map(m => ({ text: m.text || '', code: m.code || '', received_at: m.received_at }));
    o.smsCode = d.sms_code || (o.messages[o.messages.length - 1]?.code) || o.smsCode;
    o.is_final = !!d.is_final;
    if (d.status) o.status = traduzStatusV1(d.status);
    o.updatedAt = agora(); salvar();
  } catch {}
  return o;
}
function traduzStatusV1(s) {
  const map = { searching_number: 'searching_number', active: 'active', sms_received: 'sms_received', completed: 'completed', cancelled: 'cancelled', refunded: 'refunded', expired: 'expired', failed: 'failed' };
  return map[s] || s;
}

/* roda uma vez no start: garante um usuário admin para entrar no /admin */
export function inicializar(log = () => {}) {
  const D = carregarDB();
  const email = (process.env.ADMIN_EMAIL || 'admin@robsonsms.com.br').toLowerCase();
  const senha = process.env.ADMIN_PASSWORD || 'admin1234';
  let admin = Object.values(D.usuarios).find(u => u.email === email);
  if (!admin) {
    const id = ulid();
    D.usuarios[id] = {
      id, name: 'Administrador', email, phone: '', role: 'super_admin', status: 'active',
      saldo: Math.max(0, Number(process.env.ADMIN_SALDO_INICIAL_CENTS || 0)),
      referral_code: crypto.randomBytes(3).toString('hex').toUpperCase(),
      createdAt: agora(), last_login_at: agora(), senha: hashSenha(senha),
    };
    salvar();
    log(`  usuário admin    ${email}  /  ${senha}`);
  }
  return D;
}

/* ── rotas /api/admin/* respondidas com os dados LOCAIS do backend ──────────── */
function httpErro(status, message) { const e = new Error(message); e.httpStatus = status; return e; }

function adminRoute(p, req) {
  const D = carregarDB();
  const qs = new URLSearchParams(req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
  const usuarios = Object.values(D.usuarios);
  const pedidos = Object.values(D.pedidos);
  const deps = Object.values(D.deposits);
  const qBusca = (qs.get('q') || '').toLowerCase();
  const nomeDe = id => D.usuarios[id]?.name || '—';
  const emailDe = id => D.usuarios[id]?.email || '';

  const concluidos = pedidos.filter(x => ['completed', 'sms_received'].includes(x.status));
  const receita = concluidos.reduce((a, x) => a + (x.priceCents || 0), 0);
  const custo = Math.round(receita * 0.9);
  const depsPagos = deps.filter(d => d.status === 'paid');
  const depValor = depsPagos.reduce((a, d) => a + d.amountCents + (d.bonusCents || 0), 0);
  const comDeposito = new Set(depsPagos.map(d => d.userId));

  const serie = [];
  for (let i = 29; i >= 0; i--) {
    const dia = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    const valor = depsPagos.filter(d => (d.pagoEm || '').slice(0, 10) === dia).reduce((a, d) => a + d.amountCents + (d.bonusCents || 0), 0);
    serie.push({ bucket: dia, valor });
  }

  const resumoFinanceiro = {
    grain: 'day',
    totals: { rev: receita, profit: receita - custo, cost: custo, orders: concluidos.length },
    deposits: { paid: depValor, count: depsPagos.length },
    clientes: { novos: usuarios.filter(u => Date.now() - Date.parse(u.createdAt) < 30 * 864e5).length, recorrentes: 0, ativos: usuarios.filter(u => u.last_login_at && Date.now() - Date.parse(u.last_login_at) < 7 * 864e5).length, total: usuarios.length },
    conversao: { cadastros: usuarios.length, depositaram: comDeposito.size, taxa: usuarios.length ? Math.round(comDeposito.size / usuarios.length * 100) : 0 },
    ticket: { porDeposito: depsPagos.length ? Math.round(depValor / depsPagos.length) : 0, porPedido: concluidos.length ? Math.round(receita / concluidos.length) : 0 },
    seriesDepositos: serie,
  };

  if (p === '/api/admin/overview' || p === '/api/admin/revenue') return resumoFinanceiro;

  if (p === '/api/admin/users') {
    const sort = qs.get('sort') || 'saldo';
    const limite = Math.max(1, Number(qs.get('limit') || 200));
    const linhas = usuarios
      .map(u => {
        const depPagos = deps.filter(d => d.userId === u.id && d.status === 'paid');
        const pedU = pedidos.filter(x => x.userId === u.id);
        const depositado = depPagos.reduce((a, d) => a + d.amountCents + (d.bonusCents || 0), 0);
        const gasto = pedU.filter(x => !['refunded', 'cancelled'].includes(x.status)).reduce((a, x) => a + (x.priceCents || 0), 0);
        return {
          id: u.id, ulid: u.id, name: u.name, email: u.email, phone: u.phone || '', role: u.role, status: u.status,
          balance_cents: u.saldo ?? 0, depositado, gasto, lucro: Math.round(gasto * 0.1),
          created_at: u.createdAt, last_login_at: u.last_login_at || null,
          pedidos: pedU.length, orders: pedU.length, deposits: depPagos.length, risk: 'LOW', blocked: u.status !== 'active',
        };
      })
      .filter(u => !qBusca || u.name.toLowerCase().includes(qBusca) || u.email.includes(qBusca));
    const ordem = {
      saldo: (a, b) => b.balance_cents - a.balance_cents,
      depositado: (a, b) => b.depositado - a.depositado,
      gasto: (a, b) => b.gasto - a.gasto,
      recente: (a, b) => b.created_at.localeCompare(a.created_at),
    };
    linhas.sort(ordem[sort] || ordem.saldo);
    return linhas.slice(0, limite);
  }
  if (p === '/api/admin/users/blocked') {
    const bl = usuarios.filter(u => u.status !== 'active').map(u => ({ id: u.id, name: u.name, email: u.email, motivo: 'bloqueado manualmente' }));
    return { count: bl.length, users: bl };
  }
  const detUser = /^\/api\/admin\/users\/([\w-]+)(?:\/(detail|status|set-balance|credit|unblock))?$/.exec(p);
  if (detUser) {
    const u = D.usuarios[detUser[1]];
    if (!u) throw httpErro(404, 'usuário não encontrado');
    const pub = usuarioPublico(u);
    pub.orders = pedidos.filter(x => x.userId === u.id).length;
    pub.deposits = deps.filter(d => d.userId === u.id && d.status === 'paid').length;
    return pub;
  }

  if (p === '/api/admin/orders') {
    const offset = Number(qs.get('offset') || 0), limit = Math.max(1, Number(qs.get('limit') || 100));
    const statusF = qs.get('status'), provF = qs.get('provider');
    const todos = pedidos
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
      .filter(x => (!statusF || statusF === 'all' || statusF === 'todos' || x.status === statusF) && (!provF || provF === 'all' || x.server === provF) && (!qBusca || (nomeDe(x.userId) + emailDe(x.userId) + x.phone + x.service).toLowerCase().includes(qBusca)));
    const concl = todos.filter(x => ['completed', 'sms_received'].includes(x.status));
    const receitaF = concl.reduce((a, x) => a + (x.priceCents || 0), 0);
    const custoF = Math.round(receitaF * 0.9);
    return {
      rows: todos.slice(offset, offset + limit).map(x => ({
        ulid: x.ulid, id: x.ulid, cliente: nomeDe(x.userId), email: emailDe(x.userId),
        service: x.service, country: x.country, phone_number: x.phone, sms_code: x.smsCode || null,
        provider: x.server, price_customer_cents: x.priceCents ?? 0,
        cost_provider_cents: Math.round((x.priceCents ?? 0) * 0.9), profit_cents: Math.round((x.priceCents ?? 0) * 0.1),
        status: x.status, created_at: x.criadoEm, expires_at: x.expiresAt,
      })),
      pagina: { offset, limit, temMais: offset + limit < todos.length },
      totais: { vendidos: concl.length, qtd: todos.length, receita: receitaF, custo: custoF, lucro: receitaF - custoF },
    };
  }
  const detOrdem = /^\/api\/admin\/orders\/([\w-]+)\/detail$/.exec(p);
  if (detOrdem) {
    const o = D.pedidos[detOrdem[1]];
    if (!o) throw httpErro(404, 'pedido não encontrado');
    return pedidoPublico(o);
  }

  if (p === '/api/admin/deposits') {
    const st = qs.get('status') || 'all';
    const per = qs.get('period') || 'tudo';
    // janela de período (filtrando por data de criação)
    let deTs = 0;
    const agoraD2 = new Date();
    if (per === 'hoje') deTs = new Date(agoraD2.getFullYear(), agoraD2.getMonth(), agoraD2.getDate()).getTime();
    else if (per === 'week' || per === '7d') deTs = agoraD2.getTime() - 7 * 864e5;
    else if (per === 'month') deTs = new Date(agoraD2.getFullYear(), agoraD2.getMonth(), 1).getTime();
    else if (per === 'year' || per === 'ano') deTs = new Date(agoraD2.getFullYear(), 0, 1).getTime();
    else if (per === 'custom') { const f = qs.get('from'); if (f) deTs = new Date(String(f) + 'T00:00:00').getTime(); }
    const lista = deps
      .filter(d => (!st || st === 'all' || st === 'todos' || d.status === st) && Date.parse(d.criadoEm) >= deTs)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    const porStatus = {};
    for (const d of deps) { porStatus[d.status] = porStatus[d.status] || { status: d.status, v: 0, n: 0 }; porStatus[d.status].v += d.amountCents; porStatus[d.status].n++; }
    return {
      resumo: Object.values(porStatus),
      lista: lista.map(d => ({ id: d.ulid, ulid: d.ulid, name: nomeDe(d.userId), email: emailDe(d.userId), cliente: nomeDe(d.userId), amount_cents: d.amountCents, bonus_cents: d.bonusCents || 0, status: d.status, metodo: d.metodo, created_at: d.criadoEm, paid_at: d.pagoEm || null })),
    };
  }
  const detDep = /^\/api\/admin\/deposits\/([\w-]+)\/detail$/.exec(p);
  if (detDep) {
    const d = D.deposits[detDep[1]];
    if (!d) throw httpErro(404, 'depósito não encontrado');
    const du = D.usuarios[d.userId];
    return {
      id: d.ulid, ulid: d.ulid, amount_cents: d.amountCents, bonus_cents: d.bonusCents || 0,
      status: d.status, metodo: d.metodo, gateway: 'pix (simulado)', external_id: '', coupon_code: null,
      created_at: d.criadoEm, paid_at: d.pagoEm || null,
      cliente: nomeDe(d.userId), cliente_email: emailDe(d.userId),
      wallet: { balance_cents: du?.saldo ?? 0 },
    };
  }

  if (p === '/api/admin/payments') {
    return { margins: { globalMarginPercent: 100, minPriceCents: 20, depositMinCents: 500, marketBands: [], globalMarginFixedCents: 0 }, bonusTiers: [[10000, 300], [30000, 1200], [100000, 6000]].map(([m, b]) => ({ minCents: m, bonusCents: b })), gateways: [] };
  }
  if (p === '/api/admin/site') {
    // CMS do backoffice espera um array de blocos {key, value}
    return [{ key: 'testimonials', value: [] }, { key: 'announcements', value: [] }];
  }
  if (p === '/api/admin/invasoes') {
    return { volume: { porHoraAgora: 0, porHoraNormal: 10, acimaDoNormal: false }, total: { eventos: 0, origens: 0 }, origens: [], bloqueados: [], porTipo: [] };
  }
  if (p === '/api/admin/coupons') {
    return [
      { code: 'BEMVINDO10', tipo: 'percentual', valor: 10, max_bonus_cents: 2000, ativo: true, usos: 0, criada_em: agora() },
      { code: 'TESTE5', tipo: 'fixo', valor: 500, max_bonus_cents: 500, ativo: true, usos: 0, criada_em: agora() },
    ];
  }
  if (p === '/api/admin/price-overrides') return [];
  if (p === '/api/admin/services') return catalogo().slice(0, 200).map(s => ({ code: s.code, name: s.name, price_cents: s.priceCents, stock: s.stock, available: s.available, provider: null }));
  if (p === '/api/admin/stock') return catalogo().slice(0, 100).map(s => ({ code: s.code, name: s.name, stock: s.stock ?? 0, available: s.available !== false }));
  if (p === '/api/admin/costs') return [];
  if (p === '/api/admin/countries') {
    try { return JSON.parse(fs.readFileSync(path.join(RAIZ, 'mirror', 'api__catalog__countries.json'), 'utf8')); } catch { return []; }
  }
  if (p === '/api/admin/countries/disponiveis') return [];
  if (p === '/api/admin/providers') return [];
  if (p === '/api/admin/integrations') return [];
  if (p === '/api/admin/gateways/active') return {};
  if (p === '/api/admin/gateways') return [];
  if (p === '/api/admin/settings') return {};
  if (p === '/api/admin/security') return { sessions: 0, chaves_ativas: Object.values(D.chaves).flat().filter(k => !k.revoked).length };
  if (p === '/api/admin/promos') return [];
  if (p.startsWith('/api/admin/aluguel/')) return p.endsWith('config') ? {} : p.endsWith('vendas') ? { rows: [], total: 0 } : [];
  if (p.startsWith('/api/admin/logs/')) return [];
  if (p === '/api/admin/afiliados/resumo') return { total: 0, series: [] };
  if (p === '/api/admin/afiliados/config') return { percentual: 10, min_saque_cents: 5000 };
  if (p.startsWith('/api/admin/afiliados/')) return p.endsWith('saques') ? [] : [];
  if (p.startsWith('/api/admin/marca')) return { logo_url: '/marca/simbolo', assinatura_url: '/marca/assinatura' };
  if (p.startsWith('/api/admin/sync-catalog')) return { ok: true, sincronizados: catalogo().length };
  if (p.startsWith('/api/admin/export/orders.csv')) {
    const linhas = ['ulid;cliente;servico;telefone;status;preco_cents;criado_em'];
    for (const x of pedidos.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))) {
      linhas.push([x.ulid, nomeDe(x.userId), x.service, x.phone, x.status, x.priceCents ?? 0, x.criadoEm].join(';'));
    }
    return { __csv: linhas.join('\n') };
  }
  if (p === '/api/admin/painel') {
    const jn = painelJanela(qs.get('periodo') || 'hoje', qs.get('from'), qs.get('to'));
    return {
      passo: jn.passo,
      atual: painelMetrics(D, jn.de, jn.ate),
      anterior: painelMetrics(D, jn.antDe, jn.antAte),
      serie: painelSerie(D, jn),
      ...painelRankings(D, jn.de, jn.ate),
    };
  }
  // demais /api/admin/*: objeto vazio estável para o painel não acusar erro
  return {};
}

/* ── métricas da "Visão geral" (/api/admin/painel) a partir do banco local ──── */
function diaLocalKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function emJanela(iso, de, ate) {
  const t = Date.parse(iso);
  return !Number.isNaN(t) && t >= de.getTime() && t <= ate.getTime();
}

function painelJanela(periodo, from, to) {
  const agoraD = new Date();
  const hoje0 = new Date(agoraD.getFullYear(), agoraD.getMonth(), agoraD.getDate());
  const DIA = 864e5;
  let de, ate = new Date(agoraD), passo = 'hora';
  switch (periodo) {
    case 'hoje': de = hoje0; passo = 'hora'; break;
    case 'ontem': de = new Date(hoje0.getTime() - DIA); ate = new Date(hoje0.getTime() - 1); passo = 'hora'; break;
    case '7d': de = new Date(hoje0.getTime() - 6 * DIA); passo = 'dia'; break;
    case '30d': de = new Date(hoje0.getTime() - 29 * DIA); passo = 'dia'; break;
    case '90d': case '3m': de = new Date(hoje0.getTime() - 89 * DIA); passo = 'dia'; break;
    case '12m': case 'ano':
      de = new Date(agoraD.getFullYear() - 1, agoraD.getMonth(), agoraD.getDate()); passo = 'mes'; break;
    case 'custom': {
      if (from && to) { de = new Date(String(from) + 'T00:00:00'); ate = new Date(String(to) + 'T23:59:59'); }
      else de = new Date(hoje0.getTime() - 29 * DIA);
      passo = ate - de > 45 * DIA ? 'mes' : 'dia'; break;
    }
    default: de = hoje0; passo = 'hora';
  }
  const dur = ate.getTime() - de.getTime();
  const antAte = new Date(de.getTime() - 1);
  const antDe = new Date(antAte.getTime() - dur);
  return { de, ate, antDe, antAte, passo };
}

function somaVisitas(D, de, ate) {
  let total = 0, n = 0;
  for (let d = new Date(de.getFullYear(), de.getMonth(), de.getDate()); d <= ate && n < 400; d.setDate(d.getDate() + 1), n++) {
    total += (D.visitas || {})[diaLocalKey(d)] || 0;
  }
  return total;
}

function painelMetrics(D, de, ate) {
  const depsPagos = Object.values(D.deposits).filter(x => x.status === 'paid' && emJanela(x.pagoEm, de, ate));
  const faturamento = depsPagos.reduce((a, x) => a + x.amountCents + (x.bonusCents || 0), 0);
  const depositos = depsPagos.length;
  const pagantes = new Set(depsPagos.map(x => x.userId));
  const primeiraPag = {};
  for (const x of Object.values(D.deposits)) {
    if (x.status !== 'paid') continue;
    const t = Date.parse(x.pagoEm);
    if (!(x.userId in primeiraPag) || t < primeiraPag[x.userId]) primeiraPag[x.userId] = t;
  }
  const clientesNovos = [...pagantes].filter(id => primeiraPag[id] >= de.getTime() && primeiraPag[id] <= ate.getTime()).length;
  const pedidosJ = Object.values(D.pedidos).filter(x => emJanela(x.criadoEm, de, ate));
  const estornos = pedidosJ.filter(x => ['refunded', 'cancelled'].includes(x.status)).length;
  const vendasValor = pedidosJ.filter(x => !['refunded', 'cancelled'].includes(x.status)).reduce((a, x) => a + (x.priceCents || 0), 0);
  const custo = Math.round(vendasValor * 0.9);
  const cadastros = Object.values(D.usuarios).filter(u => emJanela(u.createdAt, de, ate)).length;
  const visitas = somaVisitas(D, de, ate);
  return {
    faturamento, depositos,
    depositosPendentes: Object.values(D.deposits).filter(x => x.status !== 'paid').length,
    ticketMedio: depositos ? Math.round(faturamento / depositos) : 0,
    visitas, paginas: visitas,
    vendas: pedidosJ.length, vendasValor, estornos, custo, lucro: vendasValor - custo,
    cadastros, compradores: new Set(pedidosJ.map(x => x.userId)).size,
    conversao: visitas ? Math.min(100, Math.round(cadastros / visitas * 100)) : 0,
    clientesNovos, clientesRecorrentes: Math.max(0, pagantes.size - clientesNovos), clientesPagantes: pagantes.size,
  };
}

function painelSerie(D, jn) {
  const depsPagos = Object.values(D.deposits).filter(x => x.status === 'paid');
  const pedidos = Object.values(D.pedidos).filter(x => !['refunded', 'cancelled'].includes(x.status));
  const fatEntre = (a, b) => depsPagos.filter(x => emJanela(x.pagoEm, a, b)).reduce((s, x) => s + x.amountCents + (x.bonusCents || 0), 0);
  const vendEntre = (a, b) => pedidos.filter(x => emJanela(x.criadoEm, a, b)).length;
  const out = [];
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  if (jn.passo === 'hora') {
    const dia0 = new Date(jn.de.getFullYear(), jn.de.getMonth(), jn.de.getDate());
    for (let h = 0; h < 24; h++) {
      const ini = new Date(dia0.getTime() + h * 36e5);
      out.push({ rotulo: String(h).padStart(2, '0') + 'h', faturamento: fatEntre(ini, new Date(ini.getTime() + 36e5)), vendas: vendEntre(ini, new Date(ini.getTime() + 36e5)), visitas: 0 });
    }
  } else if (jn.passo === 'dia') {
    let n = 0;
    for (let d = new Date(jn.de.getFullYear(), jn.de.getMonth(), jn.de.getDate()); d <= jn.ate && n < 32; d.setDate(d.getDate() + 1), n++) {
      const k = diaLocalKey(d);
      out.push({ rotulo: k.slice(8) + '/' + k.slice(5, 7), faturamento: fatEntre(d, new Date(d.getTime() + 864e5)), vendas: vendEntre(d, new Date(d.getTime() + 864e5)), visitas: (D.visitas || {})[k] || 0 });
    }
  } else {
    let ano = jn.de.getFullYear(), mes = jn.de.getMonth(), n = 0;
    while (n < 14) {
      const ini = new Date(ano, mes, 1), fim = new Date(ano, mes + 1, 1);
      out.push({ rotulo: MES[mes] + '/' + String(ano).slice(2), faturamento: fatEntre(ini, fim), vendas: vendEntre(ini, fim), visitas: 0 });
      if (ini > jn.ate) break;
      mes++; if (mes > 11) { mes = 0; ano++; } n++;
    }
  }
  return out;
}

/* rankings da visão geral: serviços, clientes, países, canais, meios, origens, "agora" */
const PAISES_NOME = { brazil: 'Brasil', br: 'Brasil', us: 'EUA', usa: 'EUA', mexico: 'México', portugal: 'Portugal', spain: 'Espanha', uk: 'Reino Unido', germany: 'Alemanha', india: 'Índia', indonesia: 'Indonésia' };
function nomePais(c) { return PAISES_NOME[String(c || '').toLowerCase()] || String(c || '—'); }
function nomeServico(code) {
  const it = catalogo().find(s => (s.code || '').toLowerCase() === String(code).toLowerCase());
  return it?.name || it?.title || String(code);
}

function painelRankings(D, de, ate) {
  const pedidosJ = Object.values(D.pedidos).filter(x => emJanela(x.criadoEm, de, ate));
  const entregues = pedidosJ.filter(x => ['completed', 'sms_received'].includes(x.status));
  const depsPagos = Object.values(D.deposits).filter(x => x.status === 'paid' && emJanela(x.pagoEm, de, ate));
  const usuarios = Object.values(D.usuarios);

  const porServico = {};
  for (const x of entregues) {
    porServico[x.service] = porServico[x.service] || { nome: nomeServico(x.service), vendas: 0, receita: 0 };
    porServico[x.service].vendas++; porServico[x.service].receita += x.priceCents || 0;
  }
  const servicos = Object.values(porServico).sort((a, b) => b.vendas - a.vendas).slice(0, 5).map(s => ({ ...s, lucro: Math.round(s.receita * 0.1) }));

  const porCliente = {};
  for (const d of depsPagos) {
    porCliente[d.userId] = porCliente[d.userId] || { name: D.usuarios[d.userId]?.name || '', email: D.usuarios[d.userId]?.email || '', total: 0, depositos: 0 };
    porCliente[d.userId].total += d.amountCents + (d.bonusCents || 0);
    porCliente[d.userId].depositos++;
  }
  const topClientes = Object.values(porCliente).sort((a, b) => b.total - a.total).slice(0, 5);

  const porPais = {};
  for (const x of entregues) {
    porPais[x.country] = porPais[x.country] || { nome: nomePais(x.country), vendas: 0, receita: 0 };
    porPais[x.country].vendas++; porPais[x.country].receita += x.priceCents || 0;
  }
  const paises = Object.values(porPais).sort((a, b) => b.vendas - a.vendas).slice(0, 5);

  const receitaEntregue = entregues.reduce((a, x) => a + (x.priceCents || 0), 0);
  const canais = [
    { canal: 'site', vendas: entregues.length, receita: receitaEntregue },
    { canal: 'api', vendas: 0, receita: 0 },
  ];
  const meios = depsPagos.length
    ? [{ metodo: 'pix', n: depsPagos.length, v: depsPagos.reduce((a, d) => a + d.amountCents + (d.bonusCents || 0), 0) }]
    : [];

  const cadastrosJ = usuarios.filter(u => emJanela(u.createdAt, de, ate)).length;
  const origens = cadastrosJ ? [{ origem: 'direto', n: cadastrosJ }] : [];

  const agoraB = {
    saldoClientes: usuarios.reduce((a, u) => a + (u.saldo ?? 0), 0),
    clientesComSaldo: usuarios.filter(u => (u.saldo ?? 0) > 0).length,
    pedidosAtivos: Object.values(D.pedidos).filter(x => ['searching_number', 'active'].includes(x.status)).length,
    visitantesHoje: (D.visitas || {})[diaLocalKey()] || 0,
  };

  return { servicos, topClientes, paises, canais, meios, origens, agora: agoraB };
}
