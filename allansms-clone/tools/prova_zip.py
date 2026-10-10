#!/usr/bin/env python3
"""Prova que o ZIP entregue funciona sozinho: extrai, serve e acesse rotas.

Descompacta allansms-clone.zip em pasta temporária, sobe o serve.mjs de lá em uma
porta própria e confere um conjunto de URLs. Se passar aqui, passa em qualquer
máquina com Node.
"""
import pathlib
import random
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
import zipfile

RAIZ = pathlib.Path(__file__).resolve().parents[1]
ZIP = RAIZ / "allansms-clone.zip"
PORTA = 4199
BASE = f"http://localhost:{PORTA}"

destino = pathlib.Path(tempfile.gettempdir()) / "prova-zip-allansms"
if destino.exists():
    shutil.rmtree(destino, ignore_errors=True)
destino.mkdir(parents=True)
with zipfile.ZipFile(ZIP) as z:
    z.extractall(destino)
site = destino / "public"
print(f"extraído: {sum(1 for p in site.rglob('*') if p.is_file()):,} arquivos em {site.name}")
assert (destino / "ABRIR-clone.bat").exists(), "iniciador fora do zip"
assert (destino / "README.md").exists(), "README fora do zip"

servidor = subprocess.Popen([sys.executable and "node", "serve.mjs", str(PORTA)], cwd=site,
                            stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
time.sleep(2.5)

logos = (site / "mirror" / "logo-index.json").read_text(encoding="utf8")
import json
amostra = random.sample(sorted(json.loads(logos)), 100)
URLS = ["/", "/precos", "/sobre", "/receber-sms-online", "/login", "/cadastro", "/termos",
        "/privacidade", "/docs-api", "/status", "/admin", "/painel", "/pedido/01HGTESTE",
        "/routes.json", "/sw.js", "/fonts/fonts.css", "/api/site", "/api/catalog/services",
        "/api/catalog/countries", "/api/flag/brazil", "/marca/assinatura", "/icone-192.png",
        "/site.webmanifest", "/robots.txt"] + [f"/api/logo/{c}" for c in amostra]

ruim = []
try:
    for u in URLS:
        try:
            with urllib.request.urlopen(BASE + urllib.request.quote(u), timeout=20) as r:
                corpo = r.read(64)
                mime = r.headers.get("content-type", "")
                if r.status >= 400 and not u.startswith(("/api/auth", "/api/keys")):
                    ruim.append((u, r.status))
                elif mime.startswith(("image", "application/json")) and corpo[:15].lower().startswith(b"<!doctype"):
                    ruim.append((u, "HTML disfarçado"))
        except Exception as exc:  # noqa: BLE001
            codigo = getattr(exc, "code", None)
            if codigo == 401:               # esperado para visitante
                continue
            ruim.append((u, str(exc)[:50]))
finally:
    servidor.terminate()

for u, s in ruim[:15]:
    print(f"   PROBLEMA {s} {u}")
print(f"\n{len(URLS)-len(ruim)}/{len(URLS)} caminhos respondem a partir do ZIP | "
      f"{ZIP.name}: {ZIP.stat().st_size/1e6:.1f} MB")
sys.exit(1 if ruim else 0)
