#!/usr/bin/env python3
"""Confere o que sobrou de erro no modo offline e compara as capturas de tela.

raw/shots/*.png                       <- site original, ao vivo
raw/clone-shots/online/*.png          <- clone com internet
raw/clone-shots/offline/*.png         <- clone com a rede bloqueada

Se original e clone baterem, o clone está fiel. Se online e offline baterem, o
clone é auto-suficiente.
"""
import json
import pathlib
import sys

from PIL import Image, ImageChops

RAIZ = pathlib.Path(__file__).resolve().parents[1]
ORIGINAL, CLONE = RAIZ / "raw" / "shots", RAIZ / "raw" / "clone-shots"

erros_offline = json.loads((RAIZ / "raw" / "verificacao-offline.json").read_text(encoding="utf8"))
for r in erros_offline:
    for e in r["erros_console"]:
        print(f"  console {r['rota']:<24} {e[:90]}")

print()
linhas = []
for origem in sorted(ORIGINAL.glob("*.png")):
    nome = origem.name
    linha = {"rota": "/" if nome == "index.png" else "/" + nome[:-4]}
    for modo in ("online", "offline"):
        copia = CLONE / modo / nome
        if not copia.exists():
            linha[modo] = None
            continue
        a, b = Image.open(origem).convert("RGB"), Image.open(copia).convert("RGB")
        if a.size != b.size:
            b = b.resize(a.size)
        dif = ImageChops.difference(a, b)
        caixa = dif.getbbox()
        pixels = a.size[0] * a.size[1]
        # conta pixels visivelmente diferentes (não é ruído de subpixel)
        cinza = dif.convert("L").point(lambda v: 255 if v > 24 else 0)
        diferentes = sum(1 for v in cinza.getdata() if v)
        linha[modo] = {"diferenca_pct": round(diferentes / pixels * 100, 2), "maior_afastamento": bool(caixa)}
    o = linha.get("online") or {}
    f = linha.get("offline") or {}
    linhas.append(linha)
    print(f"{linha['rota']:<26} vs original: online={str(o.get('diferenca_pct'))+'%':>7}  "
          f"offline={str(f.get('diferenca_pct'))+'%':>7}")

(RAIZ / "raw" / "comparacao-telas.json").write_text(json.dumps(linhas, ensure_ascii=False, indent=2), encoding="utf8")
piores = sorted((l for l in linhas if l.get("online")), key=lambda l: -l["online"]["diferenca_pct"])[:3]
print("\nmaiores diferenças:", [(l["rota"], l["online"]["diferenca_pct"]) for l in piores])
