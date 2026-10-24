"""Publica un clip en un canal de Discord por webhook, con el video adjunto. Solo biblioteca estándar.

El webhook va en DISCORD_CLIPS_WEBHOOK (variables de entorno o el .env de la raíz). Nunca se imprime: quien lo
tiene puede publicar en el canal.

Uso de prueba:  python discord.py prueba <video.mp4> [ruta/al/.env]   publica un mensaje de prueba con ese video
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid

DEFAULT_ENV = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
USER_AGENT = "CMLeague-render/1.0"
MAX_BYTES = 10 * 1024 * 1024  # límite de un adjunto por webhook en un servidor sin boost

TYPE_LABEL = {"ace": "ACE", "4k": "4K", "3k": "3K"}
TYPE_COLOR = {"ace": 0xF5B301, "4k": 0xE8590C, "3k": 0x3B82F6}
CLUTCH_COLOR = 0x9333EA


def load_webhook(path=DEFAULT_ENV):
    url = os.environ.get("DISCORD_CLIPS_WEBHOOK")
    if not url and os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            if line.strip().startswith("DISCORD_CLIPS_WEBHOOK="):
                url = line.strip().split("=", 1)[1].strip().strip('"').strip("'")
    if not url:
        raise SystemExit("falta DISCORD_CLIPS_WEBHOOK en el .env")
    return url


class DiscordError(Exception):
    pass


def type_label(t):
    """ace -> ACE, 4k -> 4K, clutch_3 -> Clutch 1v3."""
    if t and t.startswith("clutch_"):
        return f"Clutch 1v{t.split('_')[1]}"
    return TYPE_LABEL.get(t, (t or "").upper())


def map_name(m):
    return m if m.startswith(("de_", "cs_", "aim_", "awp_")) else f"de_{m}"


def clip_message(row):
    """El embed de una jugada (fila de clip_discord_pending)."""
    title = f"{type_label(row['type'])} · {row['player_name']}"
    secs = row.get("video_seconds")
    desc = (f"{map_name(row['map'])} · ronda {row['round']} · {row['score1']}-{row['score2']}"
            + (f" · {float(secs):.0f} s" if secs else "")
            + f"\n#{row['position']} de la partida")
    embed = {"title": title[:256], "description": desc,
             "color": CLUTCH_COLOR if str(row["type"]).startswith("clutch_") else TYPE_COLOR.get(row["type"], 0x6B7280)}
    if row.get("video_drive_id"):
        drive = f"https://drive.google.com/file/d/{row['video_drive_id']}/view"
        embed["url"] = drive
        embed["description"] += f"\n[Ver en 1080p]({drive})"
    return {"embeds": [embed], "allowed_mentions": {"parse": []}}


def post(webhook, payload, file_path, filename="clip.mp4", tries=4):
    """Publica el mensaje con el archivo adjunto y devuelve el id del mensaje. Espera y reintenta si Discord pide
    esperar (429)."""
    size = os.path.getsize(file_path)
    if size > MAX_BYTES:
        raise DiscordError(f"el video pesa {size} bytes (máximo {MAX_BYTES})")
    data = open(file_path, "rb").read()
    boundary = "cmleague" + uuid.uuid4().hex
    body = b"".join([
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"payload_json\"\r\n"
        f"Content-Type: application/json\r\n\r\n".encode(),
        json.dumps(payload).encode(),
        f"\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"files[0]\"; filename=\"{filename}\"\r\n"
        f"Content-Type: video/mp4\r\n\r\n".encode(),
        data,
        f"\r\n--{boundary}--\r\n".encode(),
    ])
    url = webhook + ("&" if "?" in webhook else "?") + "wait=true"
    for _ in range(tries):
        req = urllib.request.Request(url, data=body, method="POST", headers={
            "User-Agent": USER_AGENT, "Content-Type": f"multipart/form-data; boundary={boundary}"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return str(json.loads(r.read())["id"])
        except urllib.error.HTTPError as e:
            raw = e.read()
            if e.code == 429:
                try:
                    wait = float(json.loads(raw).get("retry_after", 2))
                except ValueError:
                    wait = 2.0
                time.sleep(min(wait, 60) + 0.5)
                continue
            raise DiscordError(f"Discord respondió {e.code}: {raw[:300]!r}") from None
    raise DiscordError("Discord siguió pidiendo esperar (429)")


def delete(webhook, message_id):
    """Borra un mensaje que publicó este webhook (por ejemplo, un clip grabado con la cámara equivocada)."""
    req = urllib.request.Request(f"{webhook}/messages/{message_id}", method="DELETE", headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return 404
        raise DiscordError(f"Discord respondió {e.code}: {e.read()[:300]!r}") from None


def prueba(video, env_path):
    row = {"type": "ace", "player_name": "Prueba", "map": "cbble", "round": 1, "score1": 16, "score2": 13,
           "position": 1, "video_seconds": 12, "video_drive_id": None}
    payload = clip_message(row)
    payload["content"] = "Mensaje de prueba del render de CMLeague."
    print("mensaje publicado:", post(load_webhook(env_path), payload, video))


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "prueba":
        prueba(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else DEFAULT_ENV)
    else:
        print(__doc__)
