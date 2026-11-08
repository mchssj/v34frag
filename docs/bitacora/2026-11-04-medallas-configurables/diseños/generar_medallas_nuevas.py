"""Genera las medallas NUEVAS de CM League (tanda 2026-10-29), con el mismo sistema que las de perfil y equipos.

Uso: python generar_medallas_nuevas.py <carpeta_nuevas>   (crea <carpeta_nuevas>/perfil y <carpeta_nuevas>/equipos)

Sistema visual:
- Forma = categoría. Perfil: escudo (trayectoria), hexágono (habilidad), octágono (arsenal y bomba),
  placa (mapas), círculo (logros), sello (comunidad), rombo (prestigio). Equipos: banderín con logo.
- Color del acento = tipo de medalla (cinta, cara, icono, etiqueta).
- Metal del marco = nivel (bronce, plata, oro, platino, diamante) + puntos de nivel debajo del número.
"""
import math, os, sys

BASE_NUEVAS = sys.argv[1]
OUT = BASE_NUEVAS
SEASON = "S1"

# ---------- formas (centro 130,141) ----------
SHAPES = {
    "escudo": "M38 42 Q38 32 50 32 H210 Q222 32 222 44 V135 Q222 208 130 250 Q38 208 38 135 Z",
    "hexagono": "M78 34 H182 Q190 34 193 41 L228 134 Q231 141 228 148 L193 241 Q190 248 182 248 H78 Q70 248 67 241 L32 148 Q29 141 32 134 L67 41 Q70 34 78 34 Z",
    "circulo": "M28 142 A102 102 0 1 1 232 142 A102 102 0 1 1 28 142 Z",
    "octagono": "M86 32 H174 L226 84 V198 L174 250 H86 L34 198 V84 Z",
    "placa": "M60 34 H200 Q226 34 226 60 V222 Q226 248 200 248 H60 Q34 248 34 222 V60 Q34 34 60 34 Z",
    "sello": "M130.0 36.5 L133.7 37.4 L137.1 39.8 L140.4 43.1 L143.4 46.3 L146.5 48.6 L149.7 49.4 L153.2 48.8 L157.2 47.2 L161.4 45.3 L165.6 44.1 L169.5 44.2 L172.7 46.1 L175.2 49.4 L177.0 53.5 L178.6 57.8 L180.4 61.3 L182.9 63.6 L186.2 64.7 L190.3 64.8 L194.9 64.7 L199.4 65.0 L203.1 66.3 L205.7 68.9 L207.0 72.6 L207.3 77.1 L207.2 81.7 L207.3 85.8 L208.4 89.1 L210.7 91.6 L214.2 93.4 L218.5 95.0 L222.6 96.8 L225.9 99.3 L227.8 102.5 L227.9 106.4 L226.7 110.6 L224.8 114.8 L223.2 118.8 L222.6 122.3 L223.4 125.5 L225.7 128.6 L228.9 131.6 L232.2 134.9 L234.6 138.3 L235.5 142.0 L234.6 145.7 L232.2 149.1 L228.9 152.4 L225.7 155.4 L223.4 158.5 L222.6 161.7 L223.2 165.2 L224.8 169.2 L226.7 173.4 L227.9 177.6 L227.8 181.5 L225.9 184.7 L222.6 187.2 L218.5 189.0 L214.2 190.6 L210.7 192.4 L208.4 194.9 L207.3 198.2 L207.2 202.3 L207.3 206.9 L207.0 211.4 L205.7 215.1 L203.1 217.7 L199.4 219.0 L194.9 219.3 L190.3 219.2 L186.2 219.3 L182.9 220.4 L180.4 222.7 L178.6 226.2 L177.0 230.5 L175.2 234.6 L172.7 237.9 L169.5 239.8 L165.6 239.9 L161.4 238.7 L157.2 236.8 L153.2 235.2 L149.7 234.6 L146.5 235.4 L143.4 237.7 L140.4 240.9 L137.1 244.2 L133.7 246.6 L130.0 247.5 L126.3 246.6 L122.9 244.2 L119.6 240.9 L116.6 237.7 L113.5 235.4 L110.3 234.6 L106.8 235.2 L102.8 236.8 L98.6 238.7 L94.4 239.9 L90.5 239.8 L87.3 237.9 L84.8 234.6 L83.0 230.5 L81.4 226.2 L79.6 222.7 L77.1 220.4 L73.8 219.3 L69.7 219.2 L65.1 219.3 L60.6 219.0 L56.9 217.7 L54.3 215.1 L53.0 211.4 L52.7 206.9 L52.8 202.3 L52.7 198.2 L51.6 194.9 L49.3 192.4 L45.8 190.6 L41.5 189.0 L37.4 187.2 L34.1 184.7 L32.2 181.5 L32.1 177.6 L33.3 173.4 L35.2 169.2 L36.8 165.2 L37.4 161.7 L36.6 158.5 L34.3 155.4 L31.1 152.4 L27.8 149.1 L25.4 145.7 L24.5 142.0 L25.4 138.3 L27.8 134.9 L31.1 131.6 L34.3 128.6 L36.6 125.5 L37.4 122.3 L36.8 118.8 L35.2 114.8 L33.3 110.6 L32.1 106.4 L32.2 102.5 L34.1 99.3 L37.4 96.8 L41.5 95.0 L45.8 93.4 L49.3 91.6 L51.6 89.1 L52.7 85.8 L52.8 81.7 L52.7 77.1 L53.0 72.6 L54.3 68.9 L56.9 66.3 L60.6 65.0 L65.1 64.7 L69.7 64.8 L73.8 64.7 L77.1 63.6 L79.6 61.3 L81.4 57.8 L83.0 53.5 L84.8 49.4 L87.3 46.1 L90.5 44.2 L94.4 44.1 L98.6 45.3 L102.8 47.2 L106.8 48.8 L110.3 49.4 L113.5 48.6 L116.6 46.3 L119.6 43.1 L122.9 39.8 L126.3 37.4 Z",
    "banderin": "M42 32 H218 V262 L130 234 L42 262 Z",
    "rombo": "M130 22 Q136 22 140 27 L232 133 Q238 141 232 149 L140 255 Q136 260 130 260 Q124 260 120 255 L28 149 Q22 141 28 133 L120 27 Q124 22 130 22 Z",
}
CX, CY = 130, 141
LAYOUT = {  # y de la etiqueta, centro del número, y de los puntos de nivel
    "escudo": dict(pill=60, num=122, pips=161),
    "hexagono": dict(pill=60, num=122, pips=161),
    "rombo": dict(pill=80, num=140, pips=180),
    "octagono": dict(pill=60, num=122, pips=161),
    "placa": dict(pill=58, num=122, pips=161),
    "banderin": dict(pill=44, num=148, pips=177),
}
LOCK_Y = {"banderin": 250}

# ---------- metales (nivel) ----------
METAL = {
    "bronce": dict(light="#FFD1A1", mid="#C8792B", dark="#55301A"),
    "plata": dict(light="#FFFFFF", mid="#BFC4CD", dark="#4A505B"),
    "oro": dict(light="#FFF1B8", mid="#E6A927", dark="#6B4A12"),
    "platino": dict(light="#F2FBFF", mid="#9FC3DA", dark="#2F4A5E"),
    "diamante": dict(light="#E6FDFF", mid="#4FD8FF", dark="#16467A"),
    "bloqueada": dict(light="#9DA1AB", mid="#5E626C", dark="#2A2C33"),
}
TIERS = ["bronce", "plata", "oro", "platino", "diamante"]


def acc(light, mid, dark, face):
    return dict(light=light, mid=mid, dark=dark, deep="#121318", face=face, text=light)


# ---------- acentos (tipo de medalla) ----------
ACC = {
    "victorias": acc("#86EFAC", "#22C55E", "#14532D", "#16301F"),   # verde: ganar
    "veterano": acc("#B9D3F0", "#5B8DC9", "#1E3A5F", "#16233A"),    # azul acero: años de servicio
    "fundador": acc("#FDA4AF", "#BE123C", "#4C0519", "#2E0E16"),    # bordó real: origen, exclusivo
    "hs": acc("#FCA5A5", "#EF4444", "#5F1414", "#311416"),          # rojo: tiro a la cabeza
    "kda": acc("#A5F3FC", "#06B6D4", "#0E4A57", "#0F2A31"),         # cian: eficiencia, sangre fría
    "clutch": acc("#F9A8D4", "#EC4899", "#5B1238", "#2F1224"),      # magenta: presión, adrenalina
    "aces": acc("#FDE68A", "#F59E0B", "#5C3A06", "#2E2210"),        # ámbar: la carta ganadora
    "elo": acc("#DDD6FE", "#8B5CF6", "#3B1F7A", "#221A3A"),         # violeta: rango, ascenso
    "campeon": acc("#FFF1B8", "#E6A927", "#6B4A12", "#2A2214"),     # oro: el título
    "finalista": acc("#F1F3F7", "#AEB4BF", "#3E434D", "#1E2128"),   # plata: segundo en la final
    "mvp": acc("#BFDBFE", "#2563EB", "#172F6B", "#141F3A"),         # azul real: el mejor de todos
    "top10": acc("#99F6E4", "#14B8A6", "#114E48", "#10292A"),       # verde agua: élite de la tabla
    "prestigio": acc("#E9D5FF", "#C026D3", "#3F0D52", "#24112E"),   # púrpura neón: reinicio con honor
    # habilidad (hexágono)
    "entry": acc("#FED7AA", "#F97316", "#5A2508", "#2E1A10"),       # naranja: el que abre la ronda
    "adr": acc("#A7F3D0", "#10B981", "#064E3B", "#0F2A22"),         # menta: daño constante
    "multikill": acc("#BFDBFE", "#3B82F6", "#14306B", "#131E36"),   # azul: 4 kills de una
    # arsenal y bomba (octágono)
    "awp": acc("#D9F99D", "#65A30D", "#1F3A0B", "#18240F"),         # verde: el cuerpo del AWP
    "scout": acc("#BAE6FD", "#38BDF8", "#0C3A5A", "#10222F"),       # celeste: liviana, saltando
    "deagle": acc("#FDE7B0", "#D6A35C", "#5A3C14", "#2A2116"),      # arena: Desert Eagle
    "rifles": acc("#FDBA74", "#B45309", "#4A2306", "#2A1A10"),      # madera: culata de la AK
    "cuchillo": acc("#FECACA", "#DC2626", "#4C0D0D", "#2C1213"),    # carmesí: humillación
    "he": acc("#FEF08A", "#EAB308", "#544006", "#2A2510"),          # amarillo: explosión
    "pistolas": acc("#E2E8F0", "#94A3B8", "#334155", "#1C222B"),    # acero: USP/Glock de la primera ronda
    "plantadas": acc("#FED7AA", "#EA580C", "#4F1D05", "#2C1810"),   # naranja T
    "desactivadas": acc("#BFDBFE", "#3B82F6", "#14306B", "#131E36"),  # azul CT
    # trayectoria (escudo)
    "racha": acc("#FEF08A", "#FACC15", "#5A4506", "#2C2610"),       # fuego
    # mapas (placa), color de cada mapa
    "dust2": acc("#FDE7B0", "#D9A85B", "#5C4016", "#2B2318"),
    "inferno": acc("#FDBA9A", "#C2410C", "#4A1806", "#2B1610"),
    "nuke": acc("#D9F99D", "#A3E635", "#365314", "#1F2810"),
    "train": acc("#BFDBFE", "#60A5FA", "#1E3A6B", "#141F33"),
    "cbble": acc("#E7E5E4", "#A8A29E", "#44403C", "#22201E"),
    "tuscan": acc("#D9E3A0", "#8A9A3B", "#33400F", "#1F2412"),        # verde oliva: cipreses de la Toscana
    "season": acc("#DDD6FE", "#A78BFA", "#3B2A73", "#211B36"),        # lavanda: estaciones
    "cache": acc("#FEF08A", "#FACC15", "#5A4506", "#2A2510"),         # amarillo industrial: contenedores
    "cpl_mirage": acc("#99F6E4", "#2DD4BF", "#0F4D45", "#10292A"),    # turquesa marroquí
    # comunidad (sello)
    "caster": acc("#DDD6FE", "#9146FF", "#2E1065", "#1E1533"),      # violeta stream
    "staff": acc("#A7F3D0", "#10B981", "#064E3B", "#0F2A22"),       # verde organización
    "aniversario": acc("#FBCFE8", "#F472B6", "#5B1838", "#2C1622"), # rosa festejo
    # equipos (banderín)
    "eq_partidas": acc("#BFDBFE", "#3B82F6", "#14306B", "#131E36"),
    "eq_semifinal": acc("#FFD1A1", "#C8792B", "#55301A", "#271B15"),
    "eq_participacion": acc("#E2E8F0", "#94A3B8", "#334155", "#1C222B"),
    "eq_invicto": acc("#FFFFFF", "#CBD5E1", "#334155", "#1E232B"),
    "eq_barrida": acc("#FECACA", "#EF4444", "#5F1414", "#311416"),
    "eq_remontada": acc("#D9F99D", "#84CC16", "#365314", "#1F2810"),
    "eq_matagigantes": acc("#FDE68A", "#F59E0B", "#5C3A06", "#2E2210"),
    "bloqueada": acc("#B5B9C2", "#5E626C", "#2A2C33", "#191A1F"),
}

K = "#0B0C10"  # contorno oscuro común


def inset(s):
    return f'transform="translate({CX*(1-s):.2f} {CY*(1-s):.2f}) scale({s})"'


def star(cx, cy, R, r=None, n=5):
    r = r or R * 0.48
    pts = []
    for i in range(n * 2):
        a = -math.pi / 2 + i * math.pi / n
        rad = R if i % 2 == 0 else r
        pts.append(f"{cx + rad*math.cos(a):.1f} {cy + rad*math.sin(a):.1f}")
    return "M" + " L".join(pts) + " Z"


def defs(shape, m, a, locked, glow):
    return f'''  <defs>
    <filter id="desenfoque" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="sombra-texto" x="-20%" y="-20%" width="140%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="1.6"/><feOffset dy="2.5" result="b"/>
      <feComponentTransfer><feFuncA type="linear" slope=".85"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{m['light']}"/><stop offset=".28" stop-color="{m['mid']}"/>
      <stop offset=".5" stop-color="{m['dark']}"/><stop offset=".68" stop-color="{m['mid']}"/>
      <stop offset=".82" stop-color="{m['light']}" stop-opacity=".9"/><stop offset="1" stop-color="{m['dark']}"/>
    </linearGradient>
    <linearGradient id="metal-vertical" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{m['light']}"/><stop offset=".55" stop-color="{m['mid']}"/><stop offset="1" stop-color="{m['dark']}"/>
    </linearGradient>
    <linearGradient id="acento" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{a['light']}"/><stop offset=".5" stop-color="{a['mid']}"/><stop offset="1" stop-color="{a['dark']}"/>
    </linearGradient>
    <radialGradient id="grad-cara" cx=".5" cy=".32" r=".75">
      <stop offset="0" stop-color="{a['dark']}"/><stop offset=".45" stop-color="{a['face']}"/><stop offset=".85" stop-color="#121318"/><stop offset="1" stop-color="#0A0B0E"/>
    </radialGradient>
    <linearGradient id="brillo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="{'.10' if locked else '.18'}"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="grad-aura" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="{a['mid']}" stop-opacity="{glow}"/><stop offset="1" stop-color="{a['mid']}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="patron-textura" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="3" height="8" fill="#FFFFFF" opacity=".035"/>
    </pattern>
    <clipPath id="recorte-forma"><path d="{SHAPES[shape]}"/></clipPath>{team_grad(locked) if shape == "banderin" else ""}
  </defs>'''


def rays():
    out = []
    for i in range(18):
        a, w, R = math.radians(i * 20), math.radians(4), 150
        out.append(f"M{CX} {CY} L{CX + R*math.cos(a-w):.1f} {CY + R*math.sin(a-w):.1f} L{CX + R*math.cos(a+w):.1f} {CY + R*math.sin(a+w):.1f} Z")
    return f'  <g id="rayos" opacity=".55"><path d="{" ".join(out)}" fill="url(#grad-aura)"/></g>'


def sparkles():
    pts = [(46, 52, 7), (218, 70, 9), (226, 196, 6), (36, 186, 5)]
    d = " ".join(f"M{x} {y-s} Q{x} {y} {x+s} {y} Q{x} {y} {x} {y+s} Q{x} {y} {x-s} {y} Q{x} {y} {x} {y-s} Z" for x, y, s in pts)
    return f'  <g id="destellos"><path d="{d}" fill="#FFFFFF" opacity=".9"/></g>'


def ribbon(a):
    return f'''  <g id="cinta">
    <path d="M76 8 L184 8 L198 30 L184 50 L76 50 L62 30 Z" fill="{a['dark']}" stroke="{K}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M90 9 L110 9 L114 49 L94 49 Z" fill="url(#acento)"/>
    <path d="M150 9 L170 9 L166 49 L146 49 Z" fill="url(#acento)"/>
    <path d="M119 9 L141 9 L139 49 L121 49 Z" fill="#0F1014"/>
    <path d="M128 9 L132 9 L131.5 49 L128.5 49 Z" fill="{a['mid']}" opacity=".8"/>
    <path d="M76 8 L184 8 L198 30 L184 50 L76 50 L62 30 Z" fill="url(#brillo)"/>
    <rect id="pasador" x="96" y="44" width="68" height="9" rx="4" fill="url(#metal)" stroke="{K}" stroke-width="2"/>
  </g>'''


def body(shape, m, a):
    P = SHAPES[shape]
    return f'''  <g id="forma-{shape}">
    <path id="sombra-forma" d="{P}" transform="translate(0 9)" fill="#000000" opacity=".55" filter="url(#desenfoque)"/>
    <path id="borde-exterior" d="{P}" fill="{K}" stroke="{K}" stroke-width="18" stroke-linejoin="round"/>
    <path id="marco-metal" d="{P}" fill="url(#metal)" stroke="url(#metal)" stroke-width="10" stroke-linejoin="round"/>
    <path id="filete-claro" d="{P}" {inset(0.94)} fill="none" stroke="{m['light']}" stroke-width="1.6" opacity=".55"/>
    <path id="cara" d="{P}" {inset(0.91)} fill="url(#grad-cara)" stroke="{K}" stroke-width="3"/>
    <path id="textura" d="{P}" {inset(0.91)} fill="url(#patron-textura)"/>
    <path id="filete-acento" d="{P}" {inset(0.85)} fill="none" stroke="{a['mid']}" stroke-width="1.5" opacity=".5"/>
    <g id="brillo-superior" clip-path="url(#recorte-forma)">
      <path d="M20 10 H240 V96 Q130 128 20 96 Z" fill="url(#brillo)"/>
    </g>
  </g>'''


def pill(label, a, y):
    fs = 15 if len(label) <= 3 else 11.5
    w = max(52, len(label) * (fs * 0.78) + 22)
    return f'''    <g id="etiqueta">
      <rect x="{130 - w/2:.1f}" y="{y}" width="{w:.1f}" height="22" rx="11" fill="{a['deep']}" stroke="{a['mid']}" stroke-width="2"/>
      <text x="130" y="{y + (16.5 if fs == 15 else 15.3)}" font-size="{fs}" font-weight="800" letter-spacing=".8" fill="{a['text']}">{label}</text>
    </g>'''


def number(txt, cy, locked, k=1.0):
    fs = round({1: 74, 2: 66, 3: 58, 4: 50, 5: 42}[len(txt)] * k)
    fill = "#A9ADB7" if locked else "#FFFFFF"
    return f'    <text id="numero" x="130" y="{cy + fs*0.35:.0f}" font-size="{fs}" font-weight="900" letter-spacing="-2" fill="{fill}" filter="url(#sombra-texto)">{txt}</text>'


def pips(total, on, y, m):
    if total <= 1:
        return ""
    gap = 13
    x0 = 130 - gap * (total - 1) / 2
    out = []
    for i in range(total):
        x = x0 + i * gap
        fill = "url(#metal-vertical)" if i < on else "#24262D"
        out.append(f'<path d="M{x:.1f} {y-5} L{x+5:.1f} {y} L{x:.1f} {y+5} L{x-5:.1f} {y} Z" fill="{fill}" stroke="{K}" stroke-width="1.5"/>')
    return f'  <g id="puntos-nivel">{"".join(out)}</g>'


def lock_badge(cy=252):
    return f'''  <g id="candado">
    <circle cx="130" cy="{cy}" r="21" fill="{K}"/>
    <circle cx="130" cy="{cy}" r="17.5" fill="#1C1D23" stroke="#7D818B" stroke-width="2.5"/>
    <path d="M123.5 {cy-2} V{cy-7} Q123.5 {cy-14} 130 {cy-14} Q136.5 {cy-14} 136.5 {cy-7} V{cy-2}" fill="none" stroke="#C3C6CE" stroke-width="3.2" stroke-linecap="round"/>
    <rect x="120" y="{cy-3}" width="20" height="15" rx="3" fill="#C3C6CE"/>
    <path d="M130 {cy+2} V{cy+7}" stroke="#1C1D23" stroke-width="2.6" stroke-linecap="round"/>
  </g>'''


# ---------- iconos (caja aprox. 100..160 x 178..230, centro 130,204) ----------
S = f'fill="url(#acento)" stroke="{K}" stroke-width="2.5" stroke-linejoin="round"'


def ic_bandera():
    return f'''<rect x="106" y="182" width="6" height="46" rx="2" {S}/>
    <circle cx="109" cy="180" r="4.5" {S}/>
    <path d="M112 185 Q125 177 138 185 Q150 193 160 186 V209 Q150 216 138 208 Q125 200 112 208 Z" {S}/>
    <path d="M124 183 V203 M136 185 V206 M148 190 V211 M112 196 Q125 188 138 196 Q150 204 160 197" fill="none" stroke="{K}" stroke-width="1.5" opacity=".45"/>'''


def ic_placas():
    tag = "M114 184 Q114 180 118 180 H142 Q146 180 146 184 V220 Q146 227 139 227 H121 Q114 227 114 220 Z"
    return f'''<path d="{tag}" transform="rotate(14 130 204) translate(8 -2)" fill="#2A2D35" stroke="{K}" stroke-width="2.5"/>
    <path d="{tag}" transform="rotate(-8 130 204)" {S}/>
    <g transform="rotate(-8 130 204)" fill="{K}" opacity=".55"><circle cx="130" cy="186" r="2.8"/><rect x="120" y="196" width="20" height="2.6" rx="1"/><rect x="120" y="203" width="16" height="2.6" rx="1"/><rect x="120" y="210" width="18" height="2.6" rx="1"/></g>
    <path d="M128 185 Q118 170 104 176" fill="none" stroke="{K}" stroke-width="5" stroke-dasharray="1 4" stroke-linecap="round"/>
    <path d="M128 185 Q118 170 104 176" fill="none" stroke="#C9CDD6" stroke-width="2.6" stroke-dasharray="1 4" stroke-linecap="round"/>'''


def ic_llave():
    ring = "M98 204 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0 Z M104.5 204 a5.5 5.5 0 1 0 11 0 a5.5 5.5 0 1 0 -11 0 Z"
    shaft = "M121 200 H163 V208 H159 V218 H153 V208 H149 V215 H143 V208 H121 Z"
    return f'<g transform="rotate(-18 130 206)"><path d="{ring} {shaft}" fill-rule="evenodd" {S}/></g>'


def ic_mira():
    ring = "M110 204 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0 Z M115.5 204 a14.5 14.5 0 1 0 29 0 a14.5 14.5 0 1 0 -29 0 Z"
    ticks = "M127.5 178 H132.5 V193 H127.5 Z M127.5 215 H132.5 V230 H127.5 Z M104 201.5 V206.5 H119 V201.5 Z M141 201.5 V206.5 H156 V201.5 Z"
    return f'''<path d="{ring} {ticks}" fill-rule="evenodd" {S}/>
    <circle cx="130" cy="204" r="4" fill="#FFFFFF" stroke="{K}" stroke-width="2"/>'''


def ic_calavera():
    sk = "M130 179 C113 179 104 190 104 202 C104 210 108 214 114 216 V224 Q114 228 118 228 H142 Q146 228 146 224 V216 C152 214 156 210 156 202 C156 190 147 179 130 179 Z"
    return f'''<path d="{sk}" {S}/>
    <g fill="{K}"><ellipse cx="120" cy="201" rx="6" ry="6.5"/><ellipse cx="140" cy="201" rx="6" ry="6.5"/><path d="M130 207 L126 214 H134 Z"/>
    <rect x="121.5" y="219" width="2.2" height="9"/><rect x="128.9" y="219" width="2.2" height="9"/><rect x="136.3" y="219" width="2.2" height="9"/></g>'''


def ic_c4():
    return f'''<path d="M108 186 Q106 176 116 176" fill="none" stroke="#E5484D" stroke-width="2.5"/>
    <path d="M114 186 Q114 172 126 174" fill="none" stroke="#3B82F6" stroke-width="2.5"/>
    <rect x="100" y="184" width="60" height="40" rx="5" {S}/>
    <rect x="106" y="190" width="30" height="13" rx="2" fill="#0E1A12" stroke="{K}" stroke-width="1.5"/>
    <text x="121" y="200.5" font-family="Consolas, monospace" font-size="9.5" font-weight="700" text-anchor="middle" fill="#5BFF8A">0:03</text>
    <g fill="{K}" opacity=".7"><rect x="140" y="190" width="5" height="4"/><rect x="148" y="190" width="5" height="4"/><rect x="140" y="197" width="5" height="4"/><rect x="148" y="197" width="5" height="4"/><rect x="140" y="204" width="5" height="4"/><rect x="148" y="204" width="5" height="4"/></g>
    <path d="M100 211 H160 M100 217 H160" stroke="{K}" stroke-width="1.6" opacity=".5"/>'''


def ic_carta():
    card = "M112 178 H148 Q153 178 153 183 V225 Q153 230 148 230 H112 Q107 230 107 225 V183 Q107 178 112 178 Z"
    spade = "M130 189 C122 198 115 202 115 209 C115 215 121 218 127 214 L124 222 H136 L133 214 C139 218 145 215 145 209 C145 202 138 198 130 189 Z"
    return f'''<path d="{card}" transform="rotate(14 130 204) translate(6 0)" fill="#2A2D35" stroke="{K}" stroke-width="2.5"/>
    <g transform="rotate(-8 130 204)"><path d="{card}" {S}/>
    <path d="{spade}" fill="{K}"/>
    <text x="113.5" y="190" font-family="Montserrat, Arial, sans-serif" font-size="10" font-weight="900" fill="{K}">A</text></g>'''


def ic_grafico():
    return f'''<g {S}><rect x="102" y="212" width="12" height="16" rx="2"/><rect x="118" y="204" width="12" height="24" rx="2"/><rect x="134" y="194" width="12" height="34" rx="2"/></g>
    <path d="M100 202 L118 190 L130 195 L152 180" fill="none" stroke="{K}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M100 202 L118 190 L130 195 L152 180" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M144 176 L160 174 L156 190 Z" fill="#FFFFFF" stroke="{K}" stroke-width="2.5" stroke-linejoin="round"/>'''


def ic_copa():
    cup = "M110 178 H150 V184 Q150 206 130 212 Q110 206 110 184 Z"
    handles = "M110 184 H100 Q99 200 114 203 M150 184 H160 Q161 200 146 203"
    return f'''<path d="{handles}" fill="none" stroke="{K}" stroke-width="8" stroke-linecap="round"/>
    <path d="{handles}" fill="none" stroke="url(#acento)" stroke-width="4.5" stroke-linecap="round"/>
    <g {S}><path d="{cup}"/><path d="M125 212 H135 L137 222 H123 Z"/><path d="M114 222 H146 Q148 222 148 225 V230 H112 V225 Q112 222 114 222 Z"/></g>
    <path d="M115 182 Q115 198 124 205" fill="none" stroke="#FFFFFF" stroke-width="2" opacity=".5" stroke-linecap="round"/>
    <path d="{star(130, 193, 7.5)}" fill="#FFFFFF" opacity=".9"/>'''


def ic_espadas():
    sword = f'''<path d="M130 172 L135 179 V212 H125 V179 Z" {S}/><path d="M116 212 H144 V218 H116 Z" {S}/>
      <path d="M127.5 218 H132.5 V228 H127.5 Z" {S}/><circle cx="130" cy="231" r="3.5" {S}/>'''
    return f'<g transform="rotate(-38 130 206)">{sword}</g><g transform="rotate(38 130 206)">{sword}</g>'


def ic_estrella():
    return f'''<path d="{star(130, 204, 26)}" {S}/>
    <path d="{star(130, 204, 14)}" fill="#FFFFFF" opacity=".35"/>'''


def ic_podio():
    return f'''<g {S}><rect x="102" y="206" width="19" height="22" rx="2"/><rect x="120.5" y="196" width="19" height="32" rx="2"/><rect x="139" y="212" width="19" height="16" rx="2"/></g>
    <path d="{star(130, 184, 9)}" fill="#FFFFFF" stroke="{K}" stroke-width="2"/>
    <g font-family="Montserrat, Arial, sans-serif" font-size="9" font-weight="900" text-anchor="middle" fill="{K}" opacity=".7"><text x="111.5" y="219">2</text><text x="130" y="209">1</text><text x="148.5" y="223">3</text></g>'''


def ic_gema():
    return f'''<path d="M112 192 L121 181 H139 L148 192 L130 228 Z" {S}/>
    <path d="M112 192 H148 M121 181 L126 192 L130 228 L134 192 L139 181" fill="none" stroke="{K}" stroke-width="1.6" opacity=".6"/>
    <path d="M121 181 L126 192 H112 Z" fill="#FFFFFF" opacity=".45"/>'''


def team_grad(locked):
    a, b = ("#7D818B", "#C3C6CE") if locked else ("#FF5722", "#FFB088")
    return f'''
    <!-- color-equipo: cambiá estos dos colores por los del equipo -->
    <linearGradient id="color-equipo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{b}"/><stop offset="1" stop-color="{a}"/>
    </linearGradient>'''


def ic_reloj():
    return f'''<path d="M110 177 H150 V183 H110 Z M110 225 H150 V231 H110 Z" {S}/>
    <path d="M114 183 H146 Q146 198 134 204 Q146 210 146 225 H114 Q114 210 126 204 Q114 198 114 183 Z" {S}/>
    <path d="M120 190 H140 Q138 197 130 201 Q122 197 120 190 Z M130 207 L141 222 H119 Z" fill="#FFFFFF" opacity=".75"/>'''


def ic_rayo():
    return f'<path d="M138 175 L110 208 H127 L120 233 L152 196 H134 Z" {S}/>'


def ic_medidor():
    return f'''<path d="M102 218 A28 28 0 0 1 158 218 H146 A16 16 0 0 0 114 218 Z" {S}/>
    <path d="M106 210 L112 212 M115 196 L119 200 M130 190 V196 M145 196 L141 200 M154 210 L148 212" stroke="{K}" stroke-width="2" opacity=".7"/>
    <path d="M130 218 L150 196" stroke="{K}" stroke-width="7" stroke-linecap="round"/>
    <path d="M130 218 L150 196" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="130" cy="218" r="6" fill="#FFFFFF" stroke="{K}" stroke-width="2.5"/>
    <rect x="104" y="222" width="52" height="7" rx="3" {S}/>'''


def ic_balas(n=4):
    out = []
    x0 = 130 - (n * 12 + (n - 1) * 3) / 2
    for i in range(n):
        x = x0 + i * 15
        out.append(f"M{x:.1f} 228 V200 Q{x:.1f} 186 {x+6:.1f} 180 Q{x+12:.1f} 186 {x+12:.1f} 200 V228 Z")
    lines = " ".join(f"M{x0 + i*15:.1f} 210 H{x0 + i*15 + 12:.1f}" for i in range(n))
    return f'''<path d="{" ".join(out)}" {S}/>
    <path d="{lines}" stroke="{K}" stroke-width="2" opacity=".6"/>'''


def ic_llama():
    return f'''<path d="M131 174 Q150 192 149 210 Q148 230 130 230 Q111 230 111 211 Q111 198 121 188 Q121 202 128 205 Q123 189 131 174 Z" {S}/>
    <path d="M131 200 Q141 210 139 220 Q137 228 130 228 Q122 228 122 220 Q122 212 128 207 Q129 214 132 214 Q130 207 131 200 Z" fill="#FFFFFF" opacity=".7"/>'''


# --- armas (siluetas laterales) ---
def ic_awp():
    return f'''<path d="M96 208 L104 200 H118 V198 H150 V201 H165 V205 H150 L146 210 H124 L120 216 H112 L114 210 H106 L98 216 Z" {S}/>
    <rect x="118" y="188" width="24" height="7" rx="3" {S}/>
    <path d="M124 195 V198 M136 195 V198" stroke="{K}" stroke-width="3"/>
    <circle cx="142" cy="191.5" r="2" fill="#FFFFFF" opacity=".8"/>'''


def ic_scout():
    return f'''<path d="M100 207 L106 201 H122 V200 H148 V202 H162 V205 H148 L144 208 H126 L122 214 H116 L118 208 H108 L102 213 Z" {S}/>
    <rect x="124" y="192" width="16" height="5.5" rx="2.5" {S}/>
    <path d="M128 197.5 V200 M136 197.5 V200" stroke="{K}" stroke-width="2.5"/>
    <path d="M150 205 L146 222 M152 205 L158 222" stroke="{K}" stroke-width="5" stroke-linecap="round"/>
    <path d="M150 205 L146 222 M152 205 L158 222" stroke="url(#acento)" stroke-width="2.5" stroke-linecap="round"/>'''


def ic_deagle():
    return f'''<path d="M106 192 H158 V206 H134 L130 210 L134 228 H118 L114 210 Q106 207 106 200 Z" {S}/>
    <path d="M130 210 Q130 218 138 218 V210" fill="none" stroke="{K}" stroke-width="2.5"/>
    <path d="M112 197 H154" stroke="#FFFFFF" stroke-width="2" opacity=".5"/>
    <path d="M140 192 V206 M146 192 V206" stroke="{K}" stroke-width="1.5" opacity=".5"/>'''


def ic_ak():
    return f'''<path d="M96 204 L106 198 H146 V200 H164 V204 H146 L142 207 H130 L122 207 L116 212 H104 L98 212 Z" {S}/>
    <path d="M128 207 Q129 218 138 224 L144 219 Q137 214 136 207 Z" {S}/>
    <path d="M118 207 L120 216 H126 L124 207" {S}/>
    <path d="M148 198 V194 H151 V198" fill="none" stroke="{K}" stroke-width="2"/>'''


def ic_cuchillo():
    return f'''<g transform="rotate(-35 130 204)">
      <path d="M126 168 Q142 180 137 208 H124 Z" {S}/>
      <path d="M126 172 Q136 182 133 204" fill="none" stroke="#FFFFFF" stroke-width="1.6" opacity=".6"/>
      <rect x="116" y="207" width="28" height="6" rx="2" {S}/>
      <rect x="125" y="213" width="10" height="22" rx="3" {S}/>
    </g>'''


def ic_he():
    return f'''<path d="M118 196 Q118 190 124 190 H136 Q142 190 142 196 V222 Q142 230 130 230 Q118 230 118 222 Z" {S}/>
    <rect x="122" y="182" width="16" height="9" rx="2" {S}/>
    <path d="M138 185 Q150 186 152 204 Q152 210 147 212" fill="none" stroke="{K}" stroke-width="6" stroke-linecap="round"/>
    <path d="M138 185 Q150 186 152 204 Q152 210 147 212" fill="none" stroke="url(#acento)" stroke-width="3" stroke-linecap="round"/>
    <circle cx="117" cy="183" r="6" fill="none" stroke="{K}" stroke-width="5"/><circle cx="117" cy="183" r="6" fill="none" stroke="#C9CDD6" stroke-width="2.4"/>
    <path d="M118 205 H142 M118 215 H142" stroke="{K}" stroke-width="1.8" opacity=".55"/>'''


def ic_usp():
    return f'''<path d="M100 194 H138 V206 H122 L118 209 L121 226 H107 L104 209 Q100 206 100 200 Z" {S}/>
    <rect x="137" y="194.5" width="26" height="10" rx="3" {S}/>
    <path d="M118 209 Q118 216 126 216 V206" fill="none" stroke="{K}" stroke-width="2.4"/>
    <path d="M143 194.5 V204.5 M149 194.5 V204.5 M155 194.5 V204.5" stroke="{K}" stroke-width="1.4" opacity=".5"/>'''


def ic_c4b():
    return ic_c4()


def ic_pinzas():
    return f'''<rect x="100" y="186" width="60" height="40" rx="6" fill="#2A2D35" stroke="{K}" stroke-width="2.5"/>
    <path d="M100 196 H160" stroke="{K}" stroke-width="2" opacity=".6"/>
    <g transform="rotate(-25 130 206)">
      <path d="M124 178 Q122 196 128 204 L132 204 Q130 192 132 178 Z M136 178 Q138 196 132 204 L128 204 Q130 192 128 178 Z" {S}/>
      <path d="M126 206 Q118 220 114 234 L121 235 Q124 222 130 210 Z M134 206 Q142 220 146 234 L139 235 Q136 222 130 210 Z" {S}/>
      <circle cx="130" cy="206" r="3.5" fill="#FFFFFF" stroke="{K}" stroke-width="2"/>
    </g>'''


# --- mapas ---
def ic_dust2():
    return f'''<path d="M100 230 V196 Q100 176 120 176 H140 Q160 176 160 196 V230 H148 V198 Q148 190 140 190 H120 Q112 190 112 198 V230 Z" {S}/>
    <path d="M112 230 V198 Q112 190 120 190 H140 Q148 190 148 198 V230 Z" fill="#0F1014" opacity=".75"/>
    <path d="M118 230 V206 M142 230 V206 M118 206 H142" stroke="{K}" stroke-width="2" opacity=".6"/>
    <path d="M100 186 H160" stroke="{K}" stroke-width="1.6" opacity=".45"/>'''


def ic_inferno():
    return f'''<path d="M130 172 V178" stroke="{K}" stroke-width="4"/><circle cx="130" cy="172" r="3.5" {S}/>
    <path d="M130 178 Q116 180 115 197 Q114 212 104 220 H156 Q146 212 145 197 Q144 180 130 178 Z" {S}/>
    <rect x="102" y="219" width="56" height="6" rx="3" {S}/>
    <circle cx="130" cy="229" r="5" {S}/>
    <path d="M121 186 Q119 200 117 210" fill="none" stroke="#FFFFFF" stroke-width="2" opacity=".5" stroke-linecap="round"/>'''


def ic_nuke():
    blades = []
    for a in (-90, 30, 150):
        a1, a2 = math.radians(a - 30), math.radians(a + 30)
        r1, r2 = 9, 26
        blades.append(f"M{130 + r1*math.cos(a1):.1f} {204 + r1*math.sin(a1):.1f} L{130 + r2*math.cos(a1):.1f} {204 + r2*math.sin(a1):.1f} "
                      f"A{r2} {r2} 0 0 1 {130 + r2*math.cos(a2):.1f} {204 + r2*math.sin(a2):.1f} L{130 + r1*math.cos(a2):.1f} {204 + r1*math.sin(a2):.1f} "
                      f"A{r1} {r1} 0 0 0 {130 + r1*math.cos(a1):.1f} {204 + r1*math.sin(a1):.1f} Z")
    return f'''<circle cx="130" cy="204" r="30" fill="#0F1014" stroke="{K}" stroke-width="2.5"/>
    <path d="{" ".join(blades)}" {S}/>
    <circle cx="130" cy="204" r="5.5" {S}/>'''


def ic_train():
    return f'''<rect x="108" y="176" width="44" height="44" rx="9" {S}/>
    <rect x="113" y="182" width="34" height="15" rx="3" fill="#0F1014" stroke="{K}" stroke-width="1.5"/>
    <circle cx="117" cy="209" r="3.5" fill="#FFFFFF"/><circle cx="143" cy="209" r="3.5" fill="#FFFFFF"/>
    <rect x="124" y="205" width="12" height="8" rx="2" fill="{K}" opacity=".5"/>
    <path d="M114 220 L106 231 M146 220 L154 231 M100 231 H160" stroke="{K}" stroke-width="5" stroke-linecap="round"/>
    <path d="M114 220 L106 231 M146 220 L154 231" stroke="url(#acento)" stroke-width="2.4" stroke-linecap="round"/>'''


def ic_cbble():
    return f'''<path d="M106 230 V190 H110 V180 H118 V188 H125 V180 H135 V188 H142 V180 H150 V190 H154 V230 Z" {S}/>
    <path d="M123 230 V215 Q130 205 137 215 V230 Z" fill="#0F1014"/>
    <path d="M106 200 H154 M106 212 H123 M137 212 H154 M118 190 V200 M142 190 V200 M130 200 V206" stroke="{K}" stroke-width="1.6" opacity=".5"/>
    <rect x="127" y="190" width="6" height="7" rx="1" fill="#0F1014"/>'''


def ic_aztec():
    return f'''<path d="M98 230 H162 L156 220 H104 Z M106 218 H154 L149 208 H111 Z M113 206 H147 L142 196 H118 Z M120 194 H140 V182 H120 Z" {S}/>
    <path d="M125 194 V187 H135 V194" fill="#0F1014"/>
    <path d="M126 230 V196 H134 V230" fill="none" stroke="{K}" stroke-width="1.6" opacity=".5"/>'''


def ic_tuscan():
    return f'''<path d="M98 231 Q116 214 134 222 Q150 214 162 231 Z" {S}/>
    <path d="M124 222 V227 M143 222 V227" stroke="{K}" stroke-width="4"/>
    <path d="M124 174 Q133 192 132 212 Q132 222 124 222 Q116 222 116 212 Q115 192 124 174 Z" {S}/>
    <path d="M143 186 Q150 200 150 214 Q150 222 143 222 Q136 222 136 214 Q136 200 143 186 Z" {S}/>
    <path d="M122 184 Q119 198 119 210" fill="none" stroke="#FFFFFF" stroke-width="1.8" opacity=".5" stroke-linecap="round"/>'''


def ic_season():
    return f'''<path d="M130 175 Q156 186 154 210 Q152 226 130 231 Q108 226 106 210 Q104 186 130 175 Z" {S}/>
    <path d="M130 182 V229 M130 196 L118 188 M130 196 L142 188 M130 208 L114 200 M130 208 L146 200 M130 219 L118 212 M130 219 L142 212" stroke="{K}" stroke-width="2" opacity=".55" stroke-linecap="round"/>'''


def ic_cache():
    stripes = " ".join(f"M{x} 226 L{x+6} 216 H{x+12} L{x+6} 226 Z" for x in range(100, 156, 12))
    return f'''<rect x="100" y="182" width="60" height="44" rx="3" {S}/>
    <path d="M110 186 V213 M120 186 V213 M130 186 V213 M140 186 V213 M150 186 V213" stroke="{K}" stroke-width="2" opacity=".5"/>
    <path d="M100 215 H160" stroke="{K}" stroke-width="2.5"/>
    <g><path d="{stripes}" fill="{K}" opacity=".8"/></g>'''


def ic_mirage():
    return f'''<path d="M130 172 V182" stroke="{K}" stroke-width="3.5"/><circle cx="130" cy="171" r="3" {S}/>
    <path d="M112 206 Q112 186 130 182 Q148 186 148 206 Z" {S}/>
    <rect x="102" y="205" width="56" height="25" rx="2" {S}/>
    <path d="M110 230 V218 Q110 212 115 212 Q120 212 120 218 V230 Z M125 230 V216 Q125 210 130 210 Q135 210 135 216 V230 Z M140 230 V218 Q140 212 145 212 Q150 212 150 218 V230 Z" fill="#0F1014"/>
    <path d="M118 202 Q118 190 128 186" fill="none" stroke="#FFFFFF" stroke-width="1.8" opacity=".5" stroke-linecap="round"/>'''


MAP_ICONS = {"dust2": ic_dust2, "inferno": ic_inferno, "tuscan": ic_tuscan, "nuke": ic_nuke, "season": ic_season,
             "cbble": ic_cbble, "cache": ic_cache, "train": ic_train, "cpl_mirage": ic_mirage}


# --- comunidad ---
def ic_microfono():
    return f'''<path d="M112 198 Q112 218 130 218 Q148 218 148 198" fill="none" stroke="{K}" stroke-width="7" stroke-linecap="round"/>
    <path d="M112 198 Q112 218 130 218 Q148 218 148 198" fill="none" stroke="url(#acento)" stroke-width="3.5" stroke-linecap="round"/>
    <rect x="119" y="174" width="22" height="36" rx="11" {S}/>
    <path d="M119 186 H141 M119 193 H141 M119 200 H141" stroke="{K}" stroke-width="1.6" opacity=".55"/>
    <path d="M130 218 V228 M118 230 H142" stroke="{K}" stroke-width="5" stroke-linecap="round"/>'''


def ic_portapapeles():
    return f'''<rect x="108" y="181" width="44" height="49" rx="5" {S}/>
    <rect x="119" y="176" width="22" height="10" rx="3" fill="#C9CDD6" stroke="{K}" stroke-width="2.2"/>
    <path d="M117 207 L126 216 L144 196" fill="none" stroke="{K}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M117 207 L126 216 L144 196" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>'''


def ic_torta():
    return f'''<rect x="104" y="208" width="52" height="20" rx="4" {S}/>
    <rect x="111" y="194" width="38" height="15" rx="4" {S}/>
    <path d="M104 216 Q111 222 117 216 Q123 222 130 216 Q137 222 143 216 Q149 222 156 216" fill="none" stroke="#FFFFFF" stroke-width="2" opacity=".7"/>
    <rect x="127.5" y="181" width="5" height="13" rx="1.5" fill="#FFFFFF" stroke="{K}" stroke-width="1.6"/>
    <path d="M130 172 Q135 178 130 182 Q125 178 130 172 Z" fill="#FDE047" stroke="{K}" stroke-width="1.4"/>'''


# --- equipos ---
def ic_auriculares():
    return f'''<path d="M108 208 Q108 180 130 180 Q152 180 152 208" fill="none" stroke="{K}" stroke-width="8" stroke-linecap="round"/>
    <path d="M108 208 Q108 180 130 180 Q152 180 152 208" fill="none" stroke="url(#acento)" stroke-width="4" stroke-linecap="round"/>
    <rect x="100" y="200" width="14" height="24" rx="5" {S}/><rect x="146" y="200" width="14" height="24" rx="5" {S}/>
    <path d="M107 222 Q110 230 124 230" fill="none" stroke="{K}" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="125" cy="230" r="3.5" {S}/>'''


def ic_calendario():
    dots = "".join(f'<rect x="{112 + c*10}" y="{201 + r*9}" width="6" height="5" rx="1"/>' for r in range(3) for c in range(4))
    return f'''<rect x="106" y="182" width="48" height="46" rx="5" {S}/>
    <path d="M106 194 H154" stroke="{K}" stroke-width="2.5"/>
    <path d="M118 177 V188 M142 177 V188" stroke="{K}" stroke-width="6" stroke-linecap="round"/>
    <path d="M118 177 V188 M142 177 V188" stroke="#C9CDD6" stroke-width="2.6" stroke-linecap="round"/>
    <g fill="{K}" opacity=".55">{dots}</g>'''


def ic_plantel():
    def person(x, y, k):
        return (f'<circle cx="{x}" cy="{y}" r="{6*k:.1f}"/>'
                f'<path d="M{x-11*k:.1f} {y+22*k:.1f} Q{x-11*k:.1f} {y+8*k:.1f} {x} {y+8*k:.1f} Q{x+11*k:.1f} {y+8*k:.1f} {x+11*k:.1f} {y+22*k:.1f} Z"/>')
    back = person(112, 190, .85) + person(148, 190, .85)
    front = person(120, 200, 1) + person(140, 200, 1)
    mid = person(130, 192, 1.1)
    return f'''<g fill="#2A2D35" stroke="{K}" stroke-width="2">{back}</g>
    <g {S}>{front}</g>
    <g {S}>{mid}</g>'''


def ic_medalla():
    return f'''<path d="M118 176 L130 196 L142 176 H134 L130 184 L126 176 Z" fill="{K}"/>
    <path d="M116 176 H126 L134 194 L126 198 Z M144 176 H134 L126 194 L134 198 Z" {S}/>
    <circle cx="130" cy="210" r="17" {S}/>
    <circle cx="130" cy="210" r="11" fill="none" stroke="{K}" stroke-width="1.6" opacity=".55"/>
    <text x="130" y="215" font-family="Montserrat, Arial, sans-serif" font-size="13" font-weight="900" text-anchor="middle" fill="{K}" opacity=".8">3</text>'''


def ic_ticket():
    return f'''<path d="M102 188 H158 V198 Q152 198 152 204 Q152 210 158 210 V220 H102 V210 Q108 210 108 204 Q108 198 102 198 Z" transform="rotate(-10 130 204)" {S}/>
    <path d="M140 190 V218" transform="rotate(-10 130 204)" stroke="{K}" stroke-width="2" stroke-dasharray="3 3"/>
    <path d="{star(122, 204, 7)}" transform="rotate(-10 130 204)" fill="#FFFFFF" opacity=".85"/>'''


def ic_corona(n=0):
    xs = {0: [], 2: [120, 140], 3: [112, 130, 148]}[n]
    st = "".join(f'<path d="{star(x, 171 if x == 130 else 173, 6.5)}" fill="#FFFFFF" stroke="{K}" stroke-width="1.8"/>' for x in xs)
    return st + f'''<g {S}><path d="M100 188 L112 202 L130 180 L148 202 L160 188 L155 220 H105 Z"/><path d="M105 220 H155 V228 H105 Z"/>
    <circle cx="100" cy="187" r="3.5"/><circle cx="130" cy="178" r="4"/><circle cx="160" cy="187" r="3.5"/></g>
    <circle cx="130" cy="209" r="4.5" fill="#FFFFFF" opacity=".9"/><circle cx="114" cy="212" r="3" fill="#FFFFFF" opacity=".7"/><circle cx="146" cy="212" r="3" fill="#FFFFFF" opacity=".7"/>'''


def ic_escudo_check():
    return f'''<path d="M108 182 Q108 178 112 178 H148 Q152 178 152 182 V200 Q152 220 130 230 Q108 220 108 200 Z" {S}/>
    <path d="M118 203 L127 212 L143 194" fill="none" stroke="{K}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M118 203 L127 212 L143 194" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>'''


def ic_marcador(txt):
    return f'''<rect x="98" y="186" width="64" height="36" rx="6" {S}/>
    <rect x="103" y="191" width="54" height="26" rx="3" fill="#0F1014"/>
    <text x="130" y="211.5" font-family="Montserrat, Arial, sans-serif" font-size="19" font-weight="900" letter-spacing="-.5" text-anchor="middle" fill="#FFFFFF">{txt}</text>'''


def ic_remontada():
    return f'''<path d="M104 224 Q108 196 128 202 Q146 207 148 186" fill="none" stroke="{K}" stroke-width="11" stroke-linecap="round"/>
    <path d="M104 224 Q108 196 128 202 Q146 207 148 186" fill="none" stroke="url(#acento)" stroke-width="6" stroke-linecap="round"/>
    <path d="M138 186 L149 172 L160 187 Z" {S}/>'''


def ic_matagigantes():
    return f'''<g transform="rotate(-14 130 210)">{ic_corona()}</g>
    <path d="M131 178 L126 194 L134 200 L127 216 L132 230" fill="none" stroke="{K}" stroke-width="4" stroke-linejoin="round"/>'''


def ic_muro():
    rows = []
    for r in range(4):
        y = 184 + r * 11
        off = 0 if r % 2 == 0 else 8
        x = 100 - off
        while x < 160:
            x1, x2 = max(x, 100), min(x + 16, 160)
            rows.append(f'<rect x="{x1}" y="{y}" width="{x2 - x1 - 1}" height="10" rx="1.5"/>')
            x += 16
    return f'<g {S.replace("2.5", "1.8")}>{"".join(rows)}</g>'


def ic_rifles_cruzados():
    ak = ic_ak()
    return f'<g transform="translate(130 204) rotate(-32) scale(.85) translate(-130 -204)">{ak}</g><g transform="translate(130 204) scale(-1 1) rotate(-32) scale(.85) translate(-130 -204)">{ak}</g>'


def ic_estrellas3():
    return f'<path d="{star(108, 212, 12)} {star(130, 196, 15)} {star(152, 212, 12)}" {S}/>'

# Siluetas vectoriales extraídas de las fuentes del juego (csd.ttf / cs.ttf de CSSv34_ClientMod).
# (path, bbox xmin, ymin, xmax, ymax en unidades de la fuente; y invertida)
GLYPHS = {
    "awp": ("M1234 -893 Q1235 -891 1236 -888 Q1237 -886 1238.0 -883.5 Q1239 -881 1239 -878 Q1239 -874 1234 -866 L1233 -864 L785 -864 L785 -858 L785 -856 L788 -856 L818 -856 L818 -828 Q823 -823 823 -823 Q826 -820 826 -813 Q826 -811 825.5 -810.5 Q825 -810 825 -809 L825 -807 Q825 -802 823 -802 Q822 -802 819.0 -802.0 Q816 -802 799.5 -802.0 Q783 -802 748.5 -802.0 Q714 -802 650 -802 Q648 -801 648 -798 Q649 -798 650 -797 L653 -794 L651 -788 L634 -788 L632 -790 Q631 -792 626.5 -802.0 Q622 -812 626 -818 Q626 -823 631 -823 L632 -823 Q642 -823 645 -820 Q651 -820 659 -824 L577 -824 Q576 -824 567.0 -821.5 Q558 -819 547.5 -816.0 Q537 -813 527.5 -810.5 Q518 -808 517 -807 L517 -778 L421 -767 L421 -798 Q413 -798 412 -796 Q410 -794 405.0 -790.0 Q400 -786 392.0 -783.5 Q384 -781 373.0 -782.0 Q362 -783 348 -791 Q347 -791 346.0 -790.5 Q345 -790 343 -790 Q343 -785 342.5 -777.0 Q342 -769 340.0 -760.5 Q338 -752 335.0 -745.0 Q332 -738 328 -736 Q323 -733 309.0 -734.0 Q295 -735 279.5 -737.5 Q264 -740 251.0 -743.0 Q238 -746 235 -748 Q232 -750 223 -761 Q217 -766 210.5 -771.5 Q204 -777 202 -778 L147 -778 Q144 -755 143.0 -751.0 Q142 -747 140 -747 Q139 -745 135.5 -745.0 Q132 -745 121 -747 Q113 -747 104.0 -747.5 Q95 -748 93 -747 Q90 -747 84.5 -746.0 Q79 -745 72 -744 Q66 -742 58.0 -741.0 Q50 -740 48 -739 L46 -739 L45 -739 Q44 -739 43.5 -740.5 Q43 -742 43.0 -747.0 Q43 -752 43.0 -763.5 Q43 -775 43 -796 Q45 -815 45.0 -834.0 Q45 -853 45 -861 Q45 -865 53.0 -868.5 Q61 -872 91 -871 L102 -871 L103 -872 Q104 -873 104.5 -873.0 Q105 -873 106 -874 Q108 -875 110 -877 L210 -877 Q213 -876 217 -873 Q224 -868 228 -861 L342 -861 Q343 -865 345.0 -871.5 Q347 -878 347 -882 L347 -885 L348 -885 Q353 -886 364.5 -887.0 Q376 -888 378 -890 Q380 -890 382 -891 Q383 -892 385 -893 L420 -893 L420 -904 L407 -904 Q405 -904 396.5 -902.5 Q388 -901 376.5 -899.5 Q365 -898 353.0 -897.5 Q341 -897 332 -899 L331 -901 L331 -902 Q330 -914 330.0 -920.5 Q330 -927 330 -931 Q330 -935 331 -936 L332 -937 L334 -937 Q334 -937 343.0 -937.5 Q352 -938 363.5 -939.0 Q375 -940 386.5 -940.0 Q398 -940 404 -939 Q411 -939 420.5 -939.0 Q430 -939 440.0 -939.0 Q450 -939 458.0 -939.5 Q466 -940 470 -940 L470 -947 Q469 -948 469 -949 L469 -952 L469 -956 L504 -958 L505 -958 L509 -947 Q509 -946 508 -945 Q507 -944 505 -944 L505 -942 L566 -942 Q573 -943 586.5 -944.5 Q600 -946 613.5 -947.5 Q627 -949 638.5 -949.5 Q650 -950 653 -948 L655 -947 L656 -899 L653 -899 Q576 -899 571 -904 L571 -902 Q568 -904 559.0 -904.5 Q550 -905 539 -904 L539 -894 L1234 -894 L1234 -893 L1234 -893 Z M391 -799 Q401 -799 401 -809 Q401 -818 391 -818 L367 -818 Q358 -818 358 -809 Q358 -799 367 -799 L391 -799 L391 -799 Z", (43, 733, 1239, 958)),
    "scout": ("M1366 -894 Q1366 -892 1367.0 -890.5 Q1368 -889 1368 -884 Q1368 -877 1364 -873 L1359 -866 L1140 -866 Q1142 -862 1142 -854 L1142 -851 Q1142 -846 1140 -840 Q1139 -837 1138 -836 L1130 -828 L1116 -825 Q1115 -825 1091.5 -824.0 Q1068 -823 1032.5 -822.0 Q997 -821 955.5 -819.5 Q914 -818 877.0 -816.5 Q840 -815 813.0 -813.5 Q786 -812 780 -812 Q763 -809 745 -812 L719 -812 Q710 -808 706.5 -807.0 Q703 -806 697 -804 Q694 -803 681.0 -802.0 Q668 -801 652.0 -800.5 Q636 -800 621.0 -799.5 Q606 -799 601 -799 L599 -799 Q597 -800 594 -801 Q588 -803 586 -804 Q586 -803 582 -801 Q580 -800 579 -799 Q578 -799 577 -798 L577 -797 Q575 -794 565.5 -781.5 Q556 -769 536 -764 Q509 -758 473 -786 Q457 -793 456 -793 Q453 -792 447.0 -788.5 Q441 -785 433.5 -780.0 Q426 -775 418.5 -767.5 Q411 -760 407 -750 L404 -745 Q396 -727 392.0 -721.5 Q388 -716 381 -714 Q367 -711 353 -719 Q348 -719 345.5 -720.0 Q343 -721 341 -721 Q338 -721 329.5 -723.0 Q321 -725 312.0 -727.5 Q303 -730 295.0 -732.5 Q287 -735 284 -736 Q283 -736 282.0 -735.0 Q281 -734 279 -733 L275 -731 L273 -731 Q269 -731 254.0 -730.5 Q239 -730 221.5 -729.5 Q204 -729 189.0 -728.5 Q174 -728 171 -729 Q167 -729 164.5 -730.0 Q162 -731 158 -731 Q155 -734 155 -734 L154 -734 L152 -731 Q147 -718 140.0 -706.0 Q133 -694 126 -691 Q118 -689 108.5 -688.5 Q99 -688 90 -688 L88 -688 Q86 -688 80.0 -688.0 Q74 -688 66.5 -689.0 Q59 -690 52.5 -691.0 Q46 -692 43 -695 Q41 -698 37.5 -703.5 Q34 -709 36 -714 Q37 -716 38.0 -727.5 Q39 -739 39.5 -755.0 Q40 -771 41.0 -789.0 Q42 -807 43 -821 Q45 -841 46.0 -851.5 Q47 -862 47 -864 Q47 -871 51.0 -874.0 Q55 -877 58 -877 L64 -877 Q70 -877 89.5 -877.0 Q109 -877 135.0 -877.5 Q161 -878 190.0 -877.5 Q219 -877 244.5 -876.5 Q270 -876 288.5 -874.5 Q307 -873 312 -871 Q319 -868 328.0 -863.0 Q337 -858 344.5 -853.0 Q352 -848 358.0 -843.5 Q364 -839 367 -838 Q370 -834 380.5 -832.0 Q391 -830 399 -836 Q405 -838 415.5 -843.5 Q426 -849 437.5 -854.5 Q449 -860 459.0 -865.0 Q469 -870 473 -871 Q478 -873 478 -880 L478 -882 Q480 -884 486.5 -895.0 Q493 -906 510 -908 Q519 -909 526.5 -909.5 Q534 -910 539 -910 L551 -910 Q553 -909 555 -910 Q558 -910 562 -914 L562 -918 Q560 -920 554.5 -920.0 Q549 -920 542 -920 Q541 -920 531.5 -918.5 Q522 -917 510.0 -916.0 Q498 -915 488.0 -915.0 Q478 -915 475 -918 Q474 -918 473.5 -919.0 Q473 -920 472.5 -925.0 Q472 -930 472.0 -940.0 Q472 -950 473 -968 L473 -973 L478 -973 Q498 -973 518.0 -972.5 Q538 -972 544 -968 Q545 -966 546.5 -966.5 Q548 -967 549 -967 Q550 -967 551 -968 L562 -970 L573 -973 L591 -973 Q592 -971 594 -970 Q598 -968 599 -968 L643 -968 L643 -969 Q643 -969 645 -970 L645 -975 L655 -982 L677 -984 L679 -984 L686 -977 L686 -973 L688 -970 L697 -970 L703 -973 L728 -973 L728 -970 Q728 -968 731 -968 L752 -968 Q756 -969 761 -970 Q766 -971 771.0 -972.0 Q776 -973 783 -975 Q797 -978 811.0 -979.5 Q825 -981 832 -979 L853 -979 L858 -979 L858 -923 L853 -923 Q850 -923 839.5 -922.5 Q829 -922 817.5 -922.0 Q806 -922 795.0 -923.0 Q784 -924 780 -927 Q776 -929 760.5 -929.0 Q745 -929 731 -927 L731 -914 L742 -914 L934 -914 Q935 -914 955.0 -914.0 Q975 -914 999.5 -914.0 Q1024 -914 1048.0 -912.5 Q1072 -911 1083 -908 Q1101 -901 1108.5 -899.0 Q1116 -897 1118 -897 L1366 -897 L1366 -894 L1366 -894 Z M495 -802 Q492 -802 492 -800 L492 -799 Q509 -783 527 -783 Q533 -784 538.5 -787.5 Q544 -791 548 -795 Q552 -799 556 -804 Q556 -806 553.5 -809.0 Q551 -812 549 -814 Q545 -814 542 -815 Q539 -815 536 -816 Q532 -817 525.5 -815.5 Q519 -814 512.5 -811.0 Q506 -808 501.0 -805.5 Q496 -803 495 -802 Z", (34, 688, 1368, 984)),
    "deagle": ("M94 -779 Q94 -783 96 -785 Q99 -793 113.5 -802.0 Q128 -811 164 -820 Q166 -822 170.5 -830.5 Q175 -839 175 -851 Q175 -856 174.5 -860.5 Q174 -865 170 -871 Q168 -872 164.5 -878.0 Q161 -884 153 -901 L153 -917 L168 -921 Q170 -919 172 -918 Q175 -915 177 -915 L205 -915 Q205 -917 208 -922 Q209 -925 211 -928 L236 -949 Q238 -950 241 -951 Q245 -953 247 -955 L247 -967 Q247 -971 248 -978 L250 -978 L279 -978 L300 -957 L336 -957 L349 -964 L498 -964 Q500 -961 502 -959 Q506 -955 507 -955 L702 -951 L704 -949 Q705 -948 707 -948 L718 -948 Q719 -949 719 -950 Q719 -952 720 -953 Q721 -955 723 -957 L940 -955 Q940 -952 941 -950 Q941 -948 941.5 -946.5 Q942 -945 942 -944 L953 -944 Q953 -945 955 -949 Q956 -951 958 -953 L1001 -953 Q1003 -954 1008.5 -957.5 Q1014 -961 1020.0 -964.5 Q1026 -968 1032.0 -970.5 Q1038 -973 1041 -973 Q1046 -973 1048.5 -966.0 Q1051 -959 1051 -957 Q1054 -954 1059 -953 Q1062 -952 1066 -951 Q1067 -950 1068 -950 L1071 -950 Q1073 -949 1076 -949 L1075 -930 L1078 -903 Q1077 -895 1074 -886 Q1072 -878 1069.0 -869.0 Q1066 -860 1064 -851 Q1058 -831 1054.0 -820.5 Q1050 -810 1047.5 -805.5 Q1045 -801 1044.0 -800.0 Q1043 -799 1042 -799 L662 -799 Q661 -799 650.0 -795.0 Q639 -791 625 -777 Q613 -765 601.0 -742.0 Q589 -719 589 -677 L589 -670 L589 -668 L587 -668 Q586 -667 571.0 -664.0 Q556 -661 535.0 -659.0 Q514 -657 489.5 -657.5 Q465 -658 446 -664 Q441 -663 431.5 -653.0 Q422 -643 421 -630 Q420 -623 416.0 -599.5 Q412 -576 406.5 -549.5 Q401 -523 397.0 -501.0 Q393 -479 392 -476 L406 -439 L403 -439 Q364 -434 324 -430 Q289 -427 248.5 -426.0 Q208 -425 170 -430 Q168 -430 165 -431 Q158 -433 155 -439 Q150 -447 150 -469 Q150 -482 153.0 -502.0 Q156 -522 164.0 -549.0 Q172 -576 186.0 -612.0 Q200 -648 222 -695 L222 -698 Q222 -701 222.5 -705.0 Q223 -709 223 -715 Q223 -731 216.0 -748.5 Q209 -766 182 -770 Q181 -770 168.0 -770.5 Q155 -771 139.5 -772.0 Q124 -773 110.5 -773.5 Q97 -774 96 -774 L94 -776 L94 -779 L94 -779 Z M462 -707 Q462 -699 467.5 -693.5 Q473 -688 481 -688 L546 -688 Q554 -688 560.0 -693.5 Q566 -699 566 -707 L566 -767 Q566 -775 560.0 -780.5 Q554 -786 546 -786 L481 -786 Q473 -786 467.5 -780.5 Q462 -775 462 -767 L462 -707 L462 -707 Z", (94, 425, 1078, 978)),
    "ak47": ("M47 -878 Q57 -885 70 -889 Q81 -893 96.0 -895.5 Q111 -898 128 -895 Q128 -894 155.0 -896.0 Q182 -898 215 -900 L303 -906 Q312 -903 321 -900 Q336 -895 346 -895 Q350 -895 362.0 -898.0 Q374 -901 388 -905 Q404 -909 422 -916 L478 -964 L483 -959 L823 -959 Q823 -960 826 -962 Q828 -964 833.0 -965.0 Q838 -966 848 -966 L1110 -964 Q1117 -962 1124 -959 Q1130 -957 1136.5 -954.5 Q1143 -952 1148 -951 L1257 -951 Q1266 -940 1274 -931 Q1281 -923 1288.0 -916.0 Q1295 -909 1300 -908 L1396 -908 L1404 -911 Q1410 -923 1414 -934 Q1418 -943 1421.5 -952.0 Q1425 -961 1427 -964 Q1429 -972 1429 -973 L1429 -977 L1439 -977 L1454 -977 L1454 -918 L1454 -911 L1477 -908 Q1480 -903 1482 -899 Q1484 -895 1484.5 -891.5 Q1485 -888 1482 -885 Q1478 -882 1471 -882 Q1468 -882 1465 -883 L1457 -883 L1447 -865 L1427 -873 L1262 -873 L1254 -862 L1244 -870 L1127 -870 L1125 -860 L940 -860 L918 -848 Q910 -843 902.0 -840.0 Q894 -837 891 -837 Q885 -837 879 -839 Q876 -840 874 -842 L866 -847 L782 -847 Q782 -816 796 -783 Q808 -754 834.5 -719.0 Q861 -684 912 -649 Q910 -649 901.0 -634.5 Q892 -620 881 -603 Q869 -583 853 -558 Q816 -583 783 -618 Q754 -648 723.5 -693.0 Q693 -738 673 -799 Q671 -801 666 -798 Q663 -796 661 -794 L643 -797 Q629 -789 614 -785 Q601 -782 584.5 -783.5 Q568 -785 552 -799 Q551 -799 540.5 -789.5 Q530 -780 517.5 -765.0 Q505 -750 493.5 -731.5 Q482 -713 478 -695 Q478 -694 467.0 -690.0 Q456 -686 442.5 -685.0 Q429 -684 417.0 -691.0 Q405 -698 402 -720 Q403 -723 411.0 -739.5 Q419 -756 429.0 -774.0 Q439 -792 447.5 -807.0 Q456 -822 458 -822 Q456 -822 448.0 -829.0 Q440 -836 432 -835 Q430 -834 419.5 -830.5 Q409 -827 392.5 -821.0 Q376 -815 355.5 -807.5 Q335 -800 314 -793 Q265 -775 204 -753 L60 -705 L47 -878 L47 -878 Z M562 -817 Q562 -809 568.5 -803.0 Q575 -797 585 -797 L618 -797 Q627 -797 632.5 -803.0 Q638 -809 638 -817 Q638 -827 632.5 -833.5 Q627 -840 618 -840 L585 -840 Q575 -840 568.5 -833.5 Q562 -827 562 -817 Z", (47, 558, 1485, 977)),
    "m4a1": ("M1423 -867 Q1425 -862 1425.5 -857.0 Q1426 -852 1426 -848 Q1426 -843 1424 -837 Q1423 -834 1423 -832 Q1422 -831 1420.0 -830.0 Q1418 -829 1411.0 -828.5 Q1404 -828 1389.5 -827.5 Q1375 -827 1350 -828 L1348 -828 L1347 -829 Q1346 -829 1345.0 -829.5 Q1344 -830 1343 -830 L1170 -830 L1172 -828 L1168 -814 L1154 -807 L1138 -805 L1138 -823 L1126 -823 L1101 -812 L1083 -812 Q1082 -811 1079.0 -808.5 Q1076 -806 1073 -803 Q1069 -799 1065 -796 Q1058 -796 1036.0 -795.5 Q1014 -795 985.5 -794.0 Q957 -793 925.0 -792.0 Q893 -791 866.0 -790.0 Q839 -789 821.0 -788.5 Q803 -788 802 -789 Q799 -789 797.0 -794.0 Q795 -799 793 -803 Q791 -803 779.5 -801.5 Q768 -800 766 -800 Q760 -797 756 -793 Q747 -786 747 -784 Q747 -783 747.0 -774.5 Q747 -766 748 -756 L750 -730 L740 -723 L740 -718 Q740 -714 741.0 -704.0 Q742 -694 745.5 -676.0 Q749 -658 755.5 -630.0 Q762 -602 772 -563 L775 -549 Q776 -549 777 -548 L777 -547 Q777 -545 775 -542 Q773 -540 770.0 -540.0 Q767 -540 756 -538 Q746 -534 724.5 -530.0 Q703 -526 667 -515 L665 -515 Q658 -522 651.0 -549.0 Q644 -576 638.0 -607.5 Q632 -639 627.5 -666.0 Q623 -693 622 -700 Q620 -700 615.0 -700.5 Q610 -701 598.0 -701.0 Q586 -701 566.0 -701.0 Q546 -701 514 -700 Q497 -675 487.0 -657.5 Q477 -640 472.0 -628.5 Q467 -617 465.5 -611.0 Q464 -605 464 -602 L464 -597 L466 -597 L462 -586 Q459 -579 450 -579 Q441 -577 427.0 -580.0 Q413 -583 400.0 -588.0 Q387 -593 376.5 -598.0 Q366 -603 364 -606 L364 -609 Q364 -612 371.5 -626.5 Q379 -641 407 -682 Q423 -704 437.0 -723.0 Q451 -742 455 -746 L455 -748 Q455 -758 448.0 -764.5 Q441 -771 433 -775 Q423 -779 412 -782 L409 -782 Q409 -790 408 -797 Q407 -803 406.5 -808.0 Q406 -813 405 -814 L393 -814 Q393 -813 392.5 -809.5 Q392 -806 391 -801 L389 -789 L329 -789 Q329 -788 323 -757 L320 -755 L318 -755 Q302 -764 282.0 -757.5 Q262 -751 244.0 -740.0 Q226 -729 213.0 -717.5 Q200 -706 197 -704 Q197 -700 195 -700 Q192 -700 192 -704 L192 -714 L192 -718 Q192 -723 191.0 -727.5 Q190 -732 190 -734 Q188 -731 177.0 -717.0 Q166 -703 154 -687 L122 -645 L122 -643 Q120 -643 118.5 -642.0 Q117 -641 115 -641 Q113 -642 111 -644 L110 -645 Q106 -654 102.5 -673.5 Q99 -693 96.5 -717.0 Q94 -741 92.0 -766.5 Q90 -792 88.5 -813.5 Q87 -835 86.0 -850.0 Q85 -865 85 -867 Q86 -869 87 -872 Q89 -878 92 -880 Q94 -884 100.5 -881.0 Q107 -878 112 -876 L412 -876 Q414 -876 418.5 -879.5 Q423 -883 425 -883 Q425 -896 432 -903 Q437 -905 442.0 -905.0 Q447 -905 450 -905 Q450 -906 452.0 -911.0 Q454 -916 456 -922 Q459 -929 462 -937 Q462 -939 471 -942 Q472 -951 475.0 -957.5 Q478 -964 481 -968 Q485 -972 489 -976 Q490 -976 509.0 -974.5 Q528 -973 555.5 -970.0 Q583 -967 615.0 -964.5 Q647 -962 675.0 -959.0 Q703 -956 722.5 -954.5 Q742 -953 745 -953 Q756 -953 758.5 -945.0 Q761 -937 761 -935 Q761 -923 762 -914 Q762 -906 762.5 -899.5 Q763 -893 763 -892 L766 -892 L772 -894 Q779 -893 784 -893 Q789 -892 792.5 -892.0 Q796 -892 798 -892 Q799 -893 803 -901 Q805 -905 807 -908 L1069 -901 Q1070 -899 1072 -897 Q1073 -895 1076 -892 Q1079 -895 1084.5 -903.5 Q1090 -912 1097.0 -921.5 Q1104 -931 1110.5 -940.5 Q1117 -950 1122 -956 Q1125 -959 1129.0 -962.0 Q1133 -965 1138 -965 Q1143 -963 1147.5 -959.0 Q1152 -955 1152 -953 Q1153 -929 1155 -910 Q1157 -893 1158.0 -879.0 Q1159 -865 1161 -864 L1346 -864 L1350 -867 L1421 -867 L1423 -867 L1423 -867 Z M592 -720 Q600 -720 606.5 -726.5 Q613 -733 613 -741 Q613 -749 606.5 -755.5 Q600 -762 592 -762 L549 -762 Q540 -762 534.0 -755.5 Q528 -749 528 -741 Q528 -733 534.0 -726.5 Q540 -720 549 -720 L592 -720 L592 -720 Z M688 -905 Q702 -905 702 -919 Q702 -924 698.5 -928.5 Q695 -933 688 -933 L533 -933 Q526 -933 521.5 -928.5 Q517 -924 517 -919 Q517 -905 533 -905 L688 -905 L688 -905 Z", (85, 515, 1426, 976)),
    "cuchillo": ("M1418 -785 L1409 -781 Q1394 -772 1359.5 -756.0 Q1325 -740 1276.5 -726.5 Q1228 -713 1166.5 -707.0 Q1105 -701 1036 -711 Q976 -720 936.5 -724.5 Q897 -729 872.0 -730.5 Q847 -732 833.5 -731.5 Q820 -731 812 -730 L807 -730 Q799 -729 774.0 -724.0 Q749 -719 721.0 -713.0 Q693 -707 670.0 -701.5 Q647 -696 643 -694 Q643 -693 642 -693 Q638 -693 638 -694 Q633 -694 633 -704 Q630 -725 620.5 -742.5 Q611 -760 580 -759 Q561 -757 549.5 -751.0 Q538 -745 531.0 -737.5 Q524 -730 521.5 -722.5 Q519 -715 518 -711 L518 -708 Q516 -706 515.5 -705.0 Q515 -704 513 -704 Q508 -702 501.5 -704.5 Q495 -707 491 -711 L489 -711 Q490 -725 491 -736 Q492 -746 493.0 -754.0 Q494 -762 494 -764 Q486 -768 479.0 -773.5 Q472 -779 470 -781 Q466 -781 464.0 -783.5 Q462 -786 460 -788 Q458 -785 457 -785 L455 -785 L72 -747 L55 -790 L60 -802 L63 -807 L65 -805 L70 -805 L72 -807 L72 -809 L72 -812 Q74 -813 76 -815 Q77 -816 77 -817 L80 -819 L82 -819 L84 -819 L84 -822 L84 -824 L92 -829 L92 -831 L94 -831 Q99 -831 99 -834 L99 -836 L106 -843 L108 -846 L111 -846 L113 -848 L113 -850 L120 -858 L120 -860 L123 -860 Q125 -860 126 -861 Q127 -861 128 -862 L128 -865 L130 -867 Q137 -874 140 -874 L482 -874 L484 -874 Q486 -872 487 -872 L489 -872 Q489 -874 490 -874 L491 -874 L503 -877 Q511 -877 518.0 -877.5 Q525 -878 530 -882 Q533 -884 537 -887 Q542 -891 547 -899 Q549 -902 550.5 -905.5 Q552 -909 554 -913 Q554 -918 559 -923 Q561 -926 565.0 -927.5 Q569 -929 573 -925 Q575 -923 581.5 -919.5 Q588 -916 588 -908 L588 -906 Q588 -901 585.0 -892.0 Q582 -883 580 -879 Q580 -877 583 -877 L641 -877 L643 -877 L643 -874 Q644 -874 645 -873 L645 -872 Q648 -872 648 -874 L648 -877 L660 -877 L662 -877 L665 -874 Q665 -872 669 -872 L669 -874 L672 -877 L682 -874 L684 -874 L686 -874 Q686 -872 687 -872 L689 -872 Q691 -872 694 -874 L694 -877 L706 -877 L708 -877 L708 -874 Q710 -872 713 -872 L715 -874 L725 -874 L727 -874 L730 -874 L732 -872 Q732 -877 737 -877 Q747 -880 751 -874 L754 -874 Q754 -872 755 -872 L756 -872 L759 -874 Q762 -882 766 -882 Q770 -882 771.5 -879.0 Q773 -876 775 -874 Q784 -875 821.0 -875.5 Q858 -876 912.0 -874.0 Q966 -872 1031.5 -867.5 Q1097 -863 1164.5 -853.5 Q1232 -844 1295.5 -828.5 Q1359 -813 1409 -790 L1418 -785 Z", (55, 693, 1418, 929)),
    "he": ("M529 -523 Q525 -521 520.0 -520.0 Q515 -519 511 -519 Q505 -519 502 -520 Q498 -524 496 -527 Q495 -529 492 -529 L491 -529 L489 -529 Q485 -529 464.5 -533.0 Q444 -537 420.0 -542.5 Q396 -548 374.5 -554.5 Q353 -561 348 -566 Q343 -571 333.0 -579.0 Q323 -587 313.0 -594.5 Q303 -602 294.5 -608.0 Q286 -614 285 -615 Q283 -617 277.0 -618.5 Q271 -620 269 -621 Q265 -622 258.5 -635.5 Q252 -649 249 -656 Q243 -669 238.5 -685.0 Q234 -701 236 -715 Q238 -741 246.0 -756.5 Q254 -772 259 -775 Q264 -776 271.0 -777.0 Q278 -778 282 -778 Q282 -779 283.5 -780.5 Q285 -782 286 -784 Q294 -796 312.5 -816.5 Q331 -837 360 -848 Q371 -854 380.0 -858.0 Q389 -862 397 -867 Q414 -876 429.0 -882.5 Q444 -889 475 -889 L479 -891 Q481 -892 482.5 -893.0 Q484 -894 486 -896 L496 -902 L499 -902 L505 -902 Q512 -902 515 -899 Q521 -893 525 -893 L552 -893 Q570 -893 588.5 -892.5 Q607 -892 617 -889 L627 -886 Q641 -881 653.0 -877.0 Q665 -873 675 -864 L691 -856 Q693 -856 707 -847 Q713 -865 724 -876 Q722 -876 720 -878 Q719 -879 718 -879 L702 -889 L654 -913 Q636 -922 621.0 -929.5 Q606 -937 606 -938 Q605 -938 583.5 -938.5 Q562 -939 536.5 -940.0 Q511 -941 489.5 -941.5 Q468 -942 468 -942 Q466 -942 464 -940 Q463 -939 462 -939 L413 -941 Q412 -944 410 -948 Q406 -954 406 -956 L372 -956 L370 -968 Q370 -969 371 -970 Q371 -970 375 -972 Q374 -974 372 -974 L359 -974 Q354 -974 347 -975 L342 -988 L568 -981 L750 -908 L760 -903 Q770 -908 780.0 -910.0 Q790 -912 802 -910 Q833 -909 857.5 -889.5 Q882 -870 891 -841 L914 -830 Q916 -830 921 -817 Q922 -814 921.5 -793.0 Q921 -772 919.5 -747.0 Q918 -722 917.0 -700.0 Q916 -678 915 -673 L914 -634 Q914 -632 912.0 -623.0 Q910 -614 902 -612 Q896 -612 886.0 -617.0 Q876 -622 874 -634 Q872 -642 874.5 -646.5 Q877 -651 879 -653 Q872 -653 856.0 -653.5 Q840 -654 823 -655 Q803 -656 780 -657 L777 -657 L779 -656 L777 -656 Q777 -654 776.0 -649.5 Q775 -645 770 -637 Q768 -632 752.5 -620.0 Q737 -608 718.5 -594.5 Q700 -581 682.5 -570.0 Q665 -559 658 -556 Q651 -553 639.0 -550.0 Q627 -547 614.5 -544.5 Q602 -542 590.5 -539.5 Q579 -537 573 -536 L570 -535 Q559 -533 549.0 -529.5 Q539 -526 534 -524 L529 -523 L529 -523 Z M864 -743 Q850 -730 832.0 -723.0 Q814 -716 794 -717 Q783 -717 768 -722 L768 -716 Q769 -715 772.0 -712.5 Q775 -710 778 -706 Q782 -702 786 -697 L786 -696 Q787 -691 788.0 -685.0 Q789 -679 789 -674 L822 -674 L888 -674 Q889 -676 891.0 -679.5 Q893 -683 895 -684 Q896 -686 897.5 -693.0 Q899 -700 899.5 -708.0 Q900 -716 900.5 -724.0 Q901 -732 901 -735 Q900 -739 896.0 -749.5 Q892 -760 884 -771 Q876 -755 864 -743 Z M766 -794 Q767 -780 767.5 -763.5 Q768 -747 768 -736 Q780 -732 794 -732 Q811 -730 826.5 -736.0 Q842 -742 853 -753 Q867 -767 874 -782 Q872 -784 870.0 -784.5 Q868 -785 866 -787 L855 -794 L766 -794 Z M800 -896 Q795 -897 789.5 -896.5 Q784 -896 779 -895 L852 -860 L872 -850 Q862 -870 843.0 -883.0 Q824 -896 800 -896 Z M737 -870 Q732 -863 727.0 -855.5 Q722 -848 720 -840 Q728 -834 731 -831 Q738 -826 744.0 -823.0 Q750 -820 756 -817 Q759 -814 763 -814 L764 -812 L764 -811 L764 -808 Q764 -806 766 -800 L766 -808 L839 -808 Q831 -814 819.5 -821.5 Q808 -829 797.0 -836.5 Q786 -844 776.0 -850.0 Q766 -856 760 -859 L753 -863 Q749 -864 745.5 -866.0 Q742 -868 737 -870 Z", (234, 519, 922, 988)),
    "usp": ("M295 -444 Q292 -458 296.0 -480.5 Q300 -503 307.5 -528.5 Q315 -554 325.5 -580.5 Q336 -607 345.5 -628.5 Q355 -650 362.0 -664.5 Q369 -679 370 -681 Q374 -688 373.5 -699.5 Q373 -711 368 -724 Q365 -730 357.5 -735.5 Q350 -741 342.0 -745.0 Q334 -749 326.5 -751.5 Q319 -754 317 -755 Q312 -757 311.0 -758.0 Q310 -759 309 -762 Q308 -764 309.0 -774.5 Q310 -785 315 -791 Q318 -793 321.5 -802.5 Q325 -812 329 -823 Q333 -835 338 -849 Q337 -849 334 -852 Q332 -854 327.0 -857.5 Q322 -861 315 -868 Q309 -877 310.5 -880.5 Q312 -884 316 -885 Q320 -886 328 -885 Q330 -883 333.5 -884.0 Q337 -885 340 -886 Q344 -887 348 -889 L352 -897 Q354 -908 359.5 -913.5 Q365 -919 371 -921 Q378 -924 386 -923 L386 -927 Q385 -938 390.5 -941.5 Q396 -945 404 -946 Q413 -947 424 -944 L426 -925 L597 -925 L630 -925 L634 -921 L730 -921 Q733 -921 735 -924 Q736 -926 736 -928 L739 -930 L951 -930 Q952 -931 953 -933 Q954 -935 954.0 -936.5 Q954 -938 955 -940 Q957 -944 966.0 -941.5 Q975 -939 980 -937 Q986 -936 987.5 -932.0 Q989 -928 993 -927 Q995 -926 996.5 -923.5 Q998 -921 998.5 -914.0 Q999 -907 999.5 -894.5 Q1000 -882 1000 -861 Q1002 -848 1002.5 -834.0 Q1003 -820 1002 -809 Q1001 -796 999 -783 L961 -779 Q959 -771 953.5 -768.0 Q948 -765 943 -765 Q941 -765 925.0 -764.0 Q909 -763 890.0 -762.0 Q871 -761 854.5 -760.0 Q838 -759 835 -759 Q829 -759 825.0 -756.0 Q821 -753 813 -748 Q809 -745 804.5 -731.5 Q800 -718 796 -703 Q792 -685 787 -664 Q785 -662 781 -659 Q778 -657 773.5 -654.0 Q769 -651 763 -649 Q756 -647 737.5 -645.0 Q719 -643 696.0 -641.5 Q673 -640 649.5 -640.5 Q626 -641 610 -644 Q593 -647 583.0 -643.0 Q573 -639 567 -634 Q560 -627 557 -618 L510 -439 Q510 -438 512 -434 Q514 -431 516.0 -426.0 Q518 -421 523 -413 Q527 -407 513.5 -404.5 Q500 -402 477.0 -401.5 Q454 -401 425.5 -402.0 Q397 -403 372.0 -404.5 Q347 -406 328.5 -407.5 Q310 -409 308 -410 Q304 -412 303.0 -416.0 Q302 -420 301 -425 Q300 -430 300 -437 Q300 -438 299 -439 Q297 -441 295 -444 Z M611 -758 Q597 -744 591 -729 Q586 -716 587.5 -700.0 Q589 -684 608 -669 Q631 -667 655.0 -666.0 Q679 -665 699.5 -666.0 Q720 -667 734.5 -668.5 Q749 -670 754 -673 Q758 -676 764.5 -685.5 Q771 -695 774.5 -707.0 Q778 -719 775.5 -732.5 Q773 -746 758 -758 L611 -758 L611 -758 Z", (292, 401, 1003, 947)),
    "glock": ("M1185 -867 Q1185 -812 1167 -801 Q1164 -799 1158 -799 Q1147 -797 1121.5 -796.0 Q1096 -795 1066.0 -793.5 Q1036 -792 1007.0 -791.5 Q978 -791 960 -791 Q938 -791 925.0 -789.0 Q912 -787 905.5 -784.0 Q899 -781 897.0 -776.5 Q895 -772 895 -766 L895 -760 Q895 -752 896.0 -742.0 Q897 -732 899 -723 Q901 -712 903 -701 L903 -699 L892 -686 L892 -684 Q886 -681 863 -681 Q816 -678 784.0 -678.5 Q752 -679 731.5 -681.0 Q711 -683 700.5 -685.5 Q690 -688 686 -691 Q680 -691 673 -688 Q667 -684 657.5 -672.0 Q648 -660 634.5 -634.0 Q621 -608 603.5 -564.0 Q586 -520 564 -453 L562 -452 Q562 -433 552 -427 Q546 -422 543 -425 L362 -425 Q362 -429 363 -433 Q365 -441 365 -446 L353 -446 Q349 -446 346 -447 Q327 -448 317 -463 Q311 -472 311 -486 Q311 -503 316.0 -516.0 Q321 -529 321 -531 L321 -529 Q322 -530 330.5 -543.0 Q339 -556 352.0 -575.5 Q365 -595 381.0 -618.0 Q397 -641 412 -662 Q428 -693 436.5 -717.0 Q445 -741 445 -760 Q445 -772 440 -784 Q434 -800 421.0 -808.0 Q408 -816 396 -822 L395 -822 Q384 -825 380.5 -833.5 Q377 -842 377 -852 Q377 -857 377.5 -860.0 Q378 -863 378 -866 Q377 -867 377 -868 L377 -872 L377 -877 L377 -911 Q377 -921 377.0 -928.5 Q377 -936 375 -938 Q375 -939 374.0 -939.0 Q373 -939 373 -941 Q373 -942 374 -943 L375 -944 Q376 -946 382.0 -949.0 Q388 -952 417 -954 Q418 -956 418.5 -958.0 Q419 -960 421 -962 Q422 -965 424 -967 L426 -970 L450 -969 L452 -963 Q453 -961 453.5 -958.5 Q454 -956 455 -954 L1123 -954 L1126 -957 Q1127 -958 1128 -958 L1143 -964 Q1144 -962 1146 -960 Q1150 -956 1151 -956 L1180 -956 L1185 -867 L1185 -867 Z M857 -769 Q857 -776 853.5 -780.0 Q850 -784 846 -784 L732 -784 Q729 -784 725.5 -780.0 Q722 -776 722 -769 L722 -730 Q722 -722 725.5 -718.0 Q729 -714 732 -714 L846 -714 Q850 -714 853.5 -718.0 Q857 -722 857 -730 L857 -769 L857 -769 Z", (311, 422, 1185, 970)),
    "headshot": ("M634 -790 Q642 -793 649 -793 Q655 -793 661.5 -790.5 Q668 -788 673 -781 L673 -779 L671 -779 Q666 -777 654.5 -775.5 Q643 -774 632 -787 L632 -790 L634 -790 L634 -790 Z M636 -787 Q638 -784 641.0 -782.5 Q644 -781 647 -779 Q645 -781 645 -785 Q645 -787 646.0 -788.5 Q647 -790 647 -792 Q644 -790 641.0 -789.5 Q638 -789 636 -787 Z M669 -781 Q667 -784 664.5 -786.0 Q662 -788 660 -790 L660 -785 Q660 -779 656 -779 Q666 -779 669 -781 Z M684 -647 Q685 -647 692.5 -650.5 Q700 -654 710.0 -656.5 Q720 -659 729.5 -658.0 Q739 -657 744 -649 L742 -647 L742 -649 L688 -647 L686 -645 L684 -647 L684 -647 Z M766 -867 Q784 -824 781 -800 L781 -798 L778 -798 Q775 -790 770.0 -775.5 Q765 -761 770 -753 L770 -751 Q772 -743 774.0 -735.0 Q776 -727 778 -725 L778 -721 Q778 -717 777.0 -710.0 Q776 -703 774.5 -696.5 Q773 -690 771.0 -684.5 Q769 -679 768 -677 Q766 -675 762.0 -664.0 Q758 -653 755 -643 Q754 -636 751.5 -625.0 Q749 -614 746.0 -603.5 Q743 -593 740.0 -584.5 Q737 -576 735 -574 Q733 -569 726.5 -564.0 Q720 -559 712 -552 L709 -552 L709 -546 Q709 -536 712.0 -525.0 Q715 -514 718 -507 L718 -501 Q705 -487 691.5 -478.5 Q678 -470 667.0 -465.5 Q656 -461 648.0 -459.5 Q640 -458 638 -458 Q607 -460 575.5 -479.0 Q544 -498 517.5 -520.0 Q491 -542 474.5 -560.0 Q458 -578 457 -580 L455 -580 Q453 -584 456.0 -599.0 Q459 -614 464 -645 Q470 -664 470 -675 Q470 -682 467.0 -698.5 Q464 -715 459 -736 Q454 -756 451.0 -777.0 Q448 -798 444 -818 Q441 -839 445.0 -860.0 Q449 -881 457.0 -899.0 Q465 -917 475.0 -931.0 Q485 -945 494 -953 Q502 -961 517.0 -967.5 Q532 -974 550.0 -978.0 Q568 -982 586.5 -983.0 Q605 -984 619 -981 Q632 -980 646.5 -974.5 Q661 -969 673.5 -962.5 Q686 -956 694.5 -949.5 Q703 -943 705 -940 Q707 -938 712.0 -933.5 Q717 -929 725 -921 L880 -921 L884 -921 L942 -897 L884 -867 L766 -867 Z M515 -871 L515 -867 Q515 -864 515.5 -857.0 Q516 -850 518 -843 Q518 -852 522 -852 L523 -852 Q524 -852 526 -850 Q528 -847 530.5 -837.5 Q533 -828 535 -820 L535 -815 Q538 -819 540.0 -821.5 Q542 -824 546 -826 Q553 -832 556 -828 Q561 -826 565.5 -821.0 Q570 -816 574 -811 L576 -809 Q578 -812 581.0 -818.5 Q584 -825 589 -828 Q592 -833 597 -833 Q600 -831 604 -831 Q611 -826 615 -828 Q619 -834 615 -841 Q610 -849 615 -852 Q617 -855 626.0 -855.5 Q635 -856 643 -854 Q641 -860 630 -867 Q626 -869 625.5 -870.0 Q625 -871 623 -871 L619 -871 L623 -874 Q623 -876 625 -876 Q629 -881 634.0 -885.0 Q639 -889 643 -891 L645 -891 Q643 -894 638.5 -897.5 Q634 -901 623 -906 Q613 -911 610.5 -913.5 Q608 -916 608 -919 Q608 -921 606 -923 Q606 -927 605.0 -930.0 Q604 -933 604 -936 L604 -940 L602 -940 Q594 -937 582 -935 Q576 -934 569 -934 L567 -932 Q567 -937 568 -942 Q568 -947 568.5 -951.0 Q569 -955 569 -958 Q568 -957 561 -943 Q557 -936 555.5 -934.0 Q554 -932 552 -932 Q550 -932 549.0 -933.0 Q548 -934 546 -934 Q546 -938 541 -938 Q539 -940 537.0 -941.5 Q535 -943 535 -945 Q533 -941 533.0 -937.5 Q533 -934 531 -928 L531 -919 Q531 -916 529.5 -915.0 Q528 -914 526 -912 L524 -912 Q517 -909 509.0 -912.5 Q501 -916 496 -919 Q496 -917 497.5 -914.5 Q499 -912 503 -912 Q508 -909 514 -900 Q517 -896 520 -891 L522 -889 Q512 -886 503 -883 Q495 -881 489.0 -879.0 Q483 -877 481 -876 Q483 -874 486.5 -871.5 Q490 -869 500 -869 L511 -869 L515 -871 Z M658 -759 Q674 -759 685.5 -767.0 Q697 -775 697 -785 Q697 -795 685.5 -803.0 Q674 -811 658 -811 Q641 -811 629.0 -803.0 Q617 -795 617 -785 Q617 -775 629.0 -767.0 Q641 -759 658 -759 Z M733 -621 Q740 -625 744.0 -631.0 Q748 -637 748 -639 L750 -649 Q748 -654 748.0 -658.5 Q748 -663 746 -665 Q744 -667 738.5 -667.0 Q733 -667 731 -667 Q729 -665 722.5 -665.0 Q716 -665 714 -667 L694 -667 Q689 -665 677.5 -658.0 Q666 -651 664 -647 Q665 -645 669.0 -641.5 Q673 -638 678.5 -634.0 Q684 -630 689.0 -627.0 Q694 -624 697 -624 Q710 -620 720.0 -619.5 Q730 -619 733 -621 Z M763 -766 Q760 -764 753.5 -764.0 Q747 -764 744 -766 L744 -764 Q750 -756 763 -753 L763 -766 Z M766 -772 Q766 -774 763.5 -775.5 Q761 -777 759 -779 L760 -778 Q760 -777 760.5 -776.0 Q761 -775 761 -774 Q761 -768 753 -768 L763 -768 L763 -769 L764 -769 Q764 -769 766 -770 L766 -772 Z M744 -774 Q744 -783 753 -783 Q750 -783 749 -784 Q748 -784 748 -785 L748 -787 Q746 -784 746.0 -782.5 Q746 -781 744 -779 L744 -777 L744 -770 L744 -768 L753 -768 Q744 -768 744 -774 Z M766 -777 Q768 -783 770.0 -789.0 Q772 -795 774 -798 Q769 -796 761.0 -795.0 Q753 -794 748 -787 Q750 -785 756.0 -782.5 Q762 -780 766 -777 Z M1024 -906 L1024 -884 L955 -884 L955 -906 L1024 -906 Z M938 -925 L979 -962 L994 -945 L951 -908 L938 -925 Z M934 -925 L914 -936 L932 -966 L949 -956 L934 -925 Z M953 -880 L996 -843 L981 -826 L940 -863 L953 -880 Z M936 -863 L951 -833 L934 -822 L916 -852 L936 -863 Z", (441, 458, 1024, 984)),
    "calavera": ("M1090 -605 Q1092 -603 1097.0 -598.0 Q1102 -593 1107.5 -586.5 Q1113 -580 1117.0 -573.5 Q1121 -567 1120 -562 Q1118 -557 1117.5 -553.5 Q1117 -550 1116 -547 Q1115 -543 1115 -541 L1113 -541 L1113 -540 Q1113 -540 1107.5 -533.5 Q1102 -527 1094.5 -520.0 Q1087 -513 1077.5 -507.5 Q1068 -502 1059 -504 Q1058 -504 1056.5 -505.0 Q1055 -506 1050 -508 Q1048 -510 1044.5 -511.0 Q1041 -512 1037 -514 L1032 -514 L1032 -515 Q1024 -519 1020 -518 L1019 -518 Q1018 -518 1016 -520 Q1014 -522 1011.5 -524.0 Q1009 -526 1004 -531 Q992 -543 990 -550 Q989 -553 978.0 -561.5 Q967 -570 950.5 -581.5 Q934 -593 914.0 -606.0 Q894 -619 873 -632 L871 -634 Q869 -627 864.5 -614.0 Q860 -601 851 -587 Q840 -568 818.0 -550.5 Q796 -533 756 -531 Q695 -527 647 -586 Q637 -600 630.5 -613.0 Q624 -626 620 -634 Q620 -635 617 -641 Q607 -635 577.0 -615.5 Q547 -596 514 -570 Q502 -561 492.0 -551.5 Q482 -542 473 -533 Q466 -526 462.0 -522.0 Q458 -518 453 -516 L453 -515 L452 -515 Q451 -514 451.0 -513.0 Q451 -512 449 -512 Q447 -510 442.0 -509.5 Q437 -509 430.0 -512.0 Q423 -515 413.5 -524.0 Q404 -533 392 -550 Q389 -553 387.0 -559.0 Q385 -565 384 -571 L384 -575 Q384 -585 392.0 -598.0 Q400 -611 431 -619 L432 -617 L432 -619 Q433 -618 439.0 -619.0 Q445 -620 453.0 -621.5 Q461 -623 468.5 -624.5 Q476 -626 481 -628 Q484 -629 498.5 -637.5 Q513 -646 531.0 -657.5 Q549 -669 567.5 -680.0 Q586 -691 598 -699 Q596 -704 593.0 -717.0 Q590 -730 586.0 -745.5 Q582 -761 579.5 -776.0 Q577 -791 577 -801 Q575 -802 557.0 -810.0 Q539 -818 517.0 -827.5 Q495 -837 477.0 -844.5 Q459 -852 459 -852 Q454 -851 441.0 -850.5 Q428 -850 415 -863 Q395 -878 397 -890 L398 -891 Q400 -894 402 -898 Q404 -901 404.5 -904.5 Q405 -908 406 -911 Q408 -932 417.0 -939.5 Q426 -947 434 -949 L435 -949 Q449 -951 464.0 -950.5 Q479 -950 485 -941 L485 -940 Q489 -933 493.5 -926.5 Q498 -920 503 -915 Q506 -912 515.5 -906.5 Q525 -901 537.0 -895.0 Q549 -889 561.5 -883.0 Q574 -877 584 -873 Q587 -879 594.0 -892.5 Q601 -906 616 -922 Q634 -939 666.5 -956.5 Q699 -974 751 -974 Q753 -974 770.0 -972.5 Q787 -971 810 -962 Q871 -941 899 -882 Q899 -884 901 -884 L910 -890 L940 -908 Q951 -916 961 -922 Q969 -927 975.5 -931.0 Q982 -935 983 -936 Q983 -940 988.0 -953.0 Q993 -966 1004 -971 Q1015 -979 1032 -973 L1033 -973 Q1039 -966 1044.5 -963.5 Q1050 -961 1053 -960 L1057 -958 Q1061 -957 1074.0 -947.5 Q1087 -938 1090 -922 Q1091 -919 1091 -914 Q1091 -893 1070 -874 Q1070 -873 1066.0 -872.0 Q1062 -871 1046 -869 Q1044 -868 1034.5 -866.5 Q1025 -865 1020 -867 Q1018 -865 1007.0 -859.0 Q996 -853 981.0 -844.5 Q966 -836 949.5 -826.5 Q933 -817 918 -809 Q916 -806 916 -802 L914 -804 Q912 -795 907.5 -779.5 Q903 -764 902 -754 L902 -743 Q900 -726 898.5 -713.0 Q897 -700 893 -695 L891 -692 Q898 -688 919.5 -676.5 Q941 -665 964 -652 Q991 -637 1023 -619 Q1024 -618 1030.5 -616.5 Q1037 -615 1045.5 -613.0 Q1054 -611 1062.0 -609.5 Q1070 -608 1076 -608 L1080 -608 L1080 -607 L1080 -608 L1088 -607 L1090 -605 L1090 -605 Z M769 -588 Q774 -590 777.5 -591.0 Q781 -592 784 -594 Q783 -597 783.0 -601.5 Q783 -606 781 -612 Q778 -611 774.5 -610.0 Q771 -609 768 -609 Q768 -603 768.0 -598.0 Q768 -593 769 -588 Z M790 -598 Q793 -600 796.0 -601.5 Q799 -603 801 -605 Q800 -607 799.0 -609.5 Q798 -612 798 -615 Q795 -615 793.0 -614.0 Q791 -613 788 -613 Q789 -607 789.0 -603.5 Q789 -600 790 -598 Z M806 -611 Q809 -613 811.0 -615.5 Q813 -618 815 -620 Q812 -619 810.0 -619.0 Q808 -619 805 -617 L805 -612 Q805 -611 806 -611 Z M806 -611 L806 -609 L806 -611 Z M804 -624 Q810 -625 815 -628 L804 -628 L804 -624 L804 -624 Z M789 -629 Q788 -625 788 -620 Q791 -620 793.0 -620.5 Q795 -621 797 -621 L797 -629 L789 -629 Z M781 -619 Q781 -625 783 -629 L768 -629 L768 -616 Q771 -617 774.5 -617.0 Q778 -617 781 -619 Z M762 -629 L748 -629 Q748 -619 747 -615 L762 -615 L762 -629 Z M741 -615 Q742 -619 742 -629 L741 -629 L724 -629 Q724 -626 724.5 -622.5 Q725 -619 725 -615 L741 -615 L741 -615 Z M700 -619 Q707 -616 718 -616 Q718 -619 717.5 -622.0 Q717 -625 717 -629 Q712 -628 708.0 -628.0 Q704 -628 700 -628 L700 -619 L700 -619 Z M675 -628 Q681 -623 693 -620 L693 -628 L675 -628 Z M693 -613 Q688 -615 683.0 -617.0 Q678 -619 674 -620 Q678 -617 683.0 -613.5 Q688 -610 693 -605 L693 -613 L693 -613 Z M700 -612 Q700 -604 699 -601 Q707 -596 718 -592 L717 -592 Q718 -594 718 -608 Q713 -609 708.5 -610.0 Q704 -611 700 -612 Z M725 -608 Q725 -592 724 -590 Q734 -586 742 -586 Q742 -588 741.5 -593.0 Q741 -598 741 -608 Q736 -607 732.5 -607.5 Q729 -608 725 -608 Z M747 -608 Q747 -599 747.0 -593.0 Q747 -587 748 -586 L747 -586 L754 -586 L763 -586 Q762 -591 762.0 -596.5 Q762 -602 762 -608 L747 -608 L747 -608 Z M742 -708 Q735 -704 732.5 -699.0 Q730 -694 729 -689 Q729 -687 728.0 -685.5 Q727 -684 727 -682 Q727 -677 730 -674 Q731 -672 733 -672 Q736 -672 742 -678 L742 -708 Z M682 -722 Q699 -722 710.5 -731.0 Q722 -740 722 -754 Q722 -767 710.5 -776.0 Q699 -785 682 -785 Q665 -785 653.0 -776.0 Q641 -767 641 -754 Q641 -740 653.0 -731.0 Q665 -722 682 -722 Z M771 -674 Q772 -675 772 -682 L772 -689 Q771 -694 768.0 -699.0 Q765 -704 758 -708 L758 -678 Q760 -676 763.0 -674.0 Q766 -672 768 -672 Q769 -672 771 -674 Z M813 -786 Q796 -786 784.0 -777.0 Q772 -768 772 -755 Q772 -742 784.0 -732.5 Q796 -723 813 -723 Q830 -723 842.5 -732.5 Q855 -742 855 -755 Q855 -768 842.5 -777.0 Q830 -786 813 -786 Z", (384, 502, 1121, 979)),
    "c4": ("M383 -497 Q373 -492 354.0 -488.0 Q335 -484 309 -484 Q236 -484 195 -527 Q156 -566 156 -632 Q156 -705 203 -747 Q248 -787 315 -787 Q341 -787 360.0 -783.0 Q379 -779 388 -774 L392 -772 L375 -710 L369 -713 Q361 -716 348.5 -719.5 Q336 -723 318 -723 Q281 -723 259 -701 Q234 -678 234 -636 Q234 -594 256.5 -572.0 Q279 -550 319 -550 Q333 -550 346.5 -551.5 Q360 -553 370 -558 L376 -561 L388 -499 L383 -497 L383 -497 Z M624 -613 L624 -553 L592 -553 L592 -489 L519 -489 L519 -553 L400 -553 L400 -602 L504 -772 L586 -772 L592 -772 L592 -613 L624 -613 Z M519 -613 L519 -667 Q519 -673 519.0 -679.0 Q519 -685 520 -693 Q517 -685 513.5 -678.5 Q510 -672 506 -664 Q499 -653 493 -643 Q488 -635 482.5 -626.5 Q477 -618 475 -613 L519 -613 Z M649 -885 Q700 -834 727.0 -769.0 Q754 -704 754 -632 Q754 -560 727.0 -495.0 Q700 -430 649 -379 Q598 -328 533.0 -301.5 Q468 -275 396 -275 Q324 -275 259.5 -301.5 Q195 -328 144 -379 Q93 -430 66.0 -495.0 Q39 -560 39 -632 Q39 -704 66.0 -769.0 Q93 -834 144 -885 Q195 -936 259.5 -963.0 Q324 -990 396 -990 Q468 -990 533.0 -963.0 Q598 -936 649 -885 Z M616 -413 Q660 -457 683.0 -513.5 Q706 -570 706 -632 Q706 -694 683.0 -750.5 Q660 -807 616 -851 Q571 -896 515.0 -919.0 Q459 -942 396 -942 Q334 -942 278.0 -919.0 Q222 -896 177 -851 Q133 -807 109.5 -750.5 Q86 -694 86 -632 Q86 -570 109.5 -513.5 Q133 -457 177 -413 Q222 -368 278.0 -345.0 Q334 -322 396 -322 Q459 -322 515.0 -345.0 Q571 -368 616 -413 Z M245 -794 L216 -830 L234 -844 L263 -809 L245 -794 Z M389 -811 L365 -811 L365 -918 L389 -918 L389 -811 Z M308 -809 L282 -880 L305 -887 L331 -816 L308 -809 Z M523 -795 L504 -811 L532 -847 L551 -831 L523 -795 Z M458 -810 L436 -818 L462 -890 L485 -881 L458 -810 Z M529 -471 L557 -435 L538 -420 L510 -456 L529 -471 Z M383 -453 L407 -453 L407 -346 L383 -346 L383 -453 Z M466 -457 L492 -385 L469 -377 L443 -449 L466 -457 Z M251 -469 L269 -455 L240 -419 L222 -433 L251 -469 Z M314 -455 L337 -446 L311 -375 L288 -383 L314 -455 Z", (39, 275, 754, 990)),
    "pinzas": ("M363 -648 L369 -656 L99 -855 L464 -707 Q465 -705 467 -702 Q469 -700 471.5 -697.5 Q474 -695 477 -692 Q495 -698 509.5 -694.0 Q524 -690 534.5 -683.0 Q545 -676 551.5 -669.0 Q558 -662 560 -662 Q566 -662 587.0 -659.0 Q608 -656 637 -656 Q776 -668 876.0 -664.5 Q976 -661 1045.5 -648.5 Q1115 -636 1157.5 -618.0 Q1200 -600 1223.5 -583.5 Q1247 -567 1255.5 -555.0 Q1264 -543 1266 -542 Q1270 -537 1261.5 -523.5 Q1253 -510 1234 -505 Q1202 -535 1159.0 -554.0 Q1116 -573 1068.0 -583.5 Q1020 -594 968.5 -597.5 Q917 -601 869 -600 Q755 -598 632 -576 L618 -587 L530 -576 L524 -567 Q525 -564 529 -557 Q533 -551 540.0 -540.0 Q547 -529 560 -512 Q605 -441 648.5 -387.5 Q692 -334 732.5 -294.5 Q773 -255 809.5 -227.5 Q846 -200 878 -182 Q952 -140 1017 -133 Q1023 -133 1031 -132 Q1044 -130 1064 -123 Q1078 -115 1078.0 -94.0 Q1078 -73 1069 -59 Q1006 -53 949.0 -65.5 Q892 -78 842.5 -103.5 Q793 -129 751.0 -163.0 Q709 -197 675 -234 Q595 -320 535 -433 Q533 -435 529 -441 Q525 -446 517.5 -456.5 Q510 -467 499 -485 Q494 -491 482.0 -499.0 Q470 -507 457 -515 Q442 -524 425 -532 L13 -707 L363 -648 Z", (13, 53, 1270, 855)),
}


def glyph(name, cx, cy, w, h, sw=2.4, flip=False, fill="url(#acento)"):
    """Silueta del juego encajada en una caja w x h centrada en (cx, cy), con contorno oscuro debajo."""
    d, (x0, y0, x1, y1) = GLYPHS[name]
    gw, gh = x1 - x0, y1 - y0
    s = min(w / gw, h / gh)
    sx = -s if flip else s
    tx = cx - sx * (x0 + gw / 2)
    ty = cy + s * (y0 + y1) / 2
    tr = f'transform="translate({tx:.2f} {ty:.2f}) scale({sx:.5f} {s:.5f})"'
    return (f'<g id="silueta-{name}"><path d="{d}" {tr} fill="{K}" stroke="{K}" stroke-width="{2*sw/s:.1f}" stroke-linejoin="round"/>'
            f'<path d="{d}" {tr} fill="{fill}"/></g>')


# --- íconos de armas y bomba con las siluetas originales del juego ---
def ic_awp():
    return glyph("awp", 130, 204, 104, 40)


def ic_scout():
    return glyph("scout", 130, 204, 100, 40)


def ic_deagle():
    return glyph("deagle", 130, 204, 60, 48)


def ic_ak():
    return glyph("ak47", 130, 204, 96, 42)


def ic_rifles():
    return glyph("ak47", 130, 204, 100, 42)


def ic_cuchillo():
    return glyph("cuchillo", 130, 204, 100, 30)


def ic_he():
    return glyph("he", 130, 204, 58, 50)


def ic_usp():
    return glyph("usp", 130, 204, 66, 44)


def ic_c4():
    return glyph("c4", 130, 204, 50, 50, sw=2)


def ic_pinzas():
    return glyph("pinzas", 130, 204, 90, 46, sw=1.6)


def ic_mira():
    return glyph("headshot", 130, 204, 56, 52)


def ic_calavera():
    return glyph("calavera", 130, 204, 66, 50)


# ---------- armado ----------
MANIFEST = []          # (carpeta, categoría, nombre) para armar catálogos
CAT = ""


def svg_open(title):
    return [f'<svg xmlns="http://www.w3.org/2000/svg" width="260" height="300" viewBox="0 0 260 300">',
            f'  <title>{title}</title>',
            '  <desc>CM League. Medalla de perfil, vector editable con capas nombradas. Textos vivos: fuente Montserrat (ExtraBold/Black).</desc>']


def write(name, parts):
    parts.append('</svg>\n')
    open(os.path.join(OUT, name + ".svg"), "w", encoding="utf-8").write("\n".join(parts))
    if not name.startswith("bloqueada_"):
        MANIFEST.append((OUT, CAT, name))


def back_layers(parts, a, locked, glow, rays_):
    parts.append(f'  <ellipse id="sombra-piso" cx="130" cy="284" rx="80" ry="9" fill="{"#000000" if locked else a["mid"]}" opacity="{".35" if locked else ".28"}" filter="url(#desenfoque)"/>')
    if glow and not locked:
        parts.append('  <circle id="aura" cx="130" cy="141" r="125" fill="url(#grad-aura)"/>')
    if rays_ and not locked:
        parts.append(rays())


def asta():
    tassels = ""
    for x in (28, 232):
        tassels += (f'<path d="M{x} 28 V60" stroke="{K}" stroke-width="5"/><path d="M{x} 28 V60" stroke="url(#color-equipo)" stroke-width="2.5"/>'
                    f'<path d="M{x} 57 Q{x-8} 72 {x-6} 84 H{x+6} Q{x+8} 72 {x} 57 Z" fill="url(#color-equipo)" stroke="{K}" stroke-width="2"/>'
                    f'<path d="M{x-3} 72 V82 M{x+3} 72 V82" stroke="{K}" stroke-width="1.2" opacity=".5"/>')
    return f'''  <g id="asta">
    <g id="borlas-color-equipo">{tassels}</g>
    <rect x="22" y="19" width="216" height="10" rx="5" fill="url(#metal)" stroke="{K}" stroke-width="2.5"/>
    <circle cx="20" cy="24" r="7.5" fill="url(#metal-vertical)" stroke="{K}" stroke-width="2.5"/>
    <circle cx="240" cy="24" r="7.5" fill="url(#metal-vertical)" stroke="{K}" stroke-width="2.5"/>
  </g>'''


def franjas_equipo():
    return '''  <g id="franjas-color-equipo" clip-path="url(#recorte-forma)" opacity=".9">
    <rect x="56" y="30" width="7" height="240" fill="url(#color-equipo)"/>
    <rect x="197" y="30" width="7" height="240" fill="url(#color-equipo)"/>
  </g>'''


def logo_equipo(cy, r, locked):
    return f'''  <g id="logo-equipo">
    <!-- reemplazá este grupo por el logo del equipo, o cambiá las iniciales -->
    <circle cx="130" cy="{cy}" r="{r+3.5}" fill="{K}"/>
    <circle cx="130" cy="{cy}" r="{r}" fill="#121318" stroke="url(#color-equipo)" stroke-width="3"/>
    <text id="iniciales-equipo" x="130" y="{cy + r*0.24:.1f}" font-family="Montserrat, Arial, sans-serif" font-size="{r*0.66:.0f}" font-weight="900" text-anchor="middle" fill="{"#A9ADB7" if locked else "#FFFFFF"}">TAG</text>
  </g>'''


def frame(parts, shape, m, a, locked):
    parts.append(asta() if shape == "banderin" else ribbon(a))
    parts.append(body(shape, m, a))
    if shape == "banderin":
        parts.append(franjas_equipo())


def badge(name, title, shape, fam, tier, label, txt, icon, total=1, level=1, locked=False, isc=1.12):
    m = METAL["bloqueada" if locked else tier]
    a = ACC["bloqueada" if locked else fam]
    glow = {1: 0, 2: 0, 3: .2, 4: .3, 5: .45}[level] if total > 1 else .2
    L = LAYOUT[shape]
    team = shape == "banderin"
    parts = svg_open(title)
    parts.append(defs(shape, m, a, locked, glow))
    back_layers(parts, a, locked, glow, level >= 4 or tier == "diamante")
    frame(parts, shape, m, a, locked)
    if tier == "diamante" and not locked:
        parts.append(sparkles())
    if team:
        parts.append(logo_equipo(98, 21, locked))
    parts.append('  <g id="textos-editables" font-family="Montserrat, Arial, sans-serif" text-anchor="middle">')
    parts.append(pill(label, a, L["pill"]))
    parts.append(number(txt, L["num"], locked, .78 if team else 1))
    parts.append('  </g>')
    parts.append(pips(total, 0 if locked else level, L["pips"], m))
    sc, cy = (.86, 203) if team else (isc, 203)
    parts.append(f'  <g id="icono" opacity="{".6" if locked else "1"}" transform="translate(130 {cy}) scale({sc}) translate(-130 -204)">\n    {icon}\n  </g>')
    if locked:
        parts.append(lock_badge(LOCK_Y.get(shape, 252)))
    write(name, parts)


def logro(name, title, fam, tier, word, icon, locked=False, rays_=False, shape="circulo", label=None, spark=False, estrellas=3, mes=False):
    m = METAL["bloqueada" if locked else tier]
    a = ACC["bloqueada" if locked else fam]
    team = shape == "banderin"
    parts = svg_open(title)
    parts.append(defs(shape, m, a, locked, .35))
    back_layers(parts, a, locked, .35, rays_)
    frame(parts, shape, m, a, locked)
    if spark and not locked:
        parts.append(sparkles())
    if team:
        parts.append(logo_equipo(87, 18, locked))
    parts.append('  <g id="textos-editables" font-family="Montserrat, Arial, sans-serif" text-anchor="middle">')
    parts.append(pill(label or SEASON, a, 44 if team else 56))
    parts.append('  </g>')
    icy, isc = (150, 1.15) if team else (136, 1.55)
    parts.append(f'  <g id="icono" opacity="{".6" if locked else "1"}" transform="translate(130 {icy}) scale({isc}) translate(-130 -204)">\n    {icon}\n  </g>')
    fs = 15 if len(word) <= 7 else 13 if len(word) <= 10 else 11.5
    dy = -6 if team else 0
    if mes:
        fs = 17
    contenido = (f'<text id="texto-banda" x="130" y="{213 if fs == 15 else 212.5}" font-family="Montserrat, Arial, sans-serif" font-size="{fs}" font-weight="900" letter-spacing="1.2" text-anchor="middle" fill="{"#B5B9C2" if locked else "#FFFFFF"}" filter="url(#sombra-texto)">{word}</text>'
                 if word else
                 f'<path id="estrellas-banda" d="{(star(108, 208, 5.5) + " " + star(130, 208, 7.5) + " " + star(152, 208, 5.5)) if estrellas == 3 else (star(119, 208, 6.5) + " " + star(141, 208, 6.5))}" fill="{"#B5B9C2" if locked else "#FFFFFF"}" stroke="{K}" stroke-width="1.4" stroke-linejoin="round"/>')
    parts.append(f'''  <g id="banda" transform="translate(0 {dy})">
    <path d="M40 194 H220 L208 208 L220 222 H40 L52 208 Z" fill="{K}" transform="translate(0 2)" opacity=".6"/>
    <path d="M40 194 H220 L208 208 L220 222 H40 L52 208 Z" fill="url(#acento)" stroke="{K}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M56 197 H204" stroke="#FFFFFF" stroke-width="1.4" opacity=".35"/>
    {contenido}{(chr(10) + '    <path id="estrellas-mes" d="' + star(92, 208, 5.5) + ' ' + star(168, 208, 5.5) + '" fill="' + ("#B5B9C2" if locked else "#FFFFFF") + '" stroke="' + K + '" stroke-width="1.4" stroke-linejoin="round"/>') if mes else ''}
  </g>''')
    if locked:
        parts.append(lock_badge(LOCK_Y.get(shape, 252)))
    write(name, parts)


def family(slug, nice, shape, fam, label, values, icon, tiers=None, isc=1.12):
    tiers = tiers or TIERS[:len(values)]
    for i, (v, t) in enumerate(zip(values, tiers), 1):
        fname = f"{slug}_{v.replace('%', '').replace('.', '_')}"
        for locked in (False, True):
            badge(("bloqueada_" if locked else "") + fname,
                  f"CM League - {nice} {v}" + (" (bloqueada)" if locked else ""),
                  shape, fam, t, label, v, icon(), total=len(values), level=i, locked=locked, isc=isc)


def single(fname, nice, shape, fam, tier, label, txt, icon):
    for locked in (False, True):
        badge(("bloqueada_" if locked else "") + fname, f"CM League - {nice}" + (" (bloqueada)" if locked else ""),
              shape, fam, tier, label, txt, icon(), locked=locked)


def single_logro(fname, nice, fam, tier, word, icon, shape="circulo", rays_=False, label=None, spark=False, estrellas=3, mes=False):
    for locked in (False, True):
        logro(("bloqueada_" if locked else "") + fname, f"CM League - {nice}" + (" (bloqueada)" if locked else ""),
              fam, tier, word, icon(), locked, rays_=rays_, shape=shape, label=label, spark=spark, estrellas=estrellas, mes=mes)



# Siluetas extra (csd.ttf) para las medallas nuevas
GLYPHS.update({
    "mp5": ("M1248 -838 Q1250 -831 1252.0 -828.0 Q1254 -825 1254 -820 Q1254 -815 1252.0 -811.5 Q1250 -808 1248 -806 L1245 -806 Q1245 -804 1243.5 -803.0 Q1242 -802 1235.5 -801.5 Q1229 -801 1214.5 -801.0 Q1200 -801 1173 -802 Q1171 -800 1170.5 -798.0 Q1170 -796 1169 -794 Q1168 -791 1167 -790 L1164 -790 Q1159 -792 1149.0 -792.5 Q1139 -793 1137 -793 L1134 -793 L1133 -794 Q1131 -793 1130.5 -791.0 Q1130 -789 1128 -787 L1127 -784 L767 -742 L755 -745 L755 -746 Q755 -760 751 -766 Q749 -764 745.0 -762.0 Q741 -760 739 -758 Q739 -753 741.5 -742.5 Q744 -732 747 -721 L747 -719 Q747 -716 741 -707 L741 -705 Q741 -682 749.5 -651.0 Q758 -620 770.5 -586.5 Q783 -553 797.5 -520.5 Q812 -488 825.0 -462.5 Q838 -437 846.5 -420.5 Q855 -404 855 -404 L858 -400 L791 -361 L789 -365 Q775 -380 761.0 -406.5 Q747 -433 734.0 -465.5 Q721 -498 709.5 -532.0 Q698 -566 689.0 -595.5 Q680 -625 674.0 -647.0 Q668 -669 666 -676 L664 -676 Q661 -676 647.0 -671.5 Q633 -667 612 -659 Q606 -636 599.0 -622.0 Q592 -608 585.5 -600.5 Q579 -593 574.5 -590.0 Q570 -587 569 -586 Q568 -586 561.0 -584.0 Q554 -582 543.5 -581.0 Q533 -580 520.5 -581.5 Q508 -583 496 -589 Q478 -596 468.0 -596.0 Q458 -596 454 -595 Q454 -593 451.5 -587.5 Q449 -582 443.0 -570.0 Q437 -558 427.5 -537.5 Q418 -517 403 -484 Q405 -482 406.0 -480.0 Q407 -478 407 -475 L407 -473 Q404 -467 397 -461 Q395 -461 392.5 -460.5 Q390 -460 384.0 -462.0 Q378 -464 366.5 -470.5 Q355 -477 336 -490 Q327 -495 318.5 -501.0 Q310 -507 303 -512 Q295 -517 288 -523 L286 -526 L288 -529 Q307 -560 325 -588 Q340 -611 355.0 -635.0 Q370 -659 378 -670 Q379 -672 379.0 -676.0 Q379 -680 379 -683 Q379 -700 369.0 -709.5 Q359 -719 354 -721 Q338 -721 331.5 -724.5 Q325 -728 321 -731 L261 -731 Q257 -719 246.0 -717.0 Q235 -715 229 -715 L227 -715 Q220 -715 217 -725 Q215 -730 215.0 -736.5 Q215 -743 213 -757 L213 -761 Q213 -764 211 -770 Q204 -763 197.0 -746.0 Q190 -729 183.0 -708.5 Q176 -688 170.5 -667.0 Q165 -646 162 -632 Q155 -609 154.0 -605.5 Q153 -602 151 -601 Q146 -599 140.0 -602.5 Q134 -606 122 -622 L120 -624 L122 -628 Q128 -636 131.5 -664.0 Q135 -692 136.5 -726.5 Q138 -761 138.0 -795.5 Q138 -830 138 -851 L138 -853 Q139 -855 146.0 -860.5 Q153 -866 159 -869 Q164 -873 185.0 -868.0 Q206 -863 227 -857 Q229 -861 233.0 -868.0 Q237 -875 241.5 -882.0 Q246 -889 250.0 -894.5 Q254 -900 255 -901 Q255 -902 256.5 -903.0 Q258 -904 265.0 -905.0 Q272 -906 286.0 -906.5 Q300 -907 326 -907 L333 -903 Q335 -903 337.5 -903.0 Q340 -903 345 -905 Q345 -925 357 -934 Q364 -941 372.0 -942.5 Q380 -944 385 -944 Q385 -944 387 -950 Q388 -952 389 -955 L438 -934 Q436 -928 433 -923 Q431 -918 429.0 -914.5 Q427 -911 425 -909 Q425 -909 427 -908 Q428 -907 429 -907 L430 -906 Q430 -905 432 -903 Q434 -903 436.5 -903.0 Q439 -903 441 -904 Q444 -904 447 -905 L543 -905 L546 -905 Q546 -908 547 -909 L549 -911 L557 -911 L561 -907 L583 -907 Q583 -909 584 -909 L585 -909 L593 -915 Q594 -914 595 -912 Q596 -910 599 -907 L600 -907 L765 -907 Q766 -907 770.5 -906.5 Q775 -906 793.0 -906.0 Q811 -906 846.0 -906.0 Q881 -906 943 -907 Q956 -920 966 -916 Q974 -916 979.0 -912.0 Q984 -908 987 -905 L1119 -905 L1121 -903 L1127 -903 Q1128 -906 1128.0 -915.0 Q1128 -924 1128 -933 L1128 -949 L1128 -961 L1128 -967 Q1129 -969 1134.0 -970.0 Q1139 -971 1144 -971 Q1150 -971 1157 -970 Q1165 -968 1169.0 -947.0 Q1173 -926 1173 -903 Q1176 -891 1176 -880 Q1176 -871 1174.5 -863.5 Q1173 -856 1173 -853 Q1173 -851 1174 -849 Q1174 -847 1174.5 -845.0 Q1175 -843 1175 -841 L1176 -841 L1181 -845 L1193 -845 Q1194 -844 1196 -843 Q1198 -842 1198.5 -841.0 Q1199 -840 1200 -840 L1248 -840 L1248 -838 L1248 -838 Z M466 -647 Q466 -640 472.0 -634.0 Q478 -628 486 -628 L559 -628 Q567 -628 573.0 -634.0 Q579 -640 579 -647 L579 -661 Q579 -670 573.0 -676.0 Q567 -682 559 -682 L486 -682 Q478 -682 472.0 -676.0 Q466 -670 466 -661 L466 -647 Z", (120, 361, 1254, 971)),
    "p90": ("M1362 -763 Q1365 -760 1366.5 -752.0 Q1368 -744 1368.0 -736.0 Q1368 -728 1367.5 -721.5 Q1367 -715 1367 -714 L1367 -711 Q1365 -710 1358 -709 Q1352 -708 1339.5 -707.5 Q1327 -707 1304 -707 L1302 -707 L1298 -711 Q1298 -712 1295 -709 L1293 -707 L1289 -711 L1284 -716 Q1283 -715 1282.5 -714.0 Q1282 -713 1281 -712 Q1280 -711 1280 -710 L1266 -710 Q1266 -710 1270 -708 Q1271 -707 1273 -707 L1275 -693 Q1276 -688 1276.5 -683.5 Q1277 -679 1277 -678 Q1278 -677 1280.5 -676.5 Q1283 -676 1285 -675 Q1288 -674 1290 -674 L1275 -582 L1273 -582 Q1267 -581 1261 -581 Q1256 -580 1249.5 -580.0 Q1243 -580 1237 -580 Q1225 -582 1223.0 -588.0 Q1221 -594 1223 -604 L1223 -616 Q1223 -629 1221 -631 Q1218 -633 1211.5 -633.5 Q1205 -634 1196 -634 L1186 -634 Q1163 -634 1159.5 -627.0 Q1156 -620 1154 -613 L1154 -611 Q1152 -601 1147.5 -579.5 Q1143 -558 1136 -546 Q1129 -531 1120.5 -522.0 Q1112 -513 1087 -496 Q1075 -490 1059.5 -486.5 Q1044 -483 1028.0 -482.0 Q1012 -481 998.0 -481.5 Q984 -482 977 -483 L972 -483 Q965 -483 959.5 -486.5 Q954 -490 953 -499 Q953 -503 955.0 -512.5 Q957 -522 959 -532 Q963 -544 963 -553 Q967 -558 954 -571 Q946 -576 932 -573 Q929 -573 925.5 -572.0 Q922 -571 917 -571 Q905 -571 900.0 -567.5 Q895 -564 881 -553 L874 -546 Q864 -537 848.0 -528.0 Q832 -519 816.0 -511.0 Q800 -503 787.0 -497.5 Q774 -492 769 -490 Q763 -488 742.0 -487.0 Q721 -486 698.0 -485.0 Q675 -484 656.5 -483.5 Q638 -483 636 -483 L630 -486 Q627 -488 625 -491 Q621 -497 621 -499 Q620 -499 613.5 -501.0 Q607 -503 597.0 -506.0 Q587 -509 574.0 -513.0 Q561 -517 548 -522 L478 -546 L462 -546 L455 -546 Q454 -545 453.5 -543.5 Q453 -542 452 -540 Q451 -537 451 -535 L448 -535 L142 -535 Q137 -537 135.5 -540.5 Q134 -544 130 -553 L130 -557 Q129 -560 129.5 -570.5 Q130 -581 131.0 -594.5 Q132 -608 133.0 -623.0 Q134 -638 135 -651 Q135 -665 136.0 -674.5 Q137 -684 137 -687 Q137 -691 136.0 -707.0 Q135 -723 135 -743 Q133 -772 132.0 -796.0 Q131 -820 133 -823 Q133 -830 141.0 -833.5 Q149 -837 151 -837 L157 -837 L164 -837 Q166 -837 167 -836 Q168 -835 168.5 -834.0 Q169 -833 170 -832 L173 -835 L505 -835 Q505 -834 506 -833 Q508 -831 509 -831 L841 -831 Q842 -831 842 -832 L901 -953 L903 -953 Q904 -953 905.0 -952.5 Q906 -952 908 -952 L937 -952 L939 -952 Q939 -950 940 -949 Q942 -947 944 -947 Q945 -947 950.5 -949.0 Q956 -951 962.5 -953.5 Q969 -956 975.0 -959.0 Q981 -962 984 -965 Q989 -970 1000.0 -978.5 Q1011 -987 1011 -989 L1161 -989 L1163 -989 Q1164 -984 1165 -980 Q1165 -977 1167 -973 Q1168 -971 1168 -970 Q1169 -970 1174.0 -967.0 Q1179 -964 1184.5 -960.5 Q1190 -957 1194.5 -953.5 Q1199 -950 1199 -949 L1210 -949 Q1210 -952 1212 -954 L1214 -956 L1214 -953 L1221 -953 Q1224 -953 1227.5 -952.5 Q1231 -952 1235 -953 Q1241 -953 1244 -952 Q1246 -950 1248.0 -948.0 Q1250 -946 1257 -943 Q1262 -940 1265.5 -922.5 Q1269 -905 1270.5 -882.0 Q1272 -859 1272.5 -834.0 Q1273 -809 1273 -790 L1273 -763 Q1274 -763 1274.5 -762.5 Q1275 -762 1276 -762 L1277 -761 Q1281 -761 1282 -762 Q1283 -762 1284 -763 L1287 -763 Q1289 -763 1293 -761 Q1293 -762 1296 -764 Q1297 -765 1299 -765 L1356 -765 Q1360 -765 1362 -763 Z M1087 -608 Q1087 -619 1079.5 -626.5 Q1072 -634 1062 -634 L1026 -634 Q1016 -634 1009.0 -626.5 Q1002 -619 1002 -608 L1002 -577 Q1002 -567 1009.0 -560.0 Q1016 -553 1026 -553 L1062 -553 Q1072 -553 1079.5 -560.0 Q1087 -567 1087 -577 L1087 -608 L1087 -608 Z M670 -591 Q697 -570 724 -580 Q731 -582 744.0 -587.5 Q757 -593 769.0 -598.5 Q781 -604 790.5 -608.5 Q800 -613 802 -613 Q804 -615 811.0 -624.5 Q818 -634 818 -644 Q818 -651 816 -653 Q806 -678 780 -685 Q771 -686 756.5 -686.0 Q742 -686 728.0 -686.0 Q714 -686 703.0 -685.5 Q692 -685 690 -685 Q689 -685 683.0 -683.0 Q677 -681 670.5 -676.5 Q664 -672 658.5 -664.5 Q653 -657 653 -647 L653 -644 L653 -643 Q654 -620 656.0 -608.5 Q658 -597 670 -591 Z", (129, 481, 1368, 989)),
    "ump45": ("M1253 -872 Q1253 -870 1254.5 -866.0 Q1256 -862 1257.0 -857.0 Q1258 -852 1257.0 -847.5 Q1256 -843 1251 -841 Q1245 -838 1238.0 -837.5 Q1231 -837 1228 -837 Q1227 -837 1221 -835 Q1218 -834 1216 -833 L1212 -833 Q1209 -833 1205 -835 Q1205 -830 1203.0 -825.0 Q1201 -820 1195 -818 Q1193 -818 1192.0 -817.5 Q1191 -817 1190 -817 L1189 -816 L1189 -806 L1187 -797 L1185 -797 Q1178 -797 1166.0 -796.5 Q1154 -796 1149 -800 Q1146 -800 1144 -798 L1143 -797 L1141 -797 Q1136 -795 1131.0 -791.5 Q1126 -788 1124 -785 Q1124 -783 1124.0 -776.0 Q1124 -769 1126 -760 Q1126 -749 1126.0 -734.5 Q1126 -720 1126.0 -706.0 Q1126 -692 1125.5 -679.0 Q1125 -666 1124 -658 Q1122 -646 1120.5 -639.0 Q1119 -632 1118 -628 Q1116 -624 1116 -621 L1114 -619 L1112 -619 Q1107 -617 1095.5 -616.5 Q1084 -616 1079 -621 L1079 -623 Q1077 -625 1074.5 -628.0 Q1072 -631 1072 -637 Q1070 -645 1070 -647 L1070 -650 L1068 -652 Q1071 -689 1072.5 -713.0 Q1074 -737 1075.0 -751.0 Q1076 -765 1077.0 -772.0 Q1078 -779 1079 -781 Q1077 -781 1075.5 -783.0 Q1074 -785 1072 -787 L1069 -790 Q1067 -791 1066.0 -792.0 Q1065 -793 1064 -793 Q1064 -795 1060.0 -797.5 Q1056 -800 1054 -800 Q1052 -800 1051 -801 Q1049 -801 1048.5 -801.5 Q1048 -802 1047 -802 L1039 -800 Q1038 -800 1036 -801 Q1034 -801 1033.0 -801.5 Q1032 -802 1031 -802 Q1030 -802 1028.0 -801.5 Q1026 -801 1024 -801 Q1021 -800 1018 -800 L981 -800 Q981 -802 982 -806 Q982 -808 982.5 -811.0 Q983 -814 983 -816 Q977 -813 966.0 -806.5 Q955 -800 952 -800 L927 -800 Q928 -796 929.5 -787.5 Q931 -779 933 -769 Q935 -758 937 -745 Q935 -745 933 -744 L927 -741 Q927 -739 930.0 -726.5 Q933 -714 937.5 -694.5 Q942 -675 947.0 -650.5 Q952 -626 958 -601 Q971 -541 987 -467 Q990 -462 991.5 -457.0 Q993 -452 995 -450 L997 -448 Q997 -442 993 -438 L920 -425 L886 -575 Q880 -603 873.5 -630.0 Q867 -657 862.0 -679.0 Q857 -701 853.5 -714.5 Q850 -728 850 -729 L833 -729 Q826 -728 821 -728 Q816 -727 811.5 -727.0 Q807 -727 804 -725 Q799 -723 796.5 -719.0 Q794 -715 792 -712 Q790 -709 788.0 -706.5 Q786 -704 783 -702 Q781 -700 768.5 -699.0 Q756 -698 741.5 -698.0 Q727 -698 713.5 -698.0 Q700 -698 696 -700 Q688 -702 679.0 -706.5 Q670 -711 665 -714 Q654 -698 654 -691 Q656 -686 657.0 -683.5 Q658 -681 658 -679 L660 -679 L654 -673 Q653 -674 652 -674 Q649 -674 648 -673 Q646 -671 642.0 -663.5 Q638 -656 633.0 -647.0 Q628 -638 624.5 -630.0 Q621 -622 621 -619 L621 -606 Q623 -604 619 -600 Q615 -596 606 -598 Q603 -599 592.0 -604.5 Q581 -610 569.0 -617.0 Q557 -624 547.0 -631.0 Q537 -638 536 -641 Q536 -643 537.5 -647.0 Q539 -651 545.0 -662.5 Q551 -674 563.0 -695.0 Q575 -716 596 -752 Q596 -757 592.0 -771.5 Q588 -786 571 -791 L546 -800 Q538 -802 532.5 -803.0 Q527 -804 521 -804 Q516 -805 507.5 -806.0 Q499 -807 489.5 -807.5 Q480 -808 471.5 -807.5 Q463 -807 459 -806 L149 -696 L147 -696 Q146 -696 140.0 -695.0 Q134 -694 126.5 -693.5 Q119 -693 111.0 -694.0 Q103 -695 99 -698 Q95 -702 95 -706 L95 -748 Q95 -763 95.0 -778.5 Q95 -794 93 -802 L93 -831 Q93 -837 92.0 -843.0 Q91 -849 91 -854 Q89 -862 89.5 -869.5 Q90 -877 97 -879 Q98 -880 109.0 -880.5 Q120 -881 134.5 -881.5 Q149 -882 164.5 -882.5 Q180 -883 190 -883 L409 -883 Q413 -884 421.5 -886.5 Q430 -889 438.5 -891.0 Q447 -893 454.0 -895.0 Q461 -897 463 -899 L475 -908 Q479 -910 482.5 -911.0 Q486 -912 488 -914 Q491 -917 511 -920 Q517 -920 519 -921 Q521 -921 523 -922 Q526 -924 537.5 -936.0 Q549 -948 559 -958 Q564 -963 576.0 -961.5 Q588 -960 594 -958 Q597 -958 598 -959 Q599 -959 600 -960 Q601 -960 603 -959 Q607 -957 608 -956 L623 -956 L627 -949 L627 -924 L629 -924 L629 -939 L660 -939 L660 -947 L673 -947 L677 -947 L677 -939 L688 -939 L688 -947 L700 -947 L704 -947 L704 -939 L715 -939 L715 -947 L727 -947 L731 -947 L731 -939 L744 -939 L744 -947 L756 -947 L760 -947 L760 -939 L773 -939 L773 -947 L785 -947 L789 -947 L789 -939 L802 -939 L802 -947 L814 -947 L819 -947 L819 -939 L829 -939 L829 -947 L841 -947 L846 -947 L846 -939 L856 -939 L856 -947 L868 -947 L873 -947 L873 -939 L885 -939 L889 -939 L889 -924 L1110 -924 Q1116 -929 1125.0 -937.0 Q1134 -945 1137 -951 Q1137 -955 1138.0 -958.0 Q1139 -961 1139 -964 Q1141 -970 1143.0 -974.0 Q1145 -978 1151 -980 L1156 -980 Q1161 -982 1166.0 -982.5 Q1171 -983 1176 -976 Q1182 -967 1185 -958 Q1187 -954 1187.0 -951.0 Q1187 -948 1189 -945 Q1192 -939 1194.5 -928.0 Q1197 -917 1199 -906 L1199 -897 L1199 -887 Q1201 -885 1202.0 -881.5 Q1203 -878 1205 -874 L1208 -874 Q1212 -874 1214 -875 Q1216 -875 1218 -876 L1226 -874 L1251 -874 L1253 -872 L1253 -872 Z M771 -743 Q771 -751 765.5 -755.5 Q760 -760 754 -760 L698 -760 Q692 -760 686.5 -755.5 Q681 -751 681 -743 Q681 -737 686.5 -733.0 Q692 -729 698 -729 L754 -729 Q760 -729 765.5 -733.0 Q771 -737 771 -743 Z M373 -820 Q373 -835 359 -835 L332 -835 Q327 -835 323.0 -831.0 Q319 -827 319 -820 Q319 -815 323.0 -811.5 Q327 -808 332 -808 L359 -808 Q365 -808 369.0 -811.5 Q373 -815 373 -820 Z M265 -789 Q265 -797 261.5 -808.0 Q258 -819 255 -827 Q250 -827 238.5 -829.5 Q227 -832 211 -837 Q204 -840 193.5 -842.0 Q183 -844 172.5 -845.5 Q162 -847 152.5 -847.5 Q143 -848 138 -849 Q138 -841 139.0 -827.5 Q140 -814 140.5 -799.5 Q141 -785 142.0 -772.5 Q143 -760 143 -756 Q146 -753 156.0 -749.0 Q166 -745 176 -745 Q183 -746 195.0 -750.0 Q207 -754 219.5 -759.0 Q232 -764 243.5 -769.5 Q255 -775 261 -779 Q265 -783 265 -789 Z M638 -931 L638 -924 L881 -924 L881 -931 L638 -931 L638 -931 Z", (89, 425, 1258, 983)),
    "tmp": ("M1031 -896 L1031 -830 L1024 -825 L943 -825 L942 -825 L947 -810 L953 -797 L958 -785 L960 -778 Q960 -776 962 -770 L964 -764 Q964 -763 966 -757 Q967 -754 969 -751 L972 -741 L967 -732 L957 -732 L948 -743 L945 -754 Q943 -756 941.5 -760.0 Q940 -764 940 -766 Q938 -767 937 -769 Q933 -773 933 -773 L926 -778 Q922 -779 918 -780 Q911 -781 894 -778 Q889 -778 885.5 -777.0 Q882 -776 877 -776 Q867 -775 863.0 -773.0 Q859 -771 859 -758 Q860 -748 863.0 -735.5 Q866 -723 869.5 -711.5 Q873 -700 876.0 -692.0 Q879 -684 879 -683 Q881 -670 885 -656 Q888 -643 891.0 -627.0 Q894 -611 898 -594 Q905 -560 907.5 -541.0 Q910 -522 911.0 -512.5 Q912 -503 911.0 -500.5 Q910 -498 910 -498 Q906 -496 891.0 -493.0 Q876 -490 859.0 -486.5 Q842 -483 827.5 -480.5 Q813 -478 810 -478 L807 -478 L807 -481 Q806 -482 802.5 -491.5 Q799 -501 795.0 -515.5 Q791 -530 787.5 -547.0 Q784 -564 783 -579 Q782 -593 781.5 -601.5 Q781 -610 780.5 -618.5 Q780 -627 779.5 -638.0 Q779 -649 778 -667 L778 -673 Q776 -693 776.0 -705.5 Q776 -718 776 -724 L776 -734 Q776 -736 773.0 -745.0 Q770 -754 761 -754 Q757 -754 754.5 -754.0 Q752 -754 747 -756 Q739 -758 729.0 -758.0 Q719 -758 705 -743 Q691 -731 683 -719 Q675 -708 668.5 -702.0 Q662 -696 650 -694 Q640 -692 626.0 -691.5 Q612 -691 598.0 -691.0 Q584 -691 572.5 -692.0 Q561 -693 555 -695 Q549 -695 545 -699 Q540 -700 536 -697 Q534 -694 529.5 -684.0 Q525 -674 520.0 -661.0 Q515 -648 511.5 -634.5 Q508 -621 508 -613 L508 -592 L508 -484 L508 -483 Q506 -482 505 -481 Q503 -480 502.5 -479.0 Q502 -478 501 -478 L500 -478 Q499 -478 499 -476 L499 -240 L493 -229 L484 -226 L390 -226 L383 -236 L383 -478 Q382 -478 382 -479 Q381 -479 381 -481 L346 -481 L341 -488 L342 -574 L347 -594 Q347 -595 352.0 -609.0 Q357 -623 362.5 -642.0 Q368 -661 373.0 -680.0 Q378 -699 378 -710 L378 -714 L378 -726 Q375 -754 369 -756 Q367 -758 365.5 -758.0 Q364 -758 363 -759 Q360 -762 354.0 -763.5 Q348 -765 322 -768 Q306 -771 280.5 -775.5 Q255 -780 231.0 -784.5 Q207 -789 189.0 -792.0 Q171 -795 170 -795 L168 -795 L162 -803 L157 -813 L157 -820 L157 -825 L148 -825 L148 -856 L152 -856 Q154 -856 155.0 -856.5 Q156 -857 157 -857 Q157 -859 157.5 -859.0 Q158 -859 158 -861 Q157 -861 157 -862 Q157 -863 156.5 -863.0 Q156 -863 156 -864 Q155 -865 155 -867 L157 -869 Q158 -870 158.5 -871.0 Q159 -872 160 -873 Q159 -873 157 -875 Q156 -876 155 -876 L155 -900 L157 -901 Q156 -902 155.0 -902.5 Q154 -903 153 -904 Q151 -905 150 -905 L150 -927 Q152 -927 154 -926 Q156 -925 157.5 -924.5 Q159 -924 160 -923 Q158 -927 158 -929 Q157 -931 157 -932 L157 -975 L170 -981 L211 -981 L212 -980 Q212 -979 214 -977 L271 -977 Q271 -980 272 -982 Q272 -984 273 -986 L288 -986 L290 -986 Q290 -984 291 -983 Q293 -979 293 -979 L297 -977 L300 -972 Q301 -970 302 -969 Q303 -967 305 -965 L803 -965 Q806 -965 809 -966 Q811 -966 813.5 -966.5 Q816 -967 817 -967 L832 -972 Q834 -972 836 -973 Q840 -975 842 -975 L852 -982 L864 -977 L877 -972 L888 -965 L896 -959 L903 -945 Q905 -942 907 -938 Q909 -935 909.5 -932.0 Q910 -929 911 -927 L913 -923 L938 -923 L943 -905 L923 -905 L923 -903 L1026 -903 L1031 -896 Z M651 -716 Q654 -718 661.5 -725.0 Q669 -732 673 -736 Q677 -740 680.0 -745.0 Q683 -750 683 -758 L683 -759 Q683 -766 680.0 -770.0 Q677 -774 673 -776 Q671 -781 670 -781 Q668 -783 663.5 -784.0 Q659 -785 655 -785 Q654 -785 648.5 -784.5 Q643 -784 636 -784 Q628 -783 619 -783 L616 -785 Q611 -785 601.5 -785.5 Q592 -786 584 -786 Q577 -786 573.0 -783.0 Q569 -780 565 -776 Q562 -774 562 -773 Q555 -770 548 -748 Q546 -743 546.5 -734.5 Q547 -726 548 -724 Q552 -718 574 -710 Q582 -709 589.0 -709.0 Q596 -709 601 -709 L607 -707 Q614 -707 624.0 -708.0 Q634 -709 636 -709 Q640 -710 644.5 -712.0 Q649 -714 651 -716 Z", (148, 226, 1031, 986)),
    "mac10": ("M957 -887 L957 -862 L947 -851 L907 -851 Q905 -850 904 -850 Q902 -849 900 -849 L900 -806 L795 -806 Q795 -804 795.0 -800.5 Q795 -797 796 -794 Q796 -790 797 -786 Q796 -785 794 -784 Q792 -783 789 -780 Q790 -778 792 -768 Q793 -764 793 -759 L772 -759 Q753 -759 747 -761 Q745 -757 741.0 -748.0 Q737 -739 730.5 -729.5 Q724 -720 715.0 -712.0 Q706 -704 694 -703 Q676 -700 652.5 -701.0 Q629 -702 614 -713 Q610 -713 609 -716 L609 -570 Q606 -569 604 -568 Q601 -567 597 -567 L597 -213 L595 -211 Q594 -210 583.5 -205.5 Q573 -201 558.5 -198.0 Q544 -195 528.5 -197.0 Q513 -199 502 -211 L502 -563 Q501 -564 500.0 -564.5 Q499 -565 498 -566 Q497 -567 496 -567 L442 -567 L430 -582 Q440 -628 449 -665 Q456 -697 462.0 -723.0 Q468 -749 468 -750 Q460 -766 452.5 -778.5 Q445 -791 440 -793 Q435 -795 417.5 -795.0 Q400 -795 385 -793 Q384 -792 382.0 -790.5 Q380 -789 378 -787 L373 -782 L361 -784 Q361 -785 360 -787 Q359 -788 358.5 -789.0 Q358 -790 357 -791 L280 -791 L280 -731 L276 -731 Q274 -729 264.0 -726.5 Q254 -724 246 -726 Q240 -728 236.0 -729.5 Q232 -731 230 -731 Q229 -731 226.0 -731.0 Q223 -731 219 -732 Q215 -732 209 -733 Q207 -733 202.5 -736.5 Q198 -740 193 -748 Q191 -751 191.0 -755.0 Q191 -759 191 -761 Q191 -773 197 -787 Q197 -789 198.0 -805.0 Q199 -821 199 -834 L205 -956 L224 -982 L224 -984 L264 -982 L266 -982 Q280 -980 297.0 -978.5 Q314 -977 329.0 -976.0 Q344 -975 354.5 -974.0 Q365 -973 367 -973 Q369 -973 382.0 -971.5 Q395 -970 410.0 -968.0 Q425 -966 438.0 -964.0 Q451 -962 454 -962 L456 -962 L456 -960 Q458 -960 460.0 -956.5 Q462 -953 460 -948 Q457 -944 448 -941 Q442 -939 431.5 -938.5 Q421 -938 410.5 -938.0 Q400 -938 392.0 -938.5 Q384 -939 383 -939 L306 -945 L305 -945 Q304 -945 304 -947 L304 -939 Q309 -939 319.0 -938.5 Q329 -938 340.0 -937.0 Q351 -936 360.5 -935.0 Q370 -934 373 -933 Q376 -933 407.0 -933.0 Q438 -933 483.0 -933.0 Q528 -933 579.5 -933.0 Q631 -933 676 -933 Q676 -935 676.5 -940.0 Q677 -945 678 -950 Q679 -956 680 -963 L682 -963 Q686 -964 694.5 -964.5 Q703 -965 711.5 -965.0 Q720 -965 726.5 -964.5 Q733 -964 735 -962 Q738 -960 741.5 -953.0 Q745 -946 747 -941 L830 -941 Q830 -943 830.0 -945.5 Q830 -948 831 -951 Q831 -955 832 -958 L834 -958 Q838 -960 845.5 -963.0 Q853 -966 860.5 -969.0 Q868 -972 875.0 -973.0 Q882 -974 886 -973 Q894 -970 896.0 -965.0 Q898 -960 898 -958 L898 -904 L906 -896 L951 -896 L957 -887 Z M717 -756 Q717 -763 711.5 -768.5 Q706 -774 698 -774 L636 -774 Q628 -774 622.0 -768.5 Q616 -763 616 -756 L616 -746 Q616 -738 622.0 -733.0 Q628 -728 636 -728 L698 -728 Q706 -728 711.5 -733.0 Q717 -738 717 -746 L717 -756 L717 -756 Z M256 -935 Q251 -937 245.0 -937.0 Q239 -937 236 -937 Q234 -934 234.0 -929.0 Q234 -924 234 -918 Q234 -908 235.0 -896.0 Q236 -884 238 -868 Q241 -889 247.0 -908.0 Q253 -927 256 -935 Z", (191, 195, 957, 984)),
    "m3": ("M1338 -964 L1338 -937 L1333 -937 L1218 -937 L1218 -927 L1312 -927 L1312 -925 Q1314 -920 1315 -916 Q1317 -907 1312 -901 L1310 -898 L1308 -898 L1306 -898 L1213 -898 Q1213 -899 1210 -896 Q1208 -895 1207 -894 L1185 -894 L1181 -898 L1109 -898 L1101 -887 L1088 -885 L1085 -885 L1085 -871 L1083 -867 L1078 -865 L1071 -865 L1068 -865 L1068 -890 L1062 -890 L1054 -887 L1053 -888 Q1051 -890 1050 -890 Q1050 -888 1048 -886 L1047 -885 L1040 -882 L1036 -881 L824 -881 L819 -887 L817 -889 Q815 -891 815 -891 L702 -887 L697 -891 Q696 -891 696 -892 Q694 -894 694 -894 L583 -894 L571 -890 Q566 -888 561.0 -885.5 Q556 -883 552 -878 L546 -870 Q542 -866 540.5 -863.5 Q539 -861 533 -861 Q530 -860 523.5 -859.5 Q517 -859 510.0 -858.5 Q503 -858 497.5 -858.0 Q492 -858 491 -858 Q489 -858 485.0 -859.0 Q481 -860 477 -858 Q475 -857 470.0 -846.5 Q465 -836 459.5 -823.0 Q454 -810 449.5 -797.0 Q445 -784 445 -778 L445 -774 Q450 -766 453.0 -764.0 Q456 -762 456 -760 L458 -758 L450 -752 Q442 -756 432 -760 Q424 -763 414.0 -765.5 Q404 -768 393 -768 Q382 -768 378.0 -770.0 Q374 -772 372 -775 Q372 -779 377 -782 Q380 -788 385.5 -798.0 Q391 -808 396.5 -818.5 Q402 -829 405.5 -839.0 Q409 -849 409 -854 L406 -854 Q406 -859 404.5 -864.5 Q403 -870 398 -871 Q390 -875 383 -871 Q379 -870 354.0 -860.0 Q329 -850 294.5 -835.5 Q260 -821 221.0 -804.0 Q182 -787 148.5 -772.5 Q115 -758 92.5 -748.0 Q70 -738 69 -738 L64 -740 L60 -744 L45 -887 L395 -932 Q399 -932 405.5 -933.5 Q412 -935 416 -937 Q418 -937 421 -938 Q423 -939 425.5 -939.0 Q428 -939 430 -941 Q442 -948 447 -948 L445 -948 Q447 -948 463.0 -956.0 Q479 -964 505 -965 Q517 -966 553.5 -966.0 Q590 -966 629 -966 Q675 -966 728 -965 L745 -965 L754 -972 L759 -977 L769 -977 L775 -972 L777 -968 L782 -965 L1298 -965 L1308 -978 L1314 -977 L1324 -965 L1327 -964 L1338 -964 Z M531 -891 Q531 -896 527.0 -900.5 Q523 -905 515 -905 L487 -905 Q479 -905 475.0 -900.5 Q471 -896 471 -891 Q471 -877 487 -877 L515 -877 Q531 -877 531 -891 Z", (45, 738, 1338, 978)),
    "xm1014": ("M1427 -927 Q1427 -922 1426.5 -915.0 Q1426 -908 1424 -904 Q1420 -900 1407.5 -899.5 Q1395 -899 1383 -899 L1383 -894 L1384 -894 Q1386 -894 1386 -891 Q1390 -891 1399.0 -892.0 Q1408 -893 1414 -889 Q1418 -887 1421.0 -878.0 Q1424 -869 1422 -861 Q1418 -849 1406 -845 L1347 -845 L1053 -845 Q1051 -845 1036.0 -840.0 Q1021 -835 992 -835 L986 -835 Q971 -835 944.5 -835.0 Q918 -835 886.0 -834.5 Q854 -834 821.0 -834.0 Q788 -834 760.0 -834.0 Q732 -834 713.0 -834.0 Q694 -834 692 -835 Q686 -837 680.5 -837.5 Q675 -838 669 -838 L651 -838 Q647 -839 638.5 -839.5 Q630 -840 621.0 -840.5 Q612 -841 604.5 -841.0 Q597 -841 595 -840 Q592 -840 587 -835 Q574 -827 569 -827 Q567 -827 562.0 -829.0 Q557 -831 549 -833 Q541 -835 531.5 -836.5 Q522 -838 520 -838 Q515 -838 502.0 -837.5 Q489 -837 485 -833 Q482 -833 477 -825 Q471 -819 464.0 -811.5 Q457 -804 449 -802 L441 -802 Q437 -800 435.0 -799.5 Q433 -799 431 -799 Q427 -799 417.0 -798.5 Q407 -798 395.5 -797.5 Q384 -797 375.0 -795.5 Q366 -794 364 -792 Q363 -791 359.0 -782.0 Q355 -773 349.0 -760.0 Q343 -747 336.0 -733.0 Q329 -719 323 -707 Q323 -697 324 -693 Q325 -689 326 -687 L328 -684 Q330 -682 333.0 -680.0 Q336 -678 336 -674 L334 -671 Q332 -669 327.0 -668.5 Q322 -668 317 -668 Q311 -668 303 -669 Q295 -671 283.0 -673.5 Q271 -676 260.0 -679.0 Q249 -682 240.5 -684.5 Q232 -687 231 -689 Q231 -689 230 -691 L230 -692 L229 -692 Q226 -694 226 -699 L226 -702 Q227 -704 234.5 -717.0 Q242 -730 250.5 -746.0 Q259 -762 266.5 -775.5 Q274 -789 275 -792 Q275 -796 274.5 -802.0 Q274 -808 270 -812 Q264 -814 255.0 -815.5 Q246 -817 241 -815 Q231 -815 231 -817 L229 -817 Q229 -819 230 -821 Q230 -823 230.5 -824.5 Q231 -826 231 -827 Q229 -827 213.0 -823.5 Q197 -820 178.5 -815.5 Q160 -811 145.0 -807.5 Q130 -804 129 -804 Q127 -802 124.5 -798.5 Q122 -795 116 -789 Q113 -785 110.0 -778.5 Q107 -772 104.0 -765.5 Q101 -759 99.0 -754.0 Q97 -749 96 -748 Q95 -747 89 -743 Q84 -740 71.5 -734.0 Q59 -728 37 -720 L34 -720 L24 -723 L21 -909 L98 -920 Q102 -921 104.0 -922.5 Q106 -924 108 -926 Q110 -928 111 -930 L364 -953 L364 -950 Q366 -946 368.0 -943.0 Q370 -940 372 -940 Q373 -939 374 -939 Q376 -939 377 -940 L380 -943 L380 -945 L380 -950 L382 -950 Q395 -970 400 -975 Q403 -979 405 -979 Q415 -979 418 -971 Q423 -966 428 -966 L433 -963 L449 -963 Q457 -963 462.0 -962.5 Q467 -962 467 -958 Q469 -958 469 -950 L469 -945 Q470 -945 471.0 -944.5 Q472 -944 473 -944 L474 -943 L474 -958 L687 -958 L687 -955 Q687 -950 688.5 -945.0 Q690 -940 692 -940 L1340 -940 Q1342 -942 1346.0 -946.5 Q1350 -951 1350 -955 L1352 -961 Q1352 -965 1354.0 -970.5 Q1356 -976 1360 -976 Q1363 -976 1370.5 -972.0 Q1378 -968 1386.0 -963.0 Q1394 -958 1400.5 -952.5 Q1407 -947 1409 -943 Q1411 -941 1412.0 -940.5 Q1413 -940 1414 -939 Q1415 -938 1416 -938 L1419 -938 L1427 -935 L1427 -932 L1427 -927 Z M1352 -894 Q1349 -899 1347 -899 L1332 -899 L1329 -902 L1053 -902 Q1048 -897 1048 -894 L1048 -891 Q1053 -890 1084.0 -890.0 Q1115 -890 1159.0 -890.5 Q1203 -891 1253.0 -892.0 Q1303 -893 1345 -894 L1352 -894 L1352 -894 Z M431 -815 Q439 -815 442.5 -819.5 Q446 -824 446 -830 Q446 -838 442.5 -843.0 Q439 -848 431 -848 L395 -848 Q389 -848 384.5 -843.0 Q380 -838 380 -830 Q380 -824 384.5 -819.5 Q389 -815 395 -815 L431 -815 L431 -815 Z M682 -961 L672 -961 L672 -968 L682 -968 L682 -961 Z M661 -958 L651 -958 L651 -968 L661 -968 L661 -958 Z M641 -961 L631 -961 L631 -971 L641 -971 L641 -961 Z M623 -961 L613 -961 L613 -971 L623 -971 L623 -961 Z M602 -961 L592 -961 L592 -971 L602 -971 L602 -961 Z M582 -961 L572 -961 L572 -971 L582 -971 L582 -961 Z M561 -961 L551 -961 L551 -971 L561 -971 L561 -961 Z M541 -961 L531 -961 L531 -971 L541 -971 L541 -961 Z M520 -961 L510 -961 L510 -971 L520 -971 L520 -961 Z M503 -961 L492 -961 L492 -971 L503 -971 L503 -961 Z", (21, 668, 1427, 979)),
    "famas": ("M1311 -829 Q1313 -826 1314.5 -817.5 Q1316 -809 1311 -797 L1311 -795 L1309 -795 Q1308 -795 1297.0 -794.0 Q1286 -793 1272.5 -792.5 Q1259 -792 1247.0 -792.0 Q1235 -792 1232 -795 Q1230 -795 1229 -796 Q1228 -796 1227 -797 L1128 -797 Q1124 -795 1118.5 -794.0 Q1113 -793 1110 -791 Q1108 -789 1100.0 -787.5 Q1092 -786 1090 -786 Q1089 -786 1084 -791 L1082 -791 Q1081 -790 1081 -788 Q1080 -786 1080 -782 L1080 -781 Q1079 -778 1077.5 -772.0 Q1076 -766 1073.0 -760.0 Q1070 -754 1065.0 -750.0 Q1060 -746 1052 -746 L808 -746 Q803 -746 799 -742 L799 -740 L799 -733 L799 -726 Q799 -718 798.0 -709.5 Q797 -701 792 -694 Q785 -689 774 -689 Q764 -690 752.0 -691.0 Q740 -692 729.0 -693.5 Q718 -695 710.0 -696.5 Q702 -698 699 -699 Q696 -697 688.5 -692.0 Q681 -687 681 -673 L681 -660 L679 -659 Q677 -657 672.0 -651.0 Q667 -645 667 -640 Q667 -636 668 -634 Q668 -632 669 -630 L672 -625 L669 -625 Q667 -624 661.5 -616.5 Q656 -609 656 -595 L656 -589 L658 -585 L651 -585 Q647 -586 637.0 -588.0 Q627 -590 615.5 -593.0 Q604 -596 594.5 -600.5 Q585 -605 583 -611 L581 -613 Q583 -646 589.5 -677.0 Q596 -708 622 -731 Q623 -734 624.0 -737.5 Q625 -741 625 -744 Q625 -750 615 -756 Q610 -758 597.0 -758.0 Q584 -758 567 -752 Q527 -737 513 -694 L511 -693 Q499 -685 493 -685 L493 -683 Q493 -677 493.5 -663.5 Q494 -650 495.0 -634.0 Q496 -618 497.0 -600.5 Q498 -583 499 -569 L499 -567 L499 -565 Q498 -565 492.0 -560.5 Q486 -556 474.0 -550.5 Q462 -545 444.5 -541.0 Q427 -537 404 -538 L402 -538 Q399 -589 397 -629 Q395 -664 394.0 -693.0 Q393 -722 393 -726 Q370 -722 350.5 -718.5 Q331 -715 327 -713 Q327 -712 326.0 -709.5 Q325 -707 325 -705 Q325 -694 320 -694 Q318 -693 307.0 -691.0 Q296 -689 291 -687 L289 -687 Q287 -689 285 -692 Q283 -694 282.0 -696.5 Q281 -699 280 -701 Q275 -698 263.0 -693.5 Q251 -689 234.5 -685.0 Q218 -681 199.5 -678.0 Q181 -675 162 -677 L160 -678 L158 -680 Q144 -724 139.0 -756.0 Q134 -788 134 -809 Q134 -849 143.5 -862.5 Q153 -876 157 -878 Q158 -878 164.0 -887.5 Q170 -897 176 -906 L176 -908 L291 -908 L291 -906 Q295 -898 302.5 -889.0 Q310 -880 314 -878 Q317 -878 329.5 -885.5 Q342 -893 352 -903 L354 -903 Q383 -901 413.0 -900.0 Q443 -899 467.5 -898.5 Q492 -898 509.5 -898.5 Q527 -899 531 -901 Q532 -904 534.5 -911.5 Q537 -919 539.0 -926.5 Q541 -934 542.5 -940.5 Q544 -947 545 -949 L545 -951 Q546 -953 548.0 -955.0 Q550 -957 556.0 -958.5 Q562 -960 574.0 -961.5 Q586 -963 607 -965 Q694 -970 894 -956 Q952 -955 987.0 -954.0 Q1022 -953 1040.0 -952.5 Q1058 -952 1064.0 -951.5 Q1070 -951 1071 -951 Q1072 -951 1077.0 -951.5 Q1082 -952 1087 -945 Q1098 -932 1098 -901 Q1098 -891 1097.5 -879.0 Q1097 -867 1094 -853 Q1093 -849 1093 -846 Q1092 -842 1092 -837 Q1094 -837 1097.0 -836.5 Q1100 -836 1102 -836 Q1105 -835 1108 -835 L1124 -832 Q1124 -831 1125 -830 Q1125 -829 1125.5 -828.5 Q1126 -828 1126 -827 L1212 -827 Q1215 -828 1218.5 -828.5 Q1222 -829 1224 -830 L1230 -832 Q1233 -833 1244.0 -833.5 Q1255 -834 1268.0 -834.5 Q1281 -835 1292.5 -834.5 Q1304 -834 1307 -834 L1311 -832 L1311 -829 L1311 -829 Z M1037 -892 Q1037 -902 1031.0 -907.5 Q1025 -913 1016 -913 L623 -913 Q603 -913 603 -892 L603 -872 Q603 -852 623 -852 L1016 -852 Q1025 -852 1031.0 -857.5 Q1037 -863 1037 -872 L1037 -892 L1037 -892 Z", (134, 537, 1316, 970)),
    "galil": ("M1376 -898 L1376 -880 L1376 -876 L1371 -876 L1318 -876 Q1316 -876 1290.5 -875.5 Q1265 -875 1234.0 -874.5 Q1203 -874 1174.0 -873.5 Q1145 -873 1135 -873 Q1135 -866 1131 -862 Q1119 -850 1110 -850 Q1105 -850 1098.0 -856.5 Q1091 -863 1087 -866 Q1085 -866 1081.5 -866.5 Q1078 -867 1074 -869 L1064 -873 Q1062 -874 1054.0 -874.5 Q1046 -875 1034.0 -875.0 Q1022 -875 1007.0 -874.5 Q992 -874 978 -873 Q978 -871 976 -867 Q975 -864 975 -862 L971 -860 Q969 -859 966 -859 Q966 -858 965.5 -854.5 Q965 -851 965 -847 Q964 -843 964 -837 L959 -837 Q937 -837 910.5 -836.5 Q884 -836 860.5 -835.5 Q837 -835 820.5 -834.5 Q804 -834 801 -834 Q799 -833 793.5 -832.5 Q788 -832 781.5 -831.0 Q775 -830 768.0 -829.0 Q761 -828 758 -827 L756 -827 L753 -834 Q752 -840 752 -846 Q751 -851 751.0 -856.0 Q751 -861 751 -864 Q748 -863 739.0 -861.5 Q730 -860 719.5 -858.0 Q709 -856 700.0 -854.5 Q691 -853 689 -853 Q689 -849 688.0 -846.0 Q687 -843 687 -841 Q687 -813 695.5 -779.5 Q704 -746 714.5 -716.5 Q725 -687 733.5 -667.5 Q742 -648 742 -647 L744 -644 L740 -642 Q737 -641 728 -637 Q720 -633 705.5 -626.0 Q691 -619 666 -606 L664 -606 L662 -606 Q653 -618 642.5 -647.5 Q632 -677 623.0 -709.0 Q614 -741 607.5 -769.5 Q601 -798 598 -807 Q593 -803 584 -800 Q582 -800 581.5 -799.0 Q581 -798 579 -798 Q576 -793 570 -793 Q544 -786 528.0 -792.5 Q512 -799 508 -802 Q507 -801 505 -800 L495 -795 Q478 -757 475.0 -732.5 Q472 -708 472 -697 L472 -692 L472 -688 Q472 -686 471.0 -685.5 Q470 -685 470 -683 Q461 -683 408 -711 L406 -713 L406 -715 Q412 -729 418.5 -745.5 Q425 -762 430.5 -776.5 Q436 -791 439.5 -801.5 Q443 -812 444 -814 Q444 -817 442.0 -819.0 Q440 -821 440 -823 Q439 -824 437 -827 Q435 -829 432.5 -831.5 Q430 -834 428 -837 Q426 -838 413.0 -838.0 Q400 -838 382.5 -837.5 Q365 -837 344.5 -836.0 Q324 -835 307 -834 L261 -832 Q218 -832 131 -754 L126 -750 Q122 -744 115 -741 Q108 -732 105.5 -729.5 Q103 -727 101 -727 Q96 -727 93.0 -734.5 Q90 -742 90 -747 Q90 -750 89.0 -764.0 Q88 -778 86.5 -796.0 Q85 -814 83.0 -833.0 Q81 -852 78 -864 Q73 -876 81 -887 Q86 -894 95.0 -894.0 Q104 -894 106 -894 L360 -894 Q363 -894 366.0 -894.0 Q369 -894 371 -896 L371 -898 Q373 -900 373.5 -901.5 Q374 -903 376 -905 Q380 -908 387 -908 Q396 -908 399 -910 Q402 -912 405.5 -912.0 Q409 -912 412 -914 Q420 -916 426.0 -919.0 Q432 -922 435 -926 Q439 -929 439.5 -934.5 Q440 -940 442 -951 L442 -956 Q442 -966 447 -969 Q451 -972 458 -972 L463 -972 L465 -969 L476 -958 Q476 -955 490 -960 L492 -960 L497 -960 Q501 -958 502.5 -951.0 Q504 -944 506 -937 Q522 -939 541.0 -939.0 Q560 -939 563 -937 Q565 -936 567 -936 Q569 -935 573 -935 L712 -935 Q712 -940 710 -944 L708 -949 L730 -949 L733 -949 L733 -944 Q733 -942 734 -941 Q734 -940 735 -940 L760 -940 L767 -940 L1071 -940 Q1071 -942 1070.5 -944.5 Q1070 -947 1070 -951 Q1069 -955 1069 -960 L1076 -974 L1099 -976 L1101 -976 L1101 -949 L1101 -937 L1100 -936 Q1099 -935 1098.0 -934.5 Q1097 -934 1096 -933 Q1101 -928 1114.0 -921.0 Q1127 -914 1142 -914 Q1149 -913 1164.5 -912.5 Q1180 -912 1199.0 -912.0 Q1218 -912 1238.5 -912.5 Q1259 -913 1276.0 -913.0 Q1293 -913 1304.5 -913.5 Q1316 -914 1318 -914 Q1321 -914 1328.0 -915.5 Q1335 -917 1343.5 -918.0 Q1352 -919 1360.0 -919.5 Q1368 -920 1371 -917 Q1376 -917 1376 -912 L1376 -898 Z M582 -827 Q582 -835 577.5 -839.0 Q573 -843 568 -843 L529 -843 Q524 -843 519.5 -839.0 Q515 -835 515 -827 Q515 -820 519.5 -815.5 Q524 -811 529 -811 L568 -811 Q573 -811 577.5 -815.5 Q582 -820 582 -827 Z M104 -864 Q105 -856 107.0 -844.5 Q109 -833 110.5 -821.0 Q112 -809 113.0 -797.5 Q114 -786 115 -779 Q120 -783 129.5 -790.5 Q139 -798 149 -807 Q170 -822 190.5 -837.5 Q211 -853 227 -864 L104 -864 Z", (73, 606, 1376, 976)),
    "elites": ("M614 -962 Q619 -961 620.5 -955.0 Q622 -949 622 -945 Q627 -937 627 -929 Q627 -924 626.0 -920.5 Q625 -917 624 -913 L624 -910 Q624 -909 623.5 -900.5 Q623 -892 622.5 -882.5 Q622 -873 621.0 -864.5 Q620 -856 620 -854 L620 -850 L578 -850 Q577 -848 577.0 -847.0 Q577 -846 575 -844 Q575 -844 573.5 -843.5 Q572 -843 565.5 -842.5 Q559 -842 546.0 -842.0 Q533 -842 509 -842 Q497 -842 486.0 -842.5 Q475 -843 466 -843 L447 -843 Q442 -843 437 -842 Q426 -840 416 -833 Q405 -825 398.0 -816.5 Q391 -808 390 -803 Q389 -795 389.0 -788.5 Q389 -782 390 -780 Q393 -772 390.5 -769.0 Q388 -766 386 -764 L386 -763 Q384 -761 375.5 -758.5 Q367 -756 357.5 -753.0 Q348 -750 340.0 -748.0 Q332 -746 332 -746 Q323 -744 307.0 -745.0 Q291 -746 261 -751 Q247 -753 239.5 -750.5 Q232 -748 228 -745 Q224 -741 222 -737 L194 -641 L194 -637 Q194 -633 194.0 -625.0 Q194 -617 196 -601 Q198 -597 198 -590 Q198 -572 190 -564 Q186 -560 183.5 -559.5 Q181 -559 180 -559 L83 -559 L82 -559 Q82 -560 71 -564 Q66 -566 64.5 -572.0 Q63 -578 63 -584 L63 -593 Q43 -594 36.5 -596.5 Q30 -599 28 -601 Q27 -602 27 -604 Q26 -605 26 -607 L26 -613 Q25 -617 25 -622 Q25 -624 24.5 -626.0 Q24 -628 24 -630 Q24 -644 27.5 -658.0 Q31 -672 31 -674 L31 -675 Q32 -676 40.5 -695.5 Q49 -715 59.0 -738.0 Q69 -761 77.5 -780.5 Q86 -800 88 -802 Q90 -810 90 -812 Q90 -821 84 -831 Q80 -839 69.5 -841.0 Q59 -843 50 -845 Q43 -845 39 -847 Q34 -852 34 -857 L34 -858 Q34 -865 37 -868 Q41 -873 48 -873 Q50 -874 51.5 -874.0 Q53 -874 55 -875 Q59 -877 67 -886 L69 -889 Q74 -895 77.5 -905.0 Q81 -915 82 -920 Q82 -923 80 -931 Q78 -941 78 -945 L78 -948 Q80 -954 83 -955 Q88 -958 93 -956 Q96 -955 102.5 -953.5 Q109 -952 111 -952 Q111 -952 121 -956 Q124 -957 127.5 -958.5 Q131 -960 134 -961 Q136 -962 140 -962 L141 -962 L141 -965 L141 -970 L141 -975 L146 -975 Q162 -974 165.5 -973.0 Q169 -972 169 -970 Q171 -964 171 -958 Q174 -958 184.0 -958.0 Q194 -958 205 -959 Q217 -959 233 -960 Q258 -960 271.5 -959.5 Q285 -959 291.5 -959.0 Q298 -959 299.5 -958.5 Q301 -958 302 -958 Q304 -956 306 -952 L574 -952 L576 -952 L576 -953 Q576 -955 579 -958 Q580 -960 581.5 -960.5 Q583 -961 585 -963 Q590 -969 599.5 -967.5 Q609 -966 611 -965 L613 -964 L614 -962 L614 -962 Z M242 -815 Q240 -811 240 -803 Q240 -793 243 -790 L244 -789 Q246 -787 248.0 -785.5 Q250 -784 255 -779 L258 -778 Q264 -774 280.5 -769.5 Q297 -765 316 -768 Q364 -776 368 -792 Q369 -795 369 -802 Q369 -810 364.5 -818.5 Q360 -827 346 -834 Q333 -834 319.5 -834.0 Q306 -834 295.0 -834.0 Q284 -834 276.0 -833.5 Q268 -833 267 -833 L264 -832 Q259 -830 251.5 -826.0 Q244 -822 242 -815 Z M1229 -943 Q1233 -936 1233 -927 Q1233 -922 1232.5 -918.5 Q1232 -915 1232 -911 Q1232 -910 1231.0 -909.5 Q1230 -909 1230 -908 Q1230 -907 1229.5 -898.5 Q1229 -890 1228.5 -880.5 Q1228 -871 1227.5 -862.5 Q1227 -854 1227 -852 L1227 -847 L1184 -847 Q1184 -846 1182 -842 Q1181 -842 1179.5 -841.5 Q1178 -841 1171.5 -840.5 Q1165 -840 1152.0 -840.0 Q1139 -840 1115 -840 Q1103 -840 1092.0 -840.5 Q1081 -841 1072 -841 L1053 -841 Q1048 -841 1043 -840 Q1033 -838 1024 -831 Q1012 -823 1005.0 -814.5 Q998 -806 997 -801 Q996 -793 996.0 -786.5 Q996 -780 996 -778 Q1001 -770 997.5 -767.0 Q994 -764 992 -762 L992 -760 Q990 -758 982.0 -756.0 Q974 -754 964 -751 Q953 -747 939 -744 Q930 -742 914.0 -742.5 Q898 -743 869 -748 Q855 -750 847.5 -748.0 Q840 -746 835 -743 Q830 -739 828 -735 L801 -639 Q801 -638 800.5 -637.5 Q800 -637 800 -635 Q800 -631 801.0 -623.0 Q802 -615 804 -599 L804 -588 Q804 -571 797 -561 Q794 -558 790.5 -557.5 Q787 -557 786 -557 L690 -557 L689 -557 L688 -558 Q687 -558 685 -559 Q683 -559 681.5 -559.5 Q680 -560 677 -561 Q669 -566 669 -582 Q669 -585 670.0 -587.0 Q671 -589 671 -591 Q650 -592 643.0 -594.0 Q636 -596 634 -599 L634 -602 Q633 -603 633 -605 Q633 -607 632.5 -608.0 Q632 -609 632 -611 Q631 -615 631 -620 L631 -627 Q631 -641 634.5 -655.5 Q638 -670 638 -671 L639 -671 L639 -672 Q640 -674 648.0 -693.0 Q656 -712 666.0 -735.0 Q676 -758 684.5 -777.5 Q693 -797 695 -800 Q697 -806 697 -810 Q697 -818 690 -829 Q686 -837 675.5 -839.0 Q665 -841 657 -843 Q649 -843 645 -845 Q640 -848 640 -855 L640 -856 Q640 -863 644 -866 Q648 -870 654 -870 Q656 -872 657.5 -872.0 Q659 -872 661 -873 Q665 -875 673 -884 L676 -887 Q681 -893 684.5 -903.0 Q688 -913 688 -918 Q688 -919 686 -929 Q684 -939 684 -943 L684 -945 Q686 -952 690 -953 Q694 -956 700 -954 Q703 -953 709.0 -951.5 Q715 -950 717 -950 Q719 -951 721.5 -951.5 Q724 -952 727 -954 Q731 -955 734.5 -956.0 Q738 -957 740 -958 Q743 -960 746 -960 L748 -960 L748 -963 L748 -967 L748 -973 L752 -973 Q769 -972 772.0 -970.5 Q775 -969 776 -967 Q777 -965 777.0 -962.5 Q777 -960 778 -956 L811 -956 Q823 -956 839 -957 Q864 -957 878.0 -957.0 Q892 -957 898.5 -956.5 Q905 -956 906.5 -956.0 Q908 -956 908 -956 Q913 -953 913 -950 L1180 -950 L1182 -950 L1182 -951 Q1182 -953 1183.5 -954.0 Q1185 -955 1186 -956 Q1188 -957 1188.5 -957.5 Q1189 -958 1191 -961 Q1197 -966 1206.0 -965.0 Q1215 -964 1217 -963 L1219 -962 L1221 -960 Q1226 -958 1227.0 -952.5 Q1228 -947 1229 -943 Z M849 -813 Q847 -805 847 -801 Q847 -791 850 -788 L850 -787 L851 -787 Q852 -784 862 -777 L864 -776 Q871 -771 887.5 -767.0 Q904 -763 924 -766 Q971 -772 974 -790 Q976 -794 976 -800 Q976 -808 971.5 -816.5 Q967 -825 953 -832 Q940 -832 926.5 -832.0 Q913 -832 902.0 -832.0 Q891 -832 883.0 -831.5 Q875 -831 874 -831 Q873 -831 873.0 -830.5 Q873 -830 872 -830 L871 -830 Q866 -828 858.5 -824.0 Q851 -820 849 -813 Z", (24, 557, 1233, 975)),
    "cruz_vida": ("M705 -839 L705 -549 L553 -549 L553 -401 L262 -401 L262 -553 L104 -553 L104 -844 L256 -844 L256 -994 L536 -994 L547 -994 L547 -839 L705 -839 Z M664 -590 L664 -798 L508 -798 L508 -800 L505 -800 L505 -953 L297 -953 L297 -802 L145 -802 L145 -594 L304 -594 L304 -442 L512 -442 L512 -590 L664 -590 Z M462 -761 L617 -761 L617 -644 L462 -644 L462 -491 L347 -491 L347 -644 L188 -644 L188 -761 L347 -761 L347 -912 L462 -912 L462 -761 Z", (104, 401, 705, 994)),
    "cronometro": ("M632 -789 Q652 -759 663.5 -723.0 Q675 -687 675 -646 Q675 -594 655.5 -548.5 Q636 -503 602.5 -469.0 Q569 -435 524.5 -415.0 Q480 -395 430 -395 Q379 -395 334.0 -415.0 Q289 -435 255.5 -469.0 Q222 -503 202.5 -548.5 Q183 -594 183 -646 Q183 -722 223 -784 Q217 -788 214 -791 Q199 -805 202.0 -829.5 Q205 -854 223 -874 Q234 -885 247.5 -891.0 Q261 -897 274 -897 Q294 -897 305 -887 Q308 -883 310.5 -879.5 Q313 -876 314 -871 Q354 -893 400 -897 L400 -931 L348 -931 L348 -993 L509 -993 L509 -931 L462 -931 L462 -897 Q482 -893 501.0 -887.5 Q520 -882 539 -872 Q541 -885 548 -891 Q554 -896 561.5 -899.0 Q569 -902 579 -902 Q591 -902 604.5 -895.0 Q618 -888 629 -877 Q640 -866 645.0 -852.5 Q650 -839 650 -827 L650 -825 Q650 -804 638 -795 Q637 -793 635.5 -792.0 Q634 -791 632 -789 Z M430 -457 Q468 -457 501.5 -472.0 Q535 -487 560.0 -513.0 Q585 -539 599.5 -573.0 Q614 -607 614 -646 Q614 -685 599.5 -720.0 Q585 -755 560.0 -780.5 Q535 -806 501.5 -821.0 Q468 -836 430 -836 Q392 -836 358.0 -821.0 Q324 -806 299.0 -780.5 Q274 -755 259.5 -720.0 Q245 -685 245 -646 Q245 -607 259.5 -573.0 Q274 -539 299.0 -513.0 Q324 -487 358.0 -472.0 Q392 -457 430 -457 Z M560 -757 L457 -654 L457 -648 Q457 -643 455 -639 L524 -568 L509 -552 L440 -623 Q437 -622 431 -622 Q419 -622 411.0 -629.5 Q403 -637 403 -648 Q403 -660 411.0 -668.5 Q419 -677 431 -677 Q432 -677 434 -675 L539 -780 L560 -757 Z", (183, 395, 675, 993)),
    "dinero": ("M773 -658 Q779 -645 781.5 -631.0 Q784 -617 784 -603 Q784 -536 742 -493 Q704 -453 648 -446 L648 -417 L585 -417 L585 -447 Q566 -450 550.5 -454.5 Q535 -459 524 -467 Q494 -480 471 -516 Q450 -550 446 -599 L446 -612 L531 -626 L534 -612 Q540 -570 555 -550 Q569 -533 585 -526 L585 -679 Q555 -688 521 -706 Q488 -725 474 -754 Q465 -769 461.0 -786.5 Q457 -804 457 -822 Q457 -890 505 -934 Q532 -958 585 -966 L585 -996 L640 -996 L648 -996 L648 -966 Q694 -960 722 -936 Q764 -901 772 -841 L775 -826 L687 -815 L685 -829 Q680 -860 668 -872 Q663 -876 658.5 -879.5 Q654 -883 648 -885 L648 -750 Q684 -741 698 -735 Q712 -729 724.0 -721.0 Q736 -713 745 -703 Q764 -683 773 -658 Z M696 -599 Q696 -624 685 -641 Q682 -645 673.5 -650.5 Q665 -656 648 -662 L648 -526 Q657 -528 664.5 -533.5 Q672 -539 678 -546 Q696 -568 696 -599 Z M545 -828 Q545 -815 547.5 -805.0 Q550 -795 558 -787 Q565 -776 585 -767 L585 -887 Q572 -882 560 -870 Q545 -852 545 -828 Z", (446, 417, 784, 996)),
    "kevlar_casco": ("M644 -896 Q658 -771 630 -666 Q619 -623 601.0 -585.0 Q583 -547 560 -512 Q539 -483 518.5 -462.0 Q498 -441 481.5 -428.0 Q465 -415 454.5 -408.5 Q444 -402 444 -401 L438 -398 L432 -401 Q342 -463 290 -553 Q249 -625 233 -715 Q226 -753 225.0 -785.5 Q224 -818 225.0 -842.5 Q226 -867 228.0 -881.5 Q230 -896 230 -897 L233 -914 L247 -905 Q288 -880 331 -891 Q352 -897 369.0 -909.5 Q386 -922 398.5 -934.5 Q411 -947 418.0 -957.0 Q425 -967 426 -968 Q426 -972 428 -982 Q429 -986 430 -991 L445 -970 Q495 -894 560 -890 Q591 -887 626 -905 Q632 -909 639 -905 L644 -902 L644 -896 L644 -896 Z M609 -672 Q626 -738 626 -815 Q626 -831 625.5 -846.5 Q625 -862 623 -878 Q590 -865 558 -867 Q489 -871 436 -943 Q434 -941 431.5 -937.5 Q429 -934 426 -931 Q417 -920 402.5 -907.0 Q388 -894 370 -884 Q312 -850 251 -878 Q250 -867 248.5 -851.5 Q247 -836 247 -816 Q247 -773 256 -719 Q271 -633 310 -564 Q356 -480 439 -425 Q445 -428 456.0 -436.0 Q467 -444 481.0 -456.5 Q495 -469 511.0 -486.0 Q527 -503 542 -526 Q565 -559 581.5 -595.0 Q598 -631 609 -672 Z M572 -824 Q577 -776 573.5 -736.0 Q570 -696 561.0 -664.0 Q552 -632 539.5 -607.5 Q527 -583 514 -565 Q500 -545 486.5 -531.0 Q473 -517 462 -508 Q449 -497 438 -491 Q404 -514 380.0 -541.0 Q356 -568 340.5 -595.5 Q325 -623 316.5 -650.0 Q308 -677 304 -700 Q299 -725 298.5 -747.5 Q298 -770 298.5 -786.5 Q299 -803 300.5 -813.0 Q302 -823 302 -824 L304 -824 Q335 -803 370 -815 Q385 -820 397.5 -829.0 Q410 -838 418.0 -847.0 Q426 -856 430.5 -863.0 Q435 -870 435 -870 L436 -870 Q455 -841 475.0 -828.5 Q495 -816 513.0 -813.5 Q531 -811 545.5 -815.0 Q560 -819 569 -824 L572 -824 L572 -824 Z M430 -669 Q430 -667 436.0 -666.5 Q442 -666 444 -664 L502 -664 Q507 -664 518.5 -661.0 Q530 -658 534 -657 L534 -667 Q534 -744 493 -771 Q474 -783 453.0 -784.0 Q432 -785 414 -782 Q393 -778 372 -770 Q363 -765 355.5 -754.5 Q348 -744 343 -732 Q337 -718 331 -702 Q329 -700 327.0 -696.5 Q325 -693 323 -691 Q322 -691 322 -690 Q324 -690 328.0 -690.5 Q332 -691 337 -691 Q348 -693 357.5 -693.5 Q367 -694 372 -694 Q376 -694 383.0 -691.0 Q390 -688 398.5 -684.0 Q407 -680 414.5 -676.0 Q422 -672 427 -670 L430 -669 Z", (224, 398, 658, 991)),
})

# ================= MEDALLAS NUEVAS (tanda 2026-10-29) =================
# Forma nueva: pentágono = Rondas (lados, eco, supervivencia).
SHAPES["pentagono"] = "M130 26 L232 100 L194 252 H66 L28 100 Z"
LAYOUT["pentagono"] = dict(pill=72, num=128, pips=165)

ACC.update({
    # trayectoria (escudo)
    "kills": acc("#E2E8F0", "#94A3B8", "#334155", "#1C222B"),        # plomo: el número de bajas
    "dano": acc("#FECACA", "#EF4444", "#5F1414", "#311416"),         # rojo: sangre, daño hecho
    "novato": acc("#E0F2FE", "#7DD3FC", "#0C4A6E", "#10222F"),       # celeste: lo nuevo, el primer paso
    # habilidad (hexágono)
    "mvp_mix": acc("#FFFFFF", "#CBD5E1", "#334155", "#1E232B"),      # blanco: la estrella de la partida
    # arsenal (octágono)
    "smg": acc("#DDD6FE", "#8B5CF6", "#3B1F7A", "#221A3A"),          # violeta: rápidas, rondas forzadas
    "escopetas": acc("#FECDD3", "#F43F5E", "#5B1325", "#2E1219"),    # rojo cartucho
    "eco_rifles": acc("#99F6E4", "#2DD4BF", "#0F4D45", "#10292A"),   # turquesa: Famas/Galil, el rifle barato
    "elites": acc("#FBCFE8", "#EC4899", "#5B1238", "#2F1224"),       # rosa: las dos pistolas de lujo
    "explotada": acc("#FECACA", "#EF4444", "#5F1414", "#311416"),    # rojo: la explosión
    # rondas (pentágono)
    "lado_ct": acc("#BFDBFE", "#3B82F6", "#14306B", "#131E36"),      # azul CT
    "lado_t": acc("#FDE68A", "#F59E0B", "#5C3A06", "#2E2210"),       # amarillo-naranja T
    "eco": acc("#BBF7D0", "#22C55E", "#14532D", "#16301F"),          # verde billete
    "sobreviviente": acc("#A5F3FC", "#22D3EE", "#0E4A57", "#0F2A31"),  # cian: sigue vivo
    # premios de temporada (círculo)
    "top_fragger": acc("#FECACA", "#DC2626", "#4C0D0D", "#2C1213"),
    "rey_hs": acc("#FED7AA", "#F97316", "#5A2508", "#2E1A10"),
    "mejor_awp": acc("#D9F99D", "#65A30D", "#1F3A0B", "#18240F"),
    "mejorado": acc("#DDD6FE", "#8B5CF6", "#3B1F7A", "#221A3A"),
    # comunidad (sello)
    "fair_play": acc("#BAE6FD", "#38BDF8", "#0C3A5A", "#10222F"),
    "reclutador": acc("#FEF08A", "#FACC15", "#5A4506", "#2C2610"),
    "supporter": acc("#FECDD3", "#F43F5E", "#5B1325", "#2E1219"),
    "halloween": acc("#FED7AA", "#F97316", "#5A2508", "#2E1A10"),
    "navidad": acc("#FECACA", "#DC2626", "#4C0D0D", "#2C1213"),
    # equipos (banderín)
    "eq_plantel": acc("#99F6E4", "#2DD4BF", "#0F4D45", "#10292A"),
    "eq_quimica": acc("#E9D5FF", "#A855F7", "#3F1A66", "#24152F"),
    "eq_rivalidad": acc("#FECDD3", "#E11D48", "#4C0519", "#2E0E16"),
    "eq_overtime": acc("#BAE6FD", "#38BDF8", "#0C3A5A", "#10222F"),
})


def ic_cruzadas(a, b, flip_b=True, w=90, h=36):
    return (f'<g transform="rotate(-22 130 204)">{glyph(a, 130, 202, w, h)}</g>'
            f'<g transform="rotate(22 130 204)">{glyph(b, 130, 206, w, h, flip=flip_b)}</g>')


def ic_mira_clasica():
    ring = "M110 204 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0 Z M115.5 204 a14.5 14.5 0 1 0 29 0 a14.5 14.5 0 1 0 -29 0 Z"
    ticks = "M127.5 178 H132.5 V193 H127.5 Z M127.5 215 H132.5 V230 H127.5 Z M104 201.5 V206.5 H119 V201.5 Z M141 201.5 V206.5 H156 V201.5 Z"
    return f'''<path d="{ring} {ticks}" fill-rule="evenodd" {S}/>
    <circle cx="130" cy="204" r="4" fill="#FFFFFF" stroke="{K}" stroke-width="2"/>'''


def ic_corazon_roto():
    heart = "M130 230 C112 216 102 206 102 193 C102 183 110 177 118 177 C124 177 128 181 130 185 C132 181 136 177 142 177 C150 177 158 183 158 193 C158 206 148 216 130 230 Z"
    return f'''<path d="{heart}" {S}/>
    <path d="M131 184 L125 198 L134 204 L126 220" fill="none" stroke="{K}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M110 190 Q110 184 116 183" fill="none" stroke="#FFFFFF" stroke-width="2" opacity=".55" stroke-linecap="round"/>'''


def ic_huellas():
    foot = "M0 0 C-7 0 -9 9 -8 17 C-7 24 -3 28 0 28 C3 28 7 24 7 16 C8 8 6 0 0 0 Z"
    toes = '<circle cx="-5" cy="-6" r="2.4"/><circle cx="0" cy="-8" r="2.6"/><circle cx="5" cy="-6" r="2.4"/>'
    return f'''<g transform="translate(116 196) rotate(-12)"><path d="{foot}" {S}/><g {S.replace("2.5", "1.5")}>{toes}</g></g>
    <g transform="translate(144 186) rotate(12)"><path d="{foot}" {S}/><g {S.replace("2.5", "1.5")}>{toes}</g></g>'''


def ic_explosion():
    pts = []
    for i in range(24):
        a = math.radians(i * 15 - 90)
        r = 28 if i % 2 == 0 else 15 + (i % 4) * 2
        pts.append(f"{130 + r*math.cos(a):.1f} {204 + r*math.sin(a):.1f}")
    return f'''<path d="M{" L".join(pts)} Z" {S}/>
    {glyph("c4", 130, 204, 26, 26, sw=1.4, fill="#FFFFFF")}'''


def ic_flecha_arriba():
    return f'''<path d="M130 174 L156 202 H141 V230 H119 V202 H104 Z" {S}/>
    <path d="M124 206 V226" stroke="#FFFFFF" stroke-width="2.4" opacity=".5" stroke-linecap="round"/>'''


def ic_rey_hs():
    crown = "M112 178 L119 186 L130 172 L141 186 L148 178 L145 192 H115 Z"
    return f'''<g {S}><path d="{crown}"/></g>
    {glyph("headshot", 130, 212, 40, 36)}'''


def ic_apreton():
    return f'''<path d="M98 206 L114 192 L124 196 L118 204 Z" {S}/>
    <path d="M162 206 L146 192 L130 196 Q124 200 128 206 L136 204 Z" {S}/>
    <path d="M114 192 Q124 186 134 192 L150 208 Q154 214 148 216 L144 214 Q146 220 140 220 L136 218 Q136 224 130 222 L124 218 Q120 222 116 218 L108 210 Z" {S}/>
    <path d="M136 210 L142 216 M130 214 L135 219 M124 214 L129 219" stroke="{K}" stroke-width="2" opacity=".6"/>
    <rect x="92" y="200" width="12" height="18" rx="2" transform="rotate(-40 98 209)" fill="#2A2D35" stroke="{K}" stroke-width="2.2"/>
    <rect x="156" y="200" width="12" height="18" rx="2" transform="rotate(40 162 209)" fill="#2A2D35" stroke="{K}" stroke-width="2.2"/>'''


def ic_megafono():
    return f'''<path d="M106 198 L140 182 V226 L106 210 Z" {S}/>
    <rect x="98" y="196" width="10" height="16" rx="2" {S}/>
    <path d="M110 211 L114 226 H122 L119 214" {S}/>
    <path d="M148 194 Q154 204 148 214 M154 188 Q164 204 154 220" fill="none" stroke="{K}" stroke-width="5" stroke-linecap="round"/>
    <path d="M148 194 Q154 204 148 214 M154 188 Q164 204 154 220" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round"/>'''


def ic_corazon():
    heart = "M130 230 C112 216 102 206 102 193 C102 183 110 177 118 177 C124 177 128 181 130 185 C132 181 136 177 142 177 C150 177 158 183 158 193 C158 206 148 216 130 230 Z"
    return f'''<path d="{heart}" {S}/>
    <path d="{star(130, 201, 9)}" fill="#FFFFFF" opacity=".85"/>'''


def ic_calabaza():
    return f'''<path d="M130 180 Q128 172 134 168" fill="none" stroke="#3F6212" stroke-width="5" stroke-linecap="round"/>
    <g {S}><ellipse cx="114" cy="206" rx="13" ry="22"/><ellipse cx="146" cy="206" rx="13" ry="22"/><ellipse cx="130" cy="206" rx="15" ry="24"/></g>
    <g fill="{K}"><path d="M118 198 L124 192 L127 200 Z M142 198 L136 192 L133 200 Z"/><path d="M116 212 L122 216 L126 212 L130 217 L134 212 L138 216 L144 212 Q138 224 130 224 Q122 224 116 212 Z"/></g>'''


def ic_arbol():
    return f'''<g {S}><path d="M130 176 L148 198 H139 L154 216 H106 L121 198 H112 Z"/><rect x="125" y="216" width="10" height="12" rx="1"/></g>
    <path d="{star(130, 175, 7)}" fill="#FDE047" stroke="{K}" stroke-width="1.6"/>
    <g fill="#FFFFFF"><circle cx="124" cy="196" r="2.4"/><circle cx="138" cy="206" r="2.4"/><circle cx="118" cy="211" r="2.4"/><circle cx="144" cy="213" r="2.4"/></g>'''


def ic_matraz():
    return f'''<path d="M122 176 H138 V192 L156 222 Q158 230 150 230 H110 Q102 230 104 222 L122 192 Z" {S}/>
    <path d="M110 216 H150 L155 224 Q156 228 150 228 H110 Q104 228 105 224 Z" fill="#FFFFFF" opacity=".55"/>
    <rect x="119" y="173" width="22" height="6" rx="2" fill="#C9CDD6" stroke="{K}" stroke-width="2"/>
    <g fill="#FFFFFF" opacity=".85"><circle cx="126" cy="208" r="3"/><circle cx="136" cy="200" r="2.2"/><circle cx="133" cy="212" r="1.8"/></g>'''


def ic_vs():
    return f'''<path d="M98 186 H162 L156 222 H104 Z" {S}/>
    <text x="130" y="213" font-family="Montserrat, Arial, sans-serif" font-size="24" font-weight="900" font-style="italic" letter-spacing="-1" text-anchor="middle" fill="#FFFFFF" stroke="{K}" stroke-width="1">VS</text>'''


# ---- generar ----
OUT = os.path.join(BASE_NUEVAS, "perfil")
os.makedirs(OUT, exist_ok=True)

CAT = "Trayectoria"
family("kills", "Kills totales", "escudo", "kills", "KILLS", ["1000", "5000", "10000"], ic_mira_clasica)
family("dano", "Dano total", "escudo", "dano", "DAÑO", ["10k", "50k", "100k"], ic_corazon_roto)
single("primer_mix", "Primer mix", "escudo", "novato", "plata", "PRIMER MIX", "1", ic_huellas)
single("primera_victoria", "Primera victoria", "escudo", "novato", "oro", "1RA VICTORIA", "1", ic_bandera)

CAT = "Habilidad"
family("mvp_mix", "MVP del mix", "hexagono", "mvp_mix", "MVP MIX", ["10", "50", "100"], ic_estrella)

CAT = "Arsenal y bomba"
family("smg", "Kills con SMG", "octagono", "smg", "SMG", ["100", "500", "1000"], lambda: glyph("mp5", 130, 204, 86, 46))
family("escopetas", "Kills con escopeta", "octagono", "escopetas", "ESCOPETAS", ["50", "250", "500"], lambda: ic_cruzadas("m3", "xm1014", w=96, h=30))
family("eco_rifles", "Kills con Famas/Galil", "octagono", "eco_rifles", "FAMAS / GALIL", ["100", "500", "1000"], lambda: ic_cruzadas("famas", "galil"))
family("elites", "Kills con Dual Elites", "octagono", "elites", "ELITES", ["10", "50", "100"], lambda: glyph("elites", 130, 204, 80, 40))
family("explotadas", "Bombas explotadas", "octagono", "explotada", "EXPLOTADAS", ["10", "50", "100"], ic_explosion)

CAT = "Rondas"
family("lado_ct", "Rondas ganadas de CT", "pentagono", "lado_ct", "CT", ["100", "500", "1000"], lambda: glyph("m4a1", 130, 204, 96, 40))
family("lado_t", "Rondas ganadas de T", "pentagono", "lado_t", "T", ["100", "500", "1000"], lambda: glyph("ak47", 130, 204, 96, 40))
family("eco_ganado", "Rondas eco ganadas", "pentagono", "eco", "ECO", ["5", "25", "100"], lambda: glyph("dinero", 130, 204, 40, 50))
family("sobreviviente", "Rondas sobrevividas", "pentagono", "sobreviviente", "VIVO", ["100", "500", "1000"], lambda: glyph("cruz_vida", 130, 204, 46, 46))

CAT = "Premios de temporada"
single_logro("top_fragger_temporada", "Top fragger de la temporada", "top_fragger", "oro", "TOP FRAGGER", lambda: glyph("calavera", 130, 204, 60, 46))
single_logro("rey_hs_temporada", "Rey del HS de la temporada", "rey_hs", "oro", "REY DEL HS", ic_rey_hs)
single_logro("mejor_awp_temporada", "Mejor AWPer de la temporada", "mejor_awp", "oro", "MEJOR AWP", lambda: glyph("awp", 130, 204, 96, 36))
single_logro("mas_mejorado_temporada", "Jugador mas mejorado", "mejorado", "plata", "+ MEJORADO", ic_flecha_arriba)

CAT = "Comunidad"
single_logro("fair_play", "Fair play", "fair_play", "plata", "FAIR PLAY", ic_apreton, shape="sello", label="CM LEAGUE")
single_logro("reclutador", "Reclutador", "reclutador", "plata", "RECLUTADOR", ic_megafono, shape="sello", label="CM LEAGUE")
single_logro("supporter", "Supporter", "supporter", "oro", "SUPPORTER", ic_corazon, shape="sello", label="CM LEAGUE")
single_logro("halloween", "Evento Halloween", "halloween", "plata", "HALLOWEEN", ic_calabaza, shape="sello", label="2026")
single_logro("navidad", "Evento Navidad", "navidad", "plata", "NAVIDAD", ic_arbol, shape="sello", label="2026")
single_logro("aniversario_2", "Aniversario 2", "aniversario", "oro", "2 AÑOS", ic_torta, shape="sello", label="CM LEAGUE")

OUT = os.path.join(BASE_NUEVAS, "equipos")
os.makedirs(OUT, exist_ok=True)
B = "banderin"
CAT = "Equipo - nuevas"
single_logro("equipo_plantel_estable", "Plantel estable", "eq_plantel", "oro", "PLANTEL", ic_plantel, shape=B)
single_logro("equipo_pistolas_perfectas", "Pistolas perfectas", "pistolas", "plata", "PISTOLAS 2-0", ic_usp, shape=B)
single_logro("equipo_quimica", "Quimica", "eq_quimica", "plata", "QUÍMICA", ic_matraz, shape=B)
single_logro("equipo_rivalidad", "Rivalidad", "eq_rivalidad", "plata", "RIVALIDAD", ic_vs, shape=B)
single_logro("equipo_overtime", "Ganador en overtime", "eq_overtime", "plata", "OVERTIME", lambda: glyph("cronometro", 130, 204, 46, 50), shape=B)
single_logro("equipo_mejor_temporada", "Mejor equipo de la temporada", "mvp", "diamante", "MEJOR EQUIPO", ic_estrella, shape=B, rays_=True)

# ---- comunidad: beta testers y pioneros (primer mix de la plataforma) ----
ACC.update({
    "beta": acc("#D9F99D", "#84CC16", "#365314", "#1F2810"),        # lima: probar y encontrar bugs
    "pionero": acc("#C7D2FE", "#6366F1", "#25236B", "#1A1A36"),     # índigo: el lanzamiento, algo histórico
})


def ic_bug():
    legs = "M114 196 L104 190 M114 206 L102 206 M114 216 L104 222 M146 196 L156 190 M146 206 L158 206 M146 216 L156 222 M124 182 L118 172 M136 182 L142 172"
    return f'''<path d="{legs}" stroke="{K}" stroke-width="6" stroke-linecap="round"/>
    <path d="{legs}" stroke="url(#acento)" stroke-width="2.6" stroke-linecap="round"/>
    <ellipse cx="130" cy="188" rx="10" ry="8" {S}/>
    <ellipse cx="130" cy="210" rx="17" ry="21" {S}/>
    <path d="M130 192 V230" stroke="{K}" stroke-width="2.2"/>
    <text x="130" y="216" font-family="Montserrat, Arial, sans-serif" font-size="13" font-weight="900" text-anchor="middle" fill="#FFFFFF" opacity=".9">β</text>'''


def ic_cohete():
    return f'''<path d="M120 212 Q110 216 106 230 Q118 226 124 220 Z M140 212 Q150 216 154 230 Q142 226 136 220 Z" {S}/>
    <path d="M130 172 Q146 186 144 214 H116 Q114 186 130 172 Z" {S}/>
    <circle cx="130" cy="194" r="6" fill="#0F1014" stroke="#FFFFFF" stroke-width="2"/>
    <path d="M122 214 Q130 236 138 214 Z" fill="#FDE047" stroke="{K}" stroke-width="2"/>
    <path d="M124 186 Q124 200 122 208" fill="none" stroke="#FFFFFF" stroke-width="1.8" opacity=".5" stroke-linecap="round"/>'''


OUT = os.path.join(BASE_NUEVAS, "perfil")
CAT = "Comunidad"
single_logro("beta_tester", "Beta tester", "beta", "plata", "BETA TESTER", ic_bug, shape="sello", label="CM LEAGUE")
single_logro("pionero_primer_mix", "Pionero: jugo el primer mix de la plataforma", "pionero", "oro", "MIX #1", ic_cohete, shape="sello", label="PIONERO", rays_=True)


# ---- comunidad: Premium (un paso antes) y VIP (lo mejor) ----
ACC.update({
    "premium": acc("#E5E9F2", "#A9B4C8", "#2E3647", "#1B1F28"),     # platino: el paso previo
    "vip": acc("#FFE7A3", "#D4AF37", "#3A2A06", "#17130A"),         # negro y dorado: lo máximo
})


def ic_corona_premium():
    return f'''<g {S}><path d="M104 192 L116 204 L130 186 L144 204 L156 192 L151 222 H109 Z"/><path d="M109 222 H151 V229 H109 Z"/>
    <circle cx="104" cy="191" r="3.2"/><circle cx="130" cy="184" r="3.6"/><circle cx="156" cy="191" r="3.2"/></g>
    <path d="M114 210 H146" stroke="{K}" stroke-width="1.6" opacity=".45"/>'''


def ic_corona_vip():
    return f'''<g {S}><path d="M98 186 L112 202 L130 176 L148 202 L162 186 L157 216 H103 Z"/><path d="M103 216 H157 V230 H103 Z"/>
    <circle cx="98" cy="185" r="4"/><circle cx="130" cy="174" r="4.6"/><circle cx="162" cy="185" r="4"/></g>
    <circle cx="130" cy="203" r="5" fill="#FFFFFF" opacity=".95" stroke="{K}" stroke-width="1.5"/>
    <circle cx="115" cy="207" r="3" fill="#FFFFFF" opacity=".75"/><circle cx="145" cy="207" r="3" fill="#FFFFFF" opacity=".75"/>
    <g id="gemas-banda" stroke="{K}" stroke-width="1.4"><path d="M118 223 L122 219 L126 223 L122 227 Z" fill="#7DD3FC"/><path d="M126 223 L130 218.5 L134 223 L130 227.5 Z" fill="#F43F5E"/><path d="M134 223 L138 219 L142 223 L138 227 Z" fill="#7DD3FC"/></g>'''


OUT = os.path.join(BASE_NUEVAS, "perfil")
CAT = "Comunidad"
single_logro("premium", "Premium", "premium", "plata", "", ic_corona_premium, shape="sello", label="CM LEAGUE", estrellas=2)
single_logro("vip", "VIP", "vip", "oro", "", ic_corona_vip, shape="sello", label="CM LEAGUE", rays_=True, spark=True)


# ---- Premium y VIP por meses: mismo diseño que las insignias Premium y VIP ----
# El mes va en números romanos en la banda, entre dos estrellas (como los prestigios I, II, III...).
ROMANOS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"]
# Un color por mes, de frío a cálido, terminando en dorado al año.
COLOR_MES = ["#22C55E", "#14B8A6", "#06B6D4", "#3B82F6", "#6366F1", "#8B5CF6",
             "#A855F7", "#D946EF", "#EC4899", "#EF4444", "#F97316", "#EAB308"]


def mezcla(c1, c2, t):
    a = [int(c1[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(c2[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(x + (y - x) * t):02X}" for x, y in zip(a, b))


for i, c in enumerate(COLOR_MES, 1):
    ACC[f"mes_{i:02d}"] = acc(mezcla(c, "#FFFFFF", .55), c, mezcla(c, "#000000", .65), mezcla(c, "#121318", .8))

CAT = "Premium y VIP por meses"
OUT = os.path.join(BASE_NUEVAS, "perfil")
for mes in range(1, 13):
    single_logro(f"premium_mes_{mes:02d}", f"Premium {mes} {'mes' if mes == 1 else 'meses'}", f"mes_{mes:02d}", "plata",
                 ROMANOS[mes - 1], ic_corona_premium, shape="sello", label="CM LEAGUE", mes=True)
for mes in range(1, 13):
    single_logro(f"vip_mes_{mes:02d}", f"VIP {mes} {'mes' if mes == 1 else 'meses'}", f"mes_{mes:02d}", "oro",
                 ROMANOS[mes - 1], ic_corona_vip, shape="sello", label="CM LEAGUE", rays_=True, spark=True, mes=True)

# ---- Misiones (forma de portapapeles: las misiones son una lista de tareas) ----
SHAPES["portapapeles"] = "M60 44 H100 Q106 30 130 30 Q154 30 160 44 H200 Q222 44 222 66 V228 Q222 250 200 250 H60 Q38 250 38 228 V66 Q38 44 60 44 Z"
LAYOUT["portapapeles"] = dict(pill=64, num=126, pips=165)
ACC.update({
    "mis_completadas": acc("#BAE6FD", "#0EA5E9", "#0C3A5A", "#10222F"),   # celeste: tareas hechas
    "mis_semanas": acc("#E9D5FF", "#A855F7", "#3F1A66", "#24152F"),       # violeta: constancia semanal
    "mis_dificiles": acc("#FECACA", "#EF4444", "#5F1414", "#311416"),     # rojo: lo difícil
    "mis_perfecta": acc("#FDE68A", "#F59E0B", "#5C3A06", "#2E2210"),      # ámbar: semana perfecta
    "mis_primeros": acc("#BBF7D0", "#22C55E", "#14532D", "#16301F"),      # verde: el comienzo
})


def ic_check_circulo():
    return f'''<circle cx="130" cy="204" r="25" {S}/>
    <path d="M117 204 L126 213 L144 194" fill="none" stroke="{K}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M117 204 L126 213 L144 194" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'''


def ic_montana():
    return f'''<path d="M146 186 V168" stroke="{K}" stroke-width="4"/>
    <path d="M147 168 L162 173 L147 178 Z" fill="#FFFFFF" stroke="{K}" stroke-width="2"/>
    <path d="M96 230 L120 192 L132 208 L146 186 L164 230 Z" {S}/>
    <path d="M140 196 L146 186 L152 196 L146 192 Z" fill="#FFFFFF" opacity=".85"/>'''


def ic_semana_perfecta():
    return f'''<path d="{star(130, 204, 28)}" {S}/>
    <path d="M120 205 L127 212 L141 197" fill="none" stroke="{K}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>'''


def ic_camino():
    return f'''<path d="M100 228 Q104 208 122 210 Q140 212 142 196" fill="none" stroke="{K}" stroke-width="7" stroke-linecap="round" stroke-dasharray="2 8"/>
    <path d="M100 228 Q104 208 122 210 Q140 212 142 196" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="2 8"/>
    <path d="M146 196 C134 184 134 172 146 170 C158 172 158 184 146 196 Z" {S}/>
    <circle cx="146" cy="179" r="4" fill="#FFFFFF" stroke="{K}" stroke-width="1.5"/>'''


OUT = os.path.join(BASE_NUEVAS, "perfil")
CAT = "Misiones"
family("misiones_completadas", "Misiones completadas", "portapapeles", "mis_completadas", "MISIONES", ["10", "50", "100", "250"], ic_check_circulo)
family("semanas_completas", "Semanas completas", "portapapeles", "mis_semanas", "SEMANAS", ["4", "12", "26", "52"], ic_calendario)
family("misiones_dificiles", "Misiones dificiles", "portapapeles", "mis_dificiles", "DIFÍCILES", ["10", "25", "50"], ic_montana)
single_logro("semana_perfecta", "Semana perfecta", "mis_perfecta", "oro", "SEMANA PERFECTA", ic_semana_perfecta, shape="portapapeles", label="MISIONES")
single_logro("primeros_pasos_completos", "Primeros pasos completos", "mis_primeros", "plata", "PRIMEROS PASOS", ic_camino, shape="portapapeles", label="MISIONES")


if os.environ.get("MANIFEST"):
    import json
    json.dump(MANIFEST, open(os.environ["MANIFEST"], "w", encoding="utf-8"))
print("nuevas perfil:", len(os.listdir(os.path.join(BASE_NUEVAS, "perfil"))), "equipos:", len(os.listdir(os.path.join(BASE_NUEVAS, "equipos"))))
