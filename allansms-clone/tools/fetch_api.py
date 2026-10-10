#!/usr/bin/env python3
"""Captura as respostas dos endpoints que a SPA consome, para servir offline."""
import json
import pathlib

import requests

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT / "raw"
OUT = RAW / "api-cache"
SRC = "https://allansms.com"
HDRS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "application/json", "Origin": SRC, "Referer": SRC + "/"}

ENDPOINTS = [
    "/api/site",
    "/api/catalog/services",
    "/api/catalog/countries",
    "/api/catalog/operators",
    "/api/catalog/servers",
    "/api/keys",
    "/api/auth/me",
    "/health",
]

OUT.mkdir(parents=True, exist_ok=True)
report = {}
for ep in ENDPOINTS:
    r = requests.get(SRC + ep, headers=HDRS, timeout=60)
    name = ep.strip("/").replace("/", "__") + ".json"
    body = {"_endpoint": ep, "_status": r.status_code}
    try:
        body["data"] = r.json()
    except ValueError:
        body["text"] = r.text[:4000]
    (OUT / name).write_text(json.dumps(body, ensure_ascii=False, indent=2), encoding="utf8")
    n = ""
    if isinstance(body.get("data"), list):
        n = f"list({len(body['data'])})"
    elif isinstance(body.get("data"), dict):
        n = "dict(" + ",".join(list(body["data"])[:12]) + ")"
    print(f"{r.status_code:>4}  {ep:<28} {len(r.content):>8}B  {n}")
    report[ep] = r.status_code
(RAW / "api-cache-report.json").write_text(json.dumps(report, indent=2), encoding="utf8")
