"""Uso: python -I tasas_coherentes.py inspect|apply <carpeta de respaldo local>

Deja coherentes las tasas de red en el cfg/server.cfg del servidor real (SFTP_CSS_*) y de RBK (SERVER1_*):
sv_minupdaterate 100, sv_maxupdaterate 101, sv_mincmdrate 100 y sv_maxcmdrate 101 (hoy los mínimos están por
encima de los máximos). Con "inspect" solo mira: muestra el valor actual de cada cvar en server.cfg y en los
demás cfgs que también podrían fijarlas, y aborta si en server.cfg una cvar no aparece exactamente una vez.
El original se guarda solo en la carpeta de respaldo local (server.cfg tiene contraseñas, no se versiona).
Necesita paramiko (en un entorno virtual aparte). No recarga nada: server.cfg se ejecuta en cada cambio de mapa.
Bitácora: docs/bitacora/2026-10-27-tasas-coherentes/
"""
import io
import os
import re
import sys

import paramiko

MODE, BACKUP = sys.argv[1], sys.argv[2]
assert MODE in ("inspect", "apply")
ROOT = r"E:\Css V34 Web\v34frag"
CFG = "cfg/server.cfg"
# Otros cfgs que se ejecutan y podrían pisar los valores de server.cfg (solo se miran).
OTHERS = ["cfg/autoexec.cfg", "cfg/game.cfg", "cfg/csstv/warmup.cfg", "cfg/csstv/live.cfg", "cfg/csstv/end.cfg"]
WANT = {"sv_minupdaterate": "100", "sv_maxupdaterate": "101", "sv_mincmdrate": "100", "sv_maxcmdrate": "101"}


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


def pat(cvar):
    # La línea activa de la cvar (no comentada), con o sin comillas y con lo que siga.
    return re.compile(rb'^[ \t]*' + cvar.encode() + rb'[ \t]+[^\r\n]*', re.M)


for srv in ("real", "rbk"):
    t, s = connect(srv)
    root = find_root(s)
    print(f"== {srv}")
    for rel in OTHERS:
        try:
            other = get(s, f"{root}/{rel}")
        except IOError:
            continue
        for cvar in WANT:
            for m in pat(cvar).finditer(other):
                print(f"  OJO {rel}: {m.group(0).decode(errors='replace').strip()}")
    path = f"{root}/{CFG}"
    data = get(s, path)
    new = data
    for cvar, val in WANT.items():
        found = pat(cvar).findall(data)
        print(f"  {CFG}: {' | '.join(f.decode(errors='replace').strip() for f in found) or 'SIN LÍNEA'}"
              f" -> {cvar} {val}")
        if len(found) != 1:
            raise SystemExit(f"ABORTA: {srv}: {cvar} aparece {len(found)} veces en {CFG}")
        new = pat(cvar).sub(lambda m: f"{cvar} {val}".encode(), new, count=1)
    if MODE == "apply":
        bak = os.path.join(BACKUP, srv, "server.cfg")
        os.makedirs(os.path.dirname(bak), exist_ok=True)
        open(bak, "wb").write(data)
        s.putfo(io.BytesIO(new), path)
        after = get(s, path)
        assert after == new, f"{srv}: verificación falló"
        print(f"  aplicado y verificado ({len(data)} -> {len(after)} bytes)")
    s.close()
    t.close()
