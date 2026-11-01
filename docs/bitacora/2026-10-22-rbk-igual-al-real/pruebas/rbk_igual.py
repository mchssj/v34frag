"""Uso: rbk_igual.py inspect|apply <dir_respaldo>
Deja RBK igual al servidor real (Stripper, plugins, extensiones y cfgs) y cambia en los dos la plata de la
prórroga (12000) y la pausa del medio tiempo (5 s). Lo propio de cada servidor no se toca.
Bitácora: docs/bitacora/2026-10-22-rbk-igual-al-real/"""
import sys, os, io, re, hashlib, stat
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from srv import connect, find_root

mode, bak = sys.argv[1], sys.argv[2]
APPLY = mode == "apply"
SM = "addons/sourcemod"

# Archivos que se copian tal cual del real a RBK (se crean o se reemplazan).
STRIPPER_BIN = ["stripper_mm_i486.so", "stripper.core.so", "stripper.14.ep1.so", "stripper.16.css.so",
                "stripper.16.dods.so", "stripper.16.hl2dm.so", "stripper.16.l4d.so", "stripper.16.csgo.so",
                "stripper.16.l4d2.so", "stripper.16.ep2.so", "stripper.16.tf2.so", "stripper.16.sdk2013.so",
                "stripper.16.insurgency.so", "stripper.16.nd.so"]
NEW = ([f"addons/stripper/bin/{f}" for f in STRIPPER_BIN] +
       ["addons/stripper/global_filters.cfg", "addons/stripper/maps/de_dust2_ob.cfg",
        "addons/stripper/maps/de_dust.cfg", "addons/stripper/maps/de_dust2_ob",
        "addons/metamod/stripper.vdf", "addons/metamod/metaplugins.ini",
        f"{SM}/plugins/csstv_perf.smx", f"{SM}/plugins/SendFileExploitFixV3.3.smx",
        f"{SM}/plugins/soft_detector.smx", f"{SM}/plugins/clientmod_emulator.smx",
        f"{SM}/plugins/convar_detector.smx",
        f"{SM}/gamedata/SendFileExploitFix_csgo_1_2_2021.txt",
        f"{SM}/extensions/soft_detector.autoload", f"{SM}/extensions/soft_detector.ext.1.ep1.so",
        f"{SM}/extensions/soft_detector.ext.2.ep1.so",
        "cfg/sourcemod/funvotes.cfg", "cfg/sourcemod/plugin.clientmod_emulator.cfg"])
BASE = ["admin-flatfile", "adminhelp", "adminmenu", "antiflood", "basebans", "basechat", "basecomm",
        "basecommands", "basetriggers", "clientprefs", "funcommands", "funvotes", "nextmap",
        "playercommands", "reservedslots", "sounds", "clientmod", "clientmod_deathnotice"]
REPLACE = ([f"{SM}/plugins/{p}.smx" for p in BASE] +
           [f"{SM}/extensions/updater.ext.so", f"{SM}/configs/adminmenu_custom.txt",
            "cfg/csstv/live.cfg", "mapcycle.txt"])
# Movimientos dentro de RBK.
MOVES = [(f"{SM}/plugins/IGN.smx", f"{SM}/plugins/disabled/IGN.smx"),
         (f"{SM}/extensions/accelerator.autoload", f"{SM}/accelerator_retirado/accelerator.autoload"),
         (f"{SM}/extensions/accelerator.ext.so", f"{SM}/accelerator_retirado/accelerator.ext.so"),
         (f"{SM}/gamedata/accelerator.games.txt", f"{SM}/accelerator_retirado/accelerator.games.txt")]

R = "cfg/sourcemod/csstv_reporter.cfg"
# Cambios de líneas: (archivo, patrón, reemplazo). Cada patrón tiene que aparecer una sola vez.
EDITS_REAL = [(R, rb'^csstv_ot_startmoney "16000"', b'csstv_ot_startmoney "12000"'),
              (R, rb'^csstv_halftime_delay "10\.0"', b'csstv_halftime_delay "5.0"')]
EDITS_RBK = [(R, rb'^csstv_ot_maxrounds "24"', b'csstv_ot_maxrounds "6"'),
             (R, rb'^csstv_ot_startmoney "10000"', b'csstv_ot_startmoney "12000"'),
             (R, rb'^csstv_halftime_delay "3\.0"', b'csstv_halftime_delay "5.0"'),
             ("cfg/server.cfg", rb'^mp_c4timer 35 ', b'mp_c4timer 40 '),
             ("cfg/server.cfg", rb'^mp_friendlyfire 0 ', b'mp_friendlyfire 1'),
             ("cfg/server.cfg", rb'^sv_pure 0 ', b'sv_pure "2"'),
             ("cfg/server.cfg", rb'^phys_timescale 1\.0 ', b'phys_timescale 1.7 ')]
APPENDS_RBK = [("cfg/server.cfg", rb'^tv_title ', b'tv_title "CMLeague SourceTV #2"'),
               ("cfg/game.cfg", rb'^sv_pure ', b'sv_pure 2')]


def md5(b): return hashlib.md5(b).hexdigest()


def get(s, p):
    b = io.BytesIO(); s.getfo(p, b); return b.getvalue()


def exists(s, p):
    try: s.stat(p); return True
    except IOError: return False


def save_bak(name, rel, data):
    p = os.path.join(bak, name, rel.replace("/", os.sep))
    os.makedirs(os.path.dirname(p), exist_ok=True); open(p, "wb").write(data)


def mkdirs(s, path):
    cur = ""
    for part in path.split("/"):
        cur = f"{cur}/{part}" if cur else part
        if not exists(s, cur): s.mkdir(cur)


def put(s, path, data):
    mkdirs(s, path.rsplit("/", 1)[0])
    s.putfo(io.BytesIO(data), path)
    ok = md5(get(s, path)) == md5(data)
    if not ok: raise SystemExit(f"  ERROR: no coincide el md5 de {path}")
    return ok


def edit(data, pat, new, rel):
    n = len(re.findall(pat, data, re.M))
    if n != 1: raise SystemExit(f"  ABORTA: {rel}: {pat!r} aparece {n} veces")
    return re.sub(pat, lambda m: new, data, count=1, flags=re.M)


tr, sr = connect("real"); rr = find_root(sr)
tb, sb = connect("rbk"); rb = find_root(sb)
os.makedirs(bak, exist_ok=not APPLY)

# --- servidor real: solo las dos cvars ---
print("== real")
data = get(sr, f"{rr}/{R}"); save_bak("real", R, data); new = data
for rel, pat, rep in EDITS_REAL:
    new = edit(new, pat, rep, rel); print(f"  {rel}: {rep.decode()}")
real_reporter = new

# --- RBK ---
print("== rbk")
uploads = {}
for rel in NEW:
    if exists(sb, f"{rb}/{rel}"): raise SystemExit(f"  ABORTA: ya existe en RBK {rel}")
    uploads[rel] = get(sr, f"{rr}/{rel}"); print(f"  nuevo     {rel} ({len(uploads[rel])} bytes)")
for rel in REPLACE:
    cur = get(sb, f"{rb}/{rel}"); src = get(sr, f"{rr}/{rel}")
    if cur == src: print(f"  igual     {rel}"); continue
    save_bak("rbk", rel, cur); uploads[rel] = src
    print(f"  reemplazo {rel} ({len(cur)} -> {len(src)} bytes)")
for a, b in MOVES:
    if not exists(sb, f"{rb}/{a}") or exists(sb, f"{rb}/{b}"): raise SystemExit(f"  ABORTA: no se puede mover {a}")
    save_bak("rbk", a, get(sb, f"{rb}/{a}")); print(f"  muevo     {a} -> {b}")
files = {}
for rel, pat, rep in EDITS_RBK:
    if rel not in files: files[rel] = get(sb, f"{rb}/{rel}"); save_bak("rbk", rel, files[rel])
    files[rel] = edit(files[rel], pat, rep, rel); print(f"  {rel}: {rep.decode()}")
for rel, pat, line in APPENDS_RBK:
    if rel not in files: files[rel] = get(sb, f"{rb}/{rel}"); save_bak("rbk", rel, files[rel])
    if re.search(pat, files[rel], re.M): raise SystemExit(f"  ABORTA: {rel} ya tiene {pat!r}")
    files[rel] = files[rel].rstrip(b"\r\n") + b"\n" + line + b"\n"; print(f"  {rel}: agrega {line.decode()}")
# las tres cvars que el real define y RBK no (mismos valores que los por defecto), después de csstv_demo_keep
real_lines = [l for l in real_reporter.split(b"\n") if re.match(rb'csstv_(abandon_players|abandon_seconds|end_delay) ', l)]
if len(real_lines) != 3: raise SystemExit("  ABORTA: no encontré las 3 líneas en el cfg del real")
rep_rbk = files[R]
if re.search(rb'^csstv_(abandon_players|abandon_seconds|end_delay) ', rep_rbk, re.M): raise SystemExit("  ABORTA: RBK ya las tiene")
files[R] = edit(rep_rbk, rb'^(csstv_demo_keep [^\n]*)$', None, R) if False else \
    re.sub(rb'^(csstv_demo_keep [^\n]*)$', lambda m: m.group(1) + b"\n" + b"\n".join(l.rstrip(b"\r") for l in real_lines), rep_rbk, count=1, flags=re.M)
if files[R] == rep_rbk: raise SystemExit("  ABORTA: no encontré csstv_demo_keep en RBK")
print("  " + R + ": agrega " + ", ".join(l.split(b" ")[0].decode() for l in real_lines))

if APPLY:
    print("== aplicando")
    put(sr, f"{rr}/{R}", real_reporter); print(f"  real {R}: ok")
    for rel, d in uploads.items(): put(sb, f"{rb}/{rel}", d); print(f"  rbk {rel}: ok")
    for rel, d in files.items(): put(sb, f"{rb}/{rel}", d); print(f"  rbk {rel}: ok")
    for a, b in MOVES:
        mkdirs(sb, f"{rb}/{b}".rsplit("/", 1)[0]); sb.rename(f"{rb}/{a}", f"{rb}/{b}"); print(f"  rbk {a} -> {b}: ok")
sr.close(); tr.close(); sb.close(); tb.close()
