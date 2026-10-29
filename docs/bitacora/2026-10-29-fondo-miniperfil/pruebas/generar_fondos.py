"""Genera los fondos de miniperfil de assets/perfil/fondos/ y los suma al catálogo.

Escribe los SVG (400 x 400, se recortan con slice para llenar cualquier tarjeta), reemplaza los artículos
kind "background" de assets/perfil/catalogo.json y el bloque de carga de
supabase/migrations/20261029200000_fondo_miniperfil.sql.
Uso (desde la raíz del repo): python docs/bitacora/2026-10-29-fondo-miniperfil/pruebas/generar_fondos.py
"""
import json
import math
import random
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[4]
PERFIL = RAIZ / "assets" / "perfil"
SQL = RAIZ / "supabase" / "migrations" / "20261029200000_fondo_miniperfil.sql"
W = 400


def svg(defs, cuerpo):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {W}" width="{W}" height="{W}" '
            f'preserveAspectRatio="xMidYMid slice">\n  <defs>{defs}</defs>\n{cuerpo}\n</svg>\n')


def cielo(id, *stops, x2=0, y2=1):
    s = "".join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops)
    return f'<linearGradient id="{id}" x1="0" y1="0" x2="{x2}" y2="{y2}">{s}</linearGradient>'


def fondo(id):
    return f'  <rect width="{W}" height="{W}" fill="url(#{id})"/>'


def caida(r, n, forma, dur=(5, 9), sube=False, deriva=30):
    """n piezas que caen (o suben) en loop, cada una con su retraso. forma(x, k) devuelve el dibujo en 0,0."""
    out = []
    for k in range(n):
        x = r.uniform(0, W)
        d = r.uniform(*dur)
        dx = r.uniform(-deriva, deriva)
        y0, y1 = (W + 30, -30) if sube else (-30, W + 30)
        out.append(f'  <g transform="translate({x:.0f} 0)"><g>{forma(r, k)}'
                   f'<animateTransform attributeName="transform" type="translate" values="0 {y0};{dx:.0f} {y1}" '
                   f'dur="{d:.1f}s" begin="-{r.uniform(0, d):.1f}s" repeatCount="indefinite"/></g></g>')
    return "\n".join(out)


def titila(r, n, color, rmax=1.6, y=(0, W)):
    out = []
    for _ in range(n):
        d = r.uniform(1.5, 4)
        out.append(f'  <circle cx="{r.uniform(0, W):.0f}" cy="{r.uniform(*y):.0f}" r="{r.uniform(.5, rmax):.1f}" fill="{color}">'
                   f'<animate attributeName="opacity" values="1;.15;1" dur="{d:.1f}s" begin="-{r.uniform(0, d):.1f}s" repeatCount="indefinite"/></circle>')
    return "\n".join(out)


BLUR = lambda id, s: f'<filter id="{id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="{s}"/></filter>'


# ---------- para todos ----------

def humo(r):
    d = cielo("c", (0, "#1b2230"), (1, "#0b0e14")) + BLUR("b", 22)
    nubes = []
    for k in range(9):
        y, rx, d0 = r.uniform(40, 380), r.uniform(80, 150), r.uniform(14, 26)
        g = r.choice(["#9aa6b8", "#7d8899", "#c3ccd8"])
        nubes.append(f'  <ellipse cx="0" cy="{y:.0f}" rx="{rx:.0f}" ry="{rx*.45:.0f}" fill="{g}" opacity=".35" filter="url(#b)">'
                     f'<animate attributeName="cx" values="-160;560" dur="{d0:.0f}s" begin="-{r.uniform(0, d0):.0f}s" repeatCount="indefinite"/></ellipse>')
    return svg(d, fondo("c") + "\n" + "\n".join(nubes))


def radar(r):
    d = (cielo("c", (0, "#06170e"), (1, "#020805"))
         + '<linearGradient id="h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3dff8a" stop-opacity="0"/>'
           '<stop offset="1" stop-color="#3dff8a" stop-opacity=".55"/></linearGradient>')
    aros = "".join(f'<circle cx="200" cy="200" r="{a}" fill="none" stroke="#3dff8a" stroke-opacity=".25"/>' for a in (50, 100, 150, 200, 250))
    rejilla = "".join(f'<path d="M{x} 0V400M0 {x}H400" stroke="#3dff8a" stroke-opacity=".07"/>' for x in range(0, 401, 25))
    barrido = ('  <g><path d="M200 200L480 200A280 280 0 0 0 442 60Z" fill="url(#h)"/>'
               '<animateTransform attributeName="transform" type="rotate" from="0 200 200" to="-360 200 200" dur="4s" repeatCount="indefinite"/></g>')
    puntos = []
    for k in range(7):
        a, dist = r.uniform(0, 2 * math.pi), r.uniform(40, 190)
        puntos.append(f'  <circle cx="{200 + dist*math.cos(a):.0f}" cy="{200 + dist*math.sin(a):.0f}" r="4" fill="#ff4a4a">'
                      f'<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.1;.6;1" dur="4s" begin="{r.uniform(0, 4):.1f}s" repeatCount="indefinite"/></circle>')
    return svg(d, fondo("c") + f"\n  {rejilla}\n  {aros}\n" + barrido + "\n" + "\n".join(puntos))


def casquillos(r):
    d = (cielo("c", (0, "#2a1a0c"), (1, "#0e0904"))
         + '<linearGradient id="l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a5a1c"/>'
           '<stop offset=".45" stop-color="#ffd27a"/><stop offset="1" stop-color="#a86d22"/></linearGradient>')

    def c(r, k):
        rot = r.uniform(0, 360)
        return (f'<g><rect x="-5" y="-13" width="10" height="26" rx="2" fill="url(#l)"/><rect x="-6" y="10" width="12" height="4" rx="1" fill="#6b4512"/>'
                f'<animateTransform attributeName="transform" type="rotate" values="{rot:.0f};{rot+360:.0f}" dur="{r.uniform(1.5, 3):.1f}s" repeatCount="indefinite"/></g>')
    return svg(d, fondo("c") + "\n" + caida(r, 26, c, (3, 6)))


def neon(r):
    d = (cielo("c", (0, "#12002b"), (.55, "#5a0a5e"), (.56, "#0a0015"), (1, "#05000c"))
         + cielo("s", (0, "#ffe66b"), (1, "#ff2e88")) + BLUR("b", 6))
    sol = ('  <circle cx="200" cy="170" r="80" fill="url(#s)"/>'
           + "".join(f'<rect x="110" y="{y}" width="180" height="{h}" fill="#5a0a5e"/>' for y, h in ((180, 4), (196, 6), (214, 8), (234, 10))))
    horizonte = '  <path d="M0 222H400" stroke="#ff4fd8" stroke-width="3" filter="url(#b)"/><path d="M0 222H400" stroke="#ffb3f2" stroke-width="1.5"/>'
    fugas = "".join(f'<path d="M200 222L{x} 420" stroke="#ff4fd8" stroke-opacity=".6"/>' for x in range(-400, 801, 80))
    lineas = "".join(f'<path d="M0 0H400" stroke="#ff4fd8" stroke-opacity=".7"><animateTransform attributeName="transform" type="translate" '
                     f'values="0 222;0 400" dur="2.4s" begin="-{k*.6:.1f}s" repeatCount="indefinite"/>'
                     f'<animate attributeName="stroke-width" values=".5;3" dur="2.4s" begin="-{k*.6:.1f}s" repeatCount="indefinite"/></path>' for k in range(4))
    return svg(d, fondo("c") + "\n" + titila(r, 30, "#fff", 1.2, (0, 210)) + "\n" + sol + "\n" + horizonte + f"\n  {fugas}\n  {lineas}")


def tormenta(r):
    d = cielo("c", (0, "#0d1426"), (1, "#05070d")) + BLUR("b", 14)
    nubes = "".join(f'<ellipse cx="{r.uniform(0, 400):.0f}" cy="{r.uniform(-10, 90):.0f}" rx="{r.uniform(70, 120):.0f}" ry="40" fill="#2a3550" filter="url(#b)"/>' for _ in range(8))
    rayo = ('  <g opacity="0"><rect width="400" height="400" fill="#aac4ff" opacity=".18"/>'
            '<path d="M230 40L190 150L225 150L170 290L250 130L212 130L250 40Z" fill="#e8f0ff" filter="url(#b)"/>'
            '<path d="M230 40L190 150L225 150L170 290L250 130L212 130L250 40Z" fill="#fff"/>'
            '<animate attributeName="opacity" values="0;0;1;0;1;0;0" keyTimes="0;.6;.62;.65;.68;.72;1" dur="5s" repeatCount="indefinite"/></g>')
    gota = lambda r, k: '<path d="M0 0l-4 18" stroke="#8fb0ff" stroke-opacity=".55" stroke-width="1.5"/>'
    return svg(d, fondo("c") + f"\n  {nubes}\n" + caida(r, 60, gota, (.7, 1.2), deriva=-40) + "\n" + rayo)


def consola(r):
    d = cielo("c", (0, "#03130a"), (1, "#000"))
    cols = []
    for k in range(16):
        x = 12 + k * 25
        txt = "".join(r.choice("0123456789ABCDEF") for _ in range(14))
        dur = r.uniform(4, 8)
        letras = "".join(f'<tspan x="{x}" dy="22">{ch}</tspan>' for ch in txt)
        cols.append(f'  <text y="0" font-family="Consolas, monospace" font-size="16" fill="#38ff7a" opacity="{r.uniform(.3, .9):.2f}">{letras}'
                    f'<animateTransform attributeName="transform" type="translate" values="0 -320;0 420" dur="{dur:.1f}s" begin="-{r.uniform(0, dur):.1f}s" repeatCount="indefinite"/></text>')
    return svg(d, fondo("c") + "\n" + "\n".join(cols))


def dust2(r):
    d = (cielo("c", (0, "#3b2a5a"), (.45, "#e8744a"), (.7, "#ffc27a"), (1, "#ffc27a"))
         + cielo("d1", (0, "#c98a4a"), (1, "#7a4a22")) + cielo("d2", (0, "#a86a34"), (1, "#5a3414")) + BLUR("b", 10))
    sol = '  <circle cx="270" cy="210" r="48" fill="#fff2c2" filter="url(#b)"/><circle cx="270" cy="210" r="38" fill="#fff6d8"/>'
    dunas = ('  <path d="M0 250Q90 205 190 245T400 235V400H0Z" fill="url(#d1)"/>'
             '  <path d="M0 300Q120 255 230 300T400 290V400H0Z" fill="url(#d2)"/>'
             '  <path d="M40 300V250H70V232H110V250H130V300Z" fill="#4a2a12" opacity=".8"/>')
    arena = lambda r, k: f'<circle r="{r.uniform(.8, 2):.1f}" fill="#ffe3b0" opacity=".7"/>'
    viento = "\n".join(f'  <circle cx="0" cy="{r.uniform(200, 380):.0f}" r="{r.uniform(.8, 2):.1f}" fill="#ffe3b0" opacity=".7">'
                       f'<animate attributeName="cx" values="-10;410" dur="{r.uniform(3, 6):.1f}s" begin="-{r.uniform(0, 6):.1f}s" repeatCount="indefinite"/></circle>'
                       for _ in range(40))
    return svg(d, fondo("c") + "\n" + sol + "\n" + dunas + "\n" + viento)


def inferno(r):
    d = cielo("c", (0, "#2a0e08"), (1, "#5a2410")) + cielo("m", (0, "#b8582e"), (1, "#7a3216")) + BLUR("b", 2)
    muro = '  <path d="M0 160H400V400H0Z" fill="url(#m)"/>'
    arcos = "".join(f'<path d="M{x} 400V270A40 40 0 0 1 {x+80} 270V400Z" fill="#1c0804"/>' for x in (20, 160, 300))
    tejas = "".join(f'<path d="M{x} 160Q{x+10} 148 {x+20} 160" fill="none" stroke="#8a2e14" stroke-width="4"/>' for x in range(0, 400, 20))
    brasa = lambda r, k: f'<circle r="{r.uniform(1.5, 3.5):.1f}" fill="{r.choice(["#ffb02e", "#ff6a1a", "#ffd56b"])}" filter="url(#b)"/>'
    return svg(d, fondo("c") + "\n" + muro + f"\n  {tejas}\n  {arcos}\n" + caida(r, 34, brasa, (4, 8), sube=True, deriva=50))


def nuke(r):
    d = (cielo("c", (0, "#0c1a1c"), (1, "#050b0c")) + BLUR("b", 12)
         + '<pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
           '<rect width="20" height="40" fill="#f2c200"/><rect x="20" width="20" height="40" fill="#111"/></pattern>')
    franjas = '  <rect y="330" width="400" height="34" fill="url(#p)"/><rect y="36" width="400" height="34" fill="url(#p)"/>'
    aspa = lambda a: (f'<path d="M200 200L{200+95*math.cos(a-.5):.1f} {200+95*math.sin(a-.5):.1f}'
                      f'A95 95 0 0 1 {200+95*math.cos(a+.5):.1f} {200+95*math.sin(a+.5):.1f}Z" fill="#f2c200"/>')
    simbolo = ("  <g>" + "".join(aspa(math.radians(a)) for a in (-90, 30, 150))
               + '<circle cx="200" cy="200" r="26" fill="#0c1a1c"/><circle cx="200" cy="200" r="16" fill="#f2c200"/>'
               + '<animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="18s" repeatCount="indefinite"/></g>')
    brillo = ('  <circle cx="200" cy="200" r="120" fill="#7dff4a" filter="url(#b)" opacity=".15">'
              '<animate attributeName="opacity" values=".08;.3;.08" dur="2.5s" repeatCount="indefinite"/></circle>')
    return svg(d, fondo("c") + "\n" + brillo + "\n" + simbolo + "\n" + franjas)


def office(r):
    d = cielo("c", (0, "#0b1430"), (1, "#1c2a4a"))
    edif = []
    for bx, bw, bh in ((0, 110, 260), (120, 140, 320), (270, 130, 230)):
        edif.append(f'<rect x="{bx}" y="{400-bh}" width="{bw}" height="{bh}" fill="#0a0f1e"/>')
        for wy in range(400 - bh + 16, 390, 22):
            for wx in range(bx + 10, bx + bw - 14, 20):
                if r.random() < .55:
                    dur = r.uniform(6, 14)
                    edif.append(f'<rect x="{wx}" y="{wy}" width="10" height="12" fill="#ffd98a" opacity=".85">'
                                f'<animate attributeName="opacity" values=".85;.85;.1;.85" keyTimes="0;.7;.8;1" dur="{dur:.0f}s" begin="-{r.uniform(0, dur):.0f}s" repeatCount="indefinite"/></rect>')
    copo = lambda r, k: f'<circle r="{r.uniform(1, 3):.1f}" fill="#fff" opacity=".85"/>'
    return svg(d, fondo("c") + "\n  " + "".join(edif) + "\n" + caida(r, 55, copo, (6, 12)))


def cruz_del_sur(r):
    d = ('<radialGradient id="c" cx=".5" cy=".3" r=".9"><stop offset="0" stop-color="#1d2a5e"/><stop offset="1" stop-color="#03050f"/></radialGradient>'
         + BLUR("b", 3) + BLUR("v", 30))
    via = '  <ellipse cx="200" cy="200" rx="260" ry="60" transform="rotate(-30 200 200)" fill="#6a7cff" opacity=".18" filter="url(#v)"/>'
    estrellas = []
    for x, y, s in ((200, 80, 9), (200, 300, 10), (120, 190, 8), (270, 175, 7), (230, 235, 5)):
        p = " ".join(f"{x + (s if i % 2 == 0 else s*.35) * math.cos(math.pi/4*i - math.pi/2):.1f},{y + (s if i % 2 == 0 else s*.35) * math.sin(math.pi/4*i - math.pi/2):.1f}" for i in range(8))
        dur = r.uniform(2, 4)
        estrellas.append(f'  <g><polygon points="{p}" fill="#fff" filter="url(#b)"/><polygon points="{p}" fill="#fff"/>'
                         f'<animate attributeName="opacity" values="1;.5;1" dur="{dur:.1f}s" repeatCount="indefinite"/></g>')
    return svg(d, fondo("c") + "\n" + via + "\n" + titila(r, 90, "#dfe6ff", 1.4) + "\n" + "\n".join(estrellas))


def carnaval(r):
    d = cielo("c", (0, "#2a0a4a"), (1, "#0e0420"))
    colores = ["#ff3b6b", "#ffd23b", "#3bd1ff", "#5aff7a", "#ff8a3b", "#c56bff"]

    def papel(r, k):
        c, rot = r.choice(colores), r.uniform(0, 360)
        forma = (f'<rect x="-5" y="-3" width="10" height="6" fill="{c}"/>' if k % 3 else f'<circle r="4" fill="{c}"/>')
        return (f'<g>{forma}<animateTransform attributeName="transform" type="rotate" values="{rot:.0f};{rot+360:.0f}" '
                f'dur="{r.uniform(1, 2.5):.1f}s" repeatCount="indefinite"/></g>')
    serp = "".join(f'<path d="M-20 {y}Q100 {y-40} 200 {y}T420 {y}" fill="none" stroke="{c}" stroke-width="5" opacity=".5"/>'
                   for y, c in ((70, "#ffd23b"), (140, "#ff3b6b"), (210, "#3bd1ff")))
    return svg(d, fondo("c") + f"\n  {serp}\n" + caida(r, 50, papel, (4, 8), deriva=60))


# ---------- VIP ----------

def luna_roja(r):
    d = (cielo("c", (0, "#2a0508"), (1, "#080103")) + BLUR("b", 18)
         + '<radialGradient id="l" cx=".45" cy=".4" r=".6"><stop offset="0" stop-color="#ff7a5a"/><stop offset="1" stop-color="#c0141e"/></radialGradient>')
    luna = '  <circle cx="200" cy="150" r="95" fill="#ff2a2a" filter="url(#b)" opacity=".6"/><circle cx="200" cy="150" r="80" fill="url(#l)"/>'
    techo = '  <path d="M0 330L70 290L140 330ZM90 330V400H50V330ZM260 340L330 300L400 340ZM350 340V400H310V340Z" fill="#050102"/><rect y="370" width="400" height="30" fill="#050102"/>'

    def hoja(r, k):
        rot = r.uniform(0, 360)
        return (f'<g><path d="M0 -8Q7 0 0 8Q-7 0 0 -8Z" fill="{r.choice(["#ff3b2e", "#c0141e", "#ff7a3b"])}"/>'
                f'<animateTransform attributeName="transform" type="rotate" values="{rot:.0f};{rot+360:.0f}" dur="{r.uniform(2, 4):.1f}s" repeatCount="indefinite"/></g>')
    return svg(d, fondo("c") + "\n" + luna + "\n" + techo + "\n" + caida(r, 26, hoja, (5, 10), deriva=120))


def aura(r):
    d = (cielo("c", (0, "#0a1240"), (1, "#02030f")) + BLUR("b", 10)
         + cielo("a", (0, "#fff6b0"), (.5, "#ffc21a"), (1, "#ff7a00")))
    llamas = []
    for k in range(7):
        x, h = 40 + k * 53, r.uniform(160, 260)
        dur = r.uniform(.6, 1.1)
        p1 = f"M{x-30} 400Q{x-25} {400-h*.5:.0f} {x} {400-h:.0f}Q{x+25} {400-h*.5:.0f} {x+30} 400Z"
        p2 = f"M{x-30} 400Q{x-35} {400-h*.45:.0f} {x+8} {400-h*1.12:.0f}Q{x+20} {400-h*.45:.0f} {x+30} 400Z"
        llamas.append(f'  <path d="{p1}" fill="url(#a)" opacity=".75" filter="url(#b)"><animate attributeName="d" values="{p1};{p2};{p1}" dur="{dur:.2f}s" repeatCount="indefinite"/></path>')
    chispa = lambda r, k: '<path d="M0 -6L1.5 0L0 6L-1.5 0Z" fill="#fff6b0"/>'
    return svg(d, fondo("c") + "\n" + "\n".join(llamas) + "\n" + caida(r, 30, chispa, (1.5, 3), sube=True, deriva=10))


def portal(r):
    d = ('<radialGradient id="c" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="#0c2a10"/><stop offset="1" stop-color="#020802"/></radialGradient>'
         + '<radialGradient id="p" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#eaffb0"/><stop offset=".45" stop-color="#7dff3a"/><stop offset="1" stop-color="#0c6a10" stop-opacity="0"/></radialGradient>'
         + BLUR("b", 6))
    espiral = []
    for k in range(4):
        pts = []
        for i in range(60):
            t = i / 59 * 3.2 * math.pi
            rr = 8 + i * 2.4
            pts.append(f"{200 + rr*math.cos(t + k*math.pi/2):.1f},{200 + rr*math.sin(t + k*math.pi/2):.1f}")
        espiral.append(f'<polyline points="{" ".join(pts)}" fill="none" stroke="#b6ff5a" stroke-width="{6 - k}" stroke-linecap="round" opacity=".8"/>')
    giro = ('  <circle cx="200" cy="200" r="150" fill="url(#p)"/>'
            f'  <g filter="url(#b)">{"".join(espiral)}<animateTransform attributeName="transform" type="rotate" from="360 200 200" to="0 200 200" dur="5s" repeatCount="indefinite"/></g>'
            f'  <g>{"".join(espiral)}<animateTransform attributeName="transform" type="rotate" from="360 200 200" to="0 200 200" dur="5s" repeatCount="indefinite"/></g>')
    return svg(d, fondo("c") + "\n" + titila(r, 40, "#b6ff5a", 1.5) + "\n" + giro)


def cristal(r):
    d = (cielo("c", (0, "#0a1a2e"), (.7, "#2a3a4a"), (1, "#a8865a")) + cielo("k", (0, "#e0faff"), (.5, "#5ad8ff"), (1, "#1a6aa8"))
         + BLUR("b", 8))
    suelo = '  <path d="M0 320Q200 300 400 330V400H0Z" fill="#8a6a40"/>'
    cristales = []
    for x, h, a in ((90, 90, -12), (130, 130, 6), (175, 70, 20), (250, 110, -8), (300, 80, 14), (330, 55, -20)):
        dur = r.uniform(1.8, 3.5)
        cristales.append(f'<g transform="rotate({a} {x} 330)"><path d="M{x-14} 330L{x-10} {330-h*.8:.0f}L{x} {330-h}L{x+10} {330-h*.8:.0f}L{x+14} 330Z" fill="url(#k)">'
                         f'<animate attributeName="opacity" values=".75;1;.75" dur="{dur:.1f}s" repeatCount="indefinite"/></path>'
                         f'<path d="M{x} {330-h}L{x+10} {330-h*.8:.0f}L{x+2} 330Z" fill="#fff" opacity=".35"/></g>')
    brillo = '  <ellipse cx="200" cy="300" rx="170" ry="50" fill="#5ad8ff" opacity=".25" filter="url(#b)"><animate attributeName="opacity" values=".15;.35;.15" dur="3s" repeatCount="indefinite"/></ellipse>'
    return svg(d, fondo("c") + "\n" + titila(r, 60, "#fff", 1.3, (0, 260)) + "\n" + suelo + "\n" + brillo + "\n  " + "".join(cristales))


def niebla(r):
    d = cielo("c", (0, "#3a2e22"), (1, "#120d08")) + BLUR("b", 18)
    chimeneas = "".join(f'<rect x="{x}" y="{y}" width="26" height="{400-y}" fill="#1a130c"/>' for x, y in ((60, 150), (130, 110), (280, 130), (330, 170)))
    fabrica = f'  <path d="M0 260L60 230V260L120 230V260L180 230V400H0Z" fill="#1a130c"/>{chimeneas}<path d="M220 280H400V400H220Z" fill="#1a130c"/>'
    ventanas = "".join(f'<rect x="{x}" y="{y}" width="12" height="10" fill="#ffb54a" opacity=".7"/>' for x in range(236, 390, 26) for y in (300, 330))
    humo = []
    for x, y in ((73, 150), (143, 110), (293, 130), (343, 170)):
        for k in range(3):
            dur = 6
            humo.append(f'<circle cx="{x}" cy="{y}" r="16" fill="#8a7a66" opacity="0" filter="url(#b)">'
                        f'<animate attributeName="cy" values="{y};{y-140}" dur="{dur}s" begin="-{k*2}s" repeatCount="indefinite"/>'
                        f'<animate attributeName="r" values="14;46" dur="{dur}s" begin="-{k*2}s" repeatCount="indefinite"/>'
                        f'<animate attributeName="opacity" values=".7;0" dur="{dur}s" begin="-{k*2}s" repeatCount="indefinite"/></circle>')
    bruma = '  <rect y="250" width="400" height="150" fill="#c8b08a" opacity=".12" filter="url(#b)"/>'
    return svg(d, fondo("c") + "\n  " + "".join(humo) + "\n" + fabrica + f"\n  {ventanas}\n" + bruma)


def reves(r):
    d = cielo("c", (0, "#14020a"), (.55, "#5a0a12"), (.8, "#a8141e"), (1, "#2a0306")) + BLUR("b", 4) + BLUR("n", 20)
    nubes = "".join(f'<ellipse cx="{x}" cy="{y}" rx="110" ry="34" fill="#ff2a3a" opacity=".25" filter="url(#n)"/>'
                    for x, y in ((80, 60), (300, 40), (200, 120)))
    arboles = "".join(f'<path d="M{x} 400V{y}M{x} {y+40}L{x-30} {y}M{x} {y+70}L{x+34} {y+20}" stroke="#050102" stroke-width="7" fill="none"/>'
                      for x, y in ((50, 230), (140, 270), (260, 240), (350, 260)))
    rayo = ('  <path d="M300 0L270 70L300 75L250 170" stroke="#ff2a3a" stroke-width="3" fill="none" filter="url(#b)" opacity="0">'
            '<animate attributeName="opacity" values="0;0;1;0;.8;0" keyTimes="0;.7;.73;.77;.8;1" dur="4s" repeatCount="indefinite"/></path>')
    espora = lambda r, k: f'<circle r="{r.uniform(1, 2.6):.1f}" fill="#e8d8d0" opacity=".6"/>'
    return svg(d, fondo("c") + f"\n  {nubes}\n" + rayo + f"\n  {arboles}\n" + caida(r, 45, espora, (8, 16), sube=True, deriva=40))


def alien(r):
    d = ('<radialGradient id="c" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#0c3a12"/><stop offset="1" stop-color="#020a03"/></radialGradient>'
         + BLUR("b", 8))
    hexes = []
    s = 26
    for fila in range(-1, 11):
        for col in range(-1, 10):
            cx = col * s * 1.73 + (s * .87 if fila % 2 else 0)
            cy = fila * s * 1.5
            p = " ".join(f"{cx + s*.92*math.cos(math.pi/3*i + math.pi/6):.1f},{cy + s*.92*math.sin(math.pi/3*i + math.pi/6):.1f}" for i in range(6))
            dist = math.hypot(cx - 200, cy - 200)
            hexes.append(f'<polygon points="{p}" fill="#3dff4a" fill-opacity="0" stroke="#3dff4a" stroke-opacity=".25">'
                         f'<animate attributeName="fill-opacity" values="0;.35;0;0" keyTimes="0;.12;.3;1" dur="3s" begin="{dist/200:.2f}s" repeatCount="indefinite"/></polygon>')
    nucleo = ('  <circle cx="200" cy="200" r="60" fill="#3dff4a" filter="url(#b)" opacity=".5"><animate attributeName="r" values="50;70;50" dur="3s" repeatCount="indefinite"/></circle>'
              '<circle cx="200" cy="200" r="34" fill="#0a0a0a" stroke="#3dff4a" stroke-width="6"/><path d="M180 178L220 178L200 200ZM180 222L220 222L200 200Z" fill="#3dff4a"/>')
    return svg(d, fondo("c") + "\n  " + "".join(hexes) + "\n" + nucleo)


def billetes(r):
    d = cielo("c", (0, "#4a0a0e"), (1, "#14020a"))

    def billete(r, k):
        rot = r.uniform(-40, 40)
        return (f'<g><g><rect x="-22" y="-11" width="44" height="22" rx="2" fill="#5aa86a" stroke="#2a6a3a"/>'
                f'<circle r="6" fill="none" stroke="#2a6a3a" stroke-width="2"/><text y="4" text-anchor="middle" font-family="Arial Black" font-size="9" fill="#2a6a3a">$</text></g>'
                f'<animateTransform attributeName="transform" type="rotate" values="{rot:.0f};{-rot:.0f};{rot:.0f}" dur="{r.uniform(1.5, 3):.1f}s" repeatCount="indefinite"/></g>')
    caretas = "".join(f'<g transform="translate({x} 330)"><ellipse rx="32" ry="40" fill="#f2e6d8"/><path d="M-20 -8Q-12 -14 -4 -8M4 -8Q12 -14 20 -8" stroke="#111" stroke-width="3" fill="none"/>'
                      f'<path d="M-14 14Q0 26 14 14" stroke="#111" stroke-width="3" fill="none"/><path d="M-12 22Q0 36 12 22" fill="#111" opacity=".6"/></g>' for x in (80, 320))
    return svg(d, fondo("c") + "\n" + caida(r, 22, billete, (4, 8), deriva=80) + "\n  " + caretas)


def abismo(r):
    d = cielo("c", (0, "#06306a"), (1, "#010614")) + BLUR("b", 10)
    rayos = "".join(f'<path d="M{x} 0L{x+40} 0L{x+100} 400L{x+20} 400Z" fill="#5ac8ff" opacity=".07"/>' for x in (20, 140, 260))
    medusas = []
    for k, (x, y, c) in enumerate(((110, 260, "#ff6bd8"), (290, 190, "#6bf2ff"), (210, 330, "#c56bff"))):
        medusas.append(f'<g><g filter="url(#b)" opacity=".6"><path d="M{x-24} {y}A24 20 0 0 1 {x+24} {y}Z" fill="{c}"/></g>'
                       f'<path d="M{x-24} {y}A24 20 0 0 1 {x+24} {y}Z" fill="{c}" opacity=".85"/>'
                       + "".join(f'<path d="M{x+t} {y}q4 14 0 28t0 28" stroke="{c}" fill="none" opacity=".6"/>' for t in (-14, -5, 5, 14))
                       + f'<animateTransform attributeName="transform" type="translate" values="0 0;0 -26;0 0" dur="{4 + k}s" repeatCount="indefinite"/></g>')
    burbuja = lambda r, k: f'<circle r="{r.uniform(2, 5):.1f}" fill="none" stroke="#bff0ff" stroke-opacity=".7"/>'
    return svg(d, fondo("c") + f"\n  {rayos}\n  " + "".join(medusas) + "\n" + caida(r, 30, burbuja, (4, 9), sube=True, deriva=20))


def trazadoras(r):
    d = (cielo("c", (0, "#14100a"), (1, "#050403"))
         + '<linearGradient id="t" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff9a1a" stop-opacity="0"/>'
           '<stop offset=".85" stop-color="#ffd56b"/><stop offset="1" stop-color="#fff"/></linearGradient>' + BLUR("b", 3))
    balas = []
    for k in range(16):
        y, dur = r.uniform(-40, 440), r.uniform(.6, 1.4)
        balas.append(f'<g transform="rotate(-20 200 200)"><rect x="-160" y="{y:.0f}" width="140" height="3" rx="1.5" fill="url(#t)" filter="url(#b)"/>'
                     f'<rect x="-160" y="{y:.0f}" width="140" height="1.5" fill="url(#t)"/>'
                     f'<animateTransform attributeName="transform" type="translate" values="-100 0;700 0" dur="{dur:.1f}s" begin="-{r.uniform(0, 3):.1f}s" repeatCount="indefinite" additive="sum"/></g>')
    return svg(d, fondo("c") + "\n  " + "".join(balas))


def oro(r):
    d = (cielo("c", (0, "#2a1c04"), (1, "#0c0802"))
         + cielo("g", (0, "#7a5410"), (.5, "#ffd96b"), (1, "#9a6a14"), x2=1, y2=1)
         + '<linearGradient id="br" x1="0" y1="0" x2="1" y2="1"><stop offset=".4" stop-color="#fff" stop-opacity="0"/>'
           '<stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient>')
    lingotes = "".join(f'<path d="M{x} {y}L{x+12} {y-18}H{x+68}L{x+80} {y}Z" fill="url(#g)" stroke="#5a3c08"/>'
                       for y in (400, 382, 364, 346) for x in range(-40 + (y % 36), 440, 84))
    barrido = '  <rect x="-400" width="400" height="400" fill="url(#br)"><animate attributeName="x" values="-400;400;400" keyTimes="0;.5;1" dur="3.5s" repeatCount="indefinite"/></rect>'
    return svg(d, fondo("c") + "\n" + titila(r, 40, "#ffe8a0", 1.8, (0, 320)) + f"\n  {lingotes}\n" + barrido)


def dragon(r):
    d = (cielo("c", (0, "#3a0606"), (1, "#0a0101"))
         + '<pattern id="e" width="40" height="30" patternUnits="userSpaceOnUse"><path d="M0 0Q20 34 40 0" fill="#8a1010" stroke="#ffb02e" stroke-opacity=".45" stroke-width="2"/>'
           '<path d="M-20 15Q0 49 20 15M20 15Q40 49 60 15" fill="#6a0a0a" stroke="#ffb02e" stroke-opacity=".45" stroke-width="2"/></pattern>'
         + '<linearGradient id="br" x1="0" y1="0" x2="1" y2="1"><stop offset=".4" stop-color="#ffd56b" stop-opacity="0"/>'
           '<stop offset=".5" stop-color="#ffd56b" stop-opacity=".45"/><stop offset=".6" stop-color="#ffd56b" stop-opacity="0"/></linearGradient>' + BLUR("b", 14))
    ojo = ('  <g><ellipse cx="200" cy="200" rx="70" ry="34" fill="#ffb02e" filter="url(#b)" opacity=".5"/>'
           '<ellipse cx="200" cy="200" rx="58" ry="26" fill="#ffc23a"/><ellipse cx="200" cy="200" rx="7" ry="24" fill="#120202">'
           '<animate attributeName="rx" values="7;3;7;7" keyTimes="0;.1;.2;1" dur="4s" repeatCount="indefinite"/></ellipse></g>')
    barrido = '  <rect x="-400" width="400" height="400" fill="url(#br)"><animate attributeName="x" values="-400;400;400" keyTimes="0;.5;1" dur="4s" repeatCount="indefinite"/></rect>'
    return svg(d, fondo("c") + f'\n  <rect width="400" height="400" fill="url(#e)" opacity=".85"/>\n' + barrido + "\n" + ojo)


FONDOS = [
    # (id, nombre, descripción, función, vip, colección)
    ("humo", "Granada de humo", "Humo que cruza la tarjeta de lado a lado.", humo, False, "cs"),
    ("radar", "Radar", "El radar barre y marca enemigos.", radar, False, "cs"),
    ("casquillos", "Lluvia de casquillos", "Vainas de bronce que caen girando.", casquillos, False, "cs"),
    ("neon", "Neón", "Sol retro y cuadrícula que avanza.", neon, False, "cs"),
    ("tormenta", "Tormenta", "Lluvia y relámpagos de noche.", tormenta, False, "cs"),
    ("consola", "Consola", "Columnas de código que bajan.", consola, False, "cs"),
    ("mapa-dust2", "Atardecer en el desierto", "Dunas, sol bajo y arena con viento.", dust2, False, "mapas"),
    ("mapa-inferno", "Brasas del pueblo", "Muros de ladrillo, arcos y brasas que suben.", inferno, False, "mapas"),
    ("mapa-nuke", "Planta nuclear", "Símbolo que gira y franjas de peligro.", nuke, False, "mapas"),
    ("mapa-office", "Oficina nevada", "Edificios de noche con nieve que cae.", office, False, "mapas"),
    ("pais-cruz-del-sur", "Cruz del Sur", "El cielo del sur con sus estrellas.", cruz_del_sur, False, "paises"),
    ("pais-carnaval", "Carnaval", "Papelitos y serpentinas de colores.", carnaval, False, "paises"),
    ("serie-luna-roja", "Luna roja", "Hojas que vuelan bajo una luna enorme.", luna_roja, True, "series"),
    ("serie-aura", "Aura dorada", "Energía dorada que sube sin parar.", aura, True, "series"),
    ("serie-portal", "Portal verde", "Un portal en espiral que gira.", portal, True, "series"),
    ("serie-cristal", "Cristales del desierto", "Cristales azules que brillan de noche.", cristal, True, "series"),
    ("serie-niebla", "Ciudad de humo", "Fábricas, chimeneas y niebla de época.", niebla, True, "series"),
    ("serie-reves", "Del otro lado", "Cielo rojo, relámpagos y esporas flotando.", reves, True, "series"),
    ("serie-alien", "Energía alien", "Celdas verdes que se encienden en onda.", alien, True, "series"),
    ("serie-billetes", "El gran golpe", "Lluvia de billetes y caretas.", billetes, True, "series"),
    ("serie-abismo", "Abismo", "Medusas de colores y burbujas en lo profundo.", abismo, True, "series2"),
    ("arma-trazadoras", "Fuego cruzado", "Trazadoras que cruzan en diagonal.", trazadoras, True, "arsenal"),
    ("arma-oro", "Bóveda de oro", "Lingotes con un brillo que pasa.", oro, True, "arsenal"),
    ("arma-dragon", "Escamas de dragón", "Escamas rojas y un ojo que parpadea.", dragon, True, "arsenal"),
]


def precio(vip, col):
    if vip:
        return None
    return 1000 if col == "cs" else 800


def q(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def main():
    carpeta = PERFIL / "fondos"
    carpeta.mkdir(exist_ok=True)
    items = []
    for n, (fid, nombre, desc, fn, vip, col) in enumerate(FONDOS):
        (carpeta / f"{fid}.svg").write_text(fn(random.Random(fid)), encoding="utf-8", newline="\n")
        items.append({"id": f"fondo-{fid}", "kind": "background", "name": nombre, "description": desc,
                      "file": f"fondos/{fid}.svg", "css_class": None, "vip_only": vip, "animated": True,
                      "price": None, "collection": col})

    ruta = PERFIL / "catalogo.json"
    cat = json.loads(ruta.read_text(encoding="utf-8"))
    cat["version"] = 7
    cat["kinds"]["background"] = "Fondo de miniperfil (400 x 400, se recorta para llenar la tarjeta)"
    cat["items"] = [i for i in cat["items"] if i["kind"] != "background"] + items
    ruta.write_text(json.dumps(cat, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")

    filas = ",\n".join(
        f"  ({q(i['id'])}, 'background', {q(i['name'])}, {q(i['description'])}, {q(i['file'])}, null, "
        f"{q(i['vip_only'])}, true, {q(i['collection'])}, {q(precio(i['vip_only'], i['collection']))}, {5000 + k * 10})"
        for k, i in enumerate(items))
    texto = SQL.read_text(encoding="utf-8")
    ini, fin = "-- --- inicio: fondos generados ---", "-- --- fin: fondos generados ---"
    a, b = texto.index(ini) + len(ini), texto.index(fin)
    SQL.write_text(texto[:a] + "\n" + filas + "\n" + texto[b:], encoding="utf-8", newline="\n")
    print(f"{len(items)} fondos; catálogo con {len(cat['items'])} artículos")


if __name__ == "__main__":
    main()
