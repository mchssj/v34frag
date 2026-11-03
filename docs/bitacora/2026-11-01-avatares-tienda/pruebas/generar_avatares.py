"""Genera los avatares de assets/perfil/avatares/ y los fondos nuevos, y los suma al catálogo.

Escribe los SVG, reemplaza los artículos de las colecciones "anime" y "memes" de assets/perfil/catalogo.json y el
bloque de carga de supabase/migrations/20261101120000_avatares_fondos.sql. Son diseños originales: sin personajes,
logos ni símbolos ajenos.
Uso (desde la raíz del repo): python docs/bitacora/2026-11-01-avatares-tienda/pruebas/generar_avatares.py
Correrlo después de generar_fondos.py, que reescribe todos los artículos kind "background" del catálogo.
"""
import json
import random
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(RAIZ / "docs" / "bitacora" / "2026-10-29-fondo-miniperfil" / "pruebas"))
from generar_fondos import BLUR, caida, cielo, fondo, svg, titila  # noqa: E402

PERFIL = RAIZ / "assets" / "perfil"
SQL = RAIZ / "supabase" / "migrations" / "20261101120000_avatares_fondos.sql"
TINTA = "#1b1522"
PRECIO = {"avatar": 1000, "background": 800}
PRECIO_VIP = 1000


def lienzo(defs, cuerpo):
    """Avatar: 256 x 256 en pantalla, dibujado en 400 x 400."""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="256" height="256">\n'
            f'  <defs>{defs}</defs>\n{cuerpo}\n</svg>\n')


def anim_y(valores, dur, extra=""):
    return (f'<animateTransform attributeName="transform" type="translate" values="{valores}" dur="{dur}s" '
            f'repeatCount="indefinite" {extra}/>')


def parpadeo(dur=4.6):
    return ('<animateTransform attributeName="transform" type="scale" values="1 1;1 1;1 .06;1 1;1 1" '
            f'keyTimes="0;.92;.95;.98;1" dur="{dur}s" repeatCount="indefinite"/>')


# ---------- caras de anime ----------

def ojo(cx, lado, p):
    """Un ojo en su lugar. Se dibuja el derecho y se espeja: el rabillo queda hacia afuera."""
    i = "d" if lado > 0 else "i"
    tinta = p.get("tinta", TINTA)
    if p.get("ojos") == "feliz":
        return (f'<g transform="translate({cx} 238) scale({lado} 1)">'
                f'<path d="M-30 8Q0 -28 30 6" fill="none" stroke="{tinta}" stroke-width="7" stroke-linecap="round"/>'
                f'<path d="M-34 -36Q0 -56 36 -38" fill="none" stroke="{tinta}" stroke-width="5" stroke-linecap="round"/></g>')
    ceja = {"serio": "M-36 -24L38 -46", "triste": "M-34 -46L38 -28"}.get(p.get("ojos"), "M-36 -38Q0 -56 38 -40")
    iris = f'url(#iris)'
    brillo = ""
    if p.get("brillo_ojo"):
        brillo = (f'<ellipse cx="0" cy="2" rx="24" ry="28" fill="{p["brillo_ojo"]}" filter="url(#bo)">'
                  '<animate attributeName="opacity" values=".25;.75;.25" dur="2.4s" repeatCount="indefinite"/></ellipse>')
    forma = "M-34 3Q-8 -25 30 -17Q38 6 22 20Q-10 29 -34 3Z"
    anim = parpadeo() if p.get("vip") else ""
    return (f'<g transform="translate({cx} 238) scale({lado} 1)">'
            f'<clipPath id="cl{i}"><path d="{forma}"/></clipPath>'
            f'<g><path d="{forma}" fill="#fbf7f2"/>'
            f'<g clip-path="url(#cl{i})"><path d="M-40 -30H44V-8Q0 -22 -40 6Z" fill="#b9b6cf"/>'
            f'<ellipse cx="0" cy="1" rx="18" ry="23" fill="{iris}" stroke="{tinta}" stroke-width="2.5"/>'
            f'<ellipse cx="0" cy="3" rx="8" ry="11" fill="{tinta}"/>{brillo}'
            f'<circle cx="-7" cy="-9" r="5.5" fill="#fff"/><circle cx="7" cy="10" r="2.6" fill="#fff"/></g>'
            f'{anim}</g>'
            f'<path d="M-40 8Q-10 -33 34 -22L44 -7Q8 -23 -33 7Z" fill="{tinta}"/>'
            f'<path d="M-24 17Q-4 27 22 21" fill="none" stroke="{tinta}" stroke-width="2.4" stroke-linecap="round"/>'
            f'<path d="{ceja}" fill="none" stroke="{p.get("ceja", tinta)}" stroke-width="6" stroke-linecap="round"/></g>')


def flequillo(puntas):
    """Casco de pelo que baja hasta la línea de puntas, listadas de derecha a izquierda."""
    tr = " ".join(f"L{x} {y}" for x, y in puntas)
    return f"M84 262C58 96 138 32 200 32C262 32 342 96 316 262{tr}Z"


def picos(arriba):
    return "".join(f'M{a} {b}L{c} {d}L{e} {f}Z' for a, b, c, d, e, f in arriba)


PELOS = {
    "rayo": {  # puntas largas, mechones laterales
        "puntas": [(330, 348), (296, 214), (292, 176), (268, 226), (244, 158), (222, 214), (196, 150), (172, 216),
                   (146, 158), (130, 226), (108, 176), (104, 214), (70, 348)],
        "picos": [(90, 130, 44, 66, 150, 66), (140, 80, 130, 4, 200, 44), (196, 60, 230, 0, 262, 56), (252, 70, 320, 28, 310, 130)],
    },
    "recto": {  # flequillo recto y melena
        "puntas": [(330, 390), (300, 390), (298, 192), (260, 204), (226, 198), (200, 206), (172, 198), (138, 204), (102, 192), (100, 390), (70, 390)],
    },
    "desordenado": {
        "puntas": [(322, 300), (298, 196), (276, 216), (258, 170), (232, 208), (206, 164), (178, 212), (152, 172), (128, 214), (102, 196), (78, 300)],
        "picos": [(100, 110, 60, 60, 160, 66), (170, 60, 176, 2, 232, 46), (232, 50, 300, 22, 300, 110)],
    },
    "largo": {
        "puntas": [(344, 400), (306, 400), (300, 218), (280, 166), (214, 190), (172, 150), (130, 178), (100, 218), (94, 400), (56, 400)],
    },
    "partido": {  # raya al medio
        "puntas": [(336, 340), (304, 240), (276, 170), (226, 136), (200, 118), (174, 136), (124, 170), (96, 240), (64, 340)],
    },
    "corto": {
        "puntas": [(316, 262), (300, 200), (262, 182), (230, 196), (194, 176), (160, 194), (126, 180), (100, 200), (84, 262)],
        "picos": [(150, 56, 186, 8, 214, 46), (214, 50, 262, 18, 262, 72)],
    },
}


def traje(p):
    c, c2 = p.get("traje", ("#2c2f3e", "#1a1c27"))
    return (f'<path d="M20 400C40 372 96 352 150 342H250C304 352 360 372 380 400Z" fill="{c}" stroke="{TINTA}" stroke-width="4"/>'
            f'<path d="M150 342L200 400L250 342L232 330H168Z" fill="{c2}"/>')


def extra_detras(p):
    e = p.get("extras", ())
    out = ""
    if "moño" in e:
        out += f'<circle cx="200" cy="30" r="30" fill="{p["pelo"]}" stroke="{TINTA}" stroke-width="4"/>'
    if "coletas" in e:
        for s in (-1, 1):
            out += (f'<path d="M{200 + s*110} 120C{200 + s*220} 110 {200 + s*210} 300 {200 + s*165} 360'
                    f'C{200 + s*175} 280 {200 + s*150} 200 {200 + s*100} 170Z" fill="{p["pelo"]}" stroke="{TINTA}" stroke-width="4"/>')
    if "orejas" in e:
        for s in (-1, 1):
            out += f'<path d="M{200 + s*62} 60L{200 + s*130} -6L{200 + s*132} 92Z" fill="{p["pelo"]}" stroke="{TINTA}" stroke-width="4"/>'
    return out


def extra_delante(p):
    e, out = p.get("extras", ()), ""
    if "bandana" in e:
        c = p.get("bandana", "#1f6f9c")
        out += (f'<path d="M78 118Q200 56 322 118L326 166Q200 108 74 166Z" fill="{c}" stroke="{TINTA}" stroke-width="4"/>'
                f'<path d="M142 92Q200 72 258 92L262 138Q200 116 138 138Z" fill="#c9d3dc" stroke="{TINTA}" stroke-width="3.5"/>'
                f'<path d="M210 86L186 112H203L190 134L218 104H201Z" fill="{TINTA}"/>')
    if "sombrero" in e:
        c = p.get("sombrero", "#20202e")
        out += (f'<path d="M210 -14C168 12 118 60 100 120C160 92 240 92 300 120C290 70 262 22 210 -14Z" fill="{c}" stroke="{TINTA}" stroke-width="4"/>'
                f'<path d="M26 150C90 104 310 104 374 150C320 132 80 132 26 150Z" fill="{c}" stroke="{TINTA}" stroke-width="4"/>'
                f'<path d="M103 112Q200 84 297 112L300 126Q200 98 100 126Z" fill="{p.get("cinta", "#4f7cff")}"/>')
    if "parche" in e:
        out += (f'<path d="M84 186L316 150" stroke="{TINTA}" stroke-width="6"/>'
                f'<ellipse cx="250" cy="238" rx="44" ry="36" fill="{TINTA}"/>')
    if "gafas" in e:
        out += (f'<g fill="#ffffff" fill-opacity=".14" stroke="{TINTA}" stroke-width="5"><rect x="108" y="208" width="82" height="60" rx="14"/>'
                f'<rect x="210" y="208" width="82" height="60" rx="14"/></g><path d="M190 232H210" stroke="{TINTA}" stroke-width="5"/>'
                '<path d="M122 256L150 216M232 256L260 216" stroke="#fff" stroke-opacity=".5" stroke-width="5"/>')
    if "barbijo" in e:
        out += (f'<path d="M108 268Q200 248 292 268Q286 346 200 372Q114 346 108 268Z" fill="{p.get("barbijo", "#23252f")}" stroke="{TINTA}" stroke-width="4"/>'
                '<path d="M130 292Q200 276 270 292M138 318Q200 304 262 318" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="3"/>')
    if "cicatriz" in e:
        out += f'<path d="M274 186L242 278M248 208L272 216M242 232L266 240" stroke="#a5413d" stroke-width="4" stroke-linecap="round" fill="none"/>'
    if "cuernos" in e:
        for s in (-1, 1):
            out += f'<path d="M{200 + s*56} 66Q{200 + s*70} 16 {200 + s*104} -6Q{200 + s*104} 44 {200 + s*92} 76Z" fill="#f2e6cf" stroke="{TINTA}" stroke-width="4"/>'
    if "auriculares" in e:
        c = p.get("auric", "#ff4f9a")
        out += (f'<path d="M78 210C60 30 340 30 322 210" fill="none" stroke="{TINTA}" stroke-width="16"/>'
                f'<path d="M78 210C60 30 340 30 322 210" fill="none" stroke="{c}" stroke-width="9"/>'
                f'<rect x="54" y="196" width="42" height="84" rx="18" fill="{c}" stroke="{TINTA}" stroke-width="4"/>'
                f'<rect x="304" y="196" width="42" height="84" rx="18" fill="{c}" stroke="{TINTA}" stroke-width="4"/>')
    return out


def efecto(p):
    e = p.get("efecto")
    if not p.get("vip") or not e:
        return ""
    r = random.Random(p["id"])
    if e == "rayos":
        out = []
        for k in range(4):
            x, y = r.uniform(10, 390), r.uniform(10, 300)
            d = f"M{x:.0f} {y:.0f}l{r.uniform(-18, 18):.0f} 26l14 -4l{r.uniform(-20, 20):.0f} 34"
            out.append(f'<path d="{d}" fill="none" stroke="#fff27a" stroke-width="4" stroke-linejoin="round" opacity="0">'
                       f'<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.06;.14;1" dur="{r.uniform(1.6, 3):.1f}s" begin="{k*.5}s" repeatCount="indefinite"/></path>')
        return "".join(out)
    forma = {
        "petalos": lambda r, k: '<ellipse rx="8" ry="4.5" fill="#ffc2dc" transform="rotate(30)"/>',
        "brasas": lambda r, k: f'<circle r="{r.uniform(2, 4.5):.1f}" fill="#ffb347"/>',
        "nieve": lambda r, k: f'<circle r="{r.uniform(1.5, 4):.1f}" fill="#fff" opacity=".9"/>',
        "chispas": lambda r, k: '<path d="M0 -8L2 -2L8 0L2 2L0 8L-2 2L-8 0L-2 -2Z" fill="#b6f3ff"/>',
        "fantasmas": lambda r, k: '<circle r="7" fill="#b89bff" opacity=".6"/>',
    }[e]
    return caida(r, 14, forma, (4, 8), sube=e in ("brasas", "fantasmas"))


def fondo_avatar(p):
    a, b = p["cielo"]
    d = cielo("bg", (0, a), (1, b))
    r = random.Random(p["id"] + "bg")
    deco = "".join(f'<path d="M200 200L{r.uniform(-200, 600):.0f} -40L{r.uniform(-200, 600):.0f} -40Z" fill="#fff" opacity=".05"/>' for _ in range(8))
    return d, f'<rect width="400" height="400" fill="url(#bg)"/>{deco}'


def anime(p):
    pelo = PELOS[p["estilo"]]
    piel, sombra = p.get("piel", ("#fde3c6", "#f0a98c"))
    tinta = p.get("tinta", TINTA)
    d_bg, bg = fondo_avatar(p)
    fr = flequillo(pelo["puntas"])
    defs = (d_bg + cielo("iris", (0, p["iris"][0]), (.55, p["iris"][1]), (1, p["iris"][2]))
            + cielo("pl", (0, p["pelo_luz"]), (.55, p["pelo"]), (1, p["pelo_osc"])) + BLUR("bo", 7)
            + '<clipPath id="cara"><path d="M104 170C104 276 150 346 200 372C250 346 296 276 296 170C296 110 104 110 104 170Z"/></clipPath>')
    atras = ""
    if p["estilo"] in ("recto", "largo", "partido"):
        atras = f'<path d="M78 180C60 280 56 360 60 400H340C344 360 340 280 322 180Z" fill="{p["pelo_osc"]}" stroke="{tinta}" stroke-width="4"/>'
    tops = f'<path d="{picos(pelo["picos"])}" fill="url(#pl)" stroke="{tinta}" stroke-width="4" stroke-linejoin="round"/>' if "picos" in pelo else ""
    boca = {"feliz": f'<path d="M172 318Q200 346 228 318Z" fill="#a0303f" stroke="{tinta}" stroke-width="3" stroke-linejoin="round"/>',
            "ladeada": f'<path d="M180 324Q206 332 228 314" fill="none" stroke="{tinta}" stroke-width="4" stroke-linecap="round"/>',
            }.get(p.get("boca"), f'<path d="M180 324H222" stroke="{tinta}" stroke-width="4" stroke-linecap="round"/>')
    mejilla = ""
    if p.get("rubor"):
        mejilla = '<ellipse cx="130" cy="284" rx="24" ry="11" fill="#ff7a8c" opacity=".35"/><ellipse cx="270" cy="284" rx="24" ry="11" fill="#ff7a8c" opacity=".35"/>'
    brillos = "".join(f'<path d="M{x} {y}q14 -16 28 -6q-14 2 -22 16z" fill="#fff" opacity=".35"/>' for x, y in ((128, 104), (182, 78), (246, 100)))
    cuerpo = "\n".join([
        f"  {bg}", f"  {atras}", f"  {extra_detras(p)}", f"  {traje(p)}",
        f'  <path d="M160 320H240V372L200 396L160 372Z" fill="{sombra}" stroke="{tinta}" stroke-width="4"/>',
        f'  <path d="M104 170C104 276 150 346 200 372C250 346 296 276 296 170C296 110 104 110 104 170Z" fill="{piel}" stroke="{tinta}" stroke-width="4"/>',
        f'  <g clip-path="url(#cara)"><path d="{fr}" transform="translate(0 14)" fill="{sombra}" opacity=".75"/>'
        f'<path d="M280 150Q262 280 200 372H310V150Z" fill="{sombra}" opacity=".35"/></g>',
        f"  {mejilla}", f"  {ojo(150, -1, p)}", f"  {ojo(250, 1, p)}",
        f'  <path d="M203 268L194 294L208 296" fill="none" stroke="{sombra}" stroke-width="4" stroke-linejoin="round"/>',
        f"  {boca}", f"  {tops}",
        f'  <path d="{fr}" fill="url(#pl)" stroke="{tinta}" stroke-width="4" stroke-linejoin="round"/>',
        f"  {brillos}", f"  {extra_delante(p)}", f"  {efecto(p)}",
    ])
    return lienzo(defs, cuerpo)


# ---------- animales ----------

def lentes(y=0, anim=""):
    return (f'<g transform="translate(0 {y})"><g><path d="M92 176H308V192L286 234H226L204 196H196L174 234H114L92 192Z" fill="#0e0e12" stroke="#000" stroke-width="3"/>'
            '<path d="M112 186L136 186L122 216ZM234 186L258 186L244 216Z" fill="#fff" opacity=".35"/>'
            f'{anim}</g></g>')


def ojo_animal(x, y=190, r=26, iris="#4a2f16", vip=False):
    a = parpadeo(3.8) if vip else ""
    return (f'<g transform="translate({x} {y})"><g><circle r="{r}" fill="#fff" stroke="{TINTA}" stroke-width="4"/>'
            f'<circle r="{r*.62:.0f}" fill="{iris}"/><circle r="{r*.3:.0f}" fill="#000"/><circle cx="{-r*.25:.0f}" cy="{-r*.28:.0f}" r="{r*.2:.0f}" fill="#fff"/>{a}</g></g>')


def meneo(vip, dur=1.2, ang=4):
    if not vip:
        return ""
    return (f'<animateTransform attributeName="transform" type="rotate" values="-{ang} 200 380;{ang} 200 380;-{ang} 200 380" '
            f'dur="{dur}s" repeatCount="indefinite"/>')


def animal(p, cuerpo):
    d, bg = fondo_avatar(p)
    return lienzo(d, f"  {bg}\n  <g>{cuerpo}{meneo(p.get('vip'), p.get('ritmo', 1.2), p.get('giro', 4))}</g>\n  {efecto(p)}")


def trazo(c, w=4):
    return f'fill="{c}" stroke="{TINTA}" stroke-width="{w}" stroke-linejoin="round"'


def gato(p):
    c, c2 = p.get("pelaje", ("#20212b", "#fbfbf6"))
    orejas = (f'<path d="M92 170L84 44L176 104Z" {trazo(c)}/><path d="M308 170L316 44L224 104Z" {trazo(c)}/>'
              '<path d="M108 136L102 74L154 110Z" fill="#f6a5b4"/><path d="M292 136L298 74L246 110Z" fill="#f6a5b4"/>')
    cara = (f'<ellipse cx="200" cy="200" rx="130" ry="118" {trazo(c)}/>'
            f'<path d="M200 164C232 200 268 234 256 280C240 312 160 312 144 280C132 234 168 200 200 164Z" fill="{c2}"/>')
    nariz = ('<path d="M188 248H212L200 262Z" fill="#f28da0"/>'
             f'<path d="M200 262V276M200 276Q186 290 172 280M200 276Q214 290 228 280" fill="none" stroke="{TINTA}" stroke-width="4" stroke-linecap="round"/>')
    bigotes = "".join(f'<path d="M{x1} {y1}L{x2} {y2}" stroke="{p.get("bigote", "#e8e8e8")}" stroke-width="3" stroke-linecap="round"/>'
                      for x1, y1, x2, y2 in ((128, 252, 60, 238), (128, 266, 56, 272), (272, 252, 340, 238), (272, 266, 344, 272)))
    tronco = (f'<path d="M84 400C84 330 130 306 200 306C270 306 316 330 316 400Z" {trazo(c)}/>'
              f'<path d="M170 400Q170 322 200 314Q230 322 230 400Z" fill="{c2}"/>')
    tipo = p.get("cara")
    if tipo == "lentes":
        anim = anim_y("0 -190;0 -190;0 0;0 0;0 -190", 4, 'keyTimes="0;.25;.42;.9;1"') if p.get("vip") else ""
        ojos = lentes(0, anim)
        if p.get("vip"):
            ojos = ojo_animal(150, vip=True) + ojo_animal(250, vip=True) + ojos
    elif tipo == "enojado":
        ojos = (ojo_animal(150, 196, 22, "#b78b1c") + ojo_animal(250, 196, 22, "#b78b1c")
                + f'<path d="M108 158L184 190M292 158L216 190" stroke="{TINTA}" stroke-width="12" stroke-linecap="round"/>')
        nariz = ('<path d="M188 248H212L200 262Z" fill="#f28da0"/>'
                 f'<path d="M168 292Q200 266 232 292" fill="none" stroke="{TINTA}" stroke-width="5" stroke-linecap="round"/>')
    elif tipo == "corazon":
        ojos = "".join(f'<path transform="translate({x} 192)" d="M0 26C-44 -6 -22 -36 0 -14C22 -36 44 -6 0 26Z" fill="#ff3d6e" stroke="{TINTA}" stroke-width="4">'
                       + ('<animateTransform attributeName="transform" type="translate" values="%d 192;%d 186;%d 192" dur=".8s" repeatCount="indefinite"/>' % (x, x, x) if p.get("vip") else "")
                       + '</path>' for x in (150, 250))
    else:
        ojos = ojo_animal(150, 190, 32, p.get("iris", "#3f9c5a"), p.get("vip")) + ojo_animal(250, 190, 32, p.get("iris", "#3f9c5a"), p.get("vip"))
    return animal(p, tronco + orejas + cara + bigotes + nariz + ojos)


def perro(p):
    c, c2 = p.get("pelaje", ("#e0a14f", "#fff4e1"))
    return animal(p, f'<path d="M84 400C84 330 130 306 200 306C270 306 316 330 316 400Z" {trazo(c)}/>'
                     f'<path d="M100 150L86 48L170 96Z" {trazo(c)}/><path d="M300 150L314 48L230 96Z" {trazo(c)}/>'
                     f'<ellipse cx="200" cy="196" rx="132" ry="120" {trazo(c)}/>'
                     f'<path d="M84 220C100 170 160 190 200 150C240 190 300 170 316 220C310 290 260 316 200 316C140 316 90 290 84 220Z" fill="{c2}"/>'
                     + ojo_animal(150, 186, 20, "#2d1b0d", p.get("vip")) + ojo_animal(250, 186, 20, "#2d1b0d", p.get("vip"))
                     + f'<ellipse cx="200" cy="244" rx="24" ry="16" fill="{TINTA}"/>'
                       f'<path d="M200 260V276M164 272Q200 302 236 272" fill="none" stroke="{TINTA}" stroke-width="5" stroke-linecap="round"/>'
                       '<path d="M186 284Q200 330 214 284Z" fill="#f2738a" stroke="#1b1522" stroke-width="3"/>')


def rana(p):
    c, c2 = p.get("pelaje", ("#6cc24a", "#d6f0b5"))
    return animal(p, f'<ellipse cx="200" cy="370" rx="150" ry="70" {trazo(c)}/>'
                     f'<circle cx="124" cy="116" r="56" {trazo(c)}/><circle cx="276" cy="116" r="56" {trazo(c)}/>'
                     f'<ellipse cx="200" cy="230" rx="160" ry="116" {trazo(c)}/>'
                     f'<ellipse cx="200" cy="300" rx="112" ry="50" fill="{c2}"/>'
                     + ojo_animal(124, 112, 38, "#20140a", p.get("vip")) + ojo_animal(276, 112, 38, "#20140a", p.get("vip"))
                     + f'<path d="M86 248Q200 330 314 248" fill="none" stroke="{TINTA}" stroke-width="6" stroke-linecap="round"/>'
                       '<circle cx="100" cy="212" r="16" fill="#ff8fa0" opacity=".55"/><circle cx="300" cy="212" r="16" fill="#ff8fa0" opacity=".55"/>')


def capibara(p):
    c = p.get("pelaje", "#a5764a")
    fruta = ('<circle cx="200" cy="56" r="34" fill="#ff9e2c" stroke="#1b1522" stroke-width="4"/><path d="M200 22q10 -16 28 -12q-6 16 -28 12" fill="#4faa4a" stroke="#1b1522" stroke-width="3"/>'
             if p.get("fruta") else "")
    return animal(p, f'<path d="M64 400C64 320 120 280 200 280C280 280 336 320 336 400Z" {trazo(c)}/>'
                     f'<ellipse cx="96" cy="108" rx="24" ry="20" {trazo(c)}/><ellipse cx="304" cy="108" rx="24" ry="20" {trazo(c)}/>'
                     f'<path d="M84 180C84 96 316 96 316 180C322 270 296 330 200 330C104 330 78 270 84 180Z" {trazo(c)}/>'
                     f'<path d="M108 250C120 196 280 196 292 250C296 304 250 326 200 326C150 326 104 304 108 250Z" fill="#8a5f39"/>'
                     f'<path d="M136 170Q154 156 172 170M228 170Q246 156 264 170" fill="none" stroke="{TINTA}" stroke-width="7" stroke-linecap="round"/>'
                     f'<ellipse cx="172" cy="248" rx="8" ry="12" fill="{TINTA}"/><ellipse cx="228" cy="248" rx="8" ry="12" fill="{TINTA}"/>'
                     f'<path d="M166 296Q200 310 234 296" fill="none" stroke="{TINTA}" stroke-width="5" stroke-linecap="round"/>' + fruta)


def pato(p):
    c = p.get("pelaje", "#ffd93b")
    return animal(p, f'<path d="M70 400C70 320 130 300 200 300C270 300 330 320 330 400Z" {trazo(c)}/>'
                     f'<path d="M200 66q-6 -40 22 -50q-4 22 8 40" {trazo(c)}/>'
                     f'<circle cx="200" cy="184" r="128" {trazo(c)}/>'
                     + ojo_animal(146, 150, 28, "#111", p.get("vip")) + ojo_animal(254, 150, 28, "#111", p.get("vip"))
                     + f'<path d="M108 216Q200 176 292 216Q270 272 200 276Q130 272 108 216Z" {trazo("#ff8a1f")}/>'
                       f'<path d="M114 222Q200 240 286 222" fill="none" stroke="{TINTA}" stroke-width="4"/>')


def mono(p):
    c, c2 = p.get("pelaje", ("#6b4226", "#f0c9a0"))
    return animal(p, f'<path d="M80 400C80 330 130 310 200 310C270 310 320 330 320 400Z" {trazo(c)}/>'
                     f'<circle cx="62" cy="190" r="44" {trazo(c)}/><circle cx="338" cy="190" r="44" {trazo(c)}/>'
                     f'<circle cx="62" cy="190" r="24" fill="{c2}"/><circle cx="338" cy="190" r="24" fill="{c2}"/>'
                     f'<circle cx="200" cy="180" r="136" {trazo(c)}/>'
                     f'<path d="M92 160C110 96 180 110 200 134C220 110 290 96 308 160C326 250 280 300 200 300C120 300 74 250 92 160Z" fill="{c2}"/>'
                     + ojo_animal(150, 166, 26, "#1a0d05", p.get("vip")) + ojo_animal(250, 166, 26, "#1a0d05", p.get("vip"))
                     + f'<circle cx="186" cy="222" r="5" fill="{TINTA}"/><circle cx="214" cy="222" r="5" fill="{TINTA}"/>'
                       f'<path d="M136 248Q200 296 264 248Z" fill="#fff" stroke="{TINTA}" stroke-width="4" stroke-linejoin="round"/>'
                       f'<path d="M168 251V268M200 252V276M232 251V268" stroke="{TINTA}" stroke-width="2.5"/>')


def pinguino(p):
    return animal(p, f'<path d="M72 400C72 330 130 306 200 306C270 306 328 330 328 400Z" {trazo("#20242f")}/>'
                     f'<path d="M140 400Q150 320 200 316Q250 320 260 400Z" fill="#f4f6fa"/>'
                     f'<circle cx="200" cy="176" r="136" {trazo("#20242f")}/>'
                     '<path d="M92 196C100 120 176 120 200 150C224 120 300 120 308 196C310 260 260 296 200 296C140 296 90 260 92 196Z" fill="#f4f6fa"/>'
                     + ojo_animal(150, 186, 22, "#111", p.get("vip")) + ojo_animal(250, 186, 22, "#111", p.get("vip"))
                     + f'<path d="M168 226H232L200 262Z" {trazo("#ff9f2c")}/>'
                       f'<path d="M64 112H336L320 88H80Z" {trazo("#d73d3d")}/>'
                       f'<rect x="96" y="50" width="208" height="44" rx="10" {trazo("#d73d3d")}/>'
                       f'<path d="M96 72H304" stroke="#fff" stroke-width="8"/><circle cx="200" cy="38" r="20" {trazo("#fff")}/>')


def zorro(p):
    c = p.get("pelaje", "#e8742a")
    return animal(p, f'<path d="M80 400C80 330 130 306 200 306C270 306 320 330 320 400Z" {trazo(c)}/>'
                     f'<path d="M84 190L66 34L178 110Z" {trazo(c)}/><path d="M316 190L334 34L222 110Z" {trazo(c)}/>'
                     f'<path d="M58 170C80 80 320 80 342 170C330 240 250 322 200 340C150 322 70 240 58 170Z" {trazo(c)}/>'
                     '<path d="M70 192C120 190 170 214 200 258C230 214 280 190 330 192C310 250 240 318 200 334C160 318 90 250 70 192Z" fill="#fff4e8"/>'
                     + ojo_animal(146, 186, 20, "#7a3a0b", p.get("vip")) + ojo_animal(254, 186, 20, "#7a3a0b", p.get("vip"))
                     + f'<ellipse cx="200" cy="302" rx="18" ry="13" fill="{TINTA}"/>')


def oso(p):
    c, c2 = p.get("pelaje", ("#f5f5f7", "#20222c"))
    return animal(p, f'<path d="M72 400C72 330 130 306 200 306C270 306 328 330 328 400Z" {trazo(c)}/>'
                     f'<circle cx="84" cy="84" r="50" {trazo(c2)}/><circle cx="316" cy="84" r="50" {trazo(c2)}/>'
                     f'<ellipse cx="200" cy="190" rx="148" ry="130" {trazo(c)}/>'
                     f'<ellipse cx="142" cy="186" rx="38" ry="46" fill="{c2}" transform="rotate(20 142 186)"/>'
                     f'<ellipse cx="258" cy="186" rx="38" ry="46" fill="{c2}" transform="rotate(-20 258 186)"/>'
                     + ojo_animal(146, 182, 16, "#111", p.get("vip")) + ojo_animal(254, 182, 16, "#111", p.get("vip"))
                     + f'<ellipse cx="200" cy="244" rx="18" ry="12" fill="{c2}"/>'
                       f'<path d="M200 256V270M172 274Q200 296 228 274" fill="none" stroke="{TINTA}" stroke-width="5" stroke-linecap="round"/>')


# ---------- los 24 avatares ----------

PIEL_MORENA = ("#c98a5e", "#8f5a38")
OSCURO = ("#3a2030", "#120a18")

AVATARES = [
    # Anime, para todos
    dict(id="rayo", n="Destello rubio", txt="Pelo de punta y bandana con un rayo.", f=anime, estilo="rayo", ojos="serio", extras=("bandana",), pelo="#f4c531", pelo_luz="#ffe873", pelo_osc="#d29a1c", iris=("#1d6fc0", "#4bb2f0", "#a8e4ff"), cielo=("#7fbf8a", "#2f6f5a"), traje=("#2b5e86", "#163a56")),
    dict(id="bruja", n="Ojos de hielo", txt="Sombrero puntiagudo y mirada helada.", f=anime, estilo="recto", ojos="triste", extras=("sombrero",), pelo="#c9cfe0", pelo_luz="#eef1fa", pelo_osc="#7f86a0", iris=("#1646c8", "#3f8bff", "#b6ecff"), cielo=("#3a3f55", "#12131f"), traje=("#20202e", "#10101a")),
    dict(id="roja", n="Melena roja", txt="Pelo de fuego y sonrisa de costado.", f=anime, estilo="largo", boca="ladeada", pelo="#d93a35", pelo_luz="#ff7a5e", pelo_osc="#8c1d2a", iris=("#6a3a0e", "#c67d1e", "#ffd678"), cielo=("#ffb36b", "#d45a4a"), traje=("#f5f0e6", "#c9bda5")),
    dict(id="samurai", n="Samurái", txt="Moño alto, cicatriz y pocas palabras.", f=anime, estilo="corto", ojos="serio", extras=("moño", "cicatriz"), pelo="#26222e", pelo_luz="#4c4660", pelo_osc="#120f18", iris=("#3b2b2b", "#7b5a4a", "#c9a98a"), cielo=("#d8c9a6", "#8c7a58"), traje=("#3c4a6b", "#222b42")),
    dict(id="estudiante", n="Delegada", txt="Coletas, anteojos y todas las tareas al día.", f=anime, estilo="partido", extras=("coletas", "gafas"), rubor=True, boca="feliz", pelo="#6f4bd8", pelo_luz="#a98bff", pelo_osc="#3f2891", iris=("#5a1fb0", "#9a5cff", "#dcc4ff"), cielo=("#ffd8ec", "#c9a6f0"), traje=("#20356b", "#f4f4f8")),
    dict(id="gamer", n="Sin dormir", txt="Auriculares puestos y una partida más.", f=anime, estilo="desordenado", extras=("auriculares",), ojos="feliz", boca="feliz", rubor=True, pelo="#ff6fae", pelo_luz="#ffb3d3", pelo_osc="#c23a7c", iris=("#000", "#000", "#000"), cielo=("#53e0d6", "#2a7fc4"), traje=("#1c1e2a", "#0f1018")),
    # Memes, para todos
    dict(id="gato-lentes", n="Gato con lentes", txt="Fino, de saco y con lentes negros.", f=gato, cara="lentes", cielo=("#8d8f96", "#3e4046")),
    dict(id="gato-enojado", n="Gato enojado", txt="No le gustan los lunes ni tus tiros.", f=gato, cara="enojado", pelaje=("#c9b6a0", "#f6efe6"), bigote="#fff", cielo=("#7b8ca8", "#333c52")),
    dict(id="shiba", n="Perro tranqui", txt="Todo está bien, aunque pierdas 16 a 0.", f=perro, cielo=("#ffe9a8", "#f5b14a")),
    dict(id="rana", n="Rana contenta", txt="Una rana a la que le da lo mismo el ELO.", f=rana, cielo=("#a4e3f5", "#4aa7d8")),
    dict(id="capibara", n="Capibara zen", txt="En paz con todos, incluso con los campers.", f=capibara, cielo=("#b6e8ae", "#5aa76a")),
    dict(id="pato", n="Pato de goma", txt="Hace cuac y escucha tus problemas.", f=pato, cielo=("#9fdcff", "#3f8fe0")),
    # Anime, VIP
    dict(id="v-relampago", n="Relámpago dorado", txt="Rayos alrededor y ojos que brillan.", f=anime, vip=True, efecto="rayos", brillo_ojo="#7ed7ff", estilo="rayo", ojos="serio", extras=("bandana",), bandana="#7a1f2e", pelo="#ffd21f", pelo_luz="#fff27a", pelo_osc="#d98a12", iris=("#0d62c4", "#3cc2ff", "#e2fbff"), cielo=("#1f2438", "#07080f"), traje=("#f4f2ea", "#b23a32")),
    dict(id="v-hechicera", n="Hechicera", txt="Parpadea entre chispas azules.", f=anime, vip=True, efecto="chispas", brillo_ojo="#59b7ff", estilo="recto", ojos="triste", extras=("sombrero",), cinta="#ffcf4a", sombrero="#2b1a4a", pelo="#5d6f9e", pelo_luz="#a5b8e6", pelo_osc="#29345a", iris=("#123fbd", "#46a4ff", "#d4f6ff"), cielo=("#25244c", "#0a0a1e"), traje=("#2b1a4a", "#150c28")),
    dict(id="v-oni", n="Oni", txt="Cuernos, brasas y ojos encendidos.", f=anime, vip=True, efecto="brasas", brillo_ojo="#ff5233", estilo="desordenado", ojos="serio", extras=("cuernos", "cicatriz"), piel=("#f2c8b4", "#c07a68"), pelo="#c9c9d6", pelo_luz="#fafaff", pelo_osc="#74748a", iris=("#7a0d0d", "#ff3a1e", "#ffd27a"), cielo=("#4a1010", "#120406"), traje=("#2a1414", "#120808")),
    dict(id="v-sombra", n="Sombra", txt="Pañuelo, parche y un solo ojo atento.", f=anime, vip=True, efecto="fantasmas", brillo_ojo="#a673ff", estilo="corto", ojos="serio", extras=("barbijo", "parche"), piel=("#ecd4c2", "#a98a7a"), pelo="#3a4256", pelo_luz="#6c7894", pelo_osc="#181c28", iris=("#431c9a", "#9460ff", "#e0ccff"), cielo=("#2a2440", "#0a0814"), traje=("#1a1c28", "#0e0f16")),
    dict(id="v-nieve", n="Princesa de nieve", txt="Pelo blanco y una nevada que no para.", f=anime, vip=True, efecto="nieve", brillo_ojo="#9beeff", estilo="largo", boca="ladeada", rubor=True, pelo="#eaf2ff", pelo_luz="#ffffff", pelo_osc="#9db3d6", iris=("#0e6e9c", "#46cdf0", "#dffaff"), cielo=("#5a86c4", "#16264f"), traje=("#a7c8f0", "#f4f9ff")),
    dict(id="v-cerezo", n="Bajo el cerezo", txt="Coletas rosas y pétalos que caen.", f=anime, vip=True, efecto="petalos", estilo="partido", extras=("coletas",), rubor=True, boca="feliz", pelo="#ff8cc0", pelo_luz="#ffc9e0", pelo_osc="#c94f8a", iris=("#0e8a6b", "#35d6a3", "#c6ffe8"), cielo=("#fff0f7", "#f7a6cb"), traje=("#ffffff", "#e84a72")),
    # Memes, VIP
    dict(id="v-gato-lentes", n="Gato bailarín", txt="Se mueve al ritmo y le caen los lentes.", f=gato, vip=True, cara="lentes", ritmo=.7, giro=7, cielo=("#b06cff", "#3a1a78")),
    dict(id="v-gato-amor", n="Gato enamorado", txt="Ojos de corazón que no paran de latir.", f=gato, vip=True, cara="corazon", pelaje=("#f29a3e", "#fff1da"), bigote="#fff", efecto="petalos", cielo=("#ffb3cd", "#e8567f")),
    dict(id="v-mono", n="Mono risueño", txt="Se ríe de tu último tiro fallado.", f=mono, vip=True, ritmo=.5, giro=5, cielo=("#ffe26b", "#f28a1e")),
    dict(id="v-pinguino", n="Pingüino navideño", txt="Con gorro de lana y nieve encima.", f=pinguino, vip=True, efecto="nieve", cielo=("#6fb4ec", "#1d3f86")),
    dict(id="v-zorro", n="Zorro astuto", txt="Pestañea entre brasas y te mira de reojo.", f=zorro, vip=True, efecto="brasas", cielo=("#3a2a55", "#141024")),
    dict(id="v-capibara", n="Capibara con naranja", txt="Se balancea con una naranja en la cabeza.", f=capibara, vip=True, fruta=True, giro=3, ritmo=2.4, efecto="chispas", cielo=("#55d6c2", "#14756f")),
]


# ---------- los 12 fondos ----------

def f_cerezos(r):
    d = cielo("c", (0, "#ffd3e6"), (.6, "#f7a6cb"), (1, "#7d4a84"))
    ramas = '  <path d="M0 80C80 100 150 70 240 110M90 88C110 120 150 130 180 128M0 30C60 30 100 10 170 0" fill="none" stroke="#3f2438" stroke-width="9" stroke-linecap="round"/>'
    copas = "".join(f'<circle cx="{r.uniform(0, 260):.0f}" cy="{r.uniform(0, 120):.0f}" r="{r.uniform(16, 34):.0f}" fill="#ff9cc6" opacity=".85"/>' for _ in range(16))
    p = lambda r, k: '<ellipse rx="7" ry="4" fill="#ffe4f0"><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="3s" repeatCount="indefinite"/></ellipse>'
    return svg(d, fondo("c") + "\n" + ramas + f"\n  {copas}\n" + caida(r, 24, p, (6, 11), deriva=70))


def f_velocidad(r):
    d = '<radialGradient id="c"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#ffe9a8"/><stop offset="1" stop-color="#f28a1e"/></radialGradient>'
    lineas = []
    for k in range(46):
        a = k / 46 * 360
        ancho = r.uniform(2, 7)
        lineas.append(f'<path transform="rotate({a:.0f} 200 200)" d="M200 {200 - r.uniform(90, 130):.0f}L{200 - ancho:.1f} -80H{200 + ancho:.1f}Z" fill="#1b1522">'
                      f'<animate attributeName="opacity" values="1;.2;1" dur="{r.uniform(.3, .9):.2f}s" repeatCount="indefinite"/></path>')
    return svg(d, f'  <rect width="400" height="400" fill="url(#c)"/>\n  ' + "".join(lineas))


def f_tejados(r):
    d = cielo("c", (0, "#121a3c"), (1, "#3d2f6b"))
    tej = ""
    for y, c, n in ((280, "#1c1a38", 5), (330, "#110f26", 4)):
        an = 400 / n
        for k in range(n + 1):
            x = k * an + (y % 40) - 30
            tej += f'<path d="M{x:.0f} {y - 40}L{x + an/2:.0f} {y - 80}L{x + an:.0f} {y - 40}L{x + an + 16:.0f} {y}H{x - 16:.0f}Z" fill="{c}"/><rect x="{x + 10:.0f}" y="{y}" width="{an - 20:.0f}" height="100" fill="{c}"/>'
            tej += f'<rect x="{x + an/2 - 8:.0f}" y="{y + 16}" width="16" height="22" fill="#ffd46b"><animate attributeName="opacity" values="1;.7;1" dur="{r.uniform(2, 5):.1f}s" repeatCount="indefinite"/></rect>'
    luna = '<circle cx="290" cy="90" r="50" fill="#fff5cf"/><circle cx="272" cy="78" r="44" fill="#121a3c" opacity=".12"/>'
    return svg(d, fondo("c") + "\n" + titila(r, 40, "#fff", 1.4, (0, 200)) + f"\n  {luna}\n  {tej}")


def f_lluvia_neon(r):
    d = cielo("c", (0, "#090a24"), (1, "#26103f"))
    edif = ""
    x = -10
    while x < 410:
        an, al = r.uniform(40, 80), r.uniform(120, 300)
        edif += f'<rect x="{x:.0f}" y="{400 - al:.0f}" width="{an:.0f}" height="{al:.0f}" fill="#100c28"/>'
        for _ in range(5):
            c = r.choice(["#ff3d9a", "#35e6ff", "#ffe14a"])
            edif += (f'<rect x="{x + r.uniform(6, an - 20):.0f}" y="{r.uniform(400 - al + 8, 380):.0f}" width="{r.uniform(8, 16):.0f}" height="6" fill="{c}">'
                     f'<animate attributeName="opacity" values="1;.25;1" dur="{r.uniform(1, 4):.1f}s" repeatCount="indefinite"/></rect>')
        x += an + 4
    g = lambda r, k: '<path d="M0 0l-3 18" stroke="#9fe6ff" stroke-opacity=".7" stroke-width="1.5"/>'
    return svg(d, fondo("c") + f"\n  {edif}\n" + caida(r, 60, g, (.8, 1.6), deriva=-20))


def f_gatos(r):
    d = cielo("c", (0, "#7ccfff"), (1, "#c9efff"))
    colores = ["#22232d", "#f29a3e", "#fff", "#9aa0ab"]

    def g(r, k):
        c = colores[k % 4]
        rot = r.uniform(0, 360)
        return (f'<g><path d="M-16 -10L-18 -28L-4 -18H4L18 -28L16 -10Q24 10 0 18Q-24 10 -16 -10Z" fill="{c}" stroke="#1b1522" stroke-width="2.5"/>'
                '<circle cx="-7" cy="-2" r="2.6" fill="#1b1522" stroke="#fff"/><circle cx="7" cy="-2" r="2.6" fill="#1b1522" stroke="#fff"/>'
                f'<animateTransform attributeName="transform" type="rotate" values="{rot:.0f};{rot + 360:.0f}" dur="{r.uniform(3, 6):.1f}s" repeatCount="indefinite"/></g>')
    return svg(d, fondo("c") + "\n" + caida(r, 18, g, (5, 9)))


def f_grafico(r):
    d = cielo("c", (0, "#0a1f17"), (1, "#04100b"))
    rejilla = "".join(f'<path d="M{x} 0V400M0 {x}H400" stroke="#2bff9a" stroke-opacity=".08"/>' for x in range(0, 401, 40))
    velas, y = "", 340
    for k in range(13):
        sube = r.random() > .18
        al = r.uniform(18, 50)
        c = "#2bff9a" if sube else "#ff4a5e"
        velas += f'<path d="M{20 + k*29} {y - al - 10:.0f}V{y + 10:.0f}" stroke="{c}" stroke-width="2"/><rect x="{10 + k*29}" y="{y - al:.0f}" width="20" height="{al:.0f}" fill="{c}"><animate attributeName="opacity" values="1;.55;1" dur="{r.uniform(1, 3):.1f}s" repeatCount="indefinite"/></rect>'
        y = max(50, y - (al * .7 if sube else -al * .6))
    return svg(d, fondo("c") + f"\n  {rejilla}\n  {velas}")


# VIP

def f_rayo_dorado(r):
    d = cielo("c", (0, "#060a1c"), (1, "#16203f")) + BLUR("b", 8)
    kunais = ""
    for k in range(9):
        x, y = r.uniform(30, 370), r.uniform(30, 370)
        a = r.uniform(0, 360)
        kunais += f'<g transform="translate({x:.0f} {y:.0f}) rotate({a:.0f})"><path d="M0 -24L6 -6L2 -4V12H-2V-4L-6 -6Z" fill="#c8d4e4" stroke="#0a0d1a"/><circle cy="16" r="4" fill="none" stroke="#c8d4e4" stroke-width="2"/></g>'
    rayos = ""
    for k in range(5):
        px, py, pts = r.uniform(0, 400), -10, []
        for _ in range(7):
            pts.append(f"{px:.0f} {py:.0f}")
            px += r.uniform(-50, 50)
            py += 70
        lin = "L".join(pts)
        rayos += (f'<g opacity="0"><path d="M{lin}" fill="none" stroke="#ffdd33" stroke-width="10" filter="url(#b)"/><path d="M{lin}" fill="none" stroke="#fff8c9" stroke-width="3"/>'
                  f'<animate attributeName="opacity" values="0;1;.2;1;0;0" keyTimes="0;.03;.06;.09;.15;1" dur="{r.uniform(2, 4):.1f}s" begin="{k*.7:.1f}s" repeatCount="indefinite"/></g>')
    return svg(d, fondo("c") + f"\n  {kunais}\n  {rayos}")


def f_luna_cuervos(r):
    d = cielo("c", (0, "#2a0a14"), (1, "#7a1426")) + BLUR("b", 24)
    luna = '<circle cx="200" cy="170" r="110" fill="#ff5a3c" filter="url(#b)" opacity=".7"/><circle cx="200" cy="170" r="92" fill="#ffd9b0"/>'
    aves = ""
    for k in range(9):
        y, dur = r.uniform(40, 300), r.uniform(8, 16)
        aves += (f'<path d="M-14 0Q-6 -10 0 0Q6 -10 14 0Q6 -3 0 4Q-6 -3 -14 0Z" fill="#12060a"><animateTransform attributeName="transform" type="translate" '
                 f'values="-30 {y:.0f};430 {y - r.uniform(-40, 40):.0f}" dur="{dur:.1f}s" begin="-{r.uniform(0, dur):.1f}s" repeatCount="indefinite"/></path>')
    return svg(d, fondo("c") + f"\n  {luna}\n  {aves}\n" + '  <path d="M0 400V330L60 300L110 340L180 290L250 345L320 300L400 340V400Z" fill="#12060a"/>')


def f_runas(r):
    d = '<radialGradient id="c"><stop offset="0" stop-color="#3a1a78"/><stop offset="1" stop-color="#0a061c"/></radialGradient>' + BLUR("b", 5)
    aros = ""
    for k, (rad, dur) in enumerate(((150, 30), (110, -20), (70, 14))):
        de, a = (0, 360) if dur > 0 else (360, 0)
        marcas = "".join(f'<path transform="rotate({m*30} 200 200)" d="M200 {200 - rad - 8}V{200 - rad + 8}M194 {200 - rad}H206" stroke="#a97bff" stroke-width="2"/>' for m in range(12))
        poli = "".join(f'<path d="M200 {200 - rad}L{200 + rad*.866:.0f} {200 + rad*.5:.0f}H{200 - rad*.866:.0f}Z" fill="none" stroke="#7ad7ff" stroke-opacity=".7"/>' for _ in range(1))
        aros += (f'<g><circle cx="200" cy="200" r="{rad}" fill="none" stroke="#a97bff" stroke-width="3" filter="url(#b)"/>'
                 f'<circle cx="200" cy="200" r="{rad}" fill="none" stroke="#e0ccff"/>{marcas}{poli}'
                 f'<animateTransform attributeName="transform" type="rotate" from="{de} 200 200" to="{a} 200 200" dur="{abs(dur)}s" repeatCount="indefinite"/></g>')
    return svg(d, '  <rect width="400" height="400" fill="url(#c)"/>\n  ' + aros + "\n" + titila(r, 30, "#c9b6ff", 1.6))


def f_olas(r):
    d = cielo("c", (0, "#fbe9c9"), (1, "#f4d6a4"))
    sol = '<circle cx="290" cy="110" r="56" fill="#e0483e"/>'
    olas = ""
    for k, (y, c, dur) in enumerate(((210, "#7fb3d5", 6), (260, "#3f83b5", 5), (310, "#1f5a8c", 4), (360, "#0f3560", 3))):
        tramo = "".join(f"q25 -36 50 0t50 0" for _ in range(6))
        olas += (f'<path d="M-100 {y}{tramo}V420H-100Z" fill="{c}" stroke="#fff" stroke-width="3">'
                 f'<animateTransform attributeName="transform" type="translate" values="0 0;100 0" dur="{dur}s" repeatCount="indefinite"/></path>')
    return svg(d, fondo("c") + f"\n  {sol}\n  {olas}")


def f_disco(r):
    d = cielo("c", (0, "#24074a"), (1, "#0a0220"))
    haces = ""
    for k, c in enumerate(("#ff3d9a", "#35e6ff", "#ffe14a", "#6dff7a", "#b06cff")):
        de = -50 + k * 25
        haces += (f'<path d="M200 60L120 460H280Z" fill="{c}" opacity=".28"><animateTransform attributeName="transform" type="rotate" '
                  f'values="{de} 200 60;{-de} 200 60;{de} 200 60" dur="{3 + k*.6:.1f}s" repeatCount="indefinite"/></path>')
    bola = ""
    for y in range(26, 96, 12):
        for x in range(164, 238, 12):
            if (x - 200)**2 + (y - 60)**2 < 34**2:
                bola += (f'<rect x="{x}" y="{y}" width="11" height="11" fill="{r.choice(["#fff", "#cfd6e6", "#8d97ad"])}">'
                         f'<animate attributeName="opacity" values="1;.4;1" dur="{r.uniform(.5, 1.6):.1f}s" repeatCount="indefinite"/></rect>')
    return svg(d, fondo("c") + f"\n  {haces}\n  <path d=\"M200 0V26\" stroke=\"#aaa\" stroke-width=\"2\"/>\n  {bola}")


def f_patos(r):
    d = cielo("c", (0, "#57c7ff"), (1, "#0f6fc4"))

    def pato_chico(r, k):
        return ('<g><ellipse cy="10" rx="26" ry="15" fill="#ffd93b" stroke="#1b1522" stroke-width="2.5"/><circle cx="10" cy="-10" r="13" fill="#ffd93b" stroke="#1b1522" stroke-width="2.5"/>'
                '<circle cx="14" cy="-13" r="2.5" fill="#1b1522"/><path d="M22 -10L34 -6L22 -3Z" fill="#ff8a1f" stroke="#1b1522" stroke-width="2"/>'
                '<animateTransform attributeName="transform" type="rotate" values="-8;8;-8" dur="1.6s" repeatCount="indefinite"/></g>')
    burb = lambda r, k: f'<circle r="{r.uniform(3, 8):.0f}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.5"/>'
    return svg(d, fondo("c") + "\n" + caida(r, 22, burb, (5, 10), sube=True) + "\n" + caida(r, 7, pato_chico, (9, 15), sube=True))


FONDOS = [
    ("cerezos", "Cerezos en flor", "Pétalos que caen sobre ramas rosas.", f_cerezos, "anime", False),
    ("velocidad", "Líneas de velocidad", "Como la viñeta de un golpe final.", f_velocidad, "anime", False),
    ("tejados", "Tejados de noche", "Una aldea dormida bajo la luna.", f_tejados, "anime", False),
    ("lluvia-neon", "Lluvia de neón", "Carteles que titilan en la ciudad mojada.", f_lluvia_neon, "anime", False),
    ("gatos", "Lluvia de gatos", "Gatos que caen dando vueltas.", f_gatos, "memes", False),
    ("grafico", "Sube y sube", "Velas verdes hasta el techo.", f_grafico, "memes", False),
    ("v-rayo", "Destello amarillo", "Rayos dorados y cuchillos clavados en la noche.", f_rayo_dorado, "anime", True),
    ("v-luna", "Luna de cuervos", "Cuervos que cruzan una luna enorme.", f_luna_cuervos, "anime", True),
    ("v-runas", "Círculo de runas", "Tres círculos mágicos que giran.", f_runas, "anime", True),
    ("v-olas", "Gran ola", "Olas que avanzan bajo un sol rojo.", f_olas, "anime", True),
    ("v-disco", "Noche de baile", "Bola de espejos y luces de colores.", f_disco, "memes", True),
    ("v-patos", "Baño de patos", "Patos de goma que suben entre burbujas.", f_patos, "memes", True),
]


def coleccion(a):
    return "anime" if a["f"] is anime else "memes"


def main():
    (PERFIL / "avatares").mkdir(exist_ok=True)
    articulos = []
    for a in AVATARES:
        vip = a.get("vip", False)
        archivo = a["id"].removeprefix("v-") + ("-vip" if vip and a["id"].removeprefix("v-") in ("gato-lentes", "capibara") else "")
        (PERFIL / "avatares" / f"{archivo}.svg").write_text(a["f"](a), encoding="utf-8", newline="\n")
        articulos.append({"id": f"avatar-{archivo}", "kind": "avatar", "name": a["n"], "description": a["txt"],
                          "file": f"avatares/{archivo}.svg", "css_class": None, "vip_only": vip, "animated": vip,
                          "price": None, "collection": coleccion(a), "vip_reward": False, "vip_price": PRECIO_VIP if vip else None})
    for base, nombre, txt, f, col, vip in FONDOS:
        archivo = "extra-" + base.removeprefix("v-")
        (PERFIL / "fondos" / f"{archivo}.svg").write_text(f(random.Random(base)), encoding="utf-8", newline="\n")
        articulos.append({"id": f"fondo-{archivo}", "kind": "background", "name": nombre, "description": txt,
                          "file": f"fondos/{archivo}.svg", "css_class": None, "vip_only": vip, "animated": True,
                          "price": None, "collection": col, "vip_reward": False, "vip_price": PRECIO_VIP if vip else None})

    ruta = PERFIL / "catalogo.json"
    cat = json.loads(ruta.read_text(encoding="utf-8"))
    cat["version"] = 9
    cat["kinds"]["avatar"] = "Avatar (256 x 256): reemplaza la foto de perfil mientras esté puesto"
    cat["collections"] = {**cat["collections"], "anime": "Anime", "memes": "Memes"}
    cat["items"] = [i for i in cat["items"] if i["collection"] not in ("anime", "memes")] + articulos
    ruta.write_text(json.dumps(cat, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")

    def q(s):
        return "'" + s.replace("'", "''") + "'" if s is not None else "null"
    filas = []
    for k, i in enumerate(articulos):
        precio = "null" if i["vip_only"] else PRECIO[i["kind"]]
        vp = i["vip_price"] if i["vip_only"] else "null"
        filas.append(f"  ({q(i['id'])}, {q(i['kind'])}, {q(i['name'])}, {q(i['description'])}, {q(i['file'])}, null, "
                     f"{str(i['vip_only']).lower()}, {str(i['animated']).lower()}, {q(i['collection'])}, {precio}, {vp}, {6000 + k*10})")
    texto = SQL.read_text(encoding="utf-8")
    ini, fin = "-- --- inicio: artículos generados ---", "-- --- fin: artículos generados ---"
    a, b = texto.index(ini) + len(ini), texto.index(fin)
    SQL.write_text(texto[:a] + "\n" + ",\n".join(filas) + "\n" + texto[b:], encoding="utf-8", newline="\n")
    print(f"{len(articulos)} artículos nuevos; catálogo con {len(cat['items'])} artículos")


if __name__ == "__main__":
    main()
