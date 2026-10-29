"""Genera las colecciones mapas, arsenal y series2 de assets/perfil, y el CSS de esas colecciones y de paises2.

Escribe los SVG de marcos y stickers, reemplaza el bloque generado de cosmeticos.css y deja en
kits.json los artículos para sumar al catálogo.
Uso (desde la raíz del repo): python docs/bitacora/2026-10-29-cosmeticos-300/pruebas/generar_kits.py
"""
import json
import math
from pathlib import Path

AQUI = Path(__file__).resolve()
RAIZ = AQUI.parents[4] / "assets" / "perfil"
HUECO = '<mask id="m"><rect width="256" height="256" fill="#fff"/><rect x="34" y="34" width="188" height="188" rx="8" fill="#000"/></mask>'
BRILLO = ('<linearGradient id="br" x1="0" y1="0" x2="1" y2="1"><stop offset=".35" stop-color="#fff" stop-opacity="0"/>'
          '<stop offset=".5" stop-color="#fff" stop-opacity=".5"/><stop offset=".65" stop-color="#fff" stop-opacity="0"/></linearGradient>')


def svg(tam, defs, cuerpo):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {tam} {tam}" width="{tam}" height="{tam}">\n  <defs>{defs}</defs>\n{cuerpo}\n</svg>\n'


def etiqueta(texto, fondo, tinta):
    tam = 20 if len(texto) <= 9 else 16
    return (f'  <g transform="rotate(-6 64 108)">\n    <rect x="8" y="94" width="112" height="28" rx="8" fill="{fondo}" stroke="#fff" stroke-width="5"/>\n'
            f'    <text x="64" y="{108 + tam*0.36:.0f}" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="{tam}" letter-spacing="1.2" fill="{tinta}">{texto}</text>\n  </g>')


def barrido(dur=4):
    return (f'  <rect x="-256" y="0" width="256" height="256" fill="url(#br)" mask="url(#m)">'
            f'<animate attributeName="x" values="-256;256;256" keyTimes="0;.45;1" dur="{dur}s" repeatCount="indefinite"/></rect>')


def clase_brillo(c1, c2, c3, dur=3, extra=""):
    return (f"background:linear-gradient(100deg,{c1} 0%,{c2} 30%,{c3} 45%,{c2} 60%,{c1} 100%) 0 0/250% 100%;"
            f"-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;"
            f"filter:drop-shadow(0 0 5px {c2}88);animation:cos-mover-250 {dur}s linear infinite{extra}")


def tema(clase, pr, fg, card, mu, bo, vip):
    t = f".{clase}{{--primary:{pr};--primary-foreground:{fg};--ring:{pr};--card:{card};--muted:{mu};--border:{bo}"
    return t + (f";--glow:{pr};animation:cos-glow 3s ease-in-out infinite}}" if vip else "}")


def item(id, kind, name, desc, file, css, vip, anim, col):
    return {"id": id, "kind": kind, "name": name, "description": desc, "file": file, "css_class": css,
            "vip_only": vip, "animated": anim, "price": None, "collection": col}


ITEMS, CSS = [], []

# ---------- paises2: solo CSS (los SVG salen de generar_paises2.py) ----------
PAISES2 = [
    ("mx", "México", "CHIDO", "#2fbf6a", "#04160c", "#0d1a12", ["#2fbf6a", "#fff", "#ff3b4a"], "90deg"),
    ("cr", "Costa Rica", "PURA VIDA", "#ff3b4a", "#1f0508", "#0e1324", ["#4a6fe0", "#fff", "#ff3b4a", "#ff3b4a", "#fff", "#4a6fe0"], "180deg"),
    ("cu", "Cuba", "ASERE", "#4a6fe0", "#050f22", "#0e1324", ["#4a6fe0", "#fff", "#4a6fe0", "#fff", "#4a6fe0"], "180deg"),
    ("do", "Rep. Dominicana", "KLK", "#4a6fe0", "#050f22", "#120f1c", ["#4a6fe0", "#fff", "#ff3b4a"], "90deg"),
    ("pr", "Puerto Rico", "WEPA", "#ff3b3b", "#1f0505", "#140f1c", ["#ff3b3b", "#fff", "#ff3b3b", "#fff", "#ff3b3b"], "180deg"),
    ("pa", "Panamá", "XOPA", "#4a7fe0", "#050f22", "#160f14", ["#fff", "#ff3b4a", "#4a7fe0", "#fff"], "90deg"),
    ("gt", "Guatemala", "CHILERO", "#5aaee8", "#04121c", "#0e1620", ["#5aaee8", "#fff", "#5aaee8"], "90deg"),
    ("hn", "Honduras", "CATRACHO", "#3a9ae8", "#04121c", "#0e1620", ["#3a9ae8", "#fff", "#3a9ae8"], "180deg"),
    ("sv", "El Salvador", "CHIVO", "#4a7fe0", "#050f22", "#0e1424", ["#4a7fe0", "#fff", "#4a7fe0"], "180deg"),
    ("es", "España", "MOLA", "#f1bf00", "#1a1400", "#1a0e0e", ["#ff3b3b", "#f1bf00", "#f1bf00", "#ff3b3b"], "180deg"),
]
CSS += ["", "/* Latinoamérica y España (para todos) */"]
for c, pais, palabra, pr, fg, card, cols, d in PAISES2:
    n = len(cols)
    g = f"linear-gradient({d}," + ",".join(f"{x} {i*100/n:.0f}% {(i+1)*100/n:.0f}%" for i, x in enumerate(cols)) + ")"
    CSS.append(tema(f"tema-pais-{c}", pr, fg, card, card, pr + "55", False))
    CSS.append(f".nombre-pais-{c}{{background:{g};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 1px 0 #000) drop-shadow(0 0 3px #0008)}}")
    ITEMS += [item(f"marco-pais-{c}", "frame", pais, f"Los colores de {pais} alrededor del avatar.", f"marcos/pais-{c}.svg", None, False, True, "paises2"),
              item(f"sticker-pais-{c}", "sticker", palabra, f"{palabra} con la bandera de {pais}.", f"stickers/pais-{c}.svg", None, False, False, "paises2"),
              item(f"tema-pais-{c}", "theme", pais, f"Los colores de {pais} en todo el perfil.", None, f"tema-pais-{c}", False, False, "paises2"),
              item(f"nombre-pais-{c}", "name", pais, f"Tu nombre con las franjas de la bandera de {pais}.", None, f"nombre-pais-{c}", False, False, "paises2")]

# ---------- mapas (para todos) ----------
TEXTURAS = {
    "arena": lambda c: f'<pattern id="tx" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r="1.2" fill="{c}"/><circle cx="10" cy="10" r="1" fill="{c}"/><circle cx="11" cy="3" r=".8" fill="{c}"/></pattern>',
    "ladrillo": lambda c: f'<pattern id="tx" width="24" height="12" patternUnits="userSpaceOnUse"><path d="M0 0h24M0 6h24M6 0v6M18 6v6" stroke="{c}" stroke-width="1.6"/></pattern>',
    "peligro": lambda c: f'<pattern id="tx" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="16" fill="{c}"/></pattern>',
    "nieve": lambda c: f'<pattern id="tx" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="4" cy="5" r="1.6" fill="{c}"/><circle cx="13" cy="13" r="1.2" fill="{c}"/></pattern>',
    "piedra": lambda c: f'<pattern id="tx" width="22" height="18" patternUnits="userSpaceOnUse"><ellipse cx="6" cy="5" rx="5" ry="4" fill="none" stroke="{c}" stroke-width="1.4"/><ellipse cx="16" cy="13" rx="5" ry="4" fill="none" stroke="{c}" stroke-width="1.4"/></pattern>',
    "selva": lambda c: f'<pattern id="tx" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M2 12Q6 2 12 4Q8 10 2 12ZM12 18Q14 10 20 10Q18 16 12 18Z" fill="{c}"/></pattern>',
    "tejas": lambda c: f'<pattern id="tx" width="16" height="10" patternUnits="userSpaceOnUse"><path d="M0 10A8 8 0 0 1 16 10" fill="none" stroke="{c}" stroke-width="1.6"/></pattern>',
    "riel": lambda c: f'<pattern id="tx" width="12" height="20" patternUnits="userSpaceOnUse"><rect x="4" width="4" height="20" fill="{c}"/><path d="M0 4h12M0 16h12" stroke="{c}" stroke-width="2"/></pattern>',
    "rejilla": lambda c: f'<pattern id="tx" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 0h12v12" fill="none" stroke="{c}" stroke-width="1.4"/></pattern>',
}
# id, nombre del mapa, base, textura, color de la textura, acento, sitio del sticker, descripción
MAPAS = [
    ("dust2", "de_dust2", "#c8a165", "arena", "#a8844c", "#f2d39b", "A", "Arena, muros de adobe y la larga de toda la vida."),
    ("inferno", "de_inferno", "#a8502e", "ladrillo", "#7a3520", "#ffc49a", "B", "Ladrillo italiano y la banana."),
    ("nuke", "de_nuke", "#5e6a74", "peligro", "#f2c230", "#f2c230", "A", "Planta nuclear con franjas de peligro."),
    ("train", "de_train", "#4e5a52", "riel", "#36403a", "#c9d2c0", "B", "Vías, vagones y metal."),
    ("office", "cs_office", "#8ea3b4", "nieve", "#ffffff", "#e8f2fa", "A", "Nieve afuera y rehenes adentro."),
    ("aztec", "de_aztec", "#4f6f3a", "selva", "#345026", "#c8e09a", "B", "Selva, templo y el puente colgante."),
    ("cbble", "de_cbble", "#7c766b", "piedra", "#5c574e", "#e0d8c6", "A", "Adoquines y murallas de castillo."),
    ("italy", "cs_italy", "#c98b4f", "tejas", "#9a5a28", "#ffe0b0", "B", "Techos de teja y el mercado."),
    ("piranesi", "de_piranesi", "#9a8466", "piedra", "#76623f", "#efe0c0", "A", "Ruinas de piedra y arcos."),
    ("prodigy", "de_prodigy", "#4a5560", "rejilla", "#2f3840", "#a8e04a", "B", "Laboratorio subterráneo y rejillas."),
]
CSS += ["", "/* Mapas de CS:S (para todos) */"]
for k, mapa, base, tex, ctex, acento, sitio, desc in MAPAS:
    largo = len(mapa) * 11 + 26
    marco = svg(256, HUECO + TEXTURAS[tex](ctex), f'''  <rect x="14" y="14" width="228" height="228" rx="12" fill="{base}" mask="url(#m)"/>
  <rect x="14" y="14" width="228" height="228" rx="12" fill="url(#tx)" mask="url(#m)"/>
  <rect x="14" y="14" width="228" height="228" rx="12" fill="none" stroke="#14141a" stroke-width="4"/>
  <rect x="31" y="31" width="194" height="194" rx="9" fill="none" stroke="#14141a" stroke-width="3"/>
  <rect x="33" y="33" width="190" height="190" rx="8" fill="none" stroke="{acento}" stroke-width="1.5"/>
  <g transform="translate(128 24)"><rect x="-15" y="-13" width="30" height="26" rx="3" fill="#14141a" stroke="{acento}" stroke-width="2"/>
    <text y="8" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="22" fill="{acento}">{sitio}</text></g>
  <rect x="{128-largo/2:.0f}" y="220" width="{largo}" height="26" rx="5" fill="#14141a" stroke="{acento}" stroke-width="2"/>
  <text x="128" y="239" text-anchor="middle" font-family="Consolas, Courier New, monospace" font-weight="700" font-size="18" fill="{acento}">{mapa}</text>''')
    sticker = svg(128, TEXTURAS[tex](ctex), f'''  <g transform="rotate(4 64 50)">
    <rect x="22" y="8" width="84" height="80" rx="8" fill="{base}" stroke="#fff" stroke-width="8"/>
    <rect x="22" y="8" width="84" height="80" rx="8" fill="url(#tx)"/>
    <rect x="22" y="8" width="84" height="80" rx="8" fill="none" stroke="#14141a" stroke-width="2"/>
    <text x="64" y="76" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="66" fill="#14141a" opacity=".85">{sitio}</text>
  </g>
''' + etiqueta(mapa.upper(), "#14141a", acento))
    (RAIZ / "marcos" / f"mapa-{k}.svg").write_text(marco, encoding="utf-8")
    (RAIZ / "stickers" / f"mapa-{k}.svg").write_text(sticker, encoding="utf-8")
    CSS.append(tema(f"tema-mapa-{k}", acento, "#111", "#15141a", "#1e1d24", base + "66", False))
    CSS.append(f".nombre-mapa-{k}{{background:linear-gradient(180deg,{acento} 0%,{acento} 45%,{base} 55%,{base} 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 1px 0 #000)}}")
    ITEMS += [item(f"marco-mapa-{k}", "frame", mapa, desc, f"marcos/mapa-{k}.svg", None, False, False, "mapas"),
              item(f"sticker-mapa-{k}", "sticker", f"{mapa} sitio {sitio}", f"El cartel del sitio {sitio} de {mapa}.", f"stickers/mapa-{k}.svg", None, False, False, "mapas"),
              item(f"tema-mapa-{k}", "theme", mapa, f"Los colores de {mapa} en todo el perfil.", None, f"tema-mapa-{k}", False, False, "mapas"),
              item(f"nombre-mapa-{k}", "name", mapa, f"Tu nombre con los colores de {mapa}.", None, f"nombre-mapa-{k}", False, False, "mapas")]

# ---------- arsenal (VIP) ----------
ARMAS = {
    "ak": '<path d="M-42-4L-20-6L-18-2L-8-2L-6-6L30-6L30-4L42-4L42-2L30-1L14-1L10 2L7 12L1 12L3 2L-6 2L-10 8L-16 8L-14 2L-20 2L-42 6Z"/>',
    "m4": '<path d="M-42-6L-26-5L-26-2L-10-2L-10-9L6-9L6-4L30-4L30-3L42-3L42-1L14-1L12 1L10 12L4 12L5 1L-4 1L-8 8L-14 8L-12 1L-26 2L-42 4Z"/>',
    "awp": '<path d="M-44-4L-28-6L-10-3L44-3L44 0L-6 0L-8 4L-14 4L-16 8L-22 8L-20 2L-30 6L-44 6Z"/><path d="M-14-12h26v6h-26Z"/><path d="M-10-6h3v3h-3ZM6-6h3v3h-3Z"/>',
    "deagle": '<path d="M-22-10L22-10L22-3L-4-3L-6 0L-8 0L-12 14L-24 14L-20 0Z"/><path d="M-8 0Q-4 7 2 0" fill="none" stroke-width="2.5"/>',
    "scout": '<path d="M-44-3L-28-5L-10-2L44-2L44 0L-8 1L-14 6L-20 6L-18 1L-44 4Z"/><path d="M-10-9h20v4h-20Z"/>',
    "usp": '<path d="M-22-9L10-9L10-7L36-7L36-2L10-2L10-3L-6-3L-8 0L-10 0L-14 13L-24 13L-20-1Z"/>',
    "glock": '<path d="M-18-9L20-9L20-3L-2-3L-4 0L-6 0L-10 13L-21 13L-17-1Z"/>',
    "mp5": '<path d="M-40-3L-22-5L-22-2L-8-2L-8-6L22-6L22-3L34-3L34-1L6-1L2 10L-4 12L0 1L-8 1L-10 6L-16 6L-14 1L-22 2L-40 3Z"/>',
    "cuchillo": '<path d="M-6-4L36-4Q30 5-6 4Z"/><path d="M-34-4h26v8h-26Z"/><path d="M-9-9h4v18h-4Z"/>',
    "he": '<circle cx="0" cy="3" r="12"/><path d="M-4-14h8v6h-8Z"/><path d="M4-12L16-6L13 2" fill="none" stroke-width="3"/><circle cx="-8" cy="-13" r="4" fill="none" stroke-width="2"/>',
}
# arma, etiqueta, acabado, c1, c2, c3, efecto, primario del tema
ARSENAL = [
    ("ak", "AK-47", "Lava", "#3a0a00", "#ff4a00", "#ffd04a", "pulso", "#ff6a1a"),
    ("m4", "M4A1", "Ártico", "#6fb7e6", "#cfeaff", "#ffffff", "", "#8fd0ff"),
    ("awp", "AWP", "Relámpago", "#1a1a4a", "#4a7aff", "#e0f0ff", "flujo", "#6a8cff"),
    ("deagle", "DEAGLE", "Oro macizo", "#8a5a10", "#f2c040", "#fff3c0", "", "#f2c040"),
    ("scout", "SCOUT", "Selva", "#1f3a1a", "#4a7a2a", "#c8e08a", "", "#8ac04a"),
    ("usp", "USP", "Medianoche", "#0a0a1f", "#4a3aa0", "#c0b0ff", "pulso", "#9a8aff"),
    ("glock", "GLOCK", "Caramelo", "#ff3a7a", "#ffd0e0", "#ffffff", "flujo", "#ff5a95"),
    ("mp5", "MP5", "Neón", "#00c8a0", "#00ffd0", "#ff00c8", "hue", "#00ffd0"),
    ("cuchillo", "CUCHILLO", "Fantasma", "#4a4a58", "#c8c8d8", "#ffffff", "pulso", "#d0d0e0"),
    ("he", "HE", "Arcoíris", "#ff3a3a", "#ffd23a", "#3aff8a", "hue", "#ffd23a"),
]
CSS += ["", "/* Arsenal (VIP): acabados propios, sin nombres de skins de Valve */"]
for k, et, acab, c1, c2, c3, fx, pr in ARSENAL:
    grad = (f'<linearGradient id="sk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset=".5" stop-color="{c2}"/><stop offset="1" stop-color="{c3}"/>'
            + ('<animateTransform attributeName="gradientTransform" type="rotate" values="0 .5 .5;360 .5 .5" dur="4s" repeatCount="indefinite"/>' if fx == "hue" else "")
            + '</linearGradient>')
    extra = ""
    if fx == "pulso":
        extra = f'  <rect x="16" y="16" width="224" height="224" rx="16" fill="none" stroke="{c3}" stroke-width="4" mask="url(#m)"><animate attributeName="stroke-opacity" values=".1;.9;.1" dur="1.6s" repeatCount="indefinite"/></rect>'
    if fx == "flujo":
        extra = f'  <rect x="16" y="16" width="224" height="224" rx="16" fill="none" stroke="{c3}" stroke-width="5" stroke-dasharray="6 26"><animate attributeName="stroke-dashoffset" values="0;-64" dur="1s" repeatCount="indefinite"/></rect>'
    arma = ARMAS[k]
    marco = svg(256, HUECO + BRILLO + grad, f'''  <rect x="16" y="16" width="224" height="224" rx="16" fill="none" stroke="#111" stroke-width="22"/>
  <rect x="16" y="16" width="224" height="224" rx="16" fill="none" stroke="url(#sk)" stroke-width="16"/>
{extra}
  <rect x="31" y="31" width="194" height="194" rx="9" fill="none" stroke="#111" stroke-width="3"/>
{barrido(3)}
  <g transform="translate(128 230)"><rect x="-66" y="-17" width="132" height="34" rx="8" fill="#111" stroke="url(#sk)" stroke-width="2.5"/>
    <g transform="scale(1.45)" fill="url(#sk)" stroke="#111" stroke-width="1">{arma}</g></g>
  <g transform="translate(128 20)"><rect x="-38" y="-10" width="76" height="20" rx="5" fill="#111" stroke="url(#sk)" stroke-width="2"/>
    <text y="6" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="14" letter-spacing="1" fill="{c2 if c2 != '#ffd0e0' else c1}">{acab.upper()}</text></g>''')
    sticker = svg(128, BRILLO.replace('id="br"', 'id="bs"') + grad, f'''  <g transform="rotate(-8 64 50)">
    <rect x="6" y="22" width="116" height="56" rx="10" fill="#111" stroke="#fff" stroke-width="6"/>
    <g transform="translate(64 50) scale(1.3)" fill="url(#sk)" stroke="#fff" stroke-width="1">{arma}</g>
    <rect x="6" y="22" width="116" height="56" rx="10" fill="url(#bs)">
      <animate attributeName="x" values="-120;130;130" keyTimes="0;.5;1" dur="2.5s" repeatCount="indefinite"/></rect>
  </g>
''' + etiqueta(et, c1, "#fff" if c1 not in ("#6fb7e6", "#00c8a0", "#ff3a7a", "#ff3a3a") else "#111"))
    (RAIZ / "marcos" / f"arma-{k}.svg").write_text(marco, encoding="utf-8")
    (RAIZ / "stickers" / f"arma-{k}.svg").write_text(sticker, encoding="utf-8")
    nombre = f"{ {'DEAGLE': 'Deagle', 'SCOUT': 'Scout', 'GLOCK': 'Glock', 'CUCHILLO': 'Cuchillo'}.get(et, et)} {acab}"
    CSS.append(tema(f"tema-arma-{k}", pr, "#111", "#141317", "#1d1b22", pr + "55", True))
    CSS.append(f".nombre-arma-{k}{{{clase_brillo(c2, c3, "#ffffff", 2.4, ',cos-holo 4s linear infinite' if fx == 'hue' else '')}}}")
    ITEMS += [item(f"marco-arma-{k}", "frame", nombre, f"Acabado {acab} con el arma abajo y un brillo que corre.", f"marcos/arma-{k}.svg", None, True, True, "arsenal"),
              item(f"sticker-arma-{k}", "sticker", nombre, f"La {et} con acabado {acab}.", f"stickers/arma-{k}.svg", None, True, True, "arsenal"),
              item(f"tema-arma-{k}", "theme", f"{acab}", f"Los colores del acabado {acab} con un borde que brilla.", None, f"tema-arma-{k}", True, True, "arsenal"),
              item(f"nombre-arma-{k}", "name", f"{acab}", f"Tu nombre con el acabado {acab}.", None, f"nombre-arma-{k}", True, True, "arsenal")]

# ---------- series2 (VIP) ----------
def trebol():
    s = '<circle r="28" fill="#ffd400" stroke="#111" stroke-width="2"/><circle r="5" fill="#111"/>'
    for i in range(3):
        a0, a1 = math.radians(-90 + i * 120 - 30), math.radians(-90 + i * 120 + 30)
        p = lambda r, a: f"{r*math.cos(a):.1f} {r*math.sin(a):.1f}"
        s += f'<path d="M{p(8,a0)}L{p(24,a0)}A24 24 0 0 1 {p(24,a1)}L{p(8,a1)}A8 8 0 0 0 {p(8,a0)}Z" fill="#111"/>'
    return s


ICONOS = {
    "dona": '<circle r="26" fill="#e8b06a"/><path d="M-21 0a21 21 0 1 1 42 0q-3 4-6 1t-6 2-6-1-6 2-6-1-6 2-6-1q-3 0-6-4Z" fill="#ff7ab8"/><circle r="8" fill="#1a1010"/>'
            '<g stroke-width="2.5" stroke-linecap="round"><path d="M-12-12l3 2" stroke="#3ad0ff"/><path d="M8-15l3-2" stroke="#ffe14a"/><path d="M13-4l2 3" stroke="#7aff6a"/><path d="M-15-2l-1 3" stroke="#fff"/><path d="M0-18h3" stroke="#ff4a4a"/></g>',
    "zombi": '<path d="M-30 22Q0 14 30 22L30 30L-30 30Z" fill="#4a3a2a"/><path d="M-6 24L-6-2L-11-16Q-12-21-8-21L-4-10L-4-24Q-2-28 1-24L1-10L3-26Q6-29 8-25L7-9L11-20Q14-23 15-18L11-2L10 24Z" fill="#7fa86a" stroke="#2a3a1a" stroke-width="1.5"/>',
    "barril": '<path d="M-18-24Q-25 0-18 24L18 24Q25 0 18-24Z" fill="#a0662e" stroke="#3a2410" stroke-width="2"/><path d="M-21-12h42M-21 12h42" stroke="#5a3a18" stroke-width="4"/><path d="M-6-24Q-9 0-6 24M6-24Q9 0 6 24" stroke="#7a4a1e" stroke-width="1.5" fill="none"/><ellipse cy="-24" rx="18" ry="4" fill="#7a4a1e"/>',
    "fuga": '<circle r="28" fill="#ff7a1a"/><rect x="-22" y="-24" width="44" height="48" rx="3" fill="none" stroke="#3a3a44" stroke-width="4"/><path d="M-11-24v48M0-24v48M11-24V2Q11 10 18 14" stroke="#3a3a44" stroke-width="4" fill="none"/>',
    "radiacion": trebol(),
    "vikingo": '<path d="M-20 6Q-20-20 0-20Q20-20 20 6Z" fill="#9aa3ad" stroke="#3a3f45" stroke-width="2"/><path d="M-20-2Q-34-6-30-26Q-26-12-16-10Z M20-2Q34-6 30-26Q26-12 16-10Z" fill="#f0e6d0" stroke="#6a5a40" stroke-width="1.5"/><rect x="-22" y="4" width="44" height="7" fill="#6a5030"/><rect x="-2.5" y="8" width="5" height="14" fill="#9aa3ad"/>',
    "elementos": '<circle cx="-12" cy="-12" r="10" fill="#3aa0ff"/><circle cx="12" cy="-12" r="10" fill="#5aa03a"/><circle cx="12" cy="12" r="10" fill="#ff4a2a"/><circle cx="-12" cy="12" r="10" fill="#e8f0ff"/><circle r="5" fill="#111"/>',
    "robot": '<path d="M0-18v-8" stroke="#8a96a2" stroke-width="3"/><circle cy="-27" r="3.5" fill="#ff5a5a"/><rect x="-22" y="-18" width="44" height="36" rx="7" fill="#b8c2cc" stroke="#4a545e" stroke-width="2"/><circle cx="-9" cy="-3" r="6" fill="#ffd23a"/><circle cx="9" cy="-3" r="6" fill="#ffd23a"/><path d="M-11 10h22" stroke="#4a545e" stroke-width="4" stroke-dasharray="3 2"/>',
    "fondo-mar": '<path d="M-10-20L-14-32L-4-22L0-34L4-22L14-32L10-20Z" fill="#3aa03a"/><ellipse cy="4" rx="22" ry="26" fill="#ff9a2a" stroke="#a85a10" stroke-width="2"/><path d="M-18-6L4 26M-8-20L18 18M8-22L-18 16M18-8L-6 26" stroke="#c86a18" stroke-width="1.5"/><circle cy="14" r="7" fill="#5a7aa0" stroke="#2a3a50" stroke-width="2"/>',
    "isla": '<circle cx="16" cy="-18" r="8" fill="#ffd23a"/><ellipse cy="24" rx="30" ry="6" fill="#2a8ad8"/><path d="M-22 22Q0 6 22 22Z" fill="#e8d08a"/><path d="M-2 18Q-4 0 2-14" stroke="#8a5a2a" stroke-width="4" fill="none"/><path d="M2-14Q-12-20-20-10M2-14Q-4-26-14-26M2-14Q12-24 22-18M2-14Q14-12 18-2" stroke="#3aa03a" stroke-width="4" fill="none" stroke-linecap="round"/>',
}
# id, nombre, inspirado en, c1, c2, c3, sticker, nombre del efecto, css del efecto, descripción del marco
SERIES2 = [
    ("dona", "Dona glaseada", "Los Simpson", "#ffd90f", "#ff7ab8", "#7ad0ff", "DONA", "Glaseado", clase_brillo("#ff4a9a", "#ff9ad0", "#fff0f8", 2.6), "Amarillo de pueblo chico y una dona que flota."),
    ("zombi", "Apocalipsis zombi", "The Walking Dead", "#3a4a2a", "#7fa86a", "#c8d8a0", "ZOMBI", "Podrido", "color:#b8d89a;-webkit-text-fill-color:#b8d89a;text-shadow:0 0 4px #5a8a3a,0 0 12px #2a4a1a;animation:cos-mutante 2.4s ease-in-out infinite", "Tierra removida y una mano que sale."),
    ("barril", "La vecindad", "El Chavo del 8", "#a0662e", "#ffd23a", "#3aa0ff", "VECINDAD", "Barril", "background:repeating-linear-gradient(90deg,#a0662e 0 6px,#7a4a1e 6px 8px);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 1px 0 #000)", "Madera de patio y un barril para esconderse."),
    ("fuga", "La fuga", "Prison Break", "#ff7a1a", "#3a3a44", "#ffd0a0", "FUGA", "Tatuaje", "font-family:Georgia,Times New Roman,serif;color:#2a4a8a;-webkit-text-fill-color:#3a5ab0;text-shadow:0 0 1px #9ab0e0,0 0 6px #3a5ab088;letter-spacing:.05em", "Mono naranja y barrotes, con uno doblado."),
    ("radiacion", "Reactor 4", "Chernobyl", "#2a2a22", "#ffd400", "#b8ff3a", "REACTOR", "Radiactivo", "color:#e8ff9a;-webkit-text-fill-color:#e8ff9a;text-shadow:0 0 4px #b8ff3a,0 0 14px #6aff00;animation:cos-mutante 1.2s ease-in-out infinite", "Peligro radiactivo que late."),
    ("vikingo", "Vikingo", "Vikingos", "#6a5030", "#9aa3ad", "#e0c080", "VALHALLA", "Rúnico", "font-family:Georgia,Times New Roman,serif;letter-spacing:.08em;text-transform:uppercase;" + clase_brillo("#6a5030", "#e0c080", "#fff4d8", 3.5), "Madera, hierro y el casco con cuernos."),
    ("elementos", "Cuatro elementos", "Avatar: la leyenda de Aang", "#3aa0ff", "#ff4a2a", "#5aa03a", "ELEMENTOS", "Elemental", "background:linear-gradient(90deg,#3aa0ff,#5aa03a,#ff4a2a,#e8f0ff,#3aa0ff) 0 0/300% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:cos-mover-300 4s linear infinite", "Agua, tierra, fuego y aire girando."),
    ("robot", "Robot del futuro", "Futurama", "#4a545e", "#b8c2cc", "#3ad0ff", "BIP BUP", "Binario", "font-family:Consolas,Courier New,monospace;color:#7ae8ff;-webkit-text-fill-color:#7ae8ff;text-shadow:0 0 6px #3ad0ff;animation:cos-neon 2.4s ease-in-out infinite", "Metal del año 3000 y luces que parpadean."),
    ("fondo-mar", "Fondo de mar", "Bob Esponja", "#2ab0d8", "#ff9a2a", "#ffe04a", "GLU GLU", "Burbujas", clase_brillo("#1a8ab8", "#6ad8ff", "#ffffff", 2.2), "Agua, burbujas y una casa con forma de fruta."),
    ("isla", "La isla", "Lost", "#2a8ad8", "#e8d08a", "#3aa03a", "LA ISLA", "Tropical", clase_brillo("#ff8a2a", "#ffd23a", "#3aff8a", 3), "Mar, arena y una palmera en medio de la nada."),
]
CSS += ["", "/* Series míticas 2 (VIP): homenajes originales, sin logos ni personajes */"]
for k, n, insp, c1, c2, c3, st, nn, ncss, desc in SERIES2:
    ic = ICONOS[k]
    burbujas = "".join(
        f'<circle cx="{x}" cy="250" r="{r}" fill="{c3}"><animate attributeName="cy" values="250;0" dur="{d}s" begin="{b}s" repeatCount="indefinite"/>'
        f'<animate attributeName="opacity" values="1;0" dur="{d}s" begin="{b}s" repeatCount="indefinite"/></circle>'
        for x, r, d, b in [(20, 2.5, 3.5, 0), (236, 2, 4, 1.2), (12, 1.6, 3, 2), (244, 2.2, 4.4, .6)])
    marco = svg(256, HUECO + f'<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset=".5" stop-color="{c2}"/><stop offset="1" stop-color="{c1}"/></linearGradient>',
                f'''  <rect x="16" y="16" width="224" height="224" rx="16" fill="none" stroke="#111" stroke-width="22"/>
  <rect x="16" y="16" width="224" height="224" rx="16" fill="none" stroke="url(#g)" stroke-width="16"/>
  <rect x="16" y="16" width="224" height="224" rx="16" fill="none" stroke="{c3}" stroke-width="4" stroke-dasharray="18 14"><animate attributeName="stroke-dashoffset" values="0;-64" dur="2s" repeatCount="indefinite"/></rect>
  <rect x="31" y="31" width="194" height="194" rx="9" fill="none" stroke="#111" stroke-width="3"/>
  {burbujas}
  <g transform="translate(128 228)"><circle r="26" fill="#111" stroke="{c3}" stroke-width="3"/>
    <g transform="scale(.75)">{ic}<animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="1.6s" additive="sum" repeatCount="indefinite"/></g></g>''')
    sticker = svg(128, "", f'''  <g transform="translate(64 50)">
    <circle r="40" fill="{c1}" stroke="#fff" stroke-width="6"/>
    <g transform="scale(1.15)">{ic}<animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="1.4s" additive="sum" repeatCount="indefinite"/></g>
  </g>
''' + etiqueta(st, c2 if c2 not in ("#e8d08a", "#b8c2cc", "#9aa3ad", "#7fa86a", "#ffd400", "#ff9a2a", "#ffd23a") else "#111", "#fff" if c2 in ("#3a3a44", "#ff4a2a", "#ff7ab8") else ("#111" if c2 not in ("#e8d08a", "#b8c2cc", "#9aa3ad", "#7fa86a", "#ffd400", "#ff9a2a", "#ffd23a") else c2)))
    (RAIZ / "marcos" / f"serie-{k}.svg").write_text(marco, encoding="utf-8")
    (RAIZ / "stickers" / f"serie-{k}.svg").write_text(sticker, encoding="utf-8")
    pr = c2 if c2 not in ("#3a3a44",) else c1
    CSS.append(tema(f"tema-serie-{k}", pr, "#111", "#141317", "#1d1b22", pr + "55", True))
    CSS.append(f".nombre-{k}{{{ncss}}}")
    ITEMS += [item(f"marco-serie-{k}", "frame", n, desc, f"marcos/serie-{k}.svg", None, True, True, "series2"),
              item(f"sticker-serie-{k}", "sticker", st, f"{st}: el ícono de {n} flotando.", f"stickers/serie-{k}.svg", None, True, True, "series2"),
              item(f"tema-serie-{k}", "theme", n, f"Los colores de {n} con un borde que brilla.", None, f"tema-serie-{k}", True, True, "series2"),
              item(f"nombre-{k}", "name", nn, f"Efecto {nn}, de la colección {n}.", None, f"nombre-{k}", True, True, "series2")]

# ---------- CSS: reemplaza el bloque generado ----------
INI, FIN = "/* --- inicio: generado por generar_kits.py --- */", "/* --- fin: generado por generar_kits.py --- */"
p = RAIZ / "cosmeticos.css"
s = p.read_text(encoding="utf-8")
bloque = INI + "\n".join(CSS) + "\n" + FIN + "\n"
if INI in s:
    s = s[:s.index(INI)] + bloque + s[s.index(FIN) + len(FIN) + 1:]
else:
    i = s.index("@keyframes cos-mover-250")
    s = s[:i] + bloque + "\n" + s[i:]
p.write_text(s, encoding="utf-8")
(AQUI.parent / "kits.json").write_text(json.dumps(ITEMS, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("listo:", len(ITEMS), "artículos")
