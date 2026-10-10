#!/usr/bin/env python3
"""Limpeza final dos logos: remove respostas que não são imagem.

O serviço de origem devolve, para alguns códigos raros, o corpo de uma página
("This domain is for sale.", pointer do git-lfs) em vez de um ícone. Esses entram
no índice como ausentes: o bundle cai nas iniciais do nome, exatamente como faz
no site original quando o ícone falha.
"""
import pathlib

RAW = pathlib.Path(__file__).resolve().parents[1] / "raw"
LOGOS = RAW / "logos"
MAGIAS = (b"\x89PNG", b"\xff\xd8\xff", b"GIF8", b"RIFF", b"BM", b"<svg", b"<?xml", b"ftyp")

removidos = []
for sub in sorted(LOGOS.iterdir()):
    if not sub.is_dir():
        continue
    for p in list(sub.iterdir()):
        head = p.read_bytes()[:32]
        if p.suffix == ".ico":       # já conferido por fix_logos.py: cabeçalho começa com 0x00 0x00
            continue
        ok = any(head.lstrip().startswith(m) or head.startswith(m) for m in MAGIAS)
        # AVIF vem com tamanho antes de 'ftyp'
        if not ok and b"ftyp" in head[:16]:
            p.rename(p.with_suffix(".avif"))
            continue
        if not ok:
            removidos.append((p.name, head[:40]))
            p.unlink()

print(f"removidos {len(removidos)} (o servidor de origem não devolve imagem):")
for n, h in removidos:
    print(f"   {n:<28} {h!r}")

total = sum(1 for sub in LOGOS.iterdir() if sub.is_dir() for _ in sub.iterdir())
bytes_total = sum(p.stat().st_size for sub in LOGOS.iterdir() if sub.is_dir() for p in sub.iterdir())
print(f"\nrestam {total} ícones válidos | {bytes_total/1e6:.1f} MB")
