"""Uso: python -I medio_tiempo_3s.py inspect|apply <carpeta de respaldo local>

Cambia csstv_halftime_delay de "5.0" a "3.0" en el csstv_reporter.cfg del servidor real (SFTP_CSS_*) y de RBK
(SERVER1_*). Con "inspect" solo mira y aborta si la línea no está exactamente una vez.
El cfg original se guarda solo en la carpeta de respaldo local (tiene el token del servidor).
Necesita paramiko (en un entorno virtual aparte). No recarga el plugin: se aplica en el próximo cambio de mapa.
Bitácora: docs/bitacora/2026-10-24-medio-tiempo-3s/
"""
import io
import os
import re
import sys

import paramiko

MODE, BACKUP = sys.argv[1], sys.argv[2]
assert MODE in ("inspect", "apply")
ROOT = r"E:\Css V34 Web\v34frag"
CFG = "cfg/sourcemod/csstv_reporter.cfg"
OLD = re.compile(rb'^csstv_halftime_delay "5\.0"', re.M)
NEW = b'csstv_halftime_delay "3.0"'


def env():
    vals = {}
    for line in open(os.path.join(ROOT, ".env"), encoding="utf-8"):
        m = re.match(r"\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$", line)
        if m:
            vals[m.group(1)] = m.group(2).strip('"').strip("'")
    return vals


def connect(srv):
    e = env()
    p = {"real": ("SFTP_CSS_SERVER", "SFTP_CSS_SERVER_PORT", "SFTP_CSS_USER", "SFTP_CSS_PASSWORD"),
         "rbk": ("SERVER1_FTP_HOST", "SERVER1_FTP_PORT", "SERVER1_FTP_USER", "SERVER1_FTP_PASSWORD")}[srv]
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


def get(s, p):
    b = io.BytesIO()
    s.getfo(p, b)
    return b.getvalue()


for srv in ("real", "rbk"):
    t, s = connect(srv)
    path = f"{find_root(s)}/{CFG}"
    data = get(s, path)
    n = len(OLD.findall(data))
    line = re.search(rb'^csstv_halftime_delay .*$', data, re.M)
    print(f"{srv}: {path} -> {line.group(0).decode().strip() if line else 'SIN LÍNEA'} ({n} coincidencia/s)")
    if n != 1:
        raise SystemExit(f"ABORTA: {srv} no tiene exactamente una línea con 5.0")
    if MODE == "apply":
        bak = os.path.join(BACKUP, srv, "csstv_reporter.cfg")
        os.makedirs(os.path.dirname(bak), exist_ok=True)
        open(bak, "wb").write(data)
        s.putfo(io.BytesIO(OLD.sub(NEW, data)), path)
        after = get(s, path)
        assert NEW in after and not OLD.search(after) and len(after) == len(data), f"{srv}: verificación falló"
        print(f"{srv}: aplicado y verificado")
    s.close()
    t.close()
