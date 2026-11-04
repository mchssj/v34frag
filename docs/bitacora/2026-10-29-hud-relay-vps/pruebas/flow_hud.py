"""Uso: python -I flow_hud.py inspect|apply|off

Prueba del relay del HUD en el VPS con flow (excepción a "todos los servidores en la misma tanda", autorizada por
Daniel el 2026-10-29). Toca solo csstv_hud.smx y cfg/sourcemod/csstv_hud.cfg de flow (SERVER2_*):
  inspect  muestra las líneas csstv_hud* de hoy (la clave, oculta).
  apply    sube csstv_hud.smx del repo si falta (flow no lo tiene), guarda el cfg original en la carpeta de este script
           y pone csstv_hud 1, host, puerto y clave de flow_hud_cfg.txt.
  off      vuelve a csstv_hud "0" (deja host, puerto y clave).
apply necesita flow_hud_cfg.txt al lado de este script, con las cuatro líneas de Administración › Servidores › flow
(tiene la clave: no se versiona). inspect y off no lo necesitan. Las credenciales salen del .env de la raíz.
Vale desde el próximo cambio de mapa (flow no nos da consola). Bitácora: docs/bitacora/2026-10-29-hud-relay-vps/
"""
import io
import os
import re
import sys

import paramiko

ROOT = r"E:\Css V34 Web\v34frag"
HERE = os.path.dirname(os.path.abspath(__file__))
CVARS = ("csstv_hud", "csstv_hud_host", "csstv_hud_port", "csstv_hud_key")


def env():
    vals = {}
    for line in open(os.path.join(ROOT, ".env"), encoding="utf-8"):
        m = re.match(r"\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$", line)
        if m:
            vals[m.group(1)] = m.group(2).strip('"').strip("'")
    return vals


def connect():
    e = env()
    t = paramiko.Transport((e["SERVER2_FTP_HOST"], int(e["SERVER2_FTP_PORT"])))
    t.connect(username=e["SERVER2_FTP_USER"], password=e["SERVER2_FTP_PASSWORD"])
    return t, paramiko.SFTPClient.from_transport(t)


def find_root(s):
    for cand in ("cstrike", "/cstrike", ".", "/home/container/cstrike"):
        try:
            if "sourcemod" in s.listdir(cand + "/addons"):
                return cand
        except IOError:
            pass
    raise SystemExit("ABORTA: no encontré cstrike/addons/sourcemod")


def show(text):
    for line in text.splitlines():
        if re.match(r'\s*csstv_hud', line):
            print("  " + re.sub(r'(csstv_hud_key\s+)".*"', r'\1"<oculta>"', line))


def set_cvar(text, name, value):
    pat = re.compile(rf'^(\s*){name}\s+".*"\s*$', re.M)
    if len(pat.findall(text)) != 1:
        raise SystemExit(f"ABORTA: {name} no aparece exactamente una vez en csstv_hud.cfg")
    return pat.sub(lambda m: f'{m.group(1)}{name} "{value}"', text)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "inspect"
    t, s = connect()
    try:
        root = find_root(s)
        path = root + "/cfg/sourcemod/csstv_hud.cfg"
        plugins = root + "/addons/sourcemod/plugins"
        has_smx = "csstv_hud.smx" in s.listdir(plugins)
        print(f"csstv_hud.smx en flow: {'sí' if has_smx else 'no'}")
        with s.open(path, "rb") as f:
            raw = f.read()
        text = raw.decode("utf-8")
        print(f"{path} hoy:")
        show(text)
        if mode == "inspect":
            return
        if mode == "apply":
            if not has_smx:
                s.put(os.path.join(ROOT, "server", "addons", "sourcemod", "plugins", "csstv_hud.smx"), plugins + "/csstv_hud.smx")
                print(f"Subido {plugins}/csstv_hud.smx ({s.stat(plugins + '/csstv_hud.smx').st_size} bytes)")
            with open(os.path.join(HERE, "flow_csstv_hud.cfg.original"), "wb") as f:
                f.write(raw)
            want = dict(re.findall(r'^(csstv_hud\w*)\s+"(.*)"\s*$',
                                   open(os.path.join(HERE, "flow_hud_cfg.txt"), encoding="utf-8").read(), re.M))
            for name in CVARS:
                text = set_cvar(text, name, want[name])
        elif mode == "off":
            text = set_cvar(text, "csstv_hud", "0")
        else:
            raise SystemExit(__doc__)
        with s.open(path, "wb") as f:
            f.write(text.encode("utf-8"))
        with s.open(path, "rb") as f:
            print(f"{path} ahora:")
            show(f.read().decode("utf-8"))
        print("Vale desde el próximo cambio de mapa.")
    finally:
        s.close()
        t.close()


main()
