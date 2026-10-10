#!/usr/bin/env python3
"""Mostra, palavra por palavra, onde o texto da home do clone difere do original."""
import difflib
import pathlib
import re

RAIZ = pathlib.Path(__file__).resolve().parents[1]
INVISIVEL = re.compile(r"<(script|style|noscript|template)\b.*?</\1>", re.S | re.I)


def texto(p: pathlib.Path):
    corpo = INVISIVEL.sub(" ", p.read_text(encoding="utf8", errors="ignore"))
    corpo = re.sub(r"<[^>]+>", " ", corpo)
    return re.sub(r"\s+", " ", corpo).strip().split()


a = texto(RAIZ / "raw/pages/index.html")
b = texto(RAIZ / "raw/clone-pages/index.html")
diferencas = []
for op in difflib.SequenceMatcher(None, a, b).get_opcodes():
    tag, i1, i2, j1, j2 = op
    if tag == "equal":
        continue
    diferencas.append((tag, " ".join(a[i1:i2]), " ".join(b[j1:j2])))

print(f"{len(diferencas)} diferenças entre o texto da home original e a do clone:\n")
for tag, antes, depois in diferencas:
    setinha = {"replace": "→", "delete": "só no original →", "insert": "só no clone →"}[tag]
    print(f"  {setinha:<20} {antes[:110]!r}  |  {depois[:110]!r}")
