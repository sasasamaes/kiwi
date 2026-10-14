#!/usr/bin/env python3
"""Hoja de ventas Kiwi — 3 páginas A4: negocios, clientes, repartidores."""
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor

W, H = 595.27, 841.89
M = 52
BAND = 110

GREEN = HexColor("#1C4A2A")
GREEN_DEEP = HexColor("#143620")
CREAM = HexColor("#FAF3E3")
GOLD = HexColor("#D9A441")
MUTED = HexColor("#D8E4D2")
SMALL = HexColor("#6B7A6D")

pdfmetrics.registerFont(TTFont("Outfit", "afiches/fonts/outfit-400.ttf"))
pdfmetrics.registerFont(TTFont("Outfit-Bold", "afiches/fonts/outfit-700.ttf"))
pdfmetrics.registerFont(TTFont("Outfit-Black", "afiches/fonts/outfit-900.ttf"))


def fit(font, text, start, max_w):
    s = start
    while pdfmetrics.stringWidth(text, font, s) > max_w and s > 10:
        s -= 2
    return s


class P:
    def __init__(self, path):
        self.c = canvas.Canvas(path, pagesize=(W, H))
        self.c.setTitle("Kiwi — Hoja de ventas: negocios, clientes, repartidores")
        self.c.setAuthor("Kiwi")

    def bg(self):
        self.c.setFillColor(GREEN)
        self.c.rect(0, 0, W, H, stroke=0, fill=1)

    def head(self, folio, eyebrow, title, sub):
        c = self.c
        c.setFillColor(CREAM)
        c.setFont("Outfit-Bold", 17)
        c.drawString(M, H - 52, "K I W I")
        c.setFont("Outfit", 13)
        c.drawRightString(W - M, H - 52, folio)
        y = H - 112
        c.setFillColor(GOLD)
        c.setFont("Outfit-Bold", 15)
        c.drawString(M, y, eyebrow)
        ts = fit("Outfit-Black", title, 56, W - 2 * M)
        y -= ts + 12
        c.setFillColor(CREAM)
        c.setFont("Outfit-Black", ts)
        c.drawString(M, y, title)
        y -= 32
        c.setFont("Outfit", 18)
        c.setFillColor(MUTED)
        c.drawString(M, y, sub)
        return y

    def section(self, y, label):
        self.c.setFillColor(GOLD)
        self.c.setFont("Outfit-Bold", 13)
        self.c.drawString(M, y, label)
        return y - 28

    def bullets(self, y, lines, size=15, gap=24):
        c = self.c
        c.setFont("Outfit", size)
        for line in lines:
            c.setFillColor(GOLD)
            c.circle(M + 5, y + 4, 3.2, stroke=0, fill=1)
            c.setFillColor(MUTED)
            c.drawString(M + 18, y, line)
            y -= gap
        return y

    def steps(self, y, items, size=15, gap=30):
        c = self.c
        for i, s in enumerate(items, 1):
            c.setStrokeColor(GOLD)
            c.setLineWidth(1.8)
            c.circle(M + 12, y + 5, 12, stroke=1, fill=0)
            c.setFillColor(GOLD)
            c.setFont("Outfit-Black", 13)
            c.drawCentredString(M + 12, y + 1, str(i))
            c.setFillColor(CREAM)
            c.setFont("Outfit", size)
            c.drawString(M + 34, y, s)
            y -= gap
        return y

    def grid3(self, y, items):
        """6 items en 3 columnas x 2 filas: (título, bajada)."""
        c = self.c
        col_w = (W - 2 * M) / 3
        for i, (t, d) in enumerate(items):
            cx = M + (i % 3) * col_w
            cy = y - (i // 3) * 56
            c.setFillColor(GOLD)
            c.circle(cx + 5, cy + 4, 3.2, stroke=0, fill=1)
            c.setFillColor(CREAM)
            c.setFont("Outfit-Bold", 14)
            c.drawString(cx + 16, cy, t)
            c.setFont("Outfit", 11.5)
            c.setFillColor(MUTED)
            c.drawString(cx + 16, cy - 17, d)
        return y - 2 * 56 - 6

    def hero_pct(self, y, big, side, bullets):
        """Número gigante + bullets a la derecha del aire."""
        c = self.c
        c.setFillColor(CREAM)
        c.setFont("Outfit-Black", 78)
        c.drawString(M, y, big)
        bw = pdfmetrics.stringWidth(big, "Outfit-Black", 78)
        c.setFont("Outfit-Bold", 19)
        c.setFillColor(GOLD)
        c.drawString(M + bw + 12, y + 10, side)
        y -= 30
        return self.bullets(y, bullets)

    def foot(self, url, l1, l2):
        c = self.c
        c.setFillColor(CREAM)
        c.rect(0, 0, W, BAND, stroke=0, fill=1)
        c.setFillColor(GREEN_DEEP)
        fs = fit("Outfit-Black", url, 25, W - 2 * M)
        c.setFont("Outfit-Black", fs)
        c.drawCentredString(W / 2, 64, url)
        c.setFont("Outfit", 12)
        c.setFillColor(SMALL)
        c.drawCentredString(W / 2, 40, l1)
        c.drawCentredString(W / 2, 22, l2)
        c.showPage()


def main():
    p = P("afiches/kiwi-vendedor.pdf")

    # ── 1. NEGOCIOS ──
    p.bg()
    y = p.head("01 / 03", "PARA COMERCIOS", "VENDÉ CON KIWI", "Tu menú en un QR. Tus pedidos en vivo.")
    y -= 72
    y = p.hero_pct(y, "15%", "por venta", [
        "Sin mensualidad · sin costo de entrada",
        "El envío lo paga el cliente, por zona",
    ])
    y -= 20
    y = p.section(y, "01 — QUÉ INCLUYE")
    y = p.grid3(y, [
        ("Menú QR", "carta siempre actualizada"),
        ("Pedidos en vivo", "notificación al instante"),
        ("4 cobros", "todos los medios de pago"),
        ("Repartidores", "flota con tracking"),
        ("Preventa", "pedidos programados"),
        ("Promoción", "seguidores y reseñas"),
    ])
    y -= 16
    y = p.section(y, "02 — CÓMO EMPEZAR")
    y = p.steps(y, [
        "Creá tu cuenta y cargá tu menú",
        "Pegá el QR en tus mesas",
        "Verificá tu identidad y activá la tarjeta",
    ])
    p.foot("negocios.kiwicr.express",
           "Sin costo fijo · valores por defecto, ajustables por campaña",
           "Pedido mínimo de plataforma: CRC 2000")

    # ── 2. CLIENTES ──
    p.bg()
    y = p.head("02 / 03", "PARA CLIENTES", "PEDÍ YA", "Sin filas, sin llamadas, sin apps raras.")
    y -= 46
    y = p.section(y, "01 — CÓMO FUNCIONA")
    y = p.steps(y, [
        "Escaneá el QR de tu local",
        "Elegí, pagá como quieras y seguí tu pedido en vivo",
        "Recibilo donde estés",
    ])
    y -= 18
    y = p.section(y, "02 — CUÁNTO PAGÁS")
    y = p.bullets(y, [
        "Tus productos, al precio de la carta",
        "Servicio Kiwi: 15% (10% en cocinas caseras)",
        "Envío según tu zona · SINPE, tarjeta, efectivo o cripto",
    ])
    y -= 18
    y = p.section(y, "03 — TRANQUILIDAD")
    y = p.bullets(y, [
        "Ves tu pedido moverse en el mapa",
        "Calificás cada entrega",
        "Soporte si algo sale mal",
    ])
    p.foot("kiwicr.express",
           "Buscá el QR en tu local favorito",
           "Pedido mínimo de plataforma: CRC 2000")

    # ── 3. REPARTIDORES ──
    p.bg()
    y = p.head("03 / 03", "PARA REPARTIDORES", "REPARTÍ", "A tu ritmo, cerca tuyo.")
    y -= 72
    y = p.hero_pct(y, "85%", "del envío es tuyo", [
        "Aceptá pedidos cuando quieras",
        "Retiros desde CRC 1000",
        "Bonos e incentivos por desempeño",
    ])
    y -= 20
    y = p.section(y, "01 — QUÉ NECESITÁS")
    y = p.bullets(y, [
        "Moto o bici y ganas de rodar",
        "Verificación de identidad aprobada",
        "La app en tu teléfono: mapa y rutas incluidos",
    ])
    y -= 18
    y = p.section(y, "02 — CÓMO EMPEZAR")
    y = p.steps(y, [
        "Registrate y subí tus documentos",
        "Aceptá tu primer pedido cercano",
        "Entregá, acumulá y retirá tus ganancias",
    ])
    p.foot("repartidores.kiwicr.express",
           "Sin jefes ni horarios fijos",
           "Cuantos más viajes, más ganás")

    p.c.save()
    print("OK afiches/kiwi-vendedor.pdf")


if __name__ == "__main__":
    main()
