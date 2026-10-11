#!/usr/bin/env python3
"""
CSSTV uploader: sube a Supabase los resultados que el plugin csstv_reporter deja en la cola.

Se usa cuando la extensión System2 no funciona en el servidor (csstv_send 0 en el plugin).
Solo usa la biblioteca estándar de Python (3.6 o superior).

Uso:
    python3 csstv_uploader.py --config csstv_uploader.ini           # queda corriendo
    python3 csstv_uploader.py --config csstv_uploader.ini --once    # una pasada (para cron)
"""

import argparse
import configparser
import json
import logging
import os
import sys
import time
import urllib.error
import urllib.request

PERMANENT_OK = range(200, 300)


def load_config(path):
    cp = configparser.ConfigParser()
    if not cp.read(path, encoding="utf-8"):
        sys.exit("No se pudo leer la configuración: %s" % path)
    s = cp["csstv"]
    cfg = {
        "api_base": s.get("api_base", "").rstrip("/"),
        "api_key": s.get("api_key", ""),
        "token": s.get("server_token", ""),
        "data_dir": s.get("data_dir", ""),
        "interval": s.getint("interval_seconds", 30),
        "log_file": s.get("log_file", ""),
    }
    missing = [k for k in ("api_base", "api_key", "token", "data_dir") if not cfg[k]]
    if missing:
        sys.exit("Faltan valores en la configuración: %s" % ", ".join(missing))
    return cfg


def post(cfg, payload):
    """Devuelve (status, cuerpo). status 0 = error de red."""
    url = cfg["api_base"] + "/rest/v1/rpc/ingest_server_match"
    body = json.dumps({"p_token": cfg["token"], "p_payload": payload}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "apikey": cfg["api_key"],
        "Authorization": "Bearer " + cfg["api_key"],
        "Content-Type": "application/json",
        "User-Agent": "CSSTV-Uploader/1.0",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:  # red caída, DNS, TLS, timeout
        return 0, str(e)


def move(src, dst_dir):
    os.makedirs(dst_dir, exist_ok=True)
    dst = os.path.join(dst_dir, os.path.basename(src))
    if os.path.exists(dst):
        os.remove(dst)
    os.replace(src, dst)


def process_once(cfg):
    queue = os.path.join(cfg["data_dir"], "queue")
    sent = os.path.join(cfg["data_dir"], "sent")
    failed = os.path.join(cfg["data_dir"], "failed")
    if not os.path.isdir(queue):
        logging.warning("No existe la carpeta de cola: %s", queue)
        return False
    transient = False
    for name in sorted(os.listdir(queue)):
        if not name.endswith(".json"):
            continue
        path = os.path.join(queue, name)
        try:
            with open(path, "rb") as f:
                raw = f.read()
            # Bytes no UTF-8 en nicks antiguos: se reemplazan para no perder el resultado.
            payload = json.loads(raw.decode("utf-8", "replace"))
        except (OSError, ValueError) as e:
            logging.error("%s ilegible (%s); se mueve a failed/", name, e)
            move(path, failed)
            continue
        status, body = post(cfg, payload)
        if status in PERMANENT_OK:
            logging.info("%s enviado. Partida: %s", name, body.strip().strip('"'))
            move(path, sent)
        elif 400 <= status < 500 and status not in (408, 429):
            logging.error("%s rechazado (HTTP %d): %s. Se mueve a failed/", name, status, body[:300])
            move(path, failed)
        else:
            logging.warning("%s no se pudo enviar (%s): %s. Se reintenta.", name, status or "sin conexión", body[:300])
            transient = True
            break
    return transient


def main():
    ap = argparse.ArgumentParser(description="Sube a CSSTV los resultados en cola del servidor.")
    ap.add_argument("--config", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "csstv_uploader.ini"))
    ap.add_argument("--once", action="store_true", help="hacer una sola pasada y salir")
    args = ap.parse_args()
    cfg = load_config(args.config)

    handlers = [logging.StreamHandler()]
    if cfg["log_file"]:
        handlers.append(logging.FileHandler(cfg["log_file"], encoding="utf-8"))
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", handlers=handlers)

    if args.once:
        process_once(cfg)
        return
    logging.info("CSSTV uploader iniciado. Cola: %s", os.path.join(cfg["data_dir"], "queue"))
    wait = cfg["interval"]
    while True:
        transient = process_once(cfg)
        wait = min(wait * 2, 900) if transient else cfg["interval"]
        time.sleep(wait)


if __name__ == "__main__":
    main()
