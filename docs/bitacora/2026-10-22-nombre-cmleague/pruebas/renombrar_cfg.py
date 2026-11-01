"""Uso: renombrar_cfg.py inspect|apply <dir_respaldo>. Cambia el nombre visible a CMLeague en los cfgs de los dos servidores."""
import sys, os, io, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from srv import connect, find_root
mode, bak = sys.argv[1], sys.argv[2]
TAG = (rb'^csstv_chat_tag "v34frag"      // prefijo de los mensajes: \[v34frag\]',
       b'csstv_chat_tag "CMLeague"     // prefijo de los mensajes: [CMLeague]')
CA_COMMENT = (rb'^// Nombre del servidor en el mensaje: "v34frag #1" en el nuestro, "v34frag #2" en RBK\.',
              b'// Nombre del servidor en el mensaje: "CMLeague #1" en el nuestro, "CMLeague #2" en RBK.')
EDITS = {
    "real": [("cfg/server.cfg", rb'^hostname "v34frag #1 By ExtremeHost"', b'hostname "CMLeague #1 By ExtremeHost"'),
             ("cfg/server.cfg", rb'^tv_title "v34frag SourceTV #1"', b'tv_title "CMLeague SourceTV #1"'),
             ("cfg/sourcemod/csstv_reporter.cfg",) + TAG,
             ("cfg/sourcemod/csstv_calladmin.cfg",) + CA_COMMENT,
             ("cfg/sourcemod/csstv_calladmin.cfg", rb'^csstv_calladmin_server "v34frag #1"', b'csstv_calladmin_server "CMLeague #1"')],
    "rbk": [("cfg/server.cfg", rb'^hostname "v34frag #2 By ExtremeHost"', b'hostname "CMLeague #2 By ExtremeHost"'),
            ("cfg/sourcemod/csstv_reporter.cfg",) + TAG,
            ("cfg/sourcemod/csstv_calladmin.cfg",) + CA_COMMENT,
            ("cfg/sourcemod/csstv_calladmin.cfg", rb'^csstv_calladmin_server "v34frag #2"', b'csstv_calladmin_server "CMLeague #2"')]}


def get(s, p):
    b = io.BytesIO(); s.getfo(p, b); return b.getvalue()


for name, edits in EDITS.items():
    t, s = connect(name); root = find_root(s); print("==", name)
    os.makedirs(f"{bak}/{name}", exist_ok=(mode == "inspect"))
    files = {}
    for rel, pat, new in edits:
        if rel not in files:
            files[rel] = get(s, f"{root}/{rel}")
            open(f"{bak}/{name}/{os.path.basename(rel)}", "wb").write(files[rel])
        n = len(re.findall(pat, files[rel], re.M))
        print(f"  {rel}: {new.decode()[:50]} <- coincidencias {n}")
        if n != 1: raise SystemExit("  ABORTA")
        files[rel] = re.sub(pat, lambda m: new, files[rel], count=1, flags=re.M)
    if mode == "apply":
        for rel, data in files.items():
            s.putfo(io.BytesIO(data), f"{root}/{rel}")
            print(f"  {rel}: subido, verificado {get(s, f'{root}/{rel}') == data}")
    s.close(); t.close()
