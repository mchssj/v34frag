"""Genera los marcos y stickers de Latinoamérica y España (colección paises2).

Reusa la plantilla de ../../2026-10-29-cosmeticos-colecciones/pruebas/generar_paises.py y le suma banderas.
Uso (desde la raíz del repo): python docs/bitacora/2026-10-29-cosmeticos-300/pruebas/generar_paises2.py
"""
import importlib.util
import math
from pathlib import Path

AQUI = Path(__file__).resolve()
spec = importlib.util.spec_from_file_location("paises", AQUI.parents[2] / "2026-10-29-cosmeticos-colecciones" / "pruebas" / "generar_paises.py")
P = importlib.util.module_from_spec(spec)
spec.loader.exec_module(P)  # también regenera los 10 de la primera tanda (quedan iguales)

PAISES2 = [
    ("mx", "México", ["#006847", "#ffffff", "#ce1126"], "CHIDO"),
    ("cr", "Costa Rica", ["#002b7f", "#ffffff", "#ce1126"], "PURA VIDA"),
    ("cu", "Cuba", ["#002a8f", "#ffffff", "#cf142b"], "ASERE"),
    ("do", "Rep. Dominicana", ["#002d62", "#ffffff", "#ce1126"], "KLK"),
    ("pr", "Puerto Rico", ["#ed0000", "#ffffff", "#0050f0"], "WEPA"),
    ("pa", "Panamá", ["#005293", "#ffffff", "#d21034"], "XOPA"),
    ("gt", "Guatemala", ["#4997d0", "#ffffff", "#4997d0"], "CHILERO"),
    ("hn", "Honduras", ["#0073cf", "#ffffff", "#0073cf"], "CATRACHO"),
    ("sv", "El Salvador", ["#0f47af", "#ffffff", "#0f47af"], "CHIVO"),
    ("es", "España", ["#aa151b", "#f1bf00", "#aa151b"], "MOLA"),
]

bandera_vieja = P.bandera


def bandera(code, x, y, w, h):
    def franjas(colores, pesos=None, vertical=False):
        pesos = pesos or [1] * len(colores)
        tot, acc, s = sum(pesos), 0, ""
        for c, p in zip(colores, pesos):
            if vertical:
                s += f'<rect x="{x + w*acc/tot:.1f}" y="{y}" width="{w*p/tot+.5:.1f}" height="{h}" fill="{c}"/>'
            else:
                s += f'<rect x="{x}" y="{y + h*acc/tot:.1f}" width="{w}" height="{h*p/tot+.5:.1f}" fill="{c}"/>'
            acc += p
        return s
    cx, cy = x + w / 2, y + h / 2
    tri = lambda c: f'<polygon points="{x},{y} {x+w*0.42:.1f},{cy} {x},{y+h}" fill="{c}"/>'
    if code == "mx":
        return (franjas(["#006847", "#fff", "#ce1126"], vertical=True)
                + f'<circle cx="{cx}" cy="{cy}" r="{h*0.16:.1f}" fill="#8a5a2a"/><path d="M{cx-h*0.12:.1f} {cy+h*0.2:.1f}h{h*0.24:.1f}" stroke="#2f8a3a" stroke-width="{h*0.05:.1f}"/>')
    if code == "cr":
        return franjas(["#002b7f", "#fff", "#ce1126", "#fff", "#002b7f"], [1, 1, 2, 1, 1])
    if code == "cu":
        return franjas(["#002a8f", "#fff", "#002a8f", "#fff", "#002a8f"]) + tri("#cf142b") + P.estrella(x + w * 0.14, cy, h * 0.15, "#fff")
    if code == "do":
        q = (f'<rect x="{x}" y="{y}" width="{w/2:.1f}" height="{h/2:.1f}" fill="#002d62"/><rect x="{cx}" y="{y}" width="{w/2:.1f}" height="{h/2:.1f}" fill="#ce1126"/>'
             f'<rect x="{x}" y="{cy}" width="{w/2:.1f}" height="{h/2:.1f}" fill="#ce1126"/><rect x="{cx}" y="{cy}" width="{w/2:.1f}" height="{h/2:.1f}" fill="#002d62"/>')
        return q + f'<rect x="{cx-h*0.08:.1f}" y="{y}" width="{h*0.16:.1f}" height="{h}" fill="#fff"/><rect x="{x}" y="{cy-h*0.08:.1f}" width="{w}" height="{h*0.16:.1f}" fill="#fff"/>'
    if code == "pr":
        return franjas(["#ed0000", "#fff", "#ed0000", "#fff", "#ed0000"]) + tri("#0050f0") + P.estrella(x + w * 0.14, cy, h * 0.15, "#fff")
    if code == "pa":
        return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#fff"/><rect x="{cx}" y="{y}" width="{w/2:.1f}" height="{h/2:.1f}" fill="#d21034"/>'
                f'<rect x="{x}" y="{cy}" width="{w/2:.1f}" height="{h/2:.1f}" fill="#005293"/>'
                + P.estrella(x + w / 4, y + h / 4, h * 0.13, "#005293") + P.estrella(x + w * 3 / 4, y + h * 3 / 4, h * 0.13, "#d21034"))
    if code == "gt":
        return franjas(["#4997d0", "#fff", "#4997d0"], vertical=True) + f'<circle cx="{cx}" cy="{cy}" r="{h*0.14:.1f}" fill="none" stroke="#2f8a3a" stroke-width="{h*0.05:.1f}"/>'
    if code == "hn":
        s = franjas(["#0073cf", "#fff", "#0073cf"])
        for dx, dy in [(-0.12, -0.05), (0.12, -0.05), (0, 0), (-0.12, 0.05), (0.12, 0.05)]:
            s += P.estrella(cx + w * dx, cy + h * dy * 1.6, h * 0.05, "#0073cf")
        return s
    if code == "sv":
        return franjas(["#0f47af", "#fff", "#0f47af"]) + f'<circle cx="{cx}" cy="{cy}" r="{h*0.12:.1f}" fill="none" stroke="#e0b84a" stroke-width="{h*0.04:.1f}"/>'
    if code == "es":
        return franjas(["#aa151b", "#f1bf00", "#aa151b"], [1, 2, 1]) + f'<rect x="{x+w*0.22:.1f}" y="{cy-h*0.12:.1f}" width="{h*0.18:.1f}" height="{h*0.24:.1f}" rx="2" fill="#aa151b" opacity=".8"/>'
    return bandera_vieja(code, x, y, w, h)


emblema_viejo = P.emblema


def emblema(tipo, cx, cy, r):
    # "flag:xx": la bandera dentro del círculo.
    if tipo.startswith("flag:"):
        code = tipo[5:]
        return (f'<clipPath id="ce"><circle cx="{cx}" cy="{cy}" r="{r}"/></clipPath>'
                f'<g clip-path="url(#ce)">{bandera(code, cx - r * 1.5, cy - r, r * 3, r * 2)}</g>'
                f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="#fff" stroke-width="2"/>')
    return emblema_viejo(tipo, cx, cy, r)


P.bandera = bandera
P.emblema = emblema
for code, nombre, anillos, palabra in PAISES2:
    (P.RAIZ / "marcos" / f"pais-{code}.svg").write_text(P.marco(code, nombre, anillos, f"flag:{code}"), encoding="utf-8")
    (P.RAIZ / "stickers" / f"pais-{code}.svg").write_text(P.sticker(code, palabra), encoding="utf-8")
print("listo:", len(PAISES2), "países más")
