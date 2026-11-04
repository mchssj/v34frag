"""Solo lectura: baja los cfgs principales de los dos servidores para compararlos."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from srv import connect, find_root
out = sys.argv[1]
FILES = ["cfg/server.cfg", "cfg/game.cfg", "cfg/autoexec.cfg", "cfg/sourcemod/csstv_reporter.cfg",
         "cfg/csstv/live.cfg", "cfg/csstv/warmup.cfg", "cfg/csstv/end.cfg", "mapcycle.txt",
         "cfg/sourcemod/Kigen-AC_Redux.cfg"]
for name in ("real", "rbk"):
    t, s = connect(name); root = find_root(s)
    for f in FILES:
        dst = os.path.join(out, name, f); os.makedirs(os.path.dirname(dst), exist_ok=True); s.get(f"{root}/{f}", dst)
    print(name, sorted(x for x in s.listdir(root + "/addons/sourcemod/plugins") if x.endswith(".smx")))
    s.close(); t.close()
