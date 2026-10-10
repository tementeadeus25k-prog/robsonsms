#!/usr/bin/env python3
"""Fecha o grafo de chunks do Vite.

O HTML só cita 3 arquivos, mas o bundle faz import dinâmico de dezenas de outros
(página por rota: Order, Painel, Admin...). O build anterior baixava só o que o
navegador pedia nas rotas públicas, e rota funda dava 404 em assets.

Aqui: parte dos .js já baixados, procura referências "./Nome-hash.js" (e .css),
baixa da origem e repete até não sobrar nenhuma. Termina com TODOS os arquivos
que o bundle pode pedir, inclusive os de /admin e /painel.
"""
import concurrent.futures as cf
import pathlib
import re

import requests

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT / "raw"
DEST = RAW / "files" / "assets"
SRC = "https://allansms.com/assets/"
H = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36"}

# "./Order-DaOT7MNO.js", '../chunks/Painel-abc12345.js', "assets/x-hash.css"
REF = re.compile(r"""['"]\.{0,2}/?(?:assets/)?([A-Za-z0-9_][A-Za-z0-9_.-]*-[A-Za-z0-9_-]{6,}\.(?:js|css))['"]""")

tem = {p.name for p in DEST.iterdir() if p.is_file()}
print(f"começo com {len(tem)} arquivos")

fila, visto, baixados = sorted(tem), set(tem), 0
rodada = 0
while fila:
    rodada += 1
    faltando = set()
    with cf.ThreadPoolExecutor(max_workers=12) as pool:
        conteudos = pool.map(lambda n: (DEST / n).read_text(encoding="utf8", errors="ignore"), fila)
        for texto in conteudos:
            for nome in REF.findall(texto):
                if nome not in visto:
                    visto.add(nome)
                    faltando.add(nome)
    if not faltando:
        break
    with cf.ThreadPoolExecutor(max_workers=12) as pool:
        resultados = list(pool.map(lambda n: (n, requests.get(SRC + n, headers=H, timeout=60)), sorted(faltando)))
    proxima = []
    for nome, r in resultados:
        if r.status_code == 200 and r.content:
            (DEST / nome).write_bytes(r.content)
            baixados += 1
            proxima.append(nome)
        else:
            print(f"   FALHOU {r.status_code} {nome}")
    print(f"rodada {rodada}: +{len(proxima)} chunks (total baixado {baixados})")
    fila = proxima

todos = sorted(p.name for p in DEST.iterdir() if p.is_file())
total = sum((DEST / n).stat().st_size for n in todos)
print(f"\nfechou: {len(todos)} arquivos de chunk em /assets, {total/1e6:.2f} MB")
print("novos:", [n for n in todos if n not in tem][:12], "..." if len(todos) - len(tem) > 12 else "")
