"""Radar propio de cada mapa para la repetición 2D y el mapa de calor (bitácora 2026-11-12-repeticion-2d-y-mapa-de-calor).

Lee el .nav del mapa (las zonas por donde caminan los bots, versión 9 en el v34) y dibuja cada zona vista desde
arriba, más clara cuanto más alta. Así no hace falta el radar de Valve, que no viene en el servidor ni existe para
los mapas de la comunidad. Las coordenadas del SVG son las del juego: x igual, y invertida (el SVG crece hacia abajo).

Uso: py -I nav_a_svg.py <carpeta de salida> <mapa.nav>...
Escribe <mapa>.svg por cada uno y actualiza index.json con los límites (minx, maxy, ancho y alto) para pasar
una posición del juego al dibujo: px = x - minx, py = maxy - y.
"""
import json, os, struct, sys


def leer_nav(path):
    d = open(path, "rb").read()
    o = 0

    # Ojo: "o += u(...)" pierde el avance de u (Python lee o antes de llamar). Se usa salto().
    def salto(n):
        nonlocal o
        o += n

    def u(fmt):
        nonlocal o
        v = struct.unpack_from("<" + fmt, d, o)
        o += struct.calcsize("<" + fmt)
        return v if len(v) > 1 else v[0]

    magic, ver = u("I"), u("I")
    if magic != 0xFEEDFACE:
        raise ValueError("no es un .nav")
    if ver >= 10:
        u("I")
    if ver >= 4:
        u("I")
    if ver >= 14:
        u("B")
    if ver >= 5:
        for _ in range(u("H")):
            salto(u("H"))
        if ver > 11:
            u("B")
    zonas = []
    for _ in range(u("I")):
        u("I")
        u("B" if ver <= 8 else "H" if ver < 13 else "I")
        nx, ny, nz, sx, sy, sz = u("6f")
        nez, swz = (u("2f") if ver >= 2 else (nz, sz))
        for _ in range(4):
            salto(4 * u("I"))
        for _ in range(u("B")):
            o += 4 + 12 + (1 if ver >= 2 else 0)
        if ver < 15:
            salto(14 * u("B"))
        for _ in range(u("I")):
            o += 4 + 1 + 4 + 1
            salto(5 * u("B"))
        if ver >= 5:
            u("H")
        if ver >= 7:
            for _ in range(2):
                salto(4 * u("I"))
        if ver >= 8:
            u("2f")
        if ver >= 11:
            u("4f")
        if ver >= 16:
            salto(8 * u("I"))
            u("I")
        zonas.append((min(nx, sx), min(ny, sy), max(nx, sx), max(ny, sy), (nz + sz + nez + swz) / 4))
    return zonas


def svg(nombre, zonas):
    minx = min(z[0] for z in zonas); maxx = max(z[2] for z in zonas)
    miny = min(z[1] for z in zonas); maxy = max(z[3] for z in zonas)
    minz = min(z[4] for z in zonas); maxz = max(z[4] for z in zonas)
    pad = 64
    minx -= pad; maxy += pad; w = maxx - minx + pad; h = maxy - miny + pad
    rects = []
    # Primero las más bajas: lo de arriba tapa lo de abajo (un puente sobre un túnel).
    for x0, y0, x1, y1, z in sorted(zonas, key=lambda z: z[4]):
        t = (z - minz) / ((maxz - minz) or 1)
        g = round(70 + t * 120)
        c = f"#{g:02x}{g:02x}{min(255, g + 12):02x}"
        rects.append(f'<rect x="{x0 - minx:.0f}" y="{maxy - y1:.0f}" width="{x1 - x0:.0f}" height="{y1 - y0:.0f}" fill="{c}" stroke="{c}" stroke-width="6"/>')
    cuerpo = "\n".join(rects)
    texto = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" data-map="{nombre}" '
             f'data-minx="{minx:.0f}" data-maxy="{maxy:.0f}" shape-rendering="crispEdges">\n{cuerpo}\n</svg>\n')
    return texto, {"minx": round(minx), "maxy": round(maxy), "width": round(w), "height": round(h), "minz": round(minz), "maxz": round(maxz)}


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    idx_path = os.path.join(out, "index.json")
    idx = json.load(open(idx_path, encoding="utf-8")) if os.path.exists(idx_path) else {}
    for nav in sys.argv[2:]:
        nombre = os.path.splitext(os.path.basename(nav))[0]
        zonas = leer_nav(nav)
        texto, lim = svg(nombre, zonas)
        open(os.path.join(out, nombre + ".svg"), "w", encoding="utf-8", newline="\n").write(texto)
        idx[nombre] = lim
        print(nombre, len(zonas), "zonas", lim)
    json.dump(dict(sorted(idx.items())), open(idx_path, "w", encoding="utf-8", newline="\n"), indent=1)


if __name__ == "__main__":
    main()
