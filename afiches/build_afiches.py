#!/usr/bin/env python3
"""Afiches Kiwi — 3 páginas A4 según filosofía Rodaja. Solo stdlib + reportlab."""
import math
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor

W, H = 595.27, 841.89  # A4
M = 56  # margen

GREEN = HexColor("#1C4A2A")
GREEN_DEEP = HexColor("#143620")
GREEN_SOFT = HexColor("#2A5F38")
CREAM = HexColor("#FAF3E3")
INK = HexColor("#1A1A1A")
GOLD = HexColor("#D9A441")
LIME = HexColor("#B8D94A")
CLAY = HexColor("#C96F4A")

pdfmetrics.registerFont(TTFont("Outfit", "afiches/fonts/outfit-400.ttf"))
pdfmetrics.registerFont(TTFont("Outfit-Bold", "afiches/fonts/outfit-700.ttf"))
pdfmetrics.registerFont(TTFont("Outfit-Black", "afiches/fonts/outfit-900.ttf"))


def fit_size(text, font, start, max_w):
    size = start
    while pdfmetrics.stringWidth(text, font, size) > max_w and size > 20:
        size -= 2
    return size


def dotted_route(c, accent, x0, y0, x1, y1, bow=-60):
    """Curva punteada contenida a la derecha del texto."""
    c.setStrokeColor(accent)
    c.setLineWidth(3)
    c.setDash(1, 9)
    c.setLineCap(1)
    p = c.beginPath()
    steps = 60
    for i in range(steps + 1):
        t = i / steps
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t + math.sin(t * math.pi) * bow
        if i == 0:
            p.moveTo(x, y)
        else:
            p.lineTo(x, y)
    c.drawPath(p)
    c.setDash()
    # puntos origen y destino
    for x, y in ((x0, y0), (x1, y1)):
        c.setFillColor(accent)
        c.circle(x, y, 7, stroke=0, fill=1)
        c.setFillColor(CREAM)
        c.circle(x, y, 3, stroke=0, fill=1)


def kiwi_slice(c, cx, cy, r, accent):
    """Rodaja abstracta: anillo + semillas orbitales + corazón."""
    c.setStrokeColor(CREAM)
    c.setLineWidth(2.5)
    c.setFillColor(GREEN_SOFT)
    c.circle(cx, cy, r, stroke=1, fill=1)
    c.setFillColor(HexColor("#F3E8CE"))
    c.circle(cx, cy, r * 0.52, stroke=0, fill=1)
    c.setFillColor(accent)
    n = 18
    for i in range(n):
        a = 2 * math.pi * i / n
        sx = cx + math.cos(a) * r * 0.76
        sy = cy + math.sin(a) * r * 0.76
        c.saveState()
        c.translate(sx, sy)
        c.rotate(a * 180 / math.pi)
        c.ellipse(-5.5, -2.4, 5.5, 2.4, stroke=0, fill=1)
        c.restoreState()


def page(c, num, eyebrow, verb, sub, benefits, url, tagline, contact, accent, slice_xy):
    c.setFillColor(GREEN)
    c.rect(0, 0, W, H, stroke=0, fill=1)

    # rodaja contenida abajo-derecha, libre del bloque de texto
    kiwi_slice(c, slice_xy[0], slice_xy[1], 170, accent)
    # ruta punteada por el margen derecho
    dotted_route(c, accent, 440, 140, 560, 660)

    # wordmark + folio
    c.setFillColor(CREAM)
    c.setFont("Outfit-Bold", 17)
    c.setFillAlpha(1)
    c.drawString(M, H - 52, "K I W I")
    c.setFont("Outfit", 13)
    c.drawRightString(W - M, H - 52, f"{num} / 03")

    # eyebrow
    y = H - 150
    c.setFillColor(accent)
    c.setFont("Outfit-Bold", 16)
    c.drawCentredString(W / 2, y, eyebrow)

    # verbo gigante
    size = fit_size(verb, "Outfit-Black", 104, W - 2 * M)
    y -= size + 26
    c.setFillColor(CREAM)
    c.setFont("Outfit-Black", size)
    c.drawCentredString(W / 2, y, verb)

    # subtítulo
    c.setFont("Outfit", 21)
    c.setFillColor(HexColor("#D8E4D2"))
    y -= 40
    c.drawCentredString(W / 2, y, sub)

    # beneficios numerados
    y -= 66
    c.setFont("Outfit-Bold", 20)
    for i, b in enumerate(benefits, 1):
        # marcador orbital
        mx = M + 26
        c.setStrokeColor(accent)
        c.setLineWidth(2)
        c.circle(mx, y + 6, 15, stroke=1, fill=0)
        c.setFillColor(accent)
        c.setFont("Outfit-Black", 15)
        c.drawCentredString(mx, y + 1, str(i))
        c.setFillColor(CREAM)
        c.setFont("Outfit-Bold", 20)
        c.drawString(M + 56, y, b)
        y -= 44

    # franja pie: url + contacto + tagline
    band_h = 132
    c.setFillColor(CREAM)
    c.rect(0, 0, W, band_h, stroke=0, fill=1)
    c.setFillColor(GREEN_DEEP)
    c.setFont("Outfit-Black", 24)
    c.drawCentredString(W / 2, 88, url)
    c.setFont("Outfit-Bold", 14)
    c.drawCentredString(W / 2, 62, contact)
    c.setFont("Outfit", 12)
    c.setFillColor(HexColor("#4A5A4C"))
    c.drawCentredString(W / 2, 38, tagline)
    c.showPage()


def main():
    c = canvas.Canvas("afiches/kiwi-afiches.pdf", pagesize=(W, H))
    c.setTitle("Kiwi — Afiches comercios, clientes y repartidores")
    c.setAuthor("Kiwi")
    page(
        c, "01", "PARA COMERCIOS · LANZAMIENTO 23 OCT", "VENDÉ MÁS",
        "tu menú en un QR",
        ["Tu carta siempre actualizada", "Pedidos entrando en vivo", "SINPE · tarjeta · efectivo"],
        "negocios.kiwicr.express", "el dashboard de tu comercio",
        "WhatsApp +506 8826 4007",
        GOLD, (W - 100, 215),
    )
    page(
        c, "02", "PARA CLIENTES · MUY PRONTO", "PRÓXIMAMENTE",
        "la app de clientes llega pronto",
        ["Dejá tu correo y te avisamos", "Comercios desde el 23 de octubre", "Mientras tanto, pedí por WhatsApp"],
        "www.kiwicr.express", "avisame del lanzamiento en la app",
        "WhatsApp +506 8826 4007",
        CLAY, (W - 100, 215),
    )
    page(
        c, "03", "PARA REPARTIDORES · LANZAMIENTO 23 OCT", "REPARTÍ",
        "a tu ritmo, cerca tuyo",
        ["Aceptá pedidos cuando quieras", "Mapa y rutas incluidos", "Retiros de tus ganancias"],
        "repartidores.kiwicr.express", "ganá con cada entrega",
        "WhatsApp +506 8826 4007",
        LIME, (W - 100, 215),
    )
    c.save()
    print("OK afiches/kiwi-afiches.pdf")


if __name__ == "__main__":
    main()
