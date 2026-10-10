/* sw.js — o espelho offline do allansms.com.

   A pasta do clone é uma árvore estática normal: /assets, /fonts, /mirror e cada
   rota com seu index.html. O service worker só faz o que um servidor estático não
   faz sozinho:

     1. responder os /api que o bundle chama, com o conteúdo congelado em mirror/;
     2. servir /api/logo/<código> a partir dos ícones baixados;
     3. devolver a casca para rota funda do React (/painel, /pedido/01H...).

   Nada aqui vai para fora da pasta: aberto sem internet o site continua inteiro. */

const Origem = new URL(self.location).origin;
const Base = new URL(self.location).pathname.replace(/[^/]*$/, '');

/* o que já é arquivo de verdade na pasta: deixa o navegador buscar direto */
const DIRETO = /^(\/(assets|fonts|mirror)\/|\/sw\.js$|\/routes\.json$|\/serve\.mjs$)/;

let Rotas = null;   // routes.json -> { '/precos': {file, type, status}, ... }
let Logos = null;   // mirror/logo-index.json -> { 'uber': '.ico', ... }

const TIPOS = {
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp', '.avif': 'image/avif',
  '.json': 'application/json', '.css': 'text/css; charset=utf-8',
};

const rotas = () => Rotas || (Rotas = fetch('./routes.json', { cache: 'no-cache' })
  .then((r) => r.json()).then((j) => j.rotas));

const logos = () => Logos || (Logos = fetch('./mirror/logo-index.json')
  .then((r) => (r.ok ? r.json() : {})).catch(() => ({})));

function responder(arquivo, tipo, status) {
  return fetch('./' + arquivo, { cache: 'force-cache' }).then((res) => {
    if (!res.ok) throw new Error('espelho sem ' + arquivo);
    return new Response(res.body, {
      status: status || 200,
      headers: { 'content-type': tipo || 'application/octet-stream' },
    });
  });
}

/* rota que o React conhece mas não está na tabela: devolve a casca e o próprio
   router do site decide o que mostrar (páginas internas, /admin, /pedido/xyz). */
const casca = () => fetch('./index.html', { cache: 'no-cache' }).then((res) =>
  new Response(res.body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }));

const semIcone = () => new Response('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
  { status: 404, headers: { 'content-type': 'image/svg+xml' } });

self.addEventListener('install', (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== Origem) return;              // nada externo é tocado

  // Modo local (node serve.mjs): o servidor tem a ponte com a API real e a chave
  // do .env — deixa ele responder os /api em vez de servir o espelho congelado.
  // Em hospedagem (domínio próprio) isso nunca entra e o espelho manda como antes.
  if (/^(localhost|127\.0\.0\.1)$/.test(url.hostname) && url.pathname.startsWith('/api/')) return;

  if (req.method !== 'GET') {
    // POST /api/site/visita e companhia: o site não lê a resposta, só engole
    event.respondWith(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    return;
  }

  let path = decodeURIComponent(url.pathname);
  if (path.indexOf(Base) === 0) path = '/' + path.slice(Base.length);
  if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);

  if (DIRETO.test(path)) return;                  // arquivo existe na pasta: sem mágica
  if (path === '/') return;                       // o index.html físico já serve a home

  const icone = /^\/api\/logo\/([^/?]+)$/.exec(path);

  event.respondWith(
    Promise.all([rotas(), logos()]).then(([tabela, extensoes]) => {
      if (icone) {
        // o bundle pede ?2x para telas retina; os originais são vetores e PNGs
        // pequenos, servimos o mesmo arquivo e o navegador reduz bem
        const codigo = icone[1].toLowerCase();
        const ext = extensoes[codigo];
        return ext ? responder('mirror/logo/' + codigo + ext, TIPOS[ext] || 'image/png', 200)
                   : semIcone();
      }
      const hit = tabela[path] || tabela[path + '.svg'] || tabela[path + '.png'];
      if (hit) return responder(hit.file, hit.type, hit.status);
      return casca();
    }).catch(casca)
  );
});
