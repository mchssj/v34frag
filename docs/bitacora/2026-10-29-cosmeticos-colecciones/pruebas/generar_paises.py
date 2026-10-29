"""Genera los marcos y stickers de países de assets/perfil.

Uso (desde la raíz del repo): python docs/bitacora/2026-10-29-cosmeticos-colecciones/pruebas/generar_paises.py
"""
import math
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[4] / "assets" / "perfil"

# code, nombre, anillos (de afuera hacia adentro), palabra del sticker, emblema
PAISES = [
    ("ar", "Argentina", ["#74acdf", "#ffffff", "#74acdf"], "CHE", "sol"),
    ("br", "Brasil", ["#009c3b", "#ffdf00", "#002776"], "BORA!", "globo"),
    ("uy", "Uruguay", ["#0038a8", "#ffffff", "#0038a8"], "GARRA", "sol"),
    ("cl", "Chile", ["#0039a6", "#ffffff", "#d52b1e"], "¿CACHAI?", "estrella-azul"),
    ("pe", "Perú", ["#d91023", "#ffffff", "#d91023"], "CAUSA", "montana"),
    ("co", "Colombia", ["#fcd116", "#003893", "#ce1126"], "PARCE", "condor"),
    ("ve", "Venezuela", ["#ffcc00", "#00247d", "#cf142b"], "CHAMO", "estrellas"),
    ("ec", "Ecuador", ["#ffd100", "#034ea2", "#ef3340"], "PANA", "volcan"),
    ("bo", "Bolivia", ["#d52b1e", "#f9e300", "#007934"], "JALLALLA", "wiphala"),
    ("py", "Paraguay", ["#d52b1e", "#ffffff", "#0038a8"], "JAHA", "estrella-blanca"),
]


def estrella(cx, cy, r, color, puntas=5, interior=0.42):
    pts = []
    for i in range(puntas * 2):
        rr = r if i % 2 == 0 else r * interior
        a = -math.pi / 2 + i * math.pi / puntas
        pts.append(f"{cx + rr * math.cos(a):.1f},{cy + rr * math.sin(a):.1f}")
    return f'<polygon points="{" ".join(pts)}" fill="{color}"/>'


def sol(cx, cy, r):
    rayos = []
    for i in range(16):
        a = i * math.pi / 8
        largo = r * (1.0 if i % 2 == 0 else 0.8)
        x1, y1 = cx + r * 0.55 * math.cos(a), cy + r * 0.55 * math.sin(a)
        x2, y2 = cx + largo * math.cos(a), cy + largo * math.sin(a)
        rayos.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"/>')
    return (f'<g stroke="#f6b40e" stroke-width="{r*0.14:.1f}" stroke-linecap="round">{"".join(rayos)}</g>'
            f'<circle cx="{cx}" cy="{cy}" r="{r*0.5:.1f}" fill="#f6b40e" stroke="#85340a" stroke-width="1.2"/>')


def emblema(tipo, cx, cy, r):
    """Emblema dentro de un círculo de radio r."""
    if tipo == "sol":
        return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#fff"/>' + sol(cx, cy, r * 0.85)
    if tipo == "globo":
        return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#ffdf00"/><circle cx="{cx}" cy="{cy}" r="{r*0.72:.1f}" fill="#002776"/>'
                f'<path d="M{cx-r*0.72:.1f} {cy-2} Q{cx} {cy-r*0.35:.1f} {cx+r*0.72:.1f} {cy+3}" stroke="#fff" stroke-width="{r*0.16:.1f}" fill="none"/>'
                + estrella(cx - r * 0.25, cy + r * 0.3, r * 0.12, "#fff") + estrella(cx + r * 0.25, cy + r * 0.35, r * 0.1, "#fff"))
    if tipo == "estrella-azul":
        return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#0039a6"/>' + estrella(cx, cy + 1, r * 0.7, "#fff")
    if tipo == "estrella-blanca":
        return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#fff"/><circle cx="{cx}" cy="{cy}" r="{r*0.78:.1f}" fill="none" stroke="#2f8a3a" stroke-width="{r*0.16:.1f}" stroke-dasharray="4 3"/>'
                + estrella(cx, cy + 1, r * 0.48, "#f6b40e"))
    if tipo == "montana":
        return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#fff"/>'
                f'<path d="M{cx-r*0.8:.1f} {cy+r*0.45:.1f} L{cx-r*0.3:.1f} {cy-r*0.25:.1f} L{cx-r*0.05:.1f} {cy+r*0.1:.1f} L{cx+r*0.3:.1f} {cy-r*0.45:.1f} L{cx+r*0.8:.1f} {cy+r*0.45:.1f}Z" fill="#2f6b3a"/>'
                f'<path d="M{cx-r*0.55:.1f} {cy+r*0.45:.1f}h{r*0.2:.1f}v-{r*0.2:.1f}h{r*0.15:.1f}v{r*0.2:.1f}h{r*0.2:.1f}v-{r*0.3:.1f}h{r*0.15:.1f}v{r*0.3:.1f}" fill="none" stroke="#8a7a5a" stroke-width="2"/>'
                f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="#d91023" stroke-width="2"/>')
    if tipo == "condor":
        return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#003893"/>'
                f'<path d="M{cx-r*0.85:.1f} {cy-r*0.05:.1f} Q{cx-r*0.4:.1f} {cy-r*0.5:.1f} {cx} {cy} Q{cx+r*0.4:.1f} {cy-r*0.5:.1f} {cx+r*0.85:.1f} {cy-r*0.05:.1f} Q{cx+r*0.4:.1f} {cy-r*0.1:.1f} {cx+r*0.1:.1f} {cy+r*0.25:.1f} L{cx} {cy+r*0.6:.1f} L{cx-r*0.1:.1f} {cy+r*0.25:.1f} Q{cx-r*0.4:.1f} {cy-r*0.1:.1f} {cx-r*0.85:.1f} {cy-r*0.05:.1f}Z" fill="#fcd116"/>')
    if tipo == "estrellas":
        s = f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#00247d"/>'
        for i in range(8):
            a = math.pi + (i + 0.5) * math.pi / 8
            s += estrella(cx + r * 0.62 * math.cos(a), cy + r * 0.25 + r * 0.62 * math.sin(a), r * 0.13, "#fff")
        return s
    if tipo == "volcan":
        return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#8fd0ff"/>'
                f'<circle cx="{cx+r*0.35:.1f}" cy="{cy-r*0.35:.1f}" r="{r*0.22:.1f}" fill="#ffd100"/>'
                f'<path d="M{cx-r:.1f} {cy+r*0.6:.1f} L{cx-r*0.1:.1f} {cy-r*0.3:.1f} L{cx+r:.1f} {cy+r*0.6:.1f}Z" fill="#4a6b3a"/>'
                f'<path d="M{cx-r*0.32:.1f} {cy-r*0.08:.1f} L{cx-r*0.1:.1f} {cy-r*0.3:.1f} L{cx+r*0.12:.1f} {cy-r*0.08:.1f} L{cx} {cy} L{cx-r*0.18:.1f} {cy-r*0.03:.1f}Z" fill="#fff"/>'
                f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="#034ea2" stroke-width="2.5"/>')
    if tipo == "wiphala":
        col = ["#d52b1e", "#ff7f00", "#f9e300", "#fff", "#007934", "#0038a8", "#6a1b9a"]
        lado = r * 1.3 / 7
        x0, y0 = cx - lado * 3.5, cy - lado * 3.5
        celdas = "".join(f'<rect x="{x0+i*lado:.1f}" y="{y0+j*lado:.1f}" width="{lado+.3:.1f}" height="{lado+.3:.1f}" fill="{col[(i - j) % 7]}"/>'
                         for i in range(7) for j in range(7))
        return (f'<clipPath id="cw"><circle cx="{cx}" cy="{cy}" r="{r*0.9:.1f}"/></clipPath>'
                f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#fff"/><g clip-path="url(#cw)">{celdas}</g>')
    raise ValueError(tipo)


def marco(code, nombre, anillos, emb):
    # Tres anillos con los colores de la bandera, separados por un filo oscuro.
    capas = ['<rect x="12" y="12" width="232" height="232" rx="22" fill="none" stroke="#0c0c10" stroke-width="10"/>']
    for i, c in enumerate(anillos):
        o = 14 + i * 7
        capas.append(f'<rect x="{o}" y="{o}" width="{256-2*o}" height="{256-2*o}" rx="{20-i*4}" fill="none" stroke="{c}" stroke-width="7"/>')
    capas.append('<rect x="33" y="33" width="190" height="190" rx="9" fill="none" stroke="#0c0c10" stroke-width="3"/>')
    largo = max(84, len(nombre) * 15 + 28)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="br" x1="0" y1="0" x2="1" y2="1"><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset=".65" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="m"><rect width="256" height="256" fill="#fff"/><rect x="34" y="34" width="188" height="188" rx="8" fill="#000"/></mask>
  </defs>
  {"".join(capas)}
  <rect x="-256" y="0" width="256" height="256" fill="url(#br)" mask="url(#m)">
    <animate attributeName="x" values="-256;256;256" keyTimes="0;.45;1" dur="4s" repeatCount="indefinite"/>
  </rect>
  <g transform="translate(0 0)">
    <circle cx="128" cy="30" r="26" fill="#0c0c10" stroke="{anillos[0]}" stroke-width="3"/>
    {emblema(emb, 128, 30, 22)}
  </g>
  <rect x="{128-largo/2:.0f}" y="218" width="{largo}" height="32" rx="6" fill="#0c0c10" stroke="{anillos[1] if anillos[1] != "#ffffff" else anillos[0]}" stroke-width="2.5"/>
  <text x="128" y="241" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="21" letter-spacing="1.5" fill="#fff">{nombre.upper()}</text>
</svg>
'''


def bandera(code, x, y, w, h):
    """Bandera simplificada dentro del rectángulo."""
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
    if code == "ar":
        return franjas(["#74acdf", "#fff", "#74acdf"]) + sol(cx, cy, h * 0.16)
    if code == "br":
        return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#009c3b"/>'
                f'<polygon points="{cx},{y+h*0.1} {x+w*0.92},{cy} {cx},{y+h*0.9} {x+w*0.08},{cy}" fill="#ffdf00"/>'
                f'<circle cx="{cx}" cy="{cy}" r="{h*0.22:.1f}" fill="#002776"/>')
    if code == "uy":
        s = franjas(["#fff", "#0038a8"] * 4 + ["#fff"])
        return s + f'<rect x="{x}" y="{y}" width="{w*0.36:.1f}" height="{h*5/9:.1f}" fill="#fff"/>' + sol(x + w * 0.18, y + h * 0.28, h * 0.2)
    if code == "cl":
        return (franjas(["#fff", "#d52b1e"]) + f'<rect x="{x}" y="{y}" width="{w/3:.1f}" height="{h/2:.1f}" fill="#0039a6"/>'
                + estrella(x + w / 6, y + h / 4, h * 0.14, "#fff"))
    if code == "pe":
        return franjas(["#d91023", "#fff", "#d91023"], vertical=True)
    if code == "co":
        return franjas(["#fcd116", "#003893", "#ce1126"], [2, 1, 1])
    if code == "ve":
        s = franjas(["#ffcc00", "#00247d", "#cf142b"])
        for i in range(8):
            a = math.pi + (i + 0.5) * math.pi / 8
            s += estrella(cx + h * 0.28 * math.cos(a), cy + h * 0.14 + h * 0.28 * math.sin(a), h * 0.05, "#fff")
        return s
    if code == "ec":
        return franjas(["#ffd100", "#034ea2", "#ef3340"], [2, 1, 1])
    if code == "bo":
        return franjas(["#d52b1e", "#f9e300", "#007934"])
    if code == "py":
        return franjas(["#d52b1e", "#fff", "#0038a8"]) + f'<circle cx="{cx}" cy="{cy}" r="{h*0.13:.1f}" fill="#fff" stroke="#2f8a3a" stroke-width="1.5"/>' + estrella(cx, cy, h * 0.08, "#f6b40e")
    raise ValueError(code)


def sticker(code, palabra):
    tam = 30 if len(palabra) <= 5 else (24 if len(palabra) <= 7 else 20)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs><clipPath id="c"><rect x="10" y="14" width="108" height="72" rx="8"/></clipPath></defs>
  <g transform="rotate(-5 64 60)">
    <rect x="10" y="14" width="108" height="72" rx="8" fill="#fff" stroke="#fff" stroke-width="10"/>
    <g clip-path="url(#c)">{bandera(code, 10, 14, 108, 72)}</g>
    <rect x="10" y="14" width="108" height="72" rx="8" fill="none" stroke="#14141a" stroke-width="2"/>
  </g>
  <g transform="rotate(4 64 104)">
    <rect x="6" y="88" width="116" height="34" rx="9" fill="#14141a" stroke="#fff" stroke-width="5"/>
    <text x="64" y="{105 + tam*0.36:.0f}" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="{tam}" letter-spacing="1" fill="#fff">{palabra}</text>
  </g>
</svg>
'''


for code, nombre, anillos, palabra, emb in PAISES:
    (RAIZ / "marcos" / f"pais-{code}.svg").write_text(marco(code, nombre, anillos, emb), encoding="utf-8")
    (RAIZ / "stickers" / f"pais-{code}.svg").write_text(sticker(code, palabra), encoding="utf-8")
print("listo:", len(PAISES), "países")
