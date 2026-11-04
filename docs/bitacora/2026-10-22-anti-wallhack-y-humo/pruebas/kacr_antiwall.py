"""Uso: kacr_antiwall.py <servidor> <0|1>. Cambia solo kacr_eyes_antiwall y lo verifica."""
import sys, os, io, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from srv import connect, find_root
name, val = sys.argv[1], sys.argv[2].encode()
old = b"1" if val == b"0" else b"0"
t, s = connect(name); root = find_root(s)
cfg = f"{root}/cfg/sourcemod/Kigen-AC_Redux.cfg"
b = io.BytesIO(); s.getfo(cfg, b); data = b.getvalue()
pat = rb'^kacr_eyes_antiwall "' + old + rb'"([ \t]*)$'
if len(re.findall(pat, data, re.M)) != 1: raise SystemExit("ABORTA: no está en " + old.decode())
new = re.sub(pat, rb'kacr_eyes_antiwall "' + val + rb'"\1', data, flags=re.M)
s.putfo(io.BytesIO(new), cfg)
b = io.BytesIO(); s.getfo(cfg, b); print("cfg verificado:", b.getvalue() == new)
pl = root + "/addons/sourcemod/plugins"
print("Anti_Wallhack_Lite en plugins:", "Anti_Wallhack_Lite.smx" in s.listdir(pl))
s.close(); t.close()
