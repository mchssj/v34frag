"""Sube Anti_Wallhack_Lite.smx (el mismo del servidor real) a RBK y verifica el md5."""
import sys, os, io, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from srv import connect, find_root
src = sys.argv[1]
t, s = connect("real"); root = find_root(s)
b = io.BytesIO(); s.getfo(root + "/addons/sourcemod/plugins/Anti_Wallhack_Lite.smx", b); s.close(); t.close()
data = b.getvalue(); local = open(src, "rb").read()
print("real:", len(data), hashlib.md5(data).hexdigest(), "- igual a la copia local:", data == local)
t, s = connect("rbk"); root = find_root(s); pl = root + "/addons/sourcemod/plugins"
if "Anti_Wallhack_Lite.smx" in s.listdir(pl): raise SystemExit("ABORTA: ya existe en RBK")
s.putfo(io.BytesIO(data), pl + "/Anti_Wallhack_Lite.smx")
b = io.BytesIO(); s.getfo(pl + "/Anti_Wallhack_Lite.smx", b)
print("rbk: subido, md5 igual:", hashlib.md5(b.getvalue()).hexdigest() == hashlib.md5(data).hexdigest())
import re
c = io.BytesIO(); s.getfo(root + "/cfg/sourcemod/Kigen-AC_Redux.cfg", c)
print("rbk kacr_eyes_antiwall:", re.findall(rb'^kacr_eyes_antiwall .*$', c.getvalue(), re.M))
c = io.BytesIO(); s.getfo(root + "/cfg/server.cfg", c)
print("rbk smoke:", re.findall(rb'^clientmod_smoke_type .*$', c.getvalue(), re.M))
print("rbk sdkhooks:", [e for e in s.listdir(root + "/addons/sourcemod/extensions") if "sdkhooks" in e])
s.close(); t.close()
