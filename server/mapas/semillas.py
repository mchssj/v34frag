# Busca zonas que en el mapa original eran parte del mapa y en el recompilado quedaron "afuera".
#
# Pasa con los espacios decorativos cerrados (un patio o una habitación que se ve por una ventana): en el original
# los mantenía adentro una entidad (casi siempre una luz), y esas luces no vuelven al descompilar. vbsp los toma
# como afuera y borra sus caras y sus props ("Static prop ... outside the map").
#
# Recorre una grilla: cada punto vacío en el original y fuera del mapa en el compilado de prueba es una zona
# perdida. Pone un info_target en un punto por cada zona (por hoja del original) y escribe el VMF nuevo.
# Hay que volver a correr vbsp con ese VMF y repetir hasta que diga 0.
#
# Uso: python semillas.py original.bsp compilado_vbsp.bsp entrada.vmf salida.vmf [--paso 32]
import re, struct, sys

orig, comp, src, dst = sys.argv[1:5]
PASO = float(sys.argv[sys.argv.index('--paso') + 1]) if '--paso' in sys.argv else 32.0


class Bsp:
    def __init__(self, fn):
        b = open(fn, 'rb').read()
        L = [struct.unpack('<iiii', b[8 + 16 * i:24 + 16 * i]) for i in range(64)]
        g = lambda i: b[L[i][0]:L[i][0] + L[i][1]]
        pl = g(1)
        self.planes = [struct.unpack('<4f', pl[20 * i:20 * i + 16]) for i in range(len(pl) // 20)]
        no = g(5)
        self.nodes = [struct.unpack('<iii', no[32 * i:32 * i + 12]) for i in range(len(no) // 32)]
        le = g(10)
        self.leafs = [struct.unpack('<ih', le[32 * i:32 * i + 6]) for i in range(len(le) // 32)]
        ent = g(0).decode('latin1')
        self.mins = [float(v) for v in re.search(r'"world_mins" "([^"]+)"', ent).group(1).split()]
        self.maxs = [float(v) for v in re.search(r'"world_maxs" "([^"]+)"', ent).group(1).split()]

    def leaf(self, p):
        n = 0
        while n >= 0:
            pi, c0, c1 = self.nodes[n]
            nx, ny, nz, d = self.planes[pi]
            n = c0 if nx * p[0] + ny * p[1] + nz * p[2] - d >= 0 else c1
        return -1 - n


A, B = Bsp(orig), Bsp(comp)
perdidas = {}
x = A.mins[0] + PASO / 2
while x < A.maxs[0]:
    y = A.mins[1] + PASO / 2
    while y < A.maxs[1]:
        z = A.mins[2] + PASO / 2
        while z < A.maxs[2]:
            la = A.leaf((x, y, z))
            ca, cla = A.leafs[la]
            if ca == 0 and cla >= 0 and la not in perdidas:
                cb, clb = B.leafs[B.leaf((x, y, z))]
                if cb & 1 and clb < 0:
                    perdidas[la] = (x, y, z)
            z += PASO
        y += PASO
    x += PASO

text = open(src, encoding='utf-8', errors='replace').read()
nid = max(int(v) for v in re.findall(r'"id" "(\d+)"', text))
extra = []
for la, (x, y, z) in sorted(perdidas.items()):
    nid += 1
    extra.append(f'entity\n{{\n\t"id" "{nid}"\n\t"classname" "info_target"\n\t"targetname" "semilla_{la}"\n'
                 f'\t"origin" "{x:g} {y:g} {z:g}"\n}}\n')
open(dst, 'w', encoding='utf-8', newline='\n').write(text + ''.join(extra))
print(f'{len(perdidas)} zonas perdidas -> {len(perdidas)} info_target en {dst}')
for la, p in sorted(perdidas.items())[:20]:
    print('  hoja', la, p)
