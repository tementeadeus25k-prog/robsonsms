#!/usr/bin/env python3
"""Compara o DOM que o CLONE monta com o DOM que o site original montou.

raw/pages/*.html        <- DOM serializado do site verdadeiro, capturado no Chrome
raw/clone-pages/*.html  <- mesmo procedimento rodando contra o clone local

Como os dois são o output do MESMO bundle depois de hidratar, a comparação é
direta: texto visível, quantidade de elementos, classes usadas e imagens.
Diferença aqui = algo que o clone não entregou.
"""
import difflib
import json
import pathlib
import re

RAIZ = pathlib.Path(__file__).resolve().parents[1]
ORIG, CLONE = RAIZ / "raw" / "pages", RAIZ / "raw" / "clone-pages"

INVISIVEL = re.compile(r"<(script|style|noscript|template)\b.*?</\1>", re.S | re.I)
TAG = re.compile(r"<[^>]+>")


def medir(html: str) -> dict:
    corpo = re.search(r"<body.*?</body>", html, re.S | re.I)
    corpo = corpo.group(0) if corpo else html
    corpo = INVISIVEL.sub(" ", corpo)
    classes = sorted({c for bloco in re.findall(r'class="([^"]+)"', corpo) for c in bloco.split()})
    texto = re.sub(r"\s+", " ", TAG.sub(" ", corpo)).strip()
    return {
        "elementos": len(re.findall(r"<[a-zA-Z]", corpo)),
        "texto": texto,
        "caracteres": len(texto),
        "classes": classes,
        "imagens": len(re.findall(r"<img\b", corpo)),
        "h": [re.sub(r"\s+", " ", TAG.sub("", h)).strip()
              for h in re.findall(r"<h[1-3][^>]*>(.*?)</h[1-3]>", corpo, re.S)],
    }


linhas, pior = [], 0
for pagina in sorted(ORIG.glob("*.html")):
    clone = CLONE / pagina.name
    if not clone.exists():
        print(f"{pagina.stem:<26} SEM CAPTURA DO CLONE (rode tools/verify.mjs)")
        continue
    o, c = medir(pagina.read_text(encoding="utf8", errors="ignore")), medir(clone.read_text(encoding="utf8", errors="ignore"))
    similar = difflib.SequenceMatcher(None, o["texto"], c["texto"]).ratio()
    Classes_faltando = sorted(set(o["classes"]) - set(c["classes"]))
    ok = similar > 0.97 and abs(o["elementos"] - c["elementos"]) <= max(4, o["elementos"] * 0.02)
    pior = max(pior, 1 - similar)
    linhas.append({"rota": "/" if pagina.stem == "index" else "/" + pagina.stem,
                   "similaridade_texto": round(similar, 4), "elementos_original": o["elementos"],
                   "elementos_clone": c["elementos"], "classes_faltando": Classes_faltando[:12],
                   "ok": ok})
    print(f"{'ok ' if ok else 'REV'} {('/' if pagina.stem=='index' else '/'+pagina.stem):<26} "
          f"texto={similar*100:5.1f}%  elementos {o['elementos']:>5} -> {c['elementos']:>5}  "
          f"imagens {o['imagens']:>2} -> {c['imagens']:>2}  classes_faltando={len(Classes_faltando)}")

(RAIZ / "raw" / "comparacao-dom.json").write_text(json.dumps(linhas, ensure_ascii=False, indent=2), encoding="utf8")
ruins = [l for l in linhas if not l["ok"]]
print(f"\n{len(linhas)-len(ruins)}/{len(linhas)} rotas idênticas ao original | maior diferença de texto: {pior*100:.1f}%")
for r in ruins:
    print("  REV", r["rota"], f"similaridade={r['similaridade_texto']}",
          "classes faltando:", r["classes_faltando"][:6])
