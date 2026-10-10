#!/usr/bin/env python3
"""Empacota a entrega: allansms-clone.zip com o site pronto + como abrir.

Dentro do zip:
  public/**          tudo de public/ (é só isso que vai para a hospedagem)
  README.md          explicações
  ABRIR-clone.bat    dois cliques e abre — procura ./public mesmo nome
"""
import pathlib
import zipfile

RAIZ = pathlib.Path(__file__).resolve().parents[1]
ALVO = RAIZ / "allansms-clone.zip"
PUBLIC = RAIZ / "public"

arquivos = sorted(p for p in PUBLIC.rglob("*") if p.is_file())
with zipfile.ZipFile(ALVO, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for p in arquivos:
        # mesmo nome da pasta no disco, para o ABRIR-clone.bat funcionar ao extrair
        z.write(p, "public/" + p.relative_to(PUBLIC).as_posix())
    for extra in ("README.md", "ABRIR-clone.bat"):
        z.write(RAIZ / extra, extra)

total = sum(p.stat().st_size for p in arquivos)
print(f"{len(arquivos):,} arquivos de public/ ({total/1e6:.1f} MB solto) "
      f"-> {ALVO.name}: {ALVO.stat().st_size/1e6:.1f} MB")
