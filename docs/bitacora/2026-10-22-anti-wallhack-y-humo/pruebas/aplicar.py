"""Uso: aplicar.py inspect|apply <dir_respaldo>. Apaga los anti-wallhack y pone el humo denso en los dos servidores."""
import sys, os, io, re, hashlib, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from srv import connect, find_root
mode, bak = sys.argv[1], sys.argv[2]
EDITS = [("cfg/sourcemod/Kigen-AC_Redux.cfg", rb'^kacr_eyes_antiwall "1"[ \t]*$', b'kacr_eyes_antiwall "0"'),
         ("cfg/server.cfg", rb'^clientmod_smoke_type 1[ \t]*$', b'clientmod_smoke_type 2')]
def get(s, p):
    b = io.BytesIO(); s.getfo(p, b); return b.getvalue()
def walk_cfgs(s, d):
    for a in s.listdir_attr(d):
        p = f"{d}/{a.filename}"
        if a.st_mode is not None and (a.st_mode & 0o170000) == 0o040000: yield from walk_cfgs(s, p)
        elif a.filename.endswith(".cfg"): yield p
for name in ("real", "rbk"):
    t, s = connect(name); root = find_root(s); print(f"== {name}")
    os.makedirs(f"{bak}/{name}", exist_ok=False)
    plan = []
    for rel, pat, new in EDITS:
        data = get(s, f"{root}/{rel}")
        open(f"{bak}/{name}/{os.path.basename(rel)}", "wb").write(data)
        n = len(re.findall(pat, data, re.M))
        done = len(re.findall(rb'^' + re.escape(new) + rb'[ 	]*$', data, re.M))
        print(f"  {rel}: coincidencias {n} (ya aplicado {done}) - {len(data)} bytes - md5 {hashlib.md5(data).hexdigest()[:8]}")
        if n == 0 and done == 1: continue
        if n != 1: raise SystemExit(f"  ABORTA: se esperaba 1 línea en {rel}")
        plan.append((rel, data, re.sub(pat, new, data, flags=re.M)))
    # que ningún otro cfg pise las cvars
    for p in walk_cfgs(s, root + "/cfg"):
        if p.endswith(("/server.cfg", "/Kigen-AC_Redux.cfg")): continue
        d = get(s, p)
        if re.search(rb'^\s*(kacr_eyes_antiwall|clientmod_smoke_type)\b', d, re.M): print("  OJO: también la define", p)
    pl = root + "/addons/sourcemod/plugins"
    awh = "Anti_Wallhack_Lite.smx" in s.listdir(pl)
    print("  Anti_Wallhack_Lite.smx:", "cargado" if awh else "no existe", "· en disabled:", "Anti_Wallhack_Lite.smx" in s.listdir(pl + "/disabled"))
    if mode == "apply":
        for rel, old, new in plan:
            s.putfo(io.BytesIO(new), f"{root}/{rel}")
            back = get(s, f"{root}/{rel}")
            print(f"  {rel}: subido, verificado {back == new} ({len(old)} -> {len(back)} bytes)")
        if awh:
            dst = pl + "/disabled/Anti_Wallhack_Lite.smx"
            if "Anti_Wallhack_Lite.smx" in s.listdir(pl + "/disabled"): raise SystemExit("  ABORTA: ya existe en disabled")
            s.rename(pl + "/Anti_Wallhack_Lite.smx", dst)
            print("  Anti_Wallhack_Lite.smx -> disabled/:", "Anti_Wallhack_Lite.smx" not in s.listdir(pl) and s.stat(dst).st_size)
    s.close(); t.close()
