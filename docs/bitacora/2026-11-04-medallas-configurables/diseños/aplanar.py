"""Aplana las medallas de CM League: mismo diseño, sin degradados, brillos, halos, rayos ni sombras.

Uso: python aplanar.py <carpeta_origen> <carpeta_destino> [--marco]
Con --marco, el marco conserva su degradado metálico y suma un resplandor suave pegado al borde;
todo lo demás queda plano.
Recorre la carpeta de origen (con subcarpetas) y escribe cada SVG aplanado en el mismo lugar relativo.
- Cada degradado se reemplaza por un color plano (el tono medio del degradado).
- Se quitan: sombras, halo, rayos, destellos, brillo superior y textura.
- Se quita el filtro de sombra de los textos.
"""
import os, re, sys
import xml.etree.ElementTree as ET

SRC, DST = sys.argv[1], sys.argv[2]
MARCO = "--marco" in sys.argv
IDS_MARCO = {"marco-metal", "marco-color", "filete-claro"}
NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)
Q = lambda t: f"{{{NS}}}{t}"

QUITAR_IDS = {"sombra-piso", "aura", "aura-nivel", "rayos", "destellos", "brillo-superior", "textura",
              "textura-escudo", "sombra-forma", "sombra-escudo", "sombra-hexagono", "sombra-circulo"}
QUITAR_URLS = {"brillo", "grad-aura", "aura", "patron-textura"}


def color_plano(grad):
    stops = [(float(s.get("offset", "0")), s.get("stop-color")) for s in grad.iter(Q("stop"))]
    if not stops:
        return None
    gid = grad.get("id")
    if gid == "metal":
        objetivo = .28            # el tono medio del metal (no el oscuro del centro)
    elif grad.tag == Q("radialGradient"):
        objetivo = .45            # la cara: el tono teñido, no el borde negro
    else:
        objetivo = .5
    return min(stops, key=lambda s: abs(s[0] - objetivo))[1]


def aplanar(path_in, path_out):
    tree = ET.parse(path_in)
    root = tree.getroot()
    colores = {}
    for g in list(root.iter(Q("linearGradient"))) + list(root.iter(Q("radialGradient"))):
        colores[g.get("id")] = color_plano(g)

    def url(v):
        m = re.match(r"url\(#([^)]+)\)", v or "")
        return m.group(1) if m else None

    # quitar elementos de brillo, sombra y halo
    def limpiar(parent):
        for ch in list(parent):
            fid = url(ch.get("filter"))
            fill = url(ch.get("fill"))
            if (ch.get("id") in QUITAR_IDS or fill in QUITAR_URLS
                    or (fid in ("desenfoque", "shadow") and ch.tag != Q("text"))):
                parent.remove(ch)
                continue
            limpiar(ch)
    limpiar(root)

    # degradados -> color plano; sin filtros
    for el in root.iter():
        if MARCO and el.get("id") in IDS_MARCO:
            continue
        for attr in ("fill", "stroke"):
            gid = url(el.get(attr))
            if gid and gid in colores and colores[gid]:
                el.set(attr, colores[gid])
        if "filter" in el.attrib and not (MARCO and el.get("id") in IDS_MARCO):
            del el.attrib["filter"]

    # defs: quedan solo los recortes (clipPath); los degradados, filtros y patrones ya no se usan
    usados = set()
    if MARCO:
        for el in root.iter():
            if el.get("id") in IDS_MARCO:
                usados |= {url(el.get("fill")), url(el.get("stroke"))}
    for defs in root.iter(Q("defs")):
        for ch in list(defs):
            if ch.tag != Q("clipPath") and ch.get("id") not in usados:
                defs.remove(ch)
        if MARCO:
            f = ET.SubElement(defs, Q("filter"), {"id": "resplandor-marco", "x": "-20%", "y": "-20%", "width": "140%", "height": "140%"})
            ET.SubElement(f, Q("feGaussianBlur"), {"stdDeviation": "5"})
    if MARCO:
        # resplandor: copia del contorno del marco, desenfocada, detrás del borde negro
        for parent in root.iter():
            hijos = list(parent)
            for i, ch in enumerate(hijos):
                if ch.get("id") in ("marco-metal", "marco-color"):
                    borde = next((h for h in hijos if h.get("id") == "borde-exterior"), ch)
                    gid = url(ch.get("stroke")) or url(ch.get("fill"))
                    color = colores.get(gid) or ch.get("stroke")
                    glow = ET.Element(Q("path"), {"id": "resplandor-marco", "d": ch.get("d"), "fill": "none",
                                                  "stroke": color, "stroke-width": "26", "stroke-linejoin": "round",
                                                  "opacity": ".55", "filter": "url(#resplandor-marco)"})
                    if ch.get("transform"):
                        glow.set("transform", ch.get("transform"))
                    parent.insert(hijos.index(borde), glow)
                    break
    desc = root.find(Q("desc"))
    if desc is not None:
        desc.text = (desc.text or "") + (" Versión plana con brillo solo en el marco." if MARCO else " Versión plana: sin degradados, brillos ni sombras.")
    os.makedirs(os.path.dirname(path_out), exist_ok=True)
    tree.write(path_out, encoding="utf-8", xml_declaration=False)


n = 0
for base, _, files in os.walk(SRC):
    if os.path.abspath(base).startswith(os.path.abspath(DST)):
        continue
    for f in files:
        if f.endswith(".svg"):
            rel = os.path.relpath(os.path.join(base, f), SRC)
            aplanar(os.path.join(base, f), os.path.join(DST, rel))
            n += 1
print("aplanadas:", n)
