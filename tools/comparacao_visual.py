#!/usr/bin/env python3
"""Gera uma imagem lado a lado: site original | clone, para conferência visual."""
import pathlib

from PIL import Image, ImageDraw

RAIZ = pathlib.Path(__file__).resolve().parents[1]
DIR_ORIG, DIR_CLONE = RAIZ / "raw" / "shots", RAIZ / "raw" / "clone-shots" / "online"
ALVO = RAIZ / "comparacao-original-e-clone.png"
ROTAS = ["index", "precos", "receber-sms-online", "sobre"]

painéis = []
for nome in ROTAS:
    a, b = DIR_ORIG / f"{nome}.png", DIR_CLONE / f"{nome}.png"
    if not (a.exists() and b.exists()):
        continue
    esquerda, direita = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
    altura = 620
    escala = altura / esquerda.size[1]
    largura = int(esquerda.size[0] * escala)
    esquerda = esquerda.resize((largura, altura))
    direita = direita.resize((largura, altura))
    faixa_titulo, separador = 34, 14
    painel = Image.new("RGB", (largura * 2 + separador, altura + faixa_titulo), (12, 10, 20))
    d = ImageDraw.Draw(painel)
    titulo = "/" if nome == "index" else "/" + nome
    d.text((10, 9), f"ORIGINAL {titulo}", fill=(235, 235, 245))
    d.text((largura + separador + 10, 9), "CLONE", fill=(167, 139, 250))
    painel.paste(esquerda, (0, faixa_titulo))
    painel.paste(direita, (largura + separador, faixa_titulo))
    painéis.append(painel)

coluna = max(p.size[0] for p in painéis)
total = Image.new("RGB", (coluna, sum(p.size[1] for p in painéis) + 60), (12, 10, 20))
d = ImageDraw.Draw(total)
d.text((12, 14), "allansms.com  -  original (esquerda) contra clone (direita)", fill=(240, 240, 250))
d.text((12, 34), "mesmo bundle, mesmo CSS, mesmas artes  -  diferença restante é animação e preço que muda no dia",
       fill=(150, 148, 170))
y = 60
for p in painéis:
    total.paste(p, (0, y))
    y += p.size[1]
total.save(ALVO)
print(f"{ALVO.name}: {total.size[0]}x{total.size[1]}")
