# Arma la versión "_ob" (sin techo) de un mapa descompilado con BSPSource.
#
# Borra los bloques de cielo (solids con todas sus caras tools/* y alguna tools/toolsskybox) que tocan la zona
# de juego y la encierra en una caja de cielo nueva, del mismo ancho y con el techo en --techo. El cielo 3D
# (la sala de sky_camera) no se toca, porque queda lejos de la zona de juego.
#
# Uso: python sin_techo_vmf.py entrada.vmf salida.vmf [--techo 2560] [--margen 512]
import re, sys

args = sys.argv[1:]
src, dst = args[0], args[1]
TECHO = float(args[args.index('--techo') + 1]) if '--techo' in args else 2560.0
MARGEN = float(args[args.index('--margen') + 1]) if '--margen' in args else 512.0
GROSOR = 32.0

text = open(src, encoding='utf-8', errors='replace').read()


# --- KeyValues mínimo: nodo = [nombre, [(clave, valor) | nodo]] ---
def parse(t):
    tok = re.findall(r'"((?:[^"\\]|\\.)*)"|([{}])|([^\s{}"]+)', t)
    pos = 0

    def block():
        nonlocal pos
        items = []
        while pos < len(tok):
            q, br, w = tok[pos]
            if br == '}':
                pos += 1
                return items
            name = q if q or not w else w
            pos += 1
            q2, br2, w2 = tok[pos]
            if br2 == '{':
                pos += 1
                items.append([name, block()])
            else:
                items.append((name, q2 if q2 or not w2 else w2))
                pos += 1
        return items
    return block()


def dump(items, ind=0):
    out = []
    p = '\t' * ind
    for it in items:
        if isinstance(it, list):
            out.append(f'{p}{it[0]}\n{p}{{\n{dump(it[1], ind + 1)}{p}}}\n')
        else:
            out.append(f'{p}"{it[0]}" "{it[1]}"\n')
    return ''.join(out)


def kv(node, key):
    return next((v for k, v in (x for x in node if isinstance(x, tuple)) if k == key), None)


def children(node, name):
    return [x for x in node if isinstance(x, list) and x[0] == name]


root = parse(text)
world = next(x for x in root if isinstance(x, list) and x[0] == 'world')[1]
ents = [x[1] for x in root if isinstance(x, list) and x[0] == 'entity']

mins = [float(v) for v in kv(world, 'world_mins').split()] if kv(world, 'world_mins') else None
maxs = [float(v) for v in kv(world, 'world_maxs').split()] if kv(world, 'world_maxs') else None


def solid_info(s):
    mats = [kv(sd[1], 'material').lower() for sd in children(s[1], 'side')]
    pts = []
    for sd in children(s[1], 'side'):
        pts += [tuple(map(float, p.split())) for p in re.findall(r'\(([^)]*)\)', kv(sd[1], 'plane'))]
    lo = [min(p[i] for p in pts) for i in range(3)]
    hi = [max(p[i] for p in pts) for i in range(3)]
    return mats, lo, hi


def toca_juego(lo, hi):
    return all(lo[i] <= maxs[i] + MARGEN and hi[i] >= mins[i] - MARGEN for i in range(2))


if mins is None:
    # BSPSource no los pasa al VMF: se leen del worldspawn del .bsp que está al lado.
    import os, struct
    bsp = os.path.splitext(src)[0] + '.bsp'
    if not os.path.exists(bsp):
        sys.exit('El VMF no trae world_mins/world_maxs y no está el .bsp al lado: ' + bsp)
    with open(bsp, 'rb') as fh:
        hb = fh.read(1036)
        o, l = struct.unpack('<ii', hb[8:16])
        fh.seek(o)
        ent = fh.read(l).decode('latin1')
    mins = [float(v) for v in re.search(r'"world_mins" "([^"]+)"', ent).group(1).split()]
    maxs = [float(v) for v in re.search(r'"world_maxs" "([^"]+)"', ent).group(1).split()]
print('zona de juego', mins, maxs)

# BSPSource deja los clips (paredes que frenan solo jugadores) como tools/toolstrigger en el mundo, y vbsp los
# compila sólidos: rellenan zonas enteras y frenan granadas y balas. Se buscan en el .bsp original por su caja y se
# les pone la textura que corresponde a su contenido.
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from brushes import load as bsp_load, bounds as bsp_bounds
_b = bsp_load(os.path.splitext(src)[0] + '.bsp')
clips = {}
for br in _b['brushes']:
    if br[2] & 0x10000 and not br[2] & 1:
        mn, mx = bsp_bounds(_b, br)
        if None not in mn and None not in mx:
            clips[tuple(round(v) for v in mn + mx)] = br[2]
arreglados = {'tools/toolsclip': 0, 'tools/toolsplayerclip': 0, 'sin par': 0}
for s in children(world, 'solid'):
    sides = children(s[1], 'side')
    if all(kv(sd[1], 'material').lower() == 'tools/toolstrigger' for sd in sides):
        _, lo, hi = solid_info(s)
        c = clips.get(tuple(round(v) for v in lo + hi))
        if c is None:
            arreglados['sin par'] += 1
            mat = 'tools/toolsplayerclip'
        else:
            mat = 'tools/toolsclip' if c & 0x20000 else 'tools/toolsplayerclip'
            arreglados[mat] += 1
        for sd in sides:
            sd[1][:] = [('material', mat.upper()) if isinstance(x, tuple) and x[0] == 'material' else x for x in sd[1]]
print('clips arreglados:', arreglados)

borrar, caja = [], [[1e9] * 3, [-1e9] * 3]
for s in children(world, 'solid'):
    mats, lo, hi = solid_info(s)
    if all(m.startswith('tools/') for m in mats) and 'tools/toolsskybox' in mats and toca_juego(lo, hi):
        borrar.append(s)
        for i in range(3):
            caja[0][i] = min(caja[0][i], lo[i])
            caja[1][i] = max(caja[1][i], hi[i])
if not borrar:
    sys.exit('No encontré bloques de cielo en la zona de juego.')
for s in borrar:
    world.remove(s)

ids = [int(v) for v in re.findall(r'"id" "(\d+)"', text)]
nid = max(ids) + 1


def side(pl, ua, va):
    global nid
    nid += 1
    return ['side', [('id', str(nid)), ('plane', pl), ('material', 'TOOLS/TOOLSSKYBOX'), ('uaxis', ua), ('vaxis', va),
                     ('rotation', '0'), ('lightmapscale', '16'), ('smoothing_groups', '0')]]


def block(a, b, c, d, e, f):
    global nid
    nid += 1
    sid = nid
    P = lambda *q: ' '.join('(%g %g %g)' % t for t in q)
    XY, XZ, YZ = ('[1 0 0 0] 0.25', '[0 -1 0 0] 0.25'), ('[1 0 0 0] 0.25', '[0 0 -1 0] 0.25'), ('[0 1 0 0] 0.25', '[0 0 -1 0] 0.25')
    sides = [side(P((a, e, f), (d, e, f), (d, b, f)), *XY), side(P((a, b, c), (d, b, c), (d, e, c)), *XY),
             side(P((a, e, f), (a, b, f), (a, b, c)), *YZ), side(P((d, e, c), (d, b, c), (d, b, f)), *YZ),
             side(P((d, e, f), (a, e, f), (a, e, c)), *XZ), side(P((d, b, c), (a, b, c), (a, b, f)), *XZ)]
    return ['solid', [('id', str(sid))] + sides + [['editor', [('color', '220 30 220'), ('visgroupshown', '1'), ('visgroupautoshow', '1')]]]]


# La caja nueva envuelve toda la geometría de la zona de juego (y los bloques borrados), sin tocar la sala del
# cielo 3D: se excluyen los solids que quedan dentro del cielo que no se borró.
resto_cielo = [[1e9] * 3, [-1e9] * 3]
geo = [list(caja[0]), list(caja[1])]
otros = []
for s in children(world, 'solid'):
    mats, lo, hi = solid_info(s)
    otros.append((lo, hi))
    if all(m.startswith('tools/') for m in mats) and 'tools/toolsskybox' in mats:
        for i in range(3):
            resto_cielo[0][i] = min(resto_cielo[0][i], lo[i])
            resto_cielo[1][i] = max(resto_cielo[1][i], hi[i])
for e in ents:
    for s in children(e, 'solid'):
        otros.append(solid_info(s)[1:])
dentro = lambda lo, hi: all(lo[i] >= resto_cielo[0][i] and hi[i] <= resto_cielo[1][i] for i in range(3))
for lo, hi in otros:
    if not dentro(lo, hi):
        for i in range(3):
            geo[0][i] = min(geo[0][i], lo[i])
            geo[1][i] = max(geo[1][i], hi[i])
g = GROSOR
x0, y0, z0 = (v - 16 - g for v in geo[0])
x1, y1 = (v + 16 + g for v in geo[1][:2])
z1 = max(TECHO, geo[1][2] + 16 + g)
caja_cielo = (x0 - 1, y0 - 1, z0 - 1, x1 + 1, y1 + 1, z1 + 1)
if resto_cielo[0][0] < 1e9 and all(caja_cielo[i] < resto_cielo[1][i] and caja_cielo[i + 3] > resto_cielo[0][i] for i in range(3)):
    sys.exit(f'La caja nueva se pisa con el cielo que queda {resto_cielo}: revisar a mano.')
nuevos = [block(x0, y0, z1 - g, x1, y1, z1),            # techo
          block(x0, y0, z0, x1, y1, z0 + g),            # piso
          block(x0, y0, z0, x0 + g, y1, z1),            # paredes
          block(x1 - g, y0, z0, x1, y1, z1),
          block(x0, y0, z0, x1, y0 + g, z1),
          block(x0, y1 - g, z0, x1, y1, z1)]
world.extend(nuevos)
open(dst, 'w', encoding='utf-8', newline='\n').write(dump(root))
print(f'{len(borrar)} bloques de cielo borrados; caja nueva x {x0:g}..{x1:g} y {y0:g}..{y1:g} z {z0:g}..{z1:g} -> {dst}')
