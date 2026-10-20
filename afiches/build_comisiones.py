#!/usr/bin/env python3
"""Afiches Kiwi — Cómo cobra Kiwi (3 páginas A4, sistema Rodaja).

Serie compañera de build_afiches.py: explica el modelo de comisión por
audiencia. Reutiliza layout, tipografías y paleta; solo cambia el copy.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from reportlab.pdfgen import canvas
from build_afiches import page, W, H, GOLD, CLAY, LIME  # noqa: E402


def main():
    c = canvas.Canvas("afiches/kiwi-comisiones.pdf", pagesize=(W, H))
    c.setTitle("Kiwi — Cómo cobra Kiwi: comercios, clientes y repartidores")
    c.setAuthor("Kiwi")
    page(
        c, "01", "PARA COMERCIOS · COMISIONES", "CUENTAS CLARAS",
        "dos casos, nada más",
        ["App de clientes: 15% del ticket", "Desde acá: solo pagás el viaje"],
        "negocios.kiwicr.express", "preguntanos por WhatsApp",
        "WhatsApp +506 8826 4007",
        GOLD, (W - 100, 215),
    )
    page(
        c, "02", "PARA REPARTIDORES · COMISIONES", "85% PARA VOS",
        "ves el pago antes de aceptar",
        ["Comisión fija: 15% del viaje", "Sin mensualidad, sin sorpresas", "Retiros de tus ganancias"],
        "repartidores.kiwicr.express", "ganá con cada entrega",
        "WhatsApp +506 8826 4007",
        LIME, (W - 100, 215),
    )
    page(
        c, "03", "PARA CLIENTES · COMISIONES", "15% TRANSPARENTE",
        "pedir en la app sostiene a Kiwi",
        ["15% del ticket del comercio", "15% del viaje del repartidor", "Vos pagás carta + envío"],
        "www.kiwicr.express", "precio nominal, sin sorpresas",
        "WhatsApp +506 8826 4007",
        CLAY, (W - 100, 215),
    )
    c.save()
    print("OK afiches/kiwi-comisiones.pdf")


if __name__ == "__main__":
    main()
