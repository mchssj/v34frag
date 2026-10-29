"""Agrega a un srcds_run la línea que lanza watchdog.sh, justo antes de "run". Idempotente: si ya está, no cambia nada.
Uso: python -I parchear_srcds_run.py <srcds_run original> <srcds_run parcheado>
Bitácora: docs/bitacora/2026-10-27-watchdog-congelamiento/
"""
import sys

MARK = "# Watchdog del #1 (docs/bitacora/2026-10-27-watchdog-congelamiento)"
# Hijo directo de srcds_run (sin subshell): el watchdog termina cuando srcds_run termina.
HOOK = MARK + "\nif test -x ./watchdog.sh; then ./watchdog.sh > /dev/null 2>&1 & fi\n\n"
ANCHOR = "# Run\nrun\n"

src, dst = sys.argv[1], sys.argv[2]
data = open(src, "rb").read().decode("utf-8")
crlf = "\r\n" in data
text = data.replace("\r\n", "\n")
if MARK in text:
    print("ya tiene el watchdog: sin cambios")
else:
    assert text.count(ANCHOR) == 1, "no se encontró '# Run / run' exactamente una vez"
    text = text.replace(ANCHOR, HOOK + ANCHOR)
    print("agregado el watchdog antes de 'run'")
if crlf:
    text = text.replace("\n", "\r\n")
open(dst, "wb").write(text.encode("utf-8"))
