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
src/                 fonte de sw.js e serve.mjs
tools/               scripts de captura, montagem e verificação (Python e Node)
raw/                 material bruto capturado: DOMs do site ao vivo, capturas de tela, APIs, logos
```

Tamanho: **7.596 arquivos, 24,6 MB** (20,7 MB disso são os ícones dos serviços do catálogo).

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

Isto depende do backend da ALLAN SMS, que não é público:

* **entrar e criar conta de verdade** — o formulário aparece, valida e chama a API,
  mas não há servidor para criar a conta. `POST` responde `{}`. Quem tenta entrar vê
  a própria tela de login de novo, exatamente como quem não está autenticado.
* **painel, saldo, pedidos, aluguel, recarga por PIX, afiliados, admin** — rotas
  protegidas abrem e caem no login (mesmo comportamento do original para visitante).
* **preços e estoque congelados** em 08/10/2026: o catálogo tem 7.500 serviços, mas é
  a fotografia do momento da captura, não um cálculo em tempo real.
* **busca de disponibilidade de número**, HISTÓRICO de pedidos e qualquer escrita.
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
