"""Revisa si el CS:S v34 tiene todo lo que necesita un mapa: materiales, texturas y modelos.

Uso:
  python -I revisar_mapas.py <v34_dir> <mapa> [<mapa> ...] [--fuente <dir_clientmod>] [--exportar <dir>]

  <v34_dir>    la instalación del v34 normal (la carpeta de hl2.exe, con cstrike/ y hl2/ en archivos sueltos).
               Los mapas se leen de <v34_dir>/cstrike/maps/<mapa>.bsp.
  --fuente     una instalación de ClientMod: sus .vpk y sus carpetas sueltas son donde se busca lo que falte.
  --exportar   copia a esa carpeta, con sus rutas, lo que falta y está en la fuente (para pegarlo en cstrike/).

Lee del .bsp las texturas de las caras, los modelos de los props estáticos, las entidades (modelos, decals,
sprites, cielo, materiales de detalle) y el pakfile. Sigue cada .vmt (las texturas que nombra y el "include" de
los "patch") y cada .mdl (sus materiales, .vvd y .dx90.vtx). Busca cada archivo donde lo busca el juego: el
pakfile, cstrike/ y hl2/.

También avisa si el mapa trae texturas VTF 7.3 o más nuevas (las del CSS nuevo): el v34 lee hasta la 7.2. Si
son los cubemaps, los reflejos salen con la textura de error; el render los apaga con mat_specular 0
(bitácora 2026-11-15-render-mapas-css-nuevo).

Solo usa la biblioteca estándar.
"""
import io
import os
import re
import struct
import sys
import zipfile

TEX_KEYS = ('$basetexture', '$basetexture2', '$bumpmap', '$bumpmap2', '$normalmap', '$normalmap2', '$envmapmask',
            '$detail', '$blendmodulatetexture', '$selfillummask', '$phongexponenttexture', '$lightwarptexture',
            '$dudvmap', '$refracttexture', '$texture2', '$iris', '$corneatexture', '$ambientoccltexture', '$envmap')
MAT_KEYS = ('include', '$bottommaterial', '$underwateroverlay', '$fallbackmaterial', '$crackmaterial')
# Las fuentes de una instalación de ClientMod, en el orden de su gameinfo.txt.
FUENTE_VPK = ('cstrike/cstrike_dir.vpk', 'cstrike_clientmod/cstrike_clientmod_dir.vpk', 'hl2/hl2_materials_dir.vpk',
              'hl2/hl2_misc_dir.vpk', 'cstrike_clientmod/inventory_base_dir.vpk',
              'cstrike_clientmod/inventory_css_items_dir.vpk', 'cstrike_clientmod/inventory_csgo_items_dir.vpk')
FUENTE_SUELTA = ('cstrike_downloads', 'cstrike', 'hl2')


def norm(p):
    return p.replace('\\', '/').strip().strip('/').lower()


class Vpk:
    """Índice de un _dir.vpk (versión 1 o 2) y lectura de sus archivos."""

    def __init__(self, path):
        self.base = path[:-len('_dir.vpk')]
        self.entries = {}
        with open(path, 'rb') as f:
            data = f.read()
        sig, ver, tree = struct.unpack_from('<III', data, 0)
        if sig != 0x55AA1234:
            raise ValueError(f'{path}: no es un .vpk')
        p = 12 if ver == 1 else 28
        end = p + tree

        def cstr():
            nonlocal p
            e = data.index(b'\0', p)
            s = data[p:e].decode('latin-1')
            p = e + 1
            return s
        while p < end:
            ext = cstr()
            if not ext:
                break
            while True:
                d = cstr()
                if not d:
                    break
                while True:
                    n = cstr()
                    if not n:
                        break
                    _crc, pre, arc, off, ln, _term = struct.unpack_from('<IHHIIH', data, p)
                    p += 18
                    full = norm((d + '/' if d.strip() else '') + n + '.' + ext)
                    self.entries[full] = (data[p:p + pre], arc, off, ln)
                    p += pre
        self.dataoff = end
        self.dirdata = data

    def read(self, name):
        predata, arc, off, ln = self.entries[name]
        if ln == 0:
            return predata
        if arc == 0x7FFF:
            return predata + self.dirdata[self.dataoff + off:self.dataoff + off + ln]
        with open('%s_%03d.vpk' % (self.base, arc), 'rb') as f:
            f.seek(off)
            return predata + f.read(ln)


class Loose:
    """Archivos sueltos de una carpeta."""

    def __init__(self, root):
        self.entries = {}
        for dp, _, fs in os.walk(root):
            for fn in fs:
                full = os.path.join(dp, fn)
                self.entries[norm(os.path.relpath(full, root))] = full

    def read(self, name):
        with open(self.entries[name], 'rb') as f:
            return f.read()


class Pak:
    """El pakfile de un .bsp (un .zip)."""

    def __init__(self, zbytes):
        self.z = zipfile.ZipFile(io.BytesIO(zbytes))
        self.entries = {norm(n): n for n in self.z.namelist()}

    def read(self, name):
        return self.z.read(self.entries[name])


def find(sources, name):
    for label, s in sources:
        if name in s.entries:
            return label, s
    return None, None


def read_bsp(path):
    """Devuelve (versión, materiales, modelos, pakfile)."""
    with open(path, 'rb') as f:
        data = f.read()
    ver = struct.unpack_from('<i', data, 4)[0]
    lumps = [struct.unpack_from('<iii4s', data, 8 + 16 * i) for i in range(64)]

    def lump(i):
        o, ln, _, _ = lumps[i]
        return data[o:o + ln]
    strdata, table = lump(43), lump(44)
    mats, models = set(), set()
    for (off,) in struct.iter_unpack('<i', table):
        mats.add(norm(strdata[off:strdata.index(b'\0', off)].decode('latin-1')))
    gl = lump(35)
    if gl:
        for i in range(struct.unpack_from('<i', gl, 0)[0]):
            gid, _flags, _gver, goff, glen = struct.unpack_from('<iHHii', gl, 4 + 16 * i)
            if gid == 0x73707270:  # 'sprp': los props estáticos
                g = data[goff:goff + glen]
                for k in range(struct.unpack_from('<i', g, 0)[0]):
                    models.add(norm(g[4 + 128 * k:4 + 128 * (k + 1)].split(b'\0')[0].decode('latin-1')))
    for k, v in re.findall(r'"([^"]+)"\s+"([^"]*)"', lump(0).decode('latin-1', 'replace')):
        kl, vl = k.lower(), norm(v)
        if not vl or vl.startswith('*') or re.fullmatch(r'[-\d. ]+', vl):
            continue
        if vl.endswith('.mdl'):
            models.add(vl)
        elif vl.endswith(('.vmt', '.spr')):
            mats.add(re.sub(r'^materials/', '', vl[:-4]))
        elif kl in ('texture', 'material', 'detailmaterial', 'ropematerial'):
            mats.add(re.sub(r'^materials/', '', vl))
        elif kl == 'skyname':
            for side in ('up', 'dn', 'lf', 'rt', 'ft', 'bk'):
                mats.add('skybox/' + vl + side)
    return ver, mats, models, Pak(lump(40))


def vmt_refs(text):
    """Devuelve (shader, texturas, materiales) de un .vmt."""
    t = re.sub(r'//[^\n]*', '', text)
    m = re.match(r'\s*"?([A-Za-z0-9_]+)"?', t)
    shader = m.group(1).lower() if m else '?'
    texs, mats = set(), set()
    for k, v in re.findall(r'"?(\$?[A-Za-z0-9_]+)"?\s+"([^"\n]*)"', t):
        k, v = k.lower(), norm(v)
        if not v or v == 'env_cubemap' or v.startswith('_rt_'):
            continue
        if k in MAT_KEYS:
            mats.add(re.sub(r'^materials/', '', re.sub(r'\.vmt$', '', v)))
        elif k in TEX_KEYS:
            texs.add(re.sub(r'\.vtf$', '', v))
    return shader, texs, mats


def mdl_info(b):
    """Devuelve (versión, nombres de materiales, carpetas de materiales) de un .mdl."""
    ver = struct.unpack_from('<i', b, 4)[0]
    numtex, texidx, numcd, cdidx = struct.unpack_from('<iiii', b, 204)
    names, cds = [], []
    for i in range(numtex):
        base = texidx + 64 * i
        s = base + struct.unpack_from('<i', b, base)[0]
        names.append(norm(b[s:b.index(b'\0', s)].decode('latin-1')))
    for i in range(numcd):
        o = struct.unpack_from('<i', b, cdidx + 4 * i)[0]
        cds.append(norm(b[o:b.index(b'\0', o)].decode('latin-1')))
    return ver, names, cds


def vtf_version(b):
    if b[:4] != b'VTF\0':
        return '?'
    return '%d.%d' % struct.unpack_from('<II', b, 4)


def revisar(v34, mapname, v34_srcs, src_srcs, export):
    ver, mats, models, pak = read_bsp(os.path.join(v34, 'cstrike', 'maps', mapname + '.bsp'))
    sources = [('pakfile', pak)] + v34_srcs
    missing = {}
    vtfvers, mdlvers = {}, {}
    seen_m, seen_t, seen_mdl = set(), set(), set()
    todo_m, todo_mdl = list(mats), list(models)

    def need(path):
        if find(sources, path)[1]:
            return find(sources, path)[1]
        label, s = find(src_srcs, path)
        missing[path] = label
        return s  # se sigue leyendo desde la fuente para ver qué más necesita

    while todo_m or todo_mdl:
        while todo_mdl:
            m = todo_mdl.pop()
            if m in seen_mdl:
                continue
            seen_mdl.add(m)
            s = need(m)
            for ext in ('.vvd', '.dx90.vtx'):
                need(m[:-4] + ext)
            if not s:
                continue
            v, names, cds = mdl_info(s.read(m))
            mdlvers[v] = mdlvers.get(v, 0) + 1
            for n in names:
                cands = [norm(cd + '/' + n) for cd in cds] or [n]
                todo_m.append(next((c for c in cands if find(sources, 'materials/' + c + '.vmt')[1]
                                    or find(src_srcs, 'materials/' + c + '.vmt')[1]), cands[0]))
        while todo_m:
            m = todo_m.pop()
            if m in seen_m:
                continue
            seen_m.add(m)
            path = 'materials/' + m + '.vmt'
            s = need(path)
            if not s:
                continue
            _shader, texs, sub = vmt_refs(s.read(path).decode('latin-1', 'replace'))
            todo_m.extend(sub)
            for t in texs - seen_t:
                seen_t.add(t)
                tp = 'materials/' + t + '.vtf'
                ts = need(tp)
                if ts:
                    v = vtf_version(ts.read(tp)[:16])
                    vtfvers[v] = vtfvers.get(v, 0) + 1

    nuevas = [n for n in pak.entries if n.endswith('.vtf') and vtf_version(pak.read(n)[:16]) not in ('7.0', '7.1', '7.2')]
    cubemaps = [n for n in nuevas if re.search(r'/c-?\d+_-?\d+_-?\d+(\.hdr)?\.vtf$', n)]
    print(f'\n=== {mapname} (BSP v{ver}: {len(seen_m)} materiales, {len(seen_mdl)} modelos) ===')
    print('VTF que usa:', ', '.join(f'{k}: {v}' for k, v in sorted(vtfvers.items())) or '-')
    print('MDL que usa:', ', '.join(f'v{k}: {v}' for k, v in sorted(mdlvers.items())) or '-')
    if nuevas:
        print(f'AVISO: {len(nuevas)} texturas VTF 7.3 o más nuevas en el pakfile ({len(cubemaps)} son cubemaps): '
              'el v34 no las lee')
        for n in sorted(set(nuevas) - set(cubemaps)):
            print('  ', n)
    en_fuente = sorted(p for p, lab in missing.items() if lab)
    sin_fuente = sorted(p for p, lab in missing.items() if not lab)
    print(f'Faltan en el v34: {len(missing)}' + (f' (en la fuente: {len(en_fuente)})' if src_srcs else ''))
    for p in en_fuente:
        print(f'  [{missing[p]}] {p}')
    for p in sin_fuente:
        print(f'  [no está] {p}')
    if export:
        for p in en_fuente:
            out = os.path.join(export, *p.split('/'))
            os.makedirs(os.path.dirname(out), exist_ok=True)
            with open(out, 'wb') as f:
                f.write(find(src_srcs, p)[1].read(p))
        if en_fuente:
            print(f'Copiados {len(en_fuente)} archivos a {export}')


def main(argv):
    args = list(argv)
    opts = {}
    for o in ('--fuente', '--exportar'):
        if o in args:
            i = args.index(o)
            opts[o] = args[i + 1]
            del args[i:i + 2]
    if len(args) < 2:
        print(__doc__)
        return 2
    v34, maps = args[0], args[1:]
    v34_srcs = [('v34/' + d, Loose(os.path.join(v34, d))) for d in ('cstrike', 'hl2')]
    src_srcs = []
    if '--fuente' in opts:
        f = opts['--fuente']
        src_srcs += [('fuente/' + r, Vpk(os.path.join(f, r))) for r in FUENTE_VPK if os.path.exists(os.path.join(f, r))]
        src_srcs += [('fuente/' + r, Loose(os.path.join(f, r))) for r in FUENTE_SUELTA if os.path.isdir(os.path.join(f, r))]
    for m in maps:
        revisar(v34, m[:-4] if m.endswith('.bsp') else m, v34_srcs, src_srcs, opts.get('--exportar'))
    return 0


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(main(sys.argv[1:]))
