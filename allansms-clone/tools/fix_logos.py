#!/usr/bin/env python3
"""Identifica os arquivos salvos como .bin em raw/logos e renomeia com a extensão certa."""
import collections
import pathlib

RAW = pathlib.Path(__file__).resolve().parents[1] / "raw"
LOGOS = RAW / "logos"


def magic(head: bytes) -> str:
    table = [(b"\x89PNG\r\n\x1a\n", ".png"), (b"\xff\xd8\xff", ".jpg"), (b"GIF8", ".gif"),
             (b"RIFF", ".webp"), (b"BM", ".bmp"), (b"\x00\x00\x01\x00", ".ico"),
             (b"\x00\x00\x02\x00", ".cur")]
    for sig, ext in table:
        if head.startswith(sig):
            return ext
    txt = head.lstrip()
    if txt[:5] in (b"<svg ", b"<svg>") or txt[:5] == b"<?xml":
        return ".svg"
    if head[:4] == b"\x00\x00":  # ICO/CUR com número de entrada != 1
        return ".ico"
    return ""


contagem = collections.Counter()
renomeados = collections.Counter()
for sub in sorted(LOGOS.iterdir()):
    if not sub.is_dir():
        continue
    for p in list(sub.iterdir()):
        ext = magic(p.read_bytes()[:16])
        contagem[ext or "?"] += 1
        if ext and p.suffix != ext:
            if p.suffix == ".bin":
                p.rename(p.with_suffix(ext))
                renomeados[ext] += 1
            elif not ext:
                pass

print("extensões reais:", dict(contagem))
print("renomeados de .bin:", dict(renomeados))

# o que ainda está sem extensão conhecida
sobras = [p for sub in LOGOS.iterdir() if sub.is_dir() for p in sub.iterdir() if p.suffix == ".bin"]
print("ainda .bin:", len(sobras))
for p in sobras[:5]:
    print("   ", p.name, p.read_bytes()[:24])
