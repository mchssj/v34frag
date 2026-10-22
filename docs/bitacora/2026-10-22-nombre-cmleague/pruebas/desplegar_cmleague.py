"""Uso: desplegar_cmleague.py inspect|apply. Sube reporter 2.4.1, sell 1.0.1, calladmin 1.0.1 y allchat 1.0.2
a los dos servidores (reporter genérico al real y licenciado a RBK). La versión anterior pasa a disabled/
y quedan como mucho 3 versiones anteriores de cada plugin csstv_*."""
import sys, os, io, re, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from srv import connect, find_root

mode = sys.argv[1]
REPO = r"E:\Css V34 Web\v34frag\server"
PL = os.path.join(REPO, "addons", "sourcemod", "plugins")
# plugin: (versión que se espera encontrar, archivo nuevo por servidor)
PLUGINS = {
    "csstv_reporter": ("2.4.0", {"real": os.path.join(PL, "csstv_reporter.smx"),
                                 "rbk": os.path.join(REPO, "licencias", "rbk", "csstv_reporter.smx")}),
    "csstv_sell": ("1.0.0", {s: os.path.join(PL, "csstv_sell.smx") for s in ("real", "rbk")}),
    "csstv_calladmin": ("1.0.0", {s: os.path.join(PL, "csstv_calladmin.smx") for s in ("real", "rbk")}),
    "csstv_allchat": ("1.0.1", {s: os.path.join(PL, "csstv_allchat.smx") for s in ("real", "rbk")}),
}
MAX_OLD = 3


def md5(b): return hashlib.md5(b).hexdigest()


def get(s, p):
    b = io.BytesIO(); s.getfo(p, b); return b.getvalue()


def vkey(name):
    m = re.search(r"_(\d+)\.(\d+)\.(\d+)\.smx$", name)
    return tuple(int(x) for x in m.groups()) if m else (0,)


def version_in(data, expected):
    # el .smx está comprimido: se busca la versión en el bloque descomprimido
    import struct, zlib
    off = struct.unpack_from("<I", data, 20)[0]
    raw = data[:off] + zlib.decompress(data[off:]) if data[6] == 1 else data
    return (b"\x00" + expected.encode() + b"\x00") in raw


for srv in ("real", "rbk"):
    t, s = connect(srv); root = find_root(s); pl = root + "/addons/sourcemod/plugins"; dis = pl + "/disabled"
    print("==", srv)
    for name, (oldver, src) in PLUGINS.items():
        cur = get(s, f"{pl}/{name}.smx"); new = open(src[srv], "rb").read()
        ok_old = version_in(cur, oldver)
        print(f"  {name}: instalado {len(cur)} bytes md5 {md5(cur)[:8]} (es {oldver}: {ok_old}) -> nuevo {len(new)} bytes md5 {md5(new)[:8]}")
        if not ok_old: raise SystemExit("  ABORTA: la versión instalada no es la esperada")
        target = f"{dis}/{name}_{oldver}.smx"
        if f"{name}_{oldver}.smx" in s.listdir(dis): raise SystemExit(f"  ABORTA: ya existe {target}")
        if mode != "apply": continue
        s.rename(f"{pl}/{name}.smx", target)
        s.putfo(io.BytesIO(new), f"{pl}/{name}.smx")
        back = get(s, f"{pl}/{name}.smx")
        print(f"    subido, md5 verificado: {md5(back) == md5(new)}; anterior en disabled/{name}_{oldver}.smx")
        olds = sorted((f for f in s.listdir(dis) if re.fullmatch(re.escape(name) + r"_\d+\.\d+\.\d+\.smx", f)), key=vkey)
        for f in olds[:-MAX_OLD]:
            s.remove(f"{dis}/{f}"); print(f"    borrado disabled/{f}")
    print("  disabled:", sorted(f for f in s.listdir(dis) if f.startswith("csstv_")))
    s.close(); t.close()
