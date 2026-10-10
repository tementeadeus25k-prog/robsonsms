#!/usr/bin/env python3
"""Build do clone: monta public/ a partir do que foi capturado em raw/.

Saída (public/):
  index.html            casca idêntica à que o servidor original devolve em /
  <rota>/index.html     mesma casca em cada rota do React (hosting estático puro)
  <rota>/index.html     páginas de conteúdo que o servidor já entrega em HTML pronto
  assets/*              JS e CSS originais, mesmos nomes com hash, byte a byte
  fonts/*               mesmas fontes do Google, servidas daqui
  mirror/**             arte da marca, bandeiras, ícones de serviço, JSON congelado
  routes.json           índice: caminho de URL -> arquivo + content-type + status
  sw.js, serve.mjs      duas formas de servir o índice (copiadas de src/)
"""
from __future__ import annotations

import concurrent.futures as cf
import json
import pathlib
import re
import shutil

import requests

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW, SRC_DIR = ROOT / "raw", ROOT / "src"
PUB = ROOT / "public"
MIRROR = PUB / "mirror"
SRC = "https://allansms.com"
H = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36"}

# rotas onde o servidor devolve a casca do React (o resto vem do /api)
SPA_ROUTES = ["/", "/login", "/cadastro", "/esqueci-senha", "/redefinir-senha", "/painel",
              "/perfil", "/recarga", "/pedidos", "/recargas", "/historico", "/aluguel",
              "/meus-alugueis", "/pedido/x", "/aluguel/x", "/proxies", "/afiliados",
              "/numeros", "/ajuda", "/admin", "/docs-api", "/status", "/termos", "/privacidade"]
# rotas que o servidor já entrega prontas, em HTML puro, sem bundle
SEO_ROUTES = ["/receber-sms-online", "/numero-virtual-whatsapp", "/numero-virtual-telegram",
              "/numero-virtual-instagram", "/precos", "/perguntas-frequentes", "/sobre"]
API_JSON = ["/api/site", "/api/catalog/services", "/api/catalog/countries",
            "/api/catalog/operators", "/api/catalog/servers", "/api/docs/openapi.json",
            "/api/docs/postman.json", "/health"]
# o bundle chama esses dois e espera 401 para quem não entrou
API_401 = {ep: {"message": "não autenticado", "error": "Unauthorized", "statusCode": 401}
           for ep in ("/api/auth/me", "/api/keys")}
FLAGS = ["brazil", "usa", "ukraine", "england", "china", "indonesia", "india", "br", "us", "pt"]
FLAT = ["/site.webmanifest", "/robots.txt", "/sitemap.xml", "/favicon.ico", "/icone-48.png",
        "/icone-96.png", "/icone-192.png", "/marca/favicon", "/marca/apple", "/marca/card",
        "/marca/assinatura", "/marca/simbolo"]

TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
         ".css": "text/css; charset=utf-8", ".json": "application/json",
         ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json",
         ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml",
         ".ico": "image/x-icon", ".jpg": "image/jpeg", ".webp": "image/webp",
         ".gif": "image/gif", ".bmp": "image/bmp", ".avif": "image/avif",
         ".mjs": "text/javascript; charset=utf-8"}

# hospedagens estáticas precisam devolver a casca para rota profunda do React
# (/pedido/01H...). Os arquivos abaixo fazem isso no Netlify, Vercel e afins.
REGRAS = {
    "_redirects": "/*  /index.html  200\n",
    "vercel.json": json.dumps({"rewrites": [{"source": "/(.*)", "destination": "/index.html"}]}, indent=2),
    "netlify.toml": "[[redirects]]\n  from = \"/*\"\n  to = \"/index.html\"\n  status = 200\n",
    "404.html": None,                       # recebe o texto da casca
    "_headers": "/*\n  X-Content-Type-Options: nosniff\n",
    "package.json": json.dumps(
        {"name": "allansms-clone", "private": True, "version": "1.0.0", "type": "module",
         "description": "Clone estático de allansms.com (bundle original + API congelada)",
         "scripts": {"start": "node serve.mjs"}}, indent=2) + "\n",
}

log: list[str] = []
rotas: dict[str, dict] = {}


def checar(head: bytes, url: str) -> tuple[str, str]:
    """Extensão e content-type pelos bytes, porque boa parte das rotas não tem sufixo."""
    if head[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png", TYPES[".png"]
    if head[:3] == b"\xff\xd8\xff":
        return ".jpg", TYPES[".jpg"]
    if head.lstrip()[:4] in (b"<svg", b"<?xm"):
        return ".svg", TYPES[".svg"]
    if head[:4] == b"RIFF":
        return ".webp", TYPES[".webp"]
    if head[:2] == b"BM":
        return ".bmp", TYPES[".bmp"]
    if head[:2] == b"\x00\x00":
        return ".ico", TYPES[".ico"]
    if head[:15].lower().startswith(b"<!doctype html"):
        return ".html", TYPES[".html"]
    if head[:1] in (b"{", b"["):
        return ".json", TYPES[".json"]
    ext = pathlib.Path(url.split("?")[0]).suffix.lower()
    return ext, TYPES.get(ext, "application/octet-stream")


def baixar(path: str):
    try:
        r = requests.get(SRC + path, headers=H, timeout=90)
    except Exception as exc:  # noqa: BLE001
        log.append(f"FALHOU rede {path}: {exc}")
        return None
    if r.status_code != 200:
        log.append(f"FALHOU {r.status_code} {path}")
        return None
    log.append(f"ok {len(r.content):>9}B  {path}")
    return r


def espelhar(url_path: str, data: bytes, *, status: int = 200) -> str:
    ext, tipo = checar(data[:32], url_path)
    nome = url_path.strip("/").replace("/", "__") + ext
    dest = MIRROR / nome
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    rotas[url_path] = {"file": f"mirror/{nome}", "type": tipo, "status": status}
    return nome


PUB.mkdir(exist_ok=True)
for limpa in (MIRROR, PUB / "assets", PUB / "fonts"):
    if limpa.exists():
        shutil.rmtree(limpa)
shutil.copytree(RAW / "fonts", PUB / "fonts")   # woff2 + fonts.css baixados por tools/fonts.py

# ─────────────────────────────────────────────────────────── casca da SPA ────
print("== casca do React")
with cf.ThreadPoolExecutor(max_workers=6) as pool:
    baix = dict(zip(SPA_ROUTES, pool.map(baixar, SPA_ROUTES)))
cascas = {k: v.content for k, v in baix.items() if v}
print(f"   {len(cascas)} rotas perguntadas | corpo idêntico em todas: {len(set(cascas.values())) == 1}")

# o original quebra esse link em várias linhas; casa a tag inteira, do <link ao />
FONTE_GOOGLE = re.compile(r"<link[^>]*href=\"https://fonts\.googleapis\.com/[^\"]*\"[^>]*/>", re.S)

# caminho absoluto: o bundle do original já pede /assets/... assim, então o clone
# é feito para a raiz do domínio e aí as duas coisas batem
LOCAL_CSS = ('<link rel="stylesheet" href="/fonts/fonts.css" media="print" '
             'onload="this.media=\'all\'" />')

CASCA_NOTA = """<!-- ==== três diferenças em relação ao HTML original, e só estas:
          1. as fontes vêm desta pasta em vez do Google Fonts, para andar offline;
          2. saiu o beacon de estatística da Cloudflare (terceiros, só medição);
          3. um service worker responde os /api com o conteúdo congelado.
        O bundle (assets/*.js, assets/*.css) não foi tocado um byte. ==== -->"""

# contador de acesso da Cloudflare: analytics puro, não aparece na tela
BEACON_CF = re.compile(r"\s*<script[^>]*static\.cloudflareinsights\.com[^>]*></script>")

SW_REGISTRO = """
    <script>
      // No site original os dados vêm de um backend em /api. Aqui responde o
      // service worker, com o conteúdo congelado em mirror/. Assim o bundle
      // roda igualzinho, sem nenhum patch dentro dos arquivos com hash.
      // O bundle pede os próprios arquivos por caminho absoluto (/assets/...),
      // então o clone é feito para morar na raiz do domínio — mesmo escopo do SW.
      if ('serviceWorker' in navigator && !/^file:/.test(location.protocol)) {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
          .then(function () { return navigator.serviceWorker.ready; })
          .then(function () {
            // primeira visita: estes fetches já haviam saído antes do worker
            // entrar no meio, então recarrega uma única vez.
            if (!navigator.serviceWorker.controller &&
                !sessionStorage.getItem('clone-recarregou')) {
              sessionStorage.setItem('clone-recarregou', '1');
              location.replace(location.href);
            }
          })
          .catch(function (e) { console.warn('[clone] service worker:', e); });
      }
    </script>
  </body>"""

texto = cascas["/"].decode("utf8")
if not FONTE_GOOGLE.search(texto):
    raise SystemExit("bloco de fontes do Google não encontrado no HTML original")
casca = FONTE_GOOGLE.sub(lambda m: CASCA_NOTA + "\n    " + LOCAL_CSS, texto, count=1)
# os dois <link rel=preconnect> do Google ficam: sem internet falham em silêncio,
# e assim o resto do <head> continua idêntico ao original
n_beacon = len(BEACON_CF.findall(casca))
casca = BEACON_CF.sub("", casca, count=1)
casca = casca.replace("</body>", SW_REGISTRO, 1)

(PUB / "index.html").write_text(casca, encoding="utf8")
rotas["/"] = {"file": "index.html", "type": TYPES[".html"], "status": 200}
for rota in SPA_ROUTES[1:]:
    pasta = PUB / rota.strip("/")
    pasta.mkdir(parents=True, exist_ok=True)
    (pasta / "index.html").write_text(casca, encoding="utf8")
    rotas[rota] = {"file": f"{rota.strip('/')}/index.html", "type": TYPES[".html"], "status": 200}
print(f"   casca gravada em {len(rotas)} caminhos | {len(casca):,}B cada")

# ─────────────────────────────────────────────────────────── assets do bundle ─
print("\n== assets originais (inalterados)")
for p in sorted((RAW / "files" / "assets").iterdir()):
    rel = f"assets/{p.name}"
    (PUB / "assets").mkdir(exist_ok=True)
    shutil.copyfile(p, PUB / rel)
    rotas["/" + rel] = {"file": rel, "type": TYPES[p.suffix], "status": 200, "imutavel": True}
    print(f"   ok /{rel:<34} {p.stat().st_size:>9,}B")

# ─────────────────────────────────────────────────────────── fontes, API, arte ─
for p in sorted((PUB / "fonts").glob("*")):
    if p.suffix in TYPES:
        rotas[f"/fonts/{p.name}"] = {"file": f"fonts/{p.name}", "type": TYPES[p.suffix], "status": 200}
print(f"\n== fontes locais: {len(list((PUB/'fonts').glob('*.woff2')))} woff2 + fonts.css")

with cf.ThreadPoolExecutor(max_workers=6) as pool:
    for ep, r in zip(API_JSON, pool.map(baixar, API_JSON)):
        if r:
            espelhar(ep, r.content)
for ep, corpo in API_401.items():
    espelhar(ep, json.dumps(corpo, ensure_ascii=False).encode("utf8"), status=401)
with cf.ThreadPoolExecutor(max_workers=6) as pool:
    for c, r in zip(FLAGS, pool.map(baixar, [f"/api/flag/{c}" for c in FLAGS])):
        if r:
            espelhar(f"/api/flag/{c}", r.content)
with cf.ThreadPoolExecutor(max_workers=6) as pool:
    for p, r in zip(FLAT, pool.map(baixar, FLAT)):
        if r:
            espelhar(p, r.content)
print(f"== API congelada: {sum('/api' in k or k == '/health' for k in rotas)} endpoints | "
      f"{len(FLAGS)} bandeiras | {len(FLAT)} arquivos de arte")

# ícones de serviço: ficam fora do routes.json (seriam 7.500 linhas) e são
# resolvidos pelo logo-index.json, tanto pelo sw.js quanto pelo serve.mjs.
LOGOS_IN, LOGOS_OUT = RAW / "logos", MIRROR / "logo"
extensoes: dict[str, str] = {}
if LOGOS_IN.exists():
    LOGOS_OUT.mkdir(parents=True, exist_ok=True)
    for sub in LOGOS_IN.iterdir():
        if not sub.is_dir():
            continue
        for p in sub.iterdir():
            shutil.copyfile(p, LOGOS_OUT / p.name)
            extensoes[p.stem] = p.suffix
    (MIRROR / "logo-index.json").write_text(
        json.dumps(extensoes, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    rotas["/mirror/logo-index.json"] = {"file": "mirror/logo-index.json",
                                        "type": TYPES[".json"], "status": 200}
print(f"== ícones de serviço: {len(extensoes):,} arquivos, {sum(1 for e in extensoes.values() if e)} tipos")

# ─────────────────────────────────────────────────── páginas de conteúdo (SEO) ─
print("\n== páginas entregues em HTML puro pelo servidor original")
for rota in SEO_ROUTES:
    origem = RAW / "files" / rota.strip("/")
    if not origem.exists():
        log.append(f"FALHOU espelho ausente {rota}")
        continue
    rel = f"{rota.strip('/')}/index.html"
    (PUB / rota.strip("/")).mkdir(parents=True, exist_ok=True)
    (PUB / rel).write_bytes(origem.read_bytes())
    rotas[rota] = {"file": rel, "type": TYPES[".html"], "status": 200, "html_pronto": True}
    print(f"   ok {rota:<28} {origem.stat().st_size:>8,}B  (artigo completo, sem depender de JS)")

# ─────────────────────────────────────────────────────────── índice + scripts ─
for nome in ("sw.js", "serve.mjs"):
    shutil.copyfile(SRC_DIR / nome, PUB / nome)
rotas["/routes.json"] = {"file": "routes.json", "type": TYPES[".json"], "status": 200}
rotas["/sw.js"] = {"file": "sw.js", "type": TYPES[".js"], "status": 200}

(PUB / "routes.json").write_text(json.dumps(
    {"_fonte": SRC, "_capturado_em": "2026-10-08",
     "_nota": "tabela que o sw.js e o serve.mjs usam; nenhuma rota aponta para fora",
     "rotas": rotas}, ensure_ascii=False, indent=1), encoding="utf8")

# regras de reescrita para quem for hospedar como site estático
for nome, corpo in REGRAS.items():
    (PUB / nome).write_text(corpo if corpo else casca, encoding="utf8")

arquivos = [p for p in PUB.rglob("*") if p.is_file()]
total = sum(p.stat().st_size for p in arquivos)
print(f"\n== public/: {len(arquivos):,} arquivos, {total/1e6:.1f} MB")
falhas = [l for l in log if l.startswith("FALHOU")]
print("   falhas na coleta:", falhas or "nenhuma")
(RAW / "build-log.txt").write_text("\n".join(log), encoding="utf8")
