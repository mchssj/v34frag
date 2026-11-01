"""Uso: python -I desplegar_2_7_1.py inspect|apply <carpeta de respaldo local>

Sube csstv_reporter 2.7.1 (la demo sigue grabando 5 s después del final del mix) a los dos servidores en la misma
tanda: el genérico al real (SFTP_CSS_*) y el licenciado a flow (SERVER2_*). Con "inspect" solo mira y aborta si algo
no es lo esperado. La versión anterior pasa a plugins/disabled/csstv_reporter_2.7.0.smx y quedan como mucho 3
anteriores. El cfg no cambia. Necesita paramiko (en un entorno virtual aparte). No recarga el plugin: se carga en el
próximo cambio de mapa.
Copia de docs/bitacora/2026-10-29-medallas-datos/pruebas/desplegar_medallas.py, sin la parte del cfg.
"""
import hashlib
import io
import os
import re
import struct
import sys
import zlib

import paramiko

MODE, BACKUP = sys.argv[1], sys.argv[2]
assert MODE in ("inspect", "apply")
ROOT = r"E:\Css V34 Web\v34frag"
NEW = {
    "real": os.path.join(ROOT, "server", "addons", "sourcemod", "plugins", "csstv_reporter.smx"),
    "flow": os.path.join(ROOT, "server", "licencias", "flow", "csstv_reporter.smx"),
}
CREDS = {
    "real": ("SFTP_CSS_SERVER", "SFTP_CSS_SERVER_PORT", "SFTP_CSS_USER", "SFTP_CSS_PASSWORD"),
    "flow": ("SERVER2_FTP_HOST", "SERVER2_FTP_PORT", "SERVER2_FTP_USER", "SERVER2_FTP_PASSWORD"),
}
OLD_VERSION, NEW_VERSION, MAX_OLD = "2.7.0", "2.7.1", 3

def env():
    vals = {}
    for line in open(os.path.join(ROOT, ".env"), encoding="utf-8"):
        m = re.match(r"\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$", line)
        if m:
            vals[m.group(1)] = m.group(2).strip('"').strip("'")
    return vals


def connect(srv):
    e = env()
    p = CREDS[srv]
    t = paramiko.Transport((e[p[0]], int(e[p[1]])))
    t.connect(username=e[p[2]], password=e[p[3]])
    return t, paramiko.SFTPClient.from_transport(t)


def find_root(s):
    """La carpeta cstrike (la que tiene addons/sourcemod)."""
    for cand in ("cstrike", "/cstrike", ".", "/home/container/cstrike"):
        try:
            if "sourcemod" in s.listdir(cand + "/addons"):
                return cand
        except IOError:
            pass
    raise SystemExit("ABORTA: no encontré cstrike/addons/sourcemod")


def md5(b):
    return hashlib.md5(b).hexdigest()


def get(s, p):
    b = io.BytesIO()
    s.getfo(p, b)
    return b.getvalue()


def has_version(data, v):
    # El .smx va comprimido: la versión se busca en el bloque descomprimido.
    off = struct.unpack_from("<I", data, 20)[0]
    raw = data[:off] + zlib.decompress(data[off:]) if data[6] == 1 else data
    return (b"\x00" + v.encode() + b"\x00") in raw


def vkey(name):
    m = re.search(r"_(\d+)\.(\d+)\.(\d+)\.smx$", name)
    return tuple(int(x) for x in m.groups()) if m else (0,)


os.makedirs(BACKUP, exist_ok=True)
for srv in ("real", "flow"):
    t, s = connect(srv)
    root = find_root(s)
    pl, dis = root + "/addons/sourcemod/plugins", root + "/addons/sourcemod/plugins/disabled"
    print("==", srv, "(", root, ")")
    cur, new = get(s, pl + "/csstv_reporter.smx"), open(NEW[srv], "rb").read()
    print(f"  plugin instalado: {len(cur)} bytes md5 {md5(cur)[:8]}, es {OLD_VERSION}: {has_version(cur, OLD_VERSION)}"
          f" -> nuevo {len(new)} bytes md5 {md5(new)[:8]}, es {NEW_VERSION}: {has_version(new, NEW_VERSION)}")
    if not has_version(cur, OLD_VERSION) or not has_version(new, NEW_VERSION):
        raise SystemExit("  ABORTA: la versión no es la esperada")
    try:
        disabled = s.listdir(dis)
    except IOError:
        disabled = None
    if disabled is not None and f"csstv_reporter_{OLD_VERSION}.smx" in disabled:
        raise SystemExit(f"  ABORTA: ya existe disabled/csstv_reporter_{OLD_VERSION}.smx")
    print("  disabled/:", "existe" if disabled is not None else "no existe (se crea)")
    if MODE != "apply":
        s.close(); t.close()
        continue

    with open(os.path.join(BACKUP, f"{srv}_csstv_reporter_{OLD_VERSION}.smx"), "wb") as f:
        f.write(cur)
    if disabled is None:
        s.mkdir(dis)
    s.rename(pl + "/csstv_reporter.smx", f"{dis}/csstv_reporter_{OLD_VERSION}.smx")
    s.putfo(io.BytesIO(new), pl + "/csstv_reporter.smx")
    print(f"  plugin subido, md5 verificado: {md5(get(s, pl + '/csstv_reporter.smx')) == md5(new)};"
          f" anterior en disabled/csstv_reporter_{OLD_VERSION}.smx")
    olds = sorted((f for f in s.listdir(dis) if re.fullmatch(r"csstv_reporter_\d+\.\d+\.\d+\.smx", f)), key=vkey)
    for f in olds[:-MAX_OLD]:
        s.remove(f"{dis}/{f}")
        print(f"  borrado disabled/{f}")
    s.close(); t.close()
print("listo" if MODE == "apply" else "inspección terminada: nada cambió")
