"""Uso: python -I armar_flow.py <carpeta de salida, p. ej. E:\\Css V34 Web\\v34frag\\flow>

Arma el paquete para el servidor de flow (CMLeague #3), que no nos da acceso al panel: baja por SFTP (solo
lectura) lo que corre en el #1 (SFTP_CSS_*) y los plugins que solo tiene RBK (SERVER1_*), y escribe los cfgs
propios de flow en <salida>/cstrike/. El token sale de FLOW_CSSTV_SERVER_TOKEN en el .env.
No incluye Accelerator, los plugins de Extreme Host, los mapas (pedido de Daniel) ni el reporter: ese es el
build licenciado (server/build_licenciado.sh <uuid> flow) y se copia aparte.
Se puede volver a correr: salta los archivos que ya bajó con el mismo tamaño.
Necesita paramiko (en un entorno virtual aparte).
Bitácora: docs/bitacora/2026-10-27-servidor-flow/
"""
import io
import os
import re
import stat
import sys

import paramiko

OUT = os.path.join(sys.argv[1], "cstrike")
ROOT = r"E:\Css V34 Web\v34frag"
SM = "addons/sourcemod"

# Carpetas que se bajan enteras del #1, con lo que se deja afuera.
TREES = ["addons/metamod", "addons/stripper", SM]
SKIP_DIRS = {f"{SM}/logs", f"{SM}/scripting", f"{SM}/plugins/disabled", f"{SM}/data/csstv", f"{SM}/data/dumps",
             f"{SM}/data/sqlite", f"{SM}/data/system2/win", f"{SM}/extensiones_desactivadas",
             f"{SM}/accelerator_retirado", f"{SM}/configs/grenade_sound_replacer", "addons/stripper/dumps",
             "addons/stripper/bin/x64"}
SKIP_FILES = {f"{SM}/plugins/extreme_host.smx", f"{SM}/plugins/extremehost.smx", f"{SM}/plugins/csstv_reporter.smx",
              f"{SM}/extensions/accelerator.autoload", f"{SM}/extensions/accelerator.ext.so",
              f"{SM}/gamedata/accelerator.games.txt", f"{SM}/translations/deadchat.phrases.txt",
              f"{SM}/configs/adminlist_settings.ini", f"{SM}/data/watchdog.pid", f"{SM}/README.md",
              "addons/metamod/README.txt"}
SKIP_RE = re.compile(r"(\.bak|\.tar\.gz$|\.dll$|\.exe$)")
SINGLE = ["addons/metamod.vdf", "cfg/game.cfg", "cfg/csstv/warmup.cfg", "cfg/csstv/live.cfg", "cfg/csstv/end.cfg",
          "cfg/sourcemod/sourcemod.cfg", "cfg/sourcemod/Kigen-AC_Redux.cfg", "cfg/sourcemod/funcommands.cfg",
          "cfg/sourcemod/funvotes.cfg", "cfg/sourcemod/basevotes.cfg", "cfg/sourcemod/plugin.clientmod_emulator.cfg",
          "cfg/sourcemod/csstv_password.cfg", "mapcycle.txt", "maplist.txt", "motd.txt"]
# Lo que solo tiene RBK (el #1 lo perdió sin registro; ver PLAN.md).
FROM_RBK = [f"{SM}/plugins/{p}.smx" for p in ("Anti_Wallhack_Lite", "SendFileExploitFixV3.3", "clientmod_emulator",
                                              "convar_detector", "soft_detector", "spectatorswitch", "csstv_hud")] + \
           [f"{SM}/extensions/soft_detector.autoload", f"{SM}/extensions/soft_detector.ext.1.ep1.so",
            f"{SM}/extensions/soft_detector.ext.2.ep1.so"]


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


def save(rel, data):
    p = os.path.join(OUT, rel.replace("/", os.sep))
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "wb").write(data)


def fetch(s, root, rel):
    """Baja un archivo tal cual; si ya está con el mismo tamaño (corrida anterior cortada), lo salta."""
    p = os.path.join(OUT, rel.replace("/", os.sep))
    if os.path.exists(p) and os.path.getsize(p) == s.stat(f"{root}/{rel}").st_size:
        return
    save(rel, get(s, f"{root}/{rel}"))


def walk(s, root, rel, acc):
    for a in s.listdir_attr(f"{root}/{rel}"):
        r = f"{rel}/{a.filename}"
        if stat.S_ISDIR(a.st_mode):
            if r not in SKIP_DIRS:
                walk(s, root, r, acc)
        elif r not in SKIP_FILES and not SKIP_RE.search(a.filename):
            acc.append(r)


def sub(data, pat, new, rel):
    """Reemplaza la línea que coincide con pat; tiene que aparecer exactamente una vez."""
    n = len(re.findall(pat, data, re.M))
    if n != 1:
        raise SystemExit(f"ABORTA: {rel}: {pat!r} aparece {n} veces")
    return re.sub(pat, lambda m: new, data, count=1, flags=re.M)


token = env().get("FLOW_CSSTV_SERVER_TOKEN", "")
if not re.fullmatch(r"csstv_[0-9a-f]{64}", token):
    raise SystemExit("ABORTA: falta FLOW_CSSTV_SERVER_TOKEN en el .env")

tr, sr = connect("real"); rr = find_root(sr)
tb, sb = connect("rbk"); rb = find_root(sb)

files = []
for tree in TREES:
    walk(sr, rr, tree, files)
for rel in files + SINGLE:
    fetch(sr, rr, rel)
print(f"#1: {len(files) + len(SINGLE)} archivos", flush=True)
for rel in FROM_RBK:
    fetch(sb, rb, rel)
print(f"RBK: {len(FROM_RBK)} archivos", flush=True)

# --- cfgs propios de flow ---
R = "cfg/sourcemod/csstv_reporter.cfg"
d = get(sr, f"{rr}/{R}")
d = sub(d, rb'^csstv_server_token "[^"]*"', b'csstv_server_token "' + token.encode() + b'"', R)
d = sub(d, rb'^csstv_server_tag "[^"]*"', b'csstv_server_tag "flow"', R)
d = sub(d, rb'^csstv_demo "1"[^\r\n]*', b'csstv_demo "0"                // flow: sin acceso al panel, el Worker no puede bajar las demos', R)
save(R, d)

C = "cfg/sourcemod/csstv_calladmin.cfg"
d = get(sr, f"{rr}/{C}")
d = sub(d, rb'^csstv_calladmin_server "[^"]*"', b'csstv_calladmin_server "CMLeague #3"', C)
d = sub(d, rb'^csstv_calladmin_address "[^"]*"', b'csstv_calladmin_address ""', C)
save(C, d)

save("cfg/sourcemod/csstv_hud.cfg", get(sb, f"{rb}/cfg/sourcemod/csstv_hud.cfg"))  # apagado, sin host ni clave

A = "cfg/autoexec.cfg"
d = get(sr, f"{rr}/{A}")
d = re.sub(rb"^// No eliminar/desactivar estos complementos\.\r?\n", b"", d, flags=re.M)
d = sub(d, rb"^sm plugins load extremehost\r?\n", b"", A)
d = sub(d, rb"^sm plugins load extreme_host\r?\n", b"", A)
save(A, d)

S = "cfg/server.cfg"
d = get(sr, f"{rr}/{S}")
d = sub(d, rb'^hostname "[^"]*"', b'hostname "CMLeague #3"', S)
d = sub(d, rb'^sv_password [^\r\n]*', b'sv_password ""', S)
d = sub(d, rb'^rcon_password [^\r\n]*', b'rcon_password ""', S)
d = sub(d, rb'^sv_downloadurl [^\r\n]*', b'sv_downloadurl ""', S)
d = sub(d, rb'^tv_title "[^"]*"', b'tv_title "CMLeague SourceTV #3"', S)
for cvar in (rb"sv_contact", rb"gamedesc_override", rb"sm_matchmod_gamedescription"):
    d = sub(d, rb"^" + cvar + rb" [^\r\n]*\r?\n", b"", S)
d = re.sub(rb"^// No eliminar/modificar el Branding[^\n]*\n// Eliminarlo/modificarlo[^\n]*\n", b"", d, flags=re.M)
d = d.replace(b"...:::[ExtremeHost]:::...", b"...:::[CMLeague #3]:::...")
save(S, d)

K = f"{SM}/configs/core.cfg"
d = get(sr, f"{rr}/{K}")
d = re.sub(rb"\t/\*\*\r?\n\t \* Accelerator[^\n]*\n(\t \*[^\n]*\n)*?\t \*/\r?\n", b"", d)
d = sub(d, rb'^\t"MinidumpUrl"[^\r\n]*\r?\n', b"", K)
save(K, d)

for s, t in ((sr, tr), (sb, tb)):
    s.close(); t.close()
print("listo:", OUT)
