"""Grabación automática de los clips (fase C2). Lo corre la tarea programada cada 10 minutos.

Uso:  python procesar.py [--config config.json] [--env ruta/al/.env] [--max-partidas N] [--sin-diario]

En cada corrida:
  1. Toma de la base una partida con jugadas visibles sin video (clip_render_claim).
  2. Baja su demo del Worker de demos (o usa la que ya bajó) y busca en ella los ticks reales de cada jugada y el
     nombre que tenía cada jugador.
  3. Graba todas sus jugadas en una sola sesión del juego, pasa cada una a .mp4, la sube a R2 (y a Google Drive, si
     está activado), verifica el tamaño con HEAD, la ata a su jugada (clip_render_done) y borra el .mp4.
  4. Repite con la siguiente partida, hasta --max-partidas. Una jugada que falla vuelve a la cola (clip_render_fail).
  5. Discord (con "discord": true en config.json): al empezar la corrida y después de grabar cada partida, publica
     las mejores jugadas con video que todavía no salieron (clip_discord_pending), con una versión liviana del video
     adjunta, y las marca (clip_discord_mark).
  6. Una vez por día: borra de R2 los videos con más de r2_days días que ya están en Drive (clip_archive_due) y
     vacía la papelera (clip_trash_list).

Variables (del .env de la raíz del repo, o del que se pase con --env; las del entorno ganan):
  RENDER_SUPABASE_URL, RENDER_SUPABASE_KEY (la clave pública), RENDER_WORKER_TOKEN y las CF_*_CLIPS de r2.py.
  Con Drive: las GOOGLE_* de drive.py. Con Discord: DISCORD_CLIPS_WEBHOOK.

Corre como administrador (como render_clip.py): la tarea programada usa "privilegios más altos"; a mano, se eleva
sola con un aviso de UAC. Un candado en work_dir evita dos corridas a la vez.
"""
import argparse
import datetime
import json
import msvcrt
import os
import sys
import time
import traceback
import urllib.error
import urllib.request
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import leer_demo  # noqa: E402
import r2 as r2mod  # noqa: E402
import render_clip  # noqa: E402
from render_clip import log  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
DEFAULT_ENV = os.path.join(AQUI, "..", ".env")
STEAM64_BASE = 76561197960265728
# Cloudflare le responde 403 al User-Agent por defecto de Python ("Python-urllib"), y el Worker de demos está detrás.
USER_AGENT = "CMLeague-render/1.0"


def load_env(path):
    vals = {}
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                vals[k.strip()] = v.strip().strip('"').strip("'")
    vals.update({k: v for k, v in os.environ.items() if k.startswith(("RENDER_", "CF_", "GOOGLE_", "DISCORD_"))})
    missing = [k for k in ("RENDER_SUPABASE_URL", "RENDER_SUPABASE_KEY", "RENDER_WORKER_TOKEN") if not vals.get(k)]
    if missing:
        raise SystemExit(f"faltan en el .env: {', '.join(missing)}")
    return vals


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(f"HTTP {status}: {message}")
        self.status = status


class Api:
    """Las funciones del render en la base, por PostgREST, con la clave pública y el token propio."""

    def __init__(self, env):
        self.base = env["RENDER_SUPABASE_URL"].rstrip("/") + "/rest/v1/rpc/"
        self.key = env["RENDER_SUPABASE_KEY"]
        self.token = env["RENDER_WORKER_TOKEN"]

    def rpc(self, fn, **params):
        body = json.dumps({"p_token": self.token, **params}).encode()
        req = urllib.request.Request(self.base + fn, data=body, method="POST", headers={
            "User-Agent": USER_AGENT, "apikey": self.key, "Authorization": f"Bearer {self.key}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
        except urllib.error.HTTPError as e:
            try:
                msg = json.loads(e.read()).get("message")
            except ValueError:
                msg = None
            raise ApiError(e.code, msg or e.reason) from None
        return json.loads(data) if data else None


# ---- La jugada dentro de la demo ----

def account_id(steamid):
    """El número de cuenta de Steam de un SteamID64 o de un STEAM_X:Y:Z (None si no es ninguno)."""
    s = str(steamid or "")
    if s.isdigit() and int(s) > STEAM64_BASE:
        return int(s) - STEAM64_BASE
    if s.startswith("STEAM_") and s.count(":") == 2:
        _, y, z = s.split(":")
        if y.isdigit() and z.isdigit():
            return int(z) * 2 + int(y)
    return None


def demo_steamid(d, clip):
    """El SteamID con que el jugador de la jugada aparece en la demo (los bots, por el nombre)."""
    acct = account_id(clip["player_steamid"])
    if acct is None:
        sid = f"BOT:{clip['player_name']}"
        return sid if sid in d.names else None
    return next((sid for sid in d.names if account_id(sid) == acct), None)


def tick_offset(d, rounds, clips):
    """Cuántos ticks hay que sumarle a los del plugin para llegar a los del .dem, para toda la partida.

    El plugin cuenta desde que empezó a grabar la demo, pero el .dem empieza unos segundos antes o después (y
    tv_delay). Se comparan las kills de cada jugada con las kills del mismo jugador en la demo y, en los clutches,
    el inicio (la muerte del último compañero) con las muertes y el fin con los round_end; gana la diferencia que
    más se repite. None si no hay con qué comparar."""
    tickrate = 1 / d.tick_interval
    window = round(180 * tickrate)
    kills_by = {}
    for r in rounds:
        for k in r["kills"]:
            if not k["suicide"]:
                kills_by.setdefault(k["attacker_steamid"], []).append(k["tick"])
    deaths = [k["tick"] for r in rounds for k in r["kills"]]
    ends = [r["end"]["tick"] for r in rounds]
    diffs = []
    for c in clips:
        sid = demo_steamid(d, c)
        for t in c["kill_ticks"]:
            diffs += [k - t for k in kills_by.get(sid, []) if abs(k - t) <= window]
        if c.get("end_tick") is not None:
            diffs += [t - c["clutch_start_tick"] for t in deaths if abs(t - c["clutch_start_tick"]) <= window]
            diffs += [e - c["end_tick"] for e in ends if abs(e - c["end_tick"]) <= window]
    if not diffs:
        return None
    votes = Counter(diffs)
    best = max(votes, key=lambda x: (sum(votes[x + j] for j in range(-2, 3)), votes[x]))
    near = sorted(x for x in diffs if abs(x - best) <= 2)
    return near[len(near) // 2]


def clip_events(d, rounds, clip, offset):
    """Los ticks del .dem de lo que pasa en la jugada: cada kill (la de la demo, si está a 3 ticks o menos de la
    que mandó el plugin corrida por el desfase) y, en un clutch, el inicio y el fin de la ronda."""
    sid = demo_steamid(d, clip)
    demo_kills = [k["tick"] for r in rounds for k in r["kills"] if not k["suicide"] and k["attacker_steamid"] == sid]
    events = []
    for t in clip["kill_ticks"]:
        want = t + offset
        near = min(demo_kills, key=lambda k: abs(k - want), default=None)
        events.append(near if near is not None and abs(near - want) <= 3 else want)
    if clip.get("clutch_start_tick") is not None:
        events += [clip["clutch_start_tick"] + offset, clip["end_tick"] + offset]
    return sorted(max(e, 0) for e in events)


class Skip(Exception):
    """La jugada no se puede grabar nunca (queda skipped)."""


def build_job(d, rounds, clip, offset, seg_cfg):
    if offset is None:
        raise Skip("No se pudo ubicar la partida en la demo (sin kills ni fines de ronda para comparar)")
    events = clip_events(d, rounds, clip, offset)
    if not events:
        raise Skip("La jugada no tiene kills ni clutch")
    sid = demo_steamid(d, clip)
    name = d.name_at(sid, events[0]) if sid else None
    if not name:
        raise Skip("El jugador no aparece en la demo")
    if '"' in name or ";" in name:
        raise Skip(f"El nombre del jugador en la demo no se puede usar en la consola: {name}")
    return {"key": clip["id"][:8], "player": name, "segs": render_clip.segments(events, d.tick_interval, seg_cfg),
            "clip": clip}


# ---- Demo ----

class DemoGone(Exception):
    pass


def download_demo(cfg, match):
    """La demo de la partida en work_dir/demos/<external_id>.dem (si ya está con el tamaño correcto, no se baja)."""
    folder = os.path.join(cfg["work_dir"], "demos")
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, match["external_id"] + ".dem")
    size = match.get("demo_size")
    if os.path.exists(path) and (size is None or os.path.getsize(path) == size):
        return path
    url = cfg["demo_worker_url"].rstrip("/") + "/demo/" + match["external_id"]
    log(f"Bajando la demo {match['external_id']} ({(size or 0) / 1e6:.0f} MB).")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=600) as r, open(path + ".part", "wb") as f:
            while chunk := r.read(1 << 20):
                f.write(chunk)
    except urllib.error.HTTPError as e:
        if e.code in (404, 410):
            raise DemoGone(f"La demo ya no está en R2 ({e.code})") from None
        raise
    got = os.path.getsize(path + ".part")
    if size is not None and got != size:
        os.remove(path + ".part")
        raise RuntimeError(f"La demo bajó incompleta: {got} de {size} bytes")
    os.replace(path + ".part", path)
    return path


# ---- Una partida ----

def fail(api, clip_id, error, final=False):
    try:
        st = api.rpc("clip_render_fail", p_clip=clip_id, p_error=str(error)[:500], p_final=final)
    except Exception as e:  # noqa: BLE001 — si la base no responde, la jugada vuelve sola a los 30 minutos
        log(f"  no se pudo marcar el fallo de {clip_id}: {e}")
        return "pending"
    log(f"  {clip_id[:8]}: {'skipped' if final else 'falló'} ({error}) -> {st}")
    return st


def process_match(cfg, api, r2, drive, job):
    m, clips, conf = job["match"], job["clips"], job["config"]
    log(f"Partida {m['external_id']} ({m['map']}): {len(clips)} jugadas.")
    seg_cfg = {k: conf[k] for k in ("pre_seconds", "post_seconds", "split_gap_seconds")}
    final = {}  # id de la jugada -> estado en que quedó

    try:
        demo_path = download_demo(cfg, m)
    except DemoGone as e:
        for c in clips:
            final[c["id"]] = fail(api, c["id"], e, final=True)
        return final
    except Exception as e:  # noqa: BLE001
        for c in clips:
            final[c["id"]] = fail(api, c["id"], f"No se pudo bajar la demo: {e}")
        return final

    d = leer_demo.Demo(demo_path).parse()
    rounds = leer_demo.rounds(d)
    offset = tick_offset(d, rounds, clips)
    log(f"Desfase de ticks del plugin a la demo: {offset}")
    jobs = []
    for c in clips:
        try:
            jobs.append(build_job(d, rounds, c, offset, seg_cfg))
        except Skip as e:
            final[c["id"]] = fail(api, c["id"], e, final=True)
    if not jobs:
        return final

    cfg = dict(cfg)
    if cfg.get("height"):
        cfg["width"] = round(cfg["height"] * 16 / 9)
    frames_dir = os.path.join(cfg["client_dir"], "cstrike", "cmleague", "cuadros")
    t0 = time.time()
    try:
        prefixes = render_clip.record_session(cfg, demo_path, d, jobs, frames_dir)
    except Exception as e:  # noqa: BLE001
        log("La sesión del juego falló:\n" + traceback.format_exc())
        for j in jobs:
            final[j["clip"]["id"]] = fail(api, j["clip"]["id"], f"Sesión del juego: {e}")
        return final
    finally:
        # La copia de la demo que usa el juego (la de work_dir/demos se borra cuando no quedan reintentos).
        copia = os.path.join(cfg["client_dir"], "cstrike", "cmleague", "demos", os.path.basename(demo_path))
        if os.path.exists(copia):
            try:
                os.remove(copia)
            except OSError as e:  # el juego quedó abierto y la tiene tomada: no cortar la corrida por eso
                log(f"Aviso: no se pudo borrar {copia}: {e}")
    log(f"Sesión del juego: {time.time() - t0:.0f} s.")

    os.makedirs(cfg["out_dir"], exist_ok=True)
    for j in jobs:
        c = j["clip"]
        out = os.path.join(cfg["out_dir"], f"{c['id']}.mp4")
        try:
            render_clip.encode(cfg, prefixes[j["key"]], j["segs"], d.tick_interval, out)
            seconds = round(sum(render_clip.segment_frames(s, d.tick_interval, cfg) for s in j["segs"]) / cfg["fps"], 2)
            size = os.path.getsize(out)
            key = f"clips/{m['id']}/{c['id']}-{time.strftime('%Y%m%d%H%M%S')}.mp4"
            st, body = r2.put(key, open(out, "rb").read(), "video/mp4")
            if st != 200:
                raise RuntimeError(f"R2 PUT {st}: {body[:200]!r}")
            st, got = r2.head(key)
            if st != 200 or got != size:
                raise RuntimeError(f"R2 HEAD {st}: {got} de {size} bytes")
            drive_id = drive.upload(out, f"{m['played_at'][:10]} {m['map']} {c['type']} {j['player']}.mp4",
                                    m["played_at"][:10]) if drive else None
            ok = api.rpc("clip_render_done", p_clip=c["id"], p_key=key, p_bytes=size, p_seconds=seconds,
                         p_drive_id=drive_id)
            final[c["id"]] = "done" if ok else "gone"
            log(f"  {c['id'][:8]}: {c['type']} de {j['player']} (ronda {c['round']}), {seconds} s, "
                f"{size / 1e6:.1f} MB{' y en Drive' if drive_id else ''}" + ("" if ok else " (la jugada cambió: a la papelera)"))
        except Exception as e:  # noqa: BLE001
            log(f"  {c['id'][:8]}: error\n" + traceback.format_exc())
            final[c["id"]] = fail(api, c["id"], e)
        finally:
            if os.path.exists(out):
                os.remove(out)
    return final


# ---- Discord ----

def publish_discord(cfg, api, r2, drive, webhook):
    """Publica las mejores jugadas con video que todavía no salieron en Discord, en orden de partida y de puesto, de a
    20 por pedido hasta vaciar la cola. Se llama al empezar la corrida y después de grabar cada partida, así nadie
    espera a que termine la corrida para ver sus clips.

    Antes de marcar en la base, el id del mensaje se anota en work_dir/discord_publicados.json: si la marca falla, la
    próxima vez se marca sin volver a publicarla. Si Discord falla, se corta y se reintenta la próxima vez. Devuelve
    False si Discord falló."""
    import discord
    state_path = os.path.join(cfg["work_dir"], "discord_publicados.json")
    try:
        posted = json.load(open(state_path, encoding="utf-8"))
    except (OSError, ValueError):
        posted = {}
    folder = os.path.join(cfg["work_dir"], "discord")
    os.makedirs(folder, exist_ok=True)
    skipped = set()  # las que no se pudieron publicar en esta llamada (no se reintentan hasta la próxima)
    while True:
        rows = [r for r in api.rpc("clip_discord_pending", p_top=cfg.get("discord_top", 5), p_limit=20) or []
                if r["clip_id"] not in skipped]
        if not rows:
            return True
        log(f"Discord: {len(rows)} jugadas para publicar.")
        for row in rows:
            cid = row["clip_id"]
            if cid in posted:
                api.rpc("clip_discord_mark", p_clip=cid, p_message_id=posted[cid])
                continue
            src = os.path.join(folder, f"{cid}.mp4")
            light = os.path.join(folder, f"{cid}_720.mp4")
            try:
                # El video: de R2 mientras está (más rápido) y si no, de Drive.
                if row.get("video_in_r2") and row.get("video_key"):
                    st, data = r2.get(row["video_key"])
                    if st != 200:
                        raise RuntimeError(f"R2 GET {st}")
                    open(src, "wb").write(data)
                elif row.get("video_drive_id") and drive:
                    drive.download(row["video_drive_id"], src)
                else:
                    raise RuntimeError("sin video en R2 ni en Drive")
                size = render_clip.light_version(cfg, src, light, row.get("video_seconds") or 30)
                msg = discord.post(webhook, discord.clip_message(row), light,
                                   filename=f"{row['type']}_{row['round']}.mp4")
                posted[cid] = msg
                json.dump(posted, open(state_path, "w", encoding="utf-8"))
                api.rpc("clip_discord_mark", p_clip=cid, p_message_id=msg)
                log(f"  {cid[:8]}: publicada en Discord ({discord.type_label(row['type'])} de {row['player_name']}, "
                    f"{size / 1e6:.1f} MB)")
            except discord.DiscordError as e:
                log(f"  {cid[:8]}: Discord falló, sigo la próxima vez: {e}")
                return False
            except Exception as e:  # noqa: BLE001 — un problema de esta jugada no frena a las demás
                log(f"  {cid[:8]}: no se pudo publicar en Discord: {e}")
                skipped.add(cid)
            finally:
                for f in (src, light):
                    if os.path.exists(f):
                        os.remove(f)
            time.sleep(2)


# ---- Tareas diarias ----

def daily(cfg, api, r2, drive):
    state_path = os.path.join(cfg["work_dir"], "estado.json")
    try:
        state = json.load(open(state_path, encoding="utf-8"))
    except (OSError, ValueError):
        state = {}
    today = datetime.date.today().isoformat()
    if state.get("diario") == today:
        return
    log("Tareas del día: archivo de R2 y papelera.")
    n = 0
    for row in api.rpc("clip_archive_due", p_days=cfg.get("r2_days", 15)) or []:
        st, _ = r2.delete(row["video_key"])
        if st in (200, 204, 404):
            n += bool(api.rpc("clip_archive_mark", p_clip=row["clip_id"]))
        else:
            log(f"  no se pudo borrar {row['video_key']} de R2: {st}")
    if n:
        log(f"  {n} videos quedaron solo en Drive.")
    n = 0
    for row in api.rpc("clip_trash_list") or []:
        if row["video_key"]:
            st, _ = r2.delete(row["video_key"])
            if st not in (200, 204, 404):
                log(f"  no se pudo borrar {row['video_key']} de R2: {st}")
                continue
        if row["video_drive_id"]:
            if not drive:
                continue  # sin Drive configurado queda en la papelera
            drive.delete(row["video_drive_id"])
        n += bool(api.rpc("clip_trash_done", p_id=row["id"]))
    if n:
        log(f"  {n} archivos borrados de la papelera.")
    state["diario"] = today
    json.dump(state, open(state_path, "w", encoding="utf-8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=os.path.join(AQUI, "config.json"))
    ap.add_argument("--env", default=DEFAULT_ENV)
    ap.add_argument("--max-partidas", type=int)
    ap.add_argument("--sin-diario", action="store_true", help="no correr el archivo ni la papelera")
    ap.add_argument("--out-log", help=argparse.SUPPRESS)
    a = ap.parse_args()
    if not render_clip.is_admin():
        render_clip.relaunch_as_admin(os.path.join(AQUI, "ultimo_procesar.log"), script=__file__)
    cfg = render_clip.load_config(a.config)
    os.makedirs(cfg["work_dir"], exist_ok=True)
    render_clip.LOG_OUT = a.out_log or os.path.join(cfg["work_dir"], "procesar.log")

    # Candado: si la corrida anterior sigue, esta no hace nada.
    lock = open(os.path.join(cfg["work_dir"], "procesar.lock"), "a+")
    try:
        msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
    except OSError:
        print("Ya hay otra corrida en curso.")
        return

    env = load_env(a.env)
    api = Api(env)
    r2 = r2mod.R2(r2mod.load_env(a.env))
    drive = None
    if cfg.get("drive"):
        import drive as drive_mod
        drive = drive_mod.Drive(drive_mod.load_env(a.env))

    # Discord: al empezar (lo que haya quedado de antes) y después de cada partida grabada.
    webhook = env.get("DISCORD_CLIPS_WEBHOOK") if cfg.get("discord") else None
    if cfg.get("discord") and not webhook:
        log("Aviso: \"discord\" está activado pero falta DISCORD_CLIPS_WEBHOOK en el .env.")
    publish = (lambda: publish_discord(cfg, api, r2, drive, webhook)) if webhook else (lambda: None)
    publish()

    for _ in range(a.max_partidas or cfg.get("max_matches_per_run", 5)):
        job = api.rpc("clip_render_claim")
        if not job:
            break
        result = process_match(cfg, api, r2, drive, job)
        publish()
        # La demo se borra cuando ya no le quedan jugadas por reintentar.
        if all(st in ("done", "skipped", "failed", "gone") for st in result.values()):
            demo = os.path.join(cfg["work_dir"], "demos", job["match"]["external_id"] + ".dem")
            if os.path.exists(demo):
                os.remove(demo)
        else:
            # Algo falló y quedó para reintentar: la base devolvería la misma partida (la más vieja) y se gastarían
            # los tres intentos en un minuto. El reintento queda para la próxima corrida.
            log("Quedaron jugadas para reintentar: sigo en la próxima corrida.")
            break
    if not a.sin_diario:
        daily(cfg, api, r2, drive)


if __name__ == "__main__":
    try:
        main()
    except Exception:  # noqa: BLE001
        log("ERROR\n" + traceback.format_exc())
        sys.exit(1)
