# Deja listo para CS:S v34 un mapa recompilado con las herramientas del CS:S de Steam.
#
# - Props estáticos v10 -> v5 (el motor v34 no lee la v10 y se cae al cargar el mapa).
# - Pakfile: el que generó vbsp (materiales con cubemaps del mapa nuevo) más todo lo del pak del mapa original.
#   Lo de materials/maps/<original>/ (cubemaps ya armados) pasa a materials/maps/<nuevo>/, que es donde lo busca
#   el juego, porque las posiciones de los env_cubemap son las mismas.
# - Lumps sin comprimir.
#
# Uso: python post_ob.py compilado.bsp original.bsp salida.bsp
import io, os, struct, sys, zipfile

comp, orig, dst = sys.argv[1:4]
nuevo = os.path.splitext(os.path.basename(dst))[0].lower()
viejo = os.path.splitext(os.path.basename(orig))[0].lower()


def lumps(b):
    return [list(struct.unpack('<iiii', b[8 + 16 * i:24 + 16 * i])) for i in range(64)]


def entradas_pak(raw):
    # Lee las entradas a mano (sin chequear CRC: hay paks con CRC mal que el motor igual acepta).
    z = zipfile.ZipFile(io.BytesIO(raw))
    for zi in z.infolist():
        assert zi.compress_type == 0, 'pak comprimido: pasar antes por bsp_unlzma.py'
        h = raw[zi.header_offset:zi.header_offset + 30]
        fl, el = struct.unpack('<HH', h[26:30])
        st = zi.header_offset + 30 + fl + el
        yield zi.filename, raw[st:st + zi.file_size]


b = open(comp, 'rb').read()
L = lumps(b)
assert not any(fc for o, l, v, fc in L if l), 'el compilado tiene lumps comprimidos'
datos = [[b[o:o + l], v] for o, l, v, fc in L]

# Game lump: sprp v10 -> v5, offsets recalculados al final.
g = datos[35][0]
n = struct.unpack('<i', g[:4])[0]
GD = []
for k in range(n):
    gid, fl, ver, fo, fl2 = struct.unpack('<4sHHii', g[4 + 16 * k:20 + 16 * k])
    assert not fl & 1, 'game lump comprimido'
    d = b[fo:fo + fl2]
    if gid[::-1] == b'sprp' and ver > 6:
        dn = struct.unpack('<i', d[:4])[0]
        p = 4 + 128 * dn
        ln = struct.unpack('<i', d[p:p + 4])[0]
        p += 4 + 2 * ln
        pn = struct.unpack('<i', d[p:p + 4])[0]
        p += 4
        rs = (len(d) - p) // pn if pn else 0
        assert pn == 0 or (rs >= 60 and p + rs * pn == len(d)), 'sprp con tamaño raro'
        d = d[:p] + b''.join(d[p + rs * i:p + rs * i + 60] for i in range(pn))
        print(f'sprp v{ver} -> v5 ({pn} props, {rs} -> 60 bytes)')
        ver = 5
    GD.append((gid, ver, d))

# Pakfile combinado.
ob = open(orig, 'rb').read()
Lo = lumps(ob)
pak = {}
for name, data in entradas_pak(ob[Lo[40][0]:Lo[40][0] + Lo[40][1]]):
    low = name.lower()
    pre = f'materials/maps/{viejo}/'
    if low.startswith(pre):
        name = f'materials/maps/{nuevo}/' + name[len(pre):]
    pak[name.lower()] = (name, data)
for name, data in entradas_pak(datos[40][0]):
    pak[name.lower()] = (name, data)  # lo de vbsp manda (los .vmt de cubemaps del mapa nuevo)
out = io.BytesIO()
with zipfile.ZipFile(out, 'w', zipfile.ZIP_STORED) as z:
    for name, data in pak.values():
        z.writestr(zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0)), data)
datos[40][0] = out.getvalue()
print(f'pak: {len(pak)} archivos')

# Arma el BSP.
o = bytearray(b[:1036])
hdr = []
for i, (d, v) in enumerate(datos):
    while len(o) % 4:
        o += b'\0'
    if i == 35:
        base = len(o)
        pos = base + 4 + 16 * len(GD)
        gl = bytearray(struct.pack('<i', len(GD)))
        body = b''
        for gid, ver, d2 in GD:
            gl += struct.pack('<4sHHii', gid, 0, ver, pos, len(d2))
            pos += len(d2)
            body += d2
        d = bytes(gl) + body
    hdr.append((len(o) if d else 0, len(d), v, 0))
    o += d
for i, h in enumerate(hdr):
    o[8 + 16 * i:24 + 16 * i] = struct.pack('<iiii', *h)
open(dst, 'wb').write(o)
print('ok', dst, len(o))
