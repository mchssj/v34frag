"""Compara los archivos de configuración del servidor real y RBK (solo lectura).
Uso: comparar.py <salida.txt> <dir_copias>. Baja los archivos de texto pequeños que difieren para verlos."""
import sys, os, io, hashlib, stat
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from srv import connect, find_root

out, copies = sys.argv[1], sys.argv[2]
SKIP_DIRS = {"maps", "materials", "models", "sound", "logs", "downloads", "download", "cache", "demos",
             "queue", "cstrike_old2", "resource", "media", "scripts", "particles", "bin", "custom", "screenshots",
             "replay", "DownloadLists", "save", "crash", "dumps", "csstv"}
ROOTS = ["addons", "cfg", "maplists.txt", "mapcycle.txt", "motd.txt", "motd_text.txt", "gameinfo.txt",
         "steam.inf"]
TEXT = (".cfg", ".txt", ".ini", ".vdf", ".phrases.txt", ".games.txt", ".autoload", ".inf", ".res", ".kv")


def walk(s, base, rel, acc):
    try:
        attrs = s.listdir_attr(f"{base}/{rel}")
    except IOError:
        try:
            a = s.stat(f"{base}/{rel}"); acc[rel] = a; return
        except IOError:
            return
    for a in attrs:
        r = f"{rel}/{a.filename}"
        if stat.S_ISDIR(a.st_mode):
            if a.filename not in SKIP_DIRS: walk(s, base, r, acc)
        else:
            acc[r] = a


info = {}
conns = {}
for name in ("real", "rbk"):
    t, s = connect(name); root = find_root(s); conns[name] = (t, s, root)
    acc = {}
    for r in ROOTS: walk(s, root, r, acc)
    # la carpeta de arriba (start.sh, etc.)
    for a in s.listdir_attr(root + "/.."):
        if not stat.S_ISDIR(a.st_mode): acc["../" + a.filename] = a
    info[name] = acc

lines = []
real, rbk = info["real"], info["rbk"]
for r in sorted(set(real) | set(rbk)):
    a, b = real.get(r), rbk.get(r)
    if a and not b: lines.append(f"SOLO REAL  {r} ({a.st_size})")
    elif b and not a: lines.append(f"SOLO RBK   {r} ({b.st_size})")
    elif a.st_size != b.st_size or r.endswith(TEXT):
        ta, sa, ra = conns["real"]; tb, sb, rb = conns["rbk"]
        if a.st_size > 2_000_000 and a.st_size == b.st_size: continue
        da = io.BytesIO(); sa.getfo(f"{ra}/{r}", da); db = io.BytesIO(); sb.getfo(f"{rb}/{r}", db)
        if da.getvalue() != db.getvalue():
            lines.append(f"DISTINTO   {r} (real {a.st_size}, rbk {b.st_size})")
            if r.endswith(TEXT) and max(a.st_size, b.st_size) < 300_000:
                for n, d in (("real", da), ("rbk", db)):
                    p = os.path.join(copies, n, r.replace("../", "_raiz/"))
                    os.makedirs(os.path.dirname(p), exist_ok=True); open(p, "wb").write(d.getvalue())
open(out, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print(len(lines), "diferencias")
for t, s, _ in conns.values(): s.close(); t.close()
