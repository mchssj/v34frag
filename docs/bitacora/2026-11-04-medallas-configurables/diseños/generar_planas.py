"""Versión PLANA de las medallas de CM League, pensada para el frontend nuevo (shadcn, tema oscuro).

Uso: python generar_planas.py <carpeta_destino> <generar_medallas_perfil.py> <generar_medallas_nuevas.py>

Toma la definición de cada medalla (forma, tipo, nivel e ícono) de los generadores originales y la
dibuja plana: sin degradados, brillos, sombras, cinta ni textos.
- Forma = categoría (la misma que la versión detallada).
- Relleno gris del tema (como el fondo "muted" del frontend).
- Borde = nivel (bronce, plata, oro, platino, diamante) en tono plano.
- Ícono = color del tipo de medalla, un poco apagado para no gritar sobre el gris.
Salida: <destino>/perfil, <destino>/equipos y <destino>/nuevas/{perfil,equipos}, con un manifiesto JSON.
"""
import json, os, re, sys, tempfile

DEST, SRC_PERFIL, SRC_NUEVAS = sys.argv[1], sys.argv[2], sys.argv[3]

SUPERFICIE = "#262626"      # muted del tema oscuro
SUPERFICIE_BLOQ = "#1C1C1E"
BORDE = {"bronce": "#C2773A", "plata": "#A1A1AA", "oro": "#EAB308", "platino": "#A5F3FC", "diamante": "#60A5FA"}
OSCUROS = {"#0B0C10", "#0F1014", "#0E1A12", "#1C1D23", "#2A2D35", "#24262D", "#121318", "#2A2C33", "#22201E"}


def mezcla(c1, c2, t):
    a = [int(c1[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(c2[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(x + (y - x) * t):02X}" for x, y in zip(a, b))


def recolectar(src, corte):
    """Ejecuta un generador interceptando badge() y logro() para quedarse con la definición de cada medalla."""
    code = open(src, encoding="utf-8").read()
    a, b = code.split(corte, 1)
    tmp = tempfile.mkdtemp()
    ns = {"__name__": "gen", "__file__": src}
    old = sys.argv
    sys.argv = ["gen", os.path.join(tmp, "perfil"), os.path.join(tmp, "equipos")]
    try:
        exec(compile(a, src, "exec"), ns)
        regs = []

        def badge(name, title, shape, fam, tier, label, txt, icon, total=1, level=1, locked=False, isc=1.12):
            if not locked:
                regs.append(dict(name=name, title=title, shape=shape, fam=fam, tier=tier, icon=icon,
                                 out=ns["OUT"], cat=ns.get("CAT", ""), logro=False))

        def logro(name, title, fam, tier, word, icon, locked=False, rays_=False, shape="circulo", label=None,
                  spark=False, estrellas=3, mes=False, **kw):
            if not locked:
                regs.append(dict(name=name, title=title, shape=shape, fam=fam, tier=tier, icon=icon,
                                 out=ns["OUT"], cat=ns.get("CAT", ""), logro=True))

        ns["badge"], ns["logro"] = badge, logro
        exec(compile((corte + b).replace('if os.environ.get("MANIFEST"):', "if False:"), src, "exec"), ns)
    finally:
        sys.argv = old
    return ns, regs


def icono_plano(svg, color, sup):
    def rep(m):
        attr, val = m.group(1), m.group(2)
        v = val.upper()
        if val.startswith("url(#acento)") or val.startswith("url(#metal") or val.startswith("url(#color-equipo)"):
            return f'{attr}="{color}"'
        if v in OSCUROS or v == "#FFFFFF":
            return f'{attr}="{sup}"'
        if v.startswith("#"):
            return f'{attr}="{color}"'
        return m.group(0)
    svg = re.sub(r'(fill|stroke)="([^"]+)"', rep, svg)
    # los textos dentro de los íconos (16-0, VS, A, β...) van siempre en el color del ícono
    svg = re.sub(r'(<text\b[^>]*?)fill="[^"]*"', lambda m: m.group(1) + f'fill="{color}"', svg)
    svg = re.sub(r'\sfilter="[^"]*"', "", svg)
    svg = re.sub(r'\sid="[^"]*"', "", svg)
    return svg


def plana(ns, r, locked):
    shape = ns["SHAPES"][r["shape"]]
    tipo = ns["ACC"][r["fam"]]["mid"]
    if locked:
        sup, borde, color = SUPERFICIE_BLOQ, "#3F3F46", "#52525B"
    else:
        sup, borde = SUPERFICIE, BORDE.get(r["tier"], "#A1A1AA")
        color = mezcla(tipo, "#A3A3A3", .2)
    ic = icono_plano(r["icon"], color, sup)
    # los íconos están dibujados alrededor de (130, 204): se centran en la forma y se agrandan
    esc = 1.95
    cy = 141 if r["shape"] != "banderin" else 132
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="64" height="70" viewBox="16 14 228 250">
  <title>{r["title"]}{" (bloqueada)" if locked else ""}</title>
  <desc>CM League, versión plana para el frontend. Forma = categoría, borde = nivel, ícono = tipo.</desc>
  <path id="forma" d="{shape}" fill="{sup}" stroke="{borde}" stroke-width="10" stroke-linejoin="round"/>
  <g id="icono" transform="translate(130 {cy}) scale({esc}) translate(-130 -204)">
    {ic}
  </g>
</svg>
'''


def main():
    ns1, regs1 = recolectar(SRC_PERFIL, "# ================= PERFIL =================")
    ns2, regs2 = recolectar(SRC_NUEVAS, "\n# Siluetas extra (csd.ttf)")
    manifest = []
    for ns, regs, base in ((ns1, regs1, ""), (ns2, regs2, "nuevas")):
        for r in regs:
            carpeta = os.path.basename(os.path.normpath(r["out"]))
            sub = os.path.join(DEST, base, "equipos" if carpeta == "equipos" else "perfil")
            os.makedirs(sub, exist_ok=True)
            for locked in (False, True):
                fn = ("bloqueada_" if locked else "") + r["name"] + ".svg"
                open(os.path.join(sub, fn), "w", encoding="utf-8").write(plana(ns, r, locked))
            rel = os.path.relpath(os.path.join(sub, r["name"] + ".svg"), DEST).replace("\\", "/")
            manifest.append(dict(archivo=rel, nombre=r["name"], titulo=r["title"].replace("CM League - ", ""),
                                 categoria=r["cat"], grupo="Nuevas" if base else "Entregadas",
                                 nivel=r["tier"], equipo=carpeta == "equipos"))
    json.dump(manifest, open(os.path.join(DEST, "manifiesto.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("medallas planas:", len(manifest))


main()
