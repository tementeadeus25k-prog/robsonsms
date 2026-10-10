#!/usr/bin/env python3
"""Varre o clone servido e confere que NENHUMA rota vira página de erro.

Percorre: cada linha de routes.json, todos os arquivos físicos da pasta e uma
amostra dos ícones de serviço. Qualquer 4xx/5xx aqui é um buraco no espelho.
"""
import json
import pathlib
import random
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

RAIZ = pathlib.Path(__file__).resolve().parents[1]
BASE = f"http://localhost:{sys.argv[1] if len(sys.argv) > 1 else 4173}"
PUBLIC = RAIZ / "public"

destinos = set()
indice = json.loads((PUBLIC / "routes.json").read_text(encoding="utf8"))["rotas"]
destinos.update(indice.keys())
for p in PUBLIC.rglob("*"):
    if p.is_file():
        rel = p.relative_to(PUBLIC).as_posix()
        if rel not in ("serve.mjs", "sw.js", "routes.json") and not rel.startswith("mirror/logo/"):
            destinos.add("/" + rel)
logos = json.loads((PUBLIC / "mirror" / "logo-index.json").read_text(encoding="utf8"))
destinos.update(f"/api/logo/{c}" for c in random.sample(sorted(logos), 300))
# rotas que só existem no router do React (nem estão na tabela)
destinos.update(["/", "/painel", "/recarga", "/pedidos", "/aluguel", "/numeros", "/afiliados",
                 "/proxies", "/admin", "/historico", "/perfil", "/ajuda", "/pedido/01HG4TESTE",
                 "/aluguel/01HG4TESTE", "/redefinir-senha", "/esqueci-senha", "/medidor"])


def checar(caminho):
    try:
        with urllib.request.urlopen(BASE + urllib.request.quote(caminho), timeout=25) as r:
            corpo = r.read(4096)
            mime = r.headers.get("content-type", "")
            # armadilha clássica: rota que devolve HTML disfarçado de JSON/imagem
            if mime.startswith(("image", "application/json")) and corpo[:15].lower().startswith(b"<!doctype html"):
                return caminho, r.status, "HTML disfarçado de " + mime
            return caminho, r.status, mime
    except Exception as exc:  # noqa: BLE001
        return caminho, getattr(exc, "code", 0), str(exc)[:60]


print(f"{len(destinos)} caminhos para conferir em {BASE}")
com_problemas = []
with ThreadPoolExecutor(max_workers=16) as pool:
    for caminho, status, info in pool.map(checar, sorted(destinos)):
        if status >= 400 or "disfarçado" in info:
            com_problemas.append((caminho, status, info))

for c, s, i in com_problemas[:40]:
    print(f"   {s} {c:<52} {i}")
print(f"\n{len(destinos)-len(com_problemas)}/{len(destinos)} caminhos ok | {len(com_problemas)} com problema")
sys.exit(1 if com_problemas else 0)
