#!/usr/bin/env python3
"""Espelha todos os logos de serviço (/api/logo/<code>) para raw/logos/.

São os ícones que o catálogo mostra. O bundle cai nas iniciais do nome quando o
arquivo falha, então sem eles o site 'funciona', mas fica sem os ícones reais.
O build copia raw/logos/ para public/mirror/logo e registra cada um no índice.
"""
import concurrent.futures as cf
import json
import pathlib

import requests

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT / "raw"
OUT = RAW / "logos"
SRC = "https://allansms.com"
H = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36"}

OUT.mkdir(parents=True, exist_ok=True)
services = json.loads((RAW / "api-cache" / "api__catalog__services.json").read_text(encoding="utf8"))["data"]
codes = sorted({s["code"] for s in services})
done = {p.name.split("__")[0] for p in OUT.iterdir()} if any(OUT.iterdir()) else set()
todo = [c for c in codes if c not in done]
print(f"{len(codes)} códigos, {len(todo)} a baixar", flush=True)

sess = requests.Session()
sess.headers.update(H)
TYPES = {b"\x89PNG": ".png", b"\xff\xd8\xff": ".jpg", b"GIF8": ".gif", b"RIFF": ".webp"}
IDX_HEAD = b"\x00\x00\x01\x00"


def sniff(head):
    for magic, ext in TYPES.items():
        if head.startswith(magic):
            return ext
    if head[:3] == b"<sv" or head[:5] == b"<?xml":
        return ".svg"
    if head[1:3] == b"\x00\x00\x01\x00" or head[:2] == b"BM":
        return ".ico"
    return ".bin"


stats = {"ok": 0, "http": 0, "erro": 0, "bytes": 0}
lock_report = {}


def one(code):
    dest_dir = OUT / (code[:2] if len(code) > 2 else "zz")
    try:
        r = sess.get(f"{SRC}/api/logo/{code}", params={"v": "clone"}, timeout=30)
    except Exception as exc:  # noqa: BLE001
        stats["erro"] += 1
        return f"ERR {code}: {exc}"
    if r.status_code != 200 or not r.content:
        stats["http"] += 1
        return f"{r.status_code} {code}"
    ext = sniff(r.content[:8])
    dest_dir.mkdir(parents=True, exist_ok=True)
    (dest_dir / (code + ext)).write_bytes(r.content)
    stats["ok"] += 1
    stats["bytes"] += len(r.content)
    lock_report[code] = ext
    return None


with cf.ThreadPoolExecutor(max_workers=12) as pool:
    for i, err in enumerate(pool.map(one, todo), 1):
        if err:
            print("  ", err, flush=True)
        if i % 500 == 0:
            print(f"  ...{i}/{len(todo)}  ok={stats['ok']} falha={stats['http']+stats['erro']} "
                  f"{stats['bytes']/1e6:.1f}MB", flush=True)

(RAW / "logos-index.json").write_text(
    json.dumps({"extensao": lock_report, "stats": stats}, ensure_ascii=False), encoding="utf8")
print(f"\nconcluído: ok={stats['ok']} http_falha={stats['http']} rede_falha={stats['erro']} "
      f"{stats['bytes']/1e6:.1f}MB", flush=True)
