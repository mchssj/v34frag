"""Prueba de la publicación en Discord (procesar.publish_discord) contra la Supabase LOCAL, sin el canal real.

El webhook es un servidor local que imita al de Discord: guarda cada mensaje (el JSON y el adjunto), responde una vez
429 para probar la espera, y devuelve un id de mensaje. R2 y Drive son los de verdad: el video de prueba se sube a los
dos y se borra al final. Comprueba el orden, el texto del mensaje, el tamaño del adjunto, que la jugada que solo está
en Drive también salga, la marca en la base y que nada se publique dos veces.

Uso (desde la raíz del repo, con la base local levantada):
  python -I docs/bitacora/2026-10-24-clips-discord/pruebas/probar_discord.py
"""
import http.server
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
sys.path.insert(0, os.path.join(RAIZ, "render"))
import discord  # noqa: E402
import drive as drive_mod  # noqa: E402
import procesar  # noqa: E402
import r2 as r2mod  # noqa: E402

DB = ["docker", "exec", "-i", "supabase_db_v34frag-api", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"]
MATCH = "d15c0000-2410-4000-8000-0000000000e1"
TOKEN = "tok-discord-local"
fallas = 0
recibidos = []
responder_429 = [True]


def ok(cond, msg):
    global fallas
    print(("OK: " if cond else "FALLA: ") + msg, flush=True)
    fallas += not cond


def sql(q):
    return subprocess.run(DB, input=q, capture_output=True, text=True, check=True).stdout.strip()


class Webhook(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers["Content-Length"]))
        if responder_429[0]:
            responder_429[0] = False
            self.send_response(429)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"retry_after": 0.3}')
            return
        boundary = self.headers["Content-Type"].split("boundary=")[1].encode()
        partes = [p for p in body.split(b"--" + boundary) if b"Content-Disposition" in p]
        msg = {"path": self.path, "ua": self.headers.get("User-Agent")}
        for p in partes:
            head, _, data = p.partition(b"\r\n\r\n")
            data = data[:-2]
            if b'name="payload_json"' in head:
                msg["payload"] = json.loads(data)
            elif b'name="files[0]"' in head:
                msg["file_bytes"] = len(data)
                msg["file_head"] = data[4:8]
                msg["filename"] = head.split(b'filename="')[1].split(b'"')[0].decode()
        recibidos.append(msg)
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"id": str(1563400000000000000 + len(recibidos))}).encode())

    def log_message(self, *a):
        pass


def main():
    tmp = os.path.join(tempfile.gettempdir(), "prueba_discord")
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(tmp)
    cfg = json.load(open(os.path.join(RAIZ, "render", "config.json"), encoding="utf-8"))
    cfg.update({"work_dir": os.path.join(tmp, "trabajo"), "discord_top": 5})
    os.makedirs(cfg["work_dir"])

    # Un video de prueba de 20 s a 1080p60 con sonido (el de verdad pesa más; acá alcanza con que se recodifique).
    video = os.path.join(tmp, "clip.mp4")
    subprocess.run([cfg["ffmpeg"], "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=60",
                    "-f", "lavfi", "-i", "sine=f=440", "-t", "20", "-c:v", "libx264", "-crf", "18", "-preset", "veryfast",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", video], check=True)
    print(f"   video de prueba: {os.path.getsize(video) / 1e6:.1f} MB")

    anon = json.loads(subprocess.run("pnpm exec supabase status -o json", shell=True, cwd=os.path.join(RAIZ, "web", "backend"),
                                     capture_output=True, text=True).stdout)["ANON_KEY"]
    api = procesar.Api({"RENDER_SUPABASE_URL": "http://127.0.0.1:54321", "RENDER_SUPABASE_KEY": anon,
                        "RENDER_WORKER_TOKEN": TOKEN})
    r2 = r2mod.R2(r2mod.load_env(os.path.join(RAIZ, ".env")))
    drive = drive_mod.Drive(drive_mod.load_env(os.path.join(RAIZ, ".env")))

    # Partida con tres jugadas con video: dos en R2 (puestos 1 y 2) y una que ya solo está en Drive (puesto 3).
    sql(f"""
      delete from matches where id = '{MATCH}';
      delete from render_workers where name = 'render-discord-local';
      insert into render_workers(name, token_hash) values ('render-discord-local', encode(sha256(convert_to('{TOKEN}', 'UTF8')), 'hex'));
      insert into matches(id, kind, status, map, score1, score2, winner_side, played_at, external_id, demo_status)
      values ('{MATCH}', 'mix', 'finished', 'cbble', 16, 13, 1, now() - interval '400 days', 'prueba-discord', 'uploaded');
      insert into match_clips(match_id, round, player_steamid, player_name, round_won, kill_ticks, clutch_vs, clutch_start_tick, end_tick)
      values ('{MATCH}', 26, '76561199619355094', 'Old x roman', true, '{{1,2,3,4,5}}', null, null, null),
             ('{MATCH}', 9, '76561201729620480', 'hyd @ PDF', true, '{{1,2}}', 3, 1, 9),
             ('{MATCH}', 25, '76561198227583188', 'Old x Lukzz', true, '{{1,2,3}}', null, null, null);
    """)
    ids = dict(l.split("|")[::-1] for l in sql(f"select id, round from match_clips where match_id = '{MATCH}'").splitlines())
    subidos = []
    for rnd in ("26", "9", "25"):
        cid = ids[rnd]
        key = f"clips/{MATCH}/{cid}-prueba01.mp4"
        assert r2.put(key, open(video, "rb").read(), "video/mp4")[0] == 200
        drive_id = drive.upload(video, f"prueba discord {rnd}.mp4", "_prueba")
        subidos.append((key, drive_id))
        sql(f"""update match_clips set video_status = 'done', video_key = '{key}', video_bytes = {os.path.getsize(video)},
                  video_seconds = 20, video_drive_id = '{drive_id}', video_rendered_at = now()
                  {", video_r2_deleted_at = now()" if rnd == "25" else ""} where id = '{cid}'""")
    # La de la ronda 25 "ya no está en R2": se borra de verdad, así tiene que salir de Drive.
    r2.delete(subidos[2][0])

    server = http.server.HTTPServer(("127.0.0.1", 0), Webhook)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    webhook = f"http://127.0.0.1:{server.server_port}/api/webhooks/1/abc"
    try:
        procesar.publish_discord(cfg, api, r2, drive, webhook)
        ok(len(recibidos) == 3, f"3 mensajes publicados ({len(recibidos)}), después de esperar un 429")
        titulos = [m["payload"]["embeds"][0]["title"] for m in recibidos]
        ok(titulos == ["ACE · Old x roman", "Clutch 1v3 · hyd @ PDF", "3K · Old x Lukzz"], f"en orden de puesto: {titulos}")
        e0 = recibidos[0]["payload"]["embeds"][0]
        ok("de_cbble · ronda 26 · 16-13 · 20 s" in e0["description"] and "#1 de la partida" in e0["description"]
           and "[Ver en 1080p](https://drive.google.com/file/d/" in e0["description"], f"texto: {e0['description']!r}")
        ok(all(m["payload"]["allowed_mentions"] == {"parse": []} for m in recibidos), "sin menciones")
        ok(all(m["path"].endswith("?wait=true") and m["ua"] == discord.USER_AGENT for m in recibidos), "?wait=true y User-Agent")
        ok(all(m["file_head"] == b"ftyp" and m["file_bytes"] <= 9_500_000 for m in recibidos),
           f"adjuntos .mp4 de menos de 9,5 MB: {[round(m['file_bytes'] / 1e6, 1) for m in recibidos]}")
        ok(recibidos[0]["filename"] == "ace_26.mp4", f"nombre del adjunto: {recibidos[0]['filename']}")
        marcas = sql(f"select count(*) from match_clips where match_id = '{MATCH}' and discord_message_id is not null")
        ok(marcas == "3", "las 3 marcadas en la base con el id del mensaje")
        ok(not os.listdir(os.path.join(cfg["work_dir"], "discord")), "los videos temporales se borraron")

        procesar.publish_discord(cfg, api, r2, drive, webhook)
        ok(len(recibidos) == 3, "segunda corrida: nada nuevo")

        # Publicada pero sin marcar (la marca falló): el archivo local evita publicarla otra vez.
        sql(f"update match_clips set discord_posted_at = null, discord_message_id = null where id = '{ids['26']}'")
        procesar.publish_discord(cfg, api, r2, drive, webhook)
        ok(len(recibidos) == 3 and sql(f"select discord_message_id is not null from match_clips where id = '{ids['26']}'") == "t",
           "sin marca en la base pero en discord_publicados.json: se marca sin volver a publicar")
    finally:
        server.shutdown()
        for key, drive_id in subidos:
            r2.delete(key)
            drive.delete(drive_id)
        drive.delete(drive.folder("_prueba", drive.folder(drive_mod.ROOT_FOLDER)))
        sql(f"delete from matches where id = '{MATCH}'; delete from clip_video_trash; "
            "delete from render_workers where name = 'render-discord-local';")
        shutil.rmtree(tmp, ignore_errors=True)
    print("Todo OK" if not fallas else f"{fallas} FALLAS")
    sys.exit(1 if fallas else 0)


if __name__ == "__main__":
    main()
