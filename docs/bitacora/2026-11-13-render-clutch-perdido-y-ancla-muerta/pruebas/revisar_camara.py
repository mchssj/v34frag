"""Los comandos de la cámara de cada tramo de los clips de una partida, sin abrir el juego ni escribir en la base.

Uso (desde cualquier carpeta, con el .env de la raíz del repo):
    python -I revisar_camara.py <render_dir> <match_id> <demo> [<match_id> <demo> ...]

render_dir: la carpeta render/ con la versión del código que se quiere revisar (para comparar la de antes con la
nueva, se corre con cada una y se comparan las salidas). Lee match_clip_list y clip_config con la clave pública.
"""
import json
import os
import sys
import urllib.request

render_dir = os.path.abspath(sys.argv[1])
sys.path.insert(0, render_dir)
import leer_demo  # noqa: E402
import procesar  # noqa: E402
import render_clip  # noqa: E402

env = procesar.load_env(os.path.join(os.path.dirname(__file__), *[".."] * 4, ".env"))


def get(q):
    req = urllib.request.Request(env["RENDER_SUPABASE_URL"].rstrip("/") + "/rest/v1/" + q, headers={
        "User-Agent": procesar.USER_AGENT, "apikey": env["RENDER_SUPABASE_KEY"],
        "Authorization": "Bearer " + env["RENDER_SUPABASE_KEY"]})
    return json.loads(urllib.request.urlopen(req, timeout=60).read())


conf = get("clip_config?select=pre_seconds,post_seconds,split_gap_seconds&id=eq.1")[0]
for mid, demo in zip(sys.argv[2::2], sys.argv[3::2]):
    clips = get(f"match_clip_list?select=*&match_id=eq.{mid}")
    d = leer_demo.Demo(demo).parse()
    rounds = leer_demo.rounds(d)
    off = procesar.tick_offset(d, rounds, clips)
    lead = round(0.5 / d.tick_interval)
    print(f"{mid[:8]} ({os.path.basename(demo)}), desfase {off}")
    for c in sorted(clips, key=lambda c: (c["round"], c["id"])):
        head = f"  {c['id'][:8]} r{c['round']} {c['type']} {ascii(c['player_name'])} [{c['video_status']}]"
        try:
            job = procesar.build_job(d, rounds, c, off, conf)
        except procesar.Skip as e:
            print(head, "SKIP:", e)
            continue
        print(head, "tramos", job["segs"])
        for s in job["segs"]:
            t = max(s[0] - lead, 0)
            try:
                cmds = render_clip.spec_target(d, job["steamid"], t)
            except RuntimeError as e:
                cmds = f"FALLA: {e}"
            print(f"      {t}: {ascii(cmds)}")
