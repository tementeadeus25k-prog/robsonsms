# Clone de allansms.com

Cópia local do site **https://allansms.com/** — mesmo bundle React compilado, mesmo
CSS, mesmas artes, mesmas fontes, mesma marca, mesmo conteúdo das páginas de
conteúdo. Capturado em **08/10/2026**.

Ele abre sem internet e sem servidor de origem: os chamados `/api` do site são
respondidos com o conteúdo congelado no momento da captura.

---

## Abrir

| caminho | o que faz |
|---|---|
| **`ABRIR-clone.bat`** | dois cliques → sobe em `http://localhost:4173` e abre o navegador |
| `cd public && node serve.mjs` | o mesmo servidor, pelo terminal |
| `cd public && npm start` | idem |
| jogar `public/` numa hospedagem estática | funciona também: lá o `/api` fica a cargo do `sw.js` |

**No ar:** https://robsonsms.surge.sh (Surge.sh, a mesma hospedagem grátis do
`ledger-site`). Para atualizar depois de editar qualquer coisa em `public/`:

```bat
surge "C:\Users\Royal\Documents\Default Project\allansms-clone\public" robsonsms.surge.sh
```

Lá os `/api` ficam a cargo do `sw.js` com o espelho congelado — a ponte com a API
real (chave, painel logado) só existe localmente, no `serve.mjs`.

Precisa do Node.js instalado só para servir localmente (o site em si não precisa
de build, npm install nem backend). Para hospedar, suba o conteúdo de `public/` na
raiz do domínio — o bundle original pede os próprios arquivos por caminho absoluto
(`/assets/...`), então não funciona em subpasta. `_redirects`, `netlify.toml`,
`vercel.json` e `404.html` já vão dentro para as hospedagens estáticas mais comuns.

## O que tem dentro

```
public/              o site, pronto para servir
  index.html         casca idêntica à que o servidor original devolve em /
  <rota>/index.html  mesma casca em cada rota do React, e artigo pronto nas páginas de SEO
  assets/            18 chunks .js + 1 .css do build original, byte a byte, com hash no nome
  fonts/             Space Grotesk, Plus Jakarta Sans e JetBrains Mono servidos daqui
  mirror/            respostas congeladas dos /api, arte da marca, bandeiras, 7.490 ícones de serviço
  routes.json        índice usado pelo service worker e pelo servidor: URL -> arquivo, tipo, status
  sw.js              service worker que responde o índice no navegador
  serve.mjs          servidor Node equivalente, para rodar local
  backend.mjs        backend local: contas, login, recarga, pedidos, chaves e backoffice admin
src/                 fonte de sw.js, serve.mjs e backend.mjs
data/                banco do backend (db.json) — criado no primeiro start, pode ser apagado p/ zerar
tools/               scripts de captura, montagem e verificação (Python e Node)
raw/                 material bruto capturado: DOMs do site ao vivo, capturas de tela, APIs, logos
```

Tamanho: **7.596 arquivos, 24,6 MB** (20,7 MB disso são os ícones dos serviços do catálogo).

## `.env` — configuração do servidor local

O servidor local lê um `.env` (na raiz do projeto ou ao lado do `serve.mjs`). Sem ele,
o clone funciona exatamente como antes. Com ele, o painel conversa com a API de
verdade e o backend de teste fica ativo:

```env
PORT=4173                    # porta local
API_BASE=https://allansms.com   # origem da API v1
API_KEY=sk_live_...          # chave Bearer — só existe no servidor, nunca no navegador

# ── backend de teste (backend.mjs) ─────────────────────────────
MODO=simulado                # simulado = número+SMS fake, sem gastar nada
                             # real = compra de verdade na API v1 com a API_KEY (gasta R$)
AUTO_PIX=1                   # 1 → o PIX da recarga confirma sozinho após alguns segundos
PIX_AGUARDA_MS=6000          # tempo até o PIX auto-confirmar
ADMIN_EMAIL=admin@robsonsms.com.br   # admin criado no 1º start, entra em /admin
ADMIN_PASSWORD=admin1234
ADMIN_SALDO_INICIAL_CENTS=50000      # saldo inicial do admin (50000 = R$ 500)

PAINEL_ADMIN=1               # atalho antigo: /api/auth/me via identidade da chave (o backend leva a frente agora)
ADMIN_ROLE=super_admin       # papel do usuário logado
```

### A ponte com a API real (`serve.mjs`)

O `serve.mjs` traduz os endpoints que o front chama para a API v1 e devolve a resposta
no formato esperado — `/api/auth/me` (identidade + saldo reais), `/api/catalog/services`
e `/api/catalog/servers` (catálogo vivo), aluguel (`/api/rent*`). Qualquer outro `/api/*`
sem versão congelada é repassado à origem com a chave. A segurança mora aqui: o header
`Authorization` é injetado no Node, então a chave não aparece em nenhum arquivo que o
navegador baixa.

### O backend de teste (`backend.mjs`)

Um backend completo em Node puro (zero dependências), persistido em `data/db.json`,
que responde tudo que envolve conta e sessão **antes** da ponte — ou seja, localmente o
site funciona de ponta a ponta:

| fluxo | como funciona |
|---|---|
| **criar conta** | `POST /api/auth/register` — valida nome/e-mail/senha (mín. 8), cria sessão em cookie httpOnly |
| **entrar / sair** | `POST /api/auth/login` / `logout` — senha com hash scrypt + salt; admin já vem criado |
| **recarregar (PIX)** | `POST /api/wallet/deposit` → código copia-e-cola; com `AUTO_PIX=1` confirma sozinho em ~6 s e creditar saldo + bônus de faixa (R$ 100→+R$ 3, R$ 300→+R$ 12, R$ 1.000→+R$ 60) |
| **cupons** | `BEMVINDO10` (10%, máx. R$ 20) e `TESTE5` (R$ 5 fixos) aceitos no checkout |
| **comprar número** | `POST /api/orders` — debita saldo; em `MODO=simulado` gera número BR fake e o SMS (código de 6 dígitos) chega em ~10–15 s; em `MODO=real` compra na v1 com a `API_KEY` |
| **cancelar** | `POST /api/orders/:id/cancel` antes do SMS → status refunded + estorno no saldo |
| **chave de API** | `POST /api/keys` gera `sk_live_...` própria do usuário (mostrada uma vez), listar/revogar |
| **favoritos** | `GET/POST/DELETE /api/catalog/favorites/:code` por usuário |
| **backoffice `/admin`** | visão geral, faturamento, usuários, pedidos, depósitos, cupons, export CSV — tudo calculado **do banco local**; exige role `admin`/`super_admin` |
| **visitas** | `POST /api/site/visita` incrementa contador diário usado nas métricas de visitas/conversão |

O banco vive em `data/db.json` — apagar a pasta `data/` zera contas, saldos, pedidos e
depósitos. As compras do modo `simulado` não gastam dinheiro nenhum; só o `MODO=real`
toca o saldo real da `API_KEY`.

Fluxo completo testado de ponta a ponta (11/11): cadastrar → login → recarga de R$ 100
(auto-PIX + bônus) → comprar WhatsApp (R$ 11,76 debitados) → SMS chegou
(`sms_received` + código) → gerar chave de API → saldo final consistente. E o backoffice
admin renderiza com esses dados (faturamento R$ 103, lucro R$ 1,18, top clientes, série
por hora/dia/mês).

### O que muda (e o que não muda) online

Em **hospedagem estática** (Surge) nada disso roda: sem processo Node, o `sw.js`
continua respondendo os `/api` com o espelho congelado e o login volta a ficar só de
fachada — igual ao original. Para o backend funcionar *online* (amigos cadastrando e
comprando pelo https://robsonsms.surge.sh), falta hospedar o `serve.mjs` num host com
Node e disco persistente (ex.: Render free). Os arquivos estão prontos para isso; a
ponte e o backend já usam só variáveis de ambiente.

| teste local | resultado |
|---|---|
| `GET /api/auth/me` (com cookie) | 200 — usuário logado, saldo, role |
| `GET /api/catalog/services?country=brazil` | 200 — catálogo vivo (milhares de itens) |
| `GET /api/admin/painel?periodo=hoje` (admin) | 200 — métricas reais do banco local |
| usuário comum chamando `/api/admin/*` | 403 |
| servidor de fora do ar / API fora | JSON `{error:{code:"api_indisponivel"}}`, nada trava |

## O que é cópia e o que eu escrevi

O site continua sendo o original em tudo que aparece na tela. Foram **três** mudanças
no HTML, todas documentadas no próprio arquivo:

1. `<link>` do Google Fonts trocado por `/fonts/fonts.css` com os mesmos woff2 → anda offline;
2. removido o beacon de estatística da Cloudflare (só medição, nada visual);
3. registrado o `sw.js`, que responde os `/api`.

Os `.js` e `.css` compilados não foram tocados em nenhum byte. O que escrevi do zero
foram os utilitários: `sw.js`, `serve.mjs` e os scripts de `tools/`.

## Fidelidade medida (não afirmada)

| checagem | resultado |
|---|---|
| rotas comparadas com o DOM do site ao vivo (`tools/diff.py`) | **14/14 idênticas**; maior diferença de texto: 0,6% |
| pixels contra captura do site ao vivo (`tools/diff_telas.py`) | **13/14 rotas em 0,0%**; home em 1,4% |
| navegação, troca de tema, acordeão, links, rota funda (`tools/interacao.mjs`) | **11/11 passaram**, zero erro de página |
| varredura de todos os caminhos servidos (`tools/varredura.py`) | **469/471 ok** — os 2 restantes são os `401` de `/api/auth/me` e `/api/keys` |
| repetir tudo com a rede bloqueada | mesmos resultados |

A diferença restante na home é dinâmica por natureza: o relógio e o carrossel de
notificações animam, e os preços do catálogo mudam durante o dia no site original.

## O que um clone estático não leva junto

Isto depende de um backend com processo e disco. **Localmente, o `backend.mjs` cobre o
principal** (contas, login, saldo, recarga, compra, cancelamento, chaves, backoffice —
tudo em `data/db.json`). O que ainda fica fora:

* **login/conta online** — no Surge (estático) o formulário aparece e valida, mas não há
  servidor para criar a conta; é preciso hospedar o `serve.mjs` num host com Node
  (ex.: Render free) para funcionar pelo ar.
* **PIX de verdade** — a recarga auto-confirma por software (`AUTO_PIX=1`); plugar um
  gateway real (Mercado Pago, PagSeguro…) é o próximo passo natural.
* **aluguel, afiliados, promoções e o resto do backoffice** — respondem com dados neutros/
  vazios estáveis (as telas abrem sem erro), mas não reproduzem a lógica completa do original.
* **preços e estoque congelados** em 08/10/2026 no espelho: o catálogo do site público tem
  7.500 serviços como fotografia da captura; localmente, com `.env`, ele é vivo via ponte.
* chat Crisp (o identificador do site vem vazio na API pública, então ele nem
  carregava no original).

## Recapturar do zero

Serve quando o site original mudar:

Na ordem — os três primeiros falam com o site original, o resto monta e confere:

```bat
node   tools/render.mjs       ::  DOM e capturas do site ao vivo, rota por rota, no Chrome local
python tools/fetch_api.py     ::  congela as respostas dos /api em raw/api-cache
python tools/chunks.py        ::  fecha o grafo de chunks .js/.css que o Vite importa dinamicamente
python tools/logos.py         ::  os 7.500 ícones de serviço (crua em raw/logos)
python tools/fix_logos.py     ::  renomeia pela assinatura real dos bytes (.ico, .svg, .png)
python tools/fix_logos2.py    ::  descarta respostas que não são imagem
python tools/fonts.py         ::  auto-hospeda as fontes do Google em raw/fonts
python tools/build.py         ::  monta public/ inteiro de novo, com routes.json
                                 (a partir daí suba o serve.mjs: cd public && node serve.mjs)
node   tools/verify.mjs       ::  console, pedidos que falham, DOM e capturas de cada rota
node   tools/verify.mjs --offline   ::  repetido com a rede bloqueada
node   tools/interacao.mjs    ::  navegação, tema, acordeão, links, rota funda
python tools/diff.py          ::  DOM do clone x DOM capturado do original
python tools/diff_home.py     ::  mostra palavra por palavra onde a home difere
python tools/diff_telas.py    ::  pixels do clone x pixels do original
python tools/varredura.py     ::  todos os caminhos precisam responder, sem HTML disfarçado
```

## Nota sobre propriedade

Isso é uma cópia do site de terceiros, com a marca, os textos, a identidade visual e
o código de produção da ALLAN SMS. Serve para estudo, referência e trabalho offline;
para publicar em domínio próprio é preciso ter direito sobre a marca e o conteúdo.
