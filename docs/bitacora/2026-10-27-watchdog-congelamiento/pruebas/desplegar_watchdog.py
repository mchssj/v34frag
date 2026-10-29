"""Sube el watchdog al servidor real (#1, SFTP_CSS_*). Uso: python -I desplegar_watchdog.py inspect|apply <carpeta local>
- inspect: solo mira (srcds_run, si ya tiene el watchdog, si existen los interruptores) y baja srcds_run a la carpeta.
- apply: 1) crea cstrike/cfg/csstv/watchdog_dry (modo de prueba) ANTES de lo demás; 2) sube watchdog.sh (0755) si cambió;
  3) copia srcds_run a srcds_run.bak_<fecha> y lo reemplaza por el parcheado. Los dos se suben como archivo nuevo y
  se renombran encima: el bash que está ejecutando el viejo no se toca (bash lee el script mientras lo ejecuta). Verifica cada archivo bajándolo de nuevo (md5).
No reinicia nada: el watchdog arranca en el próximo reinicio desde el panel. Necesita paramiko (entorno virtual aparte).
Bitácora: docs/bitacora/2026-10-27-watchdog-congelamiento/
"""
import hashlib
import io
import os
import re
import subprocess
import sys
import time

import paramiko

MODE, DEST = sys.argv[1], sys.argv[2]
assert MODE in ("inspect", "apply")
ROOT = r"E:\Css V34 Web\v34frag"
HERE = os.path.dirname(os.path.abspath(__file__))
STAMP = time.strftime("%Y%m%d")
MARK = b"# Watchdog del #1"


def env():
    vals = {}
    for line in open(os.path.join(ROOT, ".env"), encoding="utf-8"):
        m = re.match(r"\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$", line)
        if m:
            vals[m.group(1)] = m.group(2).strip('"').strip("'")
    return vals


md5 = lambda b: hashlib.md5(b).hexdigest()
e = env()
t = paramiko.Transport((e["SFTP_CSS_SERVER"], int(e["SFTP_CSS_SERVER_PORT"])))
t.connect(username=e["SFTP_CSS_USER"], password=e["SFTP_CSS_PASSWORD"])
s = paramiko.SFTPClient.from_transport(t)
os.makedirs(DEST, exist_ok=True)


def read(path):
    with s.open(path, "rb") as f:
        return f.read()


def exists(path):
    try:
        s.stat(path)
        return True
    except IOError:
        return False


def put(data, path, mode):
    with s.open(path, "wb") as f:
        f.write(data)
    s.chmod(path, mode)
    got = read(path)
    assert md5(got) == md5(data), f"{path}: md5 distinto al bajarlo"
    print(f"  {path}: {len(data)} B, md5 {md5(data)} (verificado)")


def replace(data, path, mode):
    """Sube como archivo nuevo y lo renombra encima: un bash que esté ejecutando el viejo lo sigue leyendo entero."""
    tmp = path + ".watchdog_nuevo"
    put(data, tmp, mode)
    if exists(path):
        try:
            s.posix_rename(tmp, path)
        except IOError:
            s.remove(path)
            s.rename(tmp, path)
    else:
        s.rename(tmp, path)
    assert md5(read(path)) == md5(data), f"{path}: md5 distinto después de renombrar"
    print(f"  {path}: reemplazado, md5 {md5(data)}, modo {oct(s.stat(path).st_mode)} (verificado)")


run = read("srcds_run")
open(os.path.join(DEST, "srcds_run.original"), "wb").write(run)
print(f"srcds_run: {len(run)} B, md5 {md5(run)}, modo {oct(s.stat('srcds_run').st_mode)}, "
      f"{'YA tiene' if MARK in run else 'sin'} watchdog")
for p in ("watchdog.sh", "cstrike/cfg/csstv/watchdog_dry", "cstrike/cfg/csstv/watchdog_off", f"srcds_run.bak_{STAMP}"):
    print(f"{p}: {'existe' if exists(p) else 'no existe'}")
if MODE == "inspect":
    sys.exit(0)

# 1. Modo de prueba primero: si algo se corta a mitad de camino, el watchdog no manda señales.
if not exists("cstrike/cfg/csstv/watchdog_dry"):
    put(b"Modo de prueba del watchdog: anota, pero no manda senales. Borrar para el modo normal.\n",
        "cstrike/cfg/csstv/watchdog_dry", 0o644)

# 2. El script (LF, ejecutable).
wd = open(os.path.join(ROOT, "server", "watchdog", "watchdog.sh"), "rb").read()
assert b"\r\n" not in wd, "watchdog.sh tiene CRLF"
if exists("watchdog.sh") and md5(read("watchdog.sh")) == md5(wd):
    print("watchdog.sh ya está al día")
else:
    replace(wd, "watchdog.sh", 0o755)

# 3. srcds_run parcheado.
if MARK in run:
    print("srcds_run ya tiene el watchdog: no se toca")
else:
    orig = os.path.join(DEST, "srcds_run.original")
    patched = os.path.join(DEST, "srcds_run.parcheado")
    subprocess.run([sys.executable, "-I", os.path.join(HERE, "parchear_srcds_run.py"), orig, patched], check=True)
    new = open(patched, "rb").read()
    bak = f"srcds_run.bak_{STAMP}"
    if not exists(bak):
        put(run, bak, 0o777)
    replace(new, "srcds_run", 0o777)

s.close()
t.close()
print("listo: el watchdog arranca en el próximo reinicio desde el panel, en modo de prueba")
