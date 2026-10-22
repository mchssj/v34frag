"""Uso: revertir_awh.py inspect|apply. Vuelve a prender los anti-wallhack solo en el servidor real."""
import sys, os, io, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from srv import connect, find_root
mode = sys.argv[1]
t, s = connect("real"); root = find_root(s)
cfg = f"{root}/cfg/sourcemod/Kigen-AC_Redux.cfg"; pl = root + "/addons/sourcemod/plugins"
b = io.BytesIO(); s.getfo(cfg, b); data = b.getvalue()
n = len(re.findall(rb'^kacr_eyes_antiwall "0"[ \t]*$', data, re.M))
en_dis = "Anti_Wallhack_Lite.smx" in s.listdir(pl + "/disabled"); en_pl = "Anti_Wallhack_Lite.smx" in s.listdir(pl)
print(f"kacr_eyes_antiwall \"0\": {n} - AWH en disabled: {en_dis} - en plugins: {en_pl}")
if n != 1 or not en_dis or en_pl: raise SystemExit("ABORTA: el estado no es el esperado")
if mode == "apply":
    new = re.sub(rb'^kacr_eyes_antiwall "0"([ \t]*)$', rb'kacr_eyes_antiwall "1"\1', data, flags=re.M)
    s.putfo(io.BytesIO(new), cfg)
    b = io.BytesIO(); s.getfo(cfg, b); print("cfg verificado:", b.getvalue() == new, len(new), "bytes")
    s.rename(pl + "/disabled/Anti_Wallhack_Lite.smx", pl + "/Anti_Wallhack_Lite.smx")
    print("AWH en plugins:", s.stat(pl + "/Anti_Wallhack_Lite.smx").st_size, "bytes - sigue en disabled:", "Anti_Wallhack_Lite.smx" in s.listdir(pl + "/disabled"))
s.close(); t.close()
