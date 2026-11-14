"""Graba una jugada de la base igual que procesar.py, pero solo en local: para probar a mano.

Uso:  python probar_jugada.py <id de la jugada> [--config config.json] [--env ruta/al/.env] [--name <nombre del mp4>]

Lee la jugada, las demás de su partida (para el desfase de ticks) y la partida con la clave pública
(match_clip_list, matches y clip_config), baja la demo del Worker de demos a work_dir/demos/ si no está, la graba con
render_clip.record_session y deja el .mp4 en out_dir. No escribe en la base ni sube nada a R2, Drive o Discord:
la jugada queda como estaba. La demo se queda en work_dir/demos/ para la próxima prueba.

Toma el mismo candado que procesar.py (work_dir/procesar.lock): si la tarea está grabando, avisa y sale. Corre como administrador, como procesar.py (se eleva sola con un aviso de UAC).
"""
import argparse
import json
import msvcrt
import os
import sys
import time
import traceback
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import leer_demo  # noqa: E402
import procesar  # noqa: E402
import render_clip  # noqa: E402
from render_clip import log  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))


def get(env, query):
    req = urllib.request.Request(env["RENDER_SUPABASE_URL"].rstrip("/") + "/rest/v1/" + query, headers={
        "User-Agent": procesar.USER_AGENT, "apikey": env["RENDER_SUPABASE_KEY"],
        "Authorization": f"Bearer {env['RENDER_SUPABASE_KEY']}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("clip", help="id de la jugada (match_clips.id)")
    ap.add_argument("--config", default=os.path.join(AQUI, "config.json"))
    ap.add_argument("--env", default=procesar.DEFAULT_ENV)
    ap.add_argument("--name", help="nombre del .mp4 (sin extensión)")
    ap.add_argument("--out-log", help=argparse.SUPPRESS)
    a = ap.parse_args()
    if not render_clip.is_admin():
        render_clip.relaunch_as_admin(os.path.join(AQUI, "ultimo_prueba.log"), script=__file__)
    render_clip.LOG_OUT = a.out_log
    cfg = render_clip.load_config(a.config)
    if cfg.get("height"):
        cfg["width"] = round(cfg["height"] * 16 / 9)
    os.makedirs(cfg["work_dir"], exist_ok=True)
    lock = open(os.path.join(cfg["work_dir"], "procesar.lock"), "a+")
    try:
        msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
    except OSError:
        raise SystemExit("La tarea está grabando (procesar.lock tomado): espera a que termine.") from None

    env = procesar.load_env(a.env)
    clip_id = urllib.parse.quote(a.clip)
    # match_clip_list filtrada por el id de la jugada recorre todas y la base la corta por tiempo (57014, el
    # 2026-11-13); por partida responde enseguida. La partida sale de match_clips, por su clave.
    rows = get(env, f"match_clips?select=match_id&id=eq.{clip_id}")
    if not rows:
        raise SystemExit(f"no existe la jugada {a.clip}")
    clips = get(env, f"match_clip_list?select=*&match_id=eq.{rows[0]['match_id']}")
    clip = next((c for c in clips if c["id"] == a.clip), None)
    if not clip:
        raise SystemExit(f"la jugada {a.clip} no está entre los clips visibles de su partida")
    match = get(env, f"matches?select=id,map,played_at,external_id,demo_size&id=eq.{clip['match_id']}")[0]
    conf = get(env, "clip_config?select=pre_seconds,post_seconds,split_gap_seconds&id=eq.1")[0]
    log(f"Jugada {clip['id'][:8]}: {clip['type']} de {clip['player_name']} (ronda {clip['round']}) en "
        f"{match['map']}, partida {match['external_id']}.")

    demo_path = procesar.download_demo(cfg, match)
    d = leer_demo.Demo(demo_path).parse()
    rounds = leer_demo.rounds(d)
    offset = procesar.tick_offset(d, rounds, clips)
    log(f"Desfase de ticks del plugin a la demo: {offset}")
    job = procesar.build_job(d, rounds, clip, offset, conf)
    log(f"En la demo: {job['player']} ({job['steamid']}), tramos {job['segs']}")

    frames_dir = os.path.join(cfg["client_dir"], "cstrike", "cmleague", "cuadros")
    t0 = time.time()
    try:
        prefixes = render_clip.record_session(cfg, demo_path, d, [job], frames_dir)
    finally:
        copia = os.path.join(cfg["client_dir"], "cstrike", "cmleague", "demos", os.path.basename(demo_path))
        if os.path.exists(copia):
            try:
                os.remove(copia)
            except OSError as e:
                log(f"Aviso: no se pudo borrar {copia}: {e}")
    log(f"Sesión del juego: {time.time() - t0:.0f} s.")

    os.makedirs(cfg["out_dir"], exist_ok=True)
    name = a.name or f"prueba_{match['map']}_{clip['type']}_r{clip['round']}_{clip['id'][:8]}_{cfg.get('client', 'clientmod')}"
    out = os.path.join(cfg["out_dir"], name + ".mp4")
    render_clip.encode(cfg, prefixes[job["key"]], job["segs"], d.tick_interval, out, d.header["playback_ticks"])
    log(f"Listo: {out} ({os.path.getsize(out) / 1e6:.1f} MB)")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:  # noqa: BLE001
        log("ERROR\n" + traceback.format_exc())
        sys.exit(1)
