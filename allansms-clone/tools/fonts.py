#!/usr/bin/env python3
"""Auto-hospeda as fontes do site (Google Fonts) em raw/fonts/.

O HTML original puxa Space Grotesk / Plus Jakarta Sans / JetBrains Mono do
Google. Num clone offline isso quebra, então pedimos o mesmo CSS com o mesmo
User-Agent (Chrome → só woff2), baixamos os mesmos arquivos e reescrevemos o
src para cá. O conteúdo do CSS continua idêntico, muda apenas a URL.
"""
import concurrent.futures as cf
import pathlib
import re
from urllib.parse import urlparse

import requests

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT / "raw"
FONTS = RAW / "fonts"
UA = {"User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                     "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")}

# as mesmas requisições que a página faz (duas chamadas no HTML de hoje)
CSS_URLS = ["https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600"
            "&family=Space+Grotesk:wght@400;500;600;700&display=swap",
            "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700"
            "&family=Space+Grotesk:wght@500;700&display=swap"]

for sujo in FONTS.rglob("*"):                       # recomeça limpo
    if sujo.is_file():
        sujo.unlink()
FONTS.mkdir(parents=True, exist_ok=True)

folhas = [requests.get(u, headers=UA, timeout=60).text for u in CSS_URLS]
arquivos = sorted({m for css in folhas for m in re.findall(r"url\((https://[^)]+)\)", css)})
print(f"{len(arquivos)} arquivos de fonte citados nos 2 CSS")


def nome_de(url: str) -> str:
    caminho = urlparse(url).path.strip("/")          # ex.: s/jetbrainsmono/v24/xxx.woff2
    return caminho.replace("/", "__")


def baixar(url):
    r = requests.get(url, headers=UA, timeout=90)
    if r.status_code != 200:
        return url, None
    destino = FONTS / nome_de(url)
    destino.write_bytes(r.content)
    return url, destino.name


troca = {}
with cf.ThreadPoolExecutor(max_workers=10) as pool:
    for url, nome in pool.map(baixar, arquivos):
        if nome:
            troca[url] = nome
print(f"{len(troca)}/{len(arquivos)} baixados")

texto = "\n".join(folhas)
for url, nome in troca.items():
    texto = texto.replace(url, nome)
(FONTS / "fonts.css").write_text(texto, encoding="utf8")

fam = sorted(set(re.findall(r"font-family:\s*'([^']+)'", texto)))
sobrou = re.findall(r"https://fonts\.gstatic[^\)]*", texto)
tamanho = sum(p.stat().st_size for p in FONTS.iterdir())
print(f"famílias: {fam}")
print(f"fonts.css {len(texto):,}B | {len(list(FONTS.glob('*.woff2')))} woff2 | {tamanho/1e6:.2f} MB")
print("urls gstatic que sobraram no CSS:", len(sobrou))
