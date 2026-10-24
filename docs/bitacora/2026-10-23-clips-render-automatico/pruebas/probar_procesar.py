"""Prueba de procesar.py de punta a punta contra la Supabase LOCAL, sin el juego.

Solo se reemplaza la grabación (render_clip.record_session) por cuadros de prueba de FFmpeg (testsrc) del largo
exacto de cada tramo. Todo lo demás es lo real: la cola en la base, la demo en caché, el desfase y los ticks desde
la demo de tuscan, FFmpeg, la subida al R2 de clips (cuenta de Daniel, con HEAD), clip_render_done y _fail, el
archivo de los 15 días y la papelera. Los videos de prueba se borran de R2 al final.

Uso (desde la raíz del repo, con la base local levantada):
  python -I docs/bitacora/2026-10-23-clips-render-automatico/pruebas/probar_procesar.py <demo de tuscan> [carpeta temporal]
  (sin carpeta: prueba_c2 dentro de la carpeta temporal de Windows)
  ... --juego   con el juego de verdad (aviso de UAC; no usar la PC mientras graba): solo tres jugadas de tuscan, el 4k
                de musul y el 3k de Xaby de la ronda 10 (se pisan: dos pasadas) y el 4k de Lukas (dos tramos),
                a la resolución de config.json. Los .mp4 quedan en <out_dir>/prueba_c2/ para mirarlos.
"""
import glob
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
sys.path.insert(0, os.path.join(RAIZ, "render"))
import leer_demo  # noqa: E402
import procesar  # noqa: E402
import r2 as r2mod  # noqa: E402
import render_clip  # noqa: E402

DB = ["docker", "exec", "-i", "supabase_db_v34frag-api", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"]
MATCH = "eeeeeeee-2318-4000-8000-000000000001"
UID = "prueba-render-tuscan"
TOKEN = "tok-render-local"
DESFASE = 237
fallas = 0


def ok(cond, msg):
    global fallas
    print(("OK: " if cond else "FALLA: ") + msg, flush=True)
    fallas += not cond


def sql(q):
    return subprocess.run(DB, input=q, capture_output=True, text=True, check=True).stdout.strip()


def steam64(sid):
    _, y, z = sid.split(":")
    return str(procesar.STEAM64_BASE + int(z) * 2 + int(y))


def fake_record(cfg, demo_path, d, jobs, frames_dir):
    """En lugar del juego: los cuadros (con el lead) y el audio de cada tramo, como los dejaría startmovie."""
    shutil.rmtree(frames_dir, ignore_errors=True)
    os.makedirs(frames_dir)
    out = {}
    for job in jobs:
        out[job["key"]] = []
        for i, seg in enumerate(job["segs"]):
            n = render_clip.lead_frames(cfg) + render_clip.segment_frames(seg, d.tick_interval, cfg) + 2
            prefix = os.path.join(frames_dir, f"{job['key']}_{i}_")
            w, h = cfg["width"], cfg["height"]
            subprocess.run([cfg["ffmpeg"], "-y", "-loglevel", "error", "-f", "lavfi", "-i",
                            f"testsrc=size={w}x{h}:rate={cfg['fps']}", "-frames:v", str(n), prefix + "%04d.tga"],
                           check=True)
            subprocess.run([cfg["ffmpeg"], "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=f=440:sample_rate=44100",
                            "-t", f"{n / cfg['fps']:.3f}", prefix + ".wav"], check=True)
            out[job["key"]].append(prefix)
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    demo = args[0]
    tmp = os.path.abspath(args[1]) if len(args) > 1 else os.path.join(tempfile.gettempdir(), "prueba_c2")
    if "%" in tmp:
        raise SystemExit(f"La carpeta temporal tiene un '%' sin expandir ({tmp}): en PowerShell va $env:TEMP, o no la pases")
    juego = "--juego" in sys.argv
    print(f"Carpeta temporal: {tmp}")
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(os.path.join(tmp, "trabajo", "demos"))
    shutil.copyfile(demo, os.path.join(tmp, "trabajo", "demos", UID + ".dem"))

    # Configuración: la de la máquina, con carpetas temporales y video chico (la prueba no mide calidad).
    cfg = json.load(open(os.path.join(RAIZ, "render", "config.json"), encoding="utf-8"))
    revisar = os.path.join(cfg["out_dir"], "prueba_c2")
    cfg.update({"work_dir": os.path.join(tmp, "trabajo"), "out_dir": os.path.join(tmp, "videos"), "drive": False})
    if not juego:
        cfg.update({"client_dir": os.path.join(tmp, "cliente"), "height": 180, "width": 320})
        os.makedirs(os.path.join(tmp, "cliente", "cstrike"))
    cfg_path = os.path.join(tmp, "config.json")
    json.dump(cfg, open(cfg_path, "w", encoding="utf-8"))
    anon = json.loads(subprocess.run("pnpm exec supabase status -o json", shell=True, cwd=os.path.join(RAIZ, "web", "backend"),
                                     capture_output=True, text=True).stdout)["ANON_KEY"]
    os.environ.update({"RENDER_SUPABASE_URL": "http://127.0.0.1:54321", "RENDER_SUPABASE_KEY": anon,
                       "RENDER_WORKER_TOKEN": TOKEN})

    # La partida en la base local: los 3k y 4k de la demo como los mandaría el plugin, un clutch y un jugador que
    # no está en la demo.
    d = leer_demo.Demo(demo).parse()
    rounds = leer_demo.rounds(d)
    clips = leer_demo.clips(rounds)
    if juego:
        clips = [c for c in clips if c["round"] == 10 or c["kill_ticks"] == [234981, 235042, 235201, 237919]]
    filas = [f"({c['round']}, '{steam64(c['steamid'])}', $${c['name']}$$, true, "
             f"'{{{','.join(str(t - DESFASE) for t in c['kill_ticks'])}}}'::integer[], null, null, null)" for c in clips]
    r5 = rounds[4]
    filas.append(f"(105, '{steam64(r5['kills'][-1]['attacker_steamid'])}', $${r5['kills'][-1]['attacker']}$$, true, '{{}}', 1, "
                 f"{r5['kills'][-2]['tick'] - DESFASE}, {r5['end']['tick'] - DESFASE})")
    filas.append("(106, '76561190000000001', 'NoEsta', true, '{1000,1100,1200}', null, null, null)")
    sql(f"""
      delete from matches where id = '{MATCH}';
      delete from render_workers where name = 'render-local';
      insert into render_workers(name, token_hash) values ('render-local', encode(sha256(convert_to('{TOKEN}', 'UTF8')), 'hex'));
      update clip_config set per_player = 10, per_match = 50 where id = 1;
      insert into matches(id, kind, status, map, score1, score2, winner_side, played_at, external_id, tickrate,
                          demo_status, demo_key, demo_size)
      values ('{MATCH}', 'mix', 'finished', 'de_tuscan', 19, 16, 1, now() - interval '400 days', '{UID}', 101,
              'uploaded', 'demos/2026/10/{UID}.dem', {os.path.getsize(demo)});
      insert into match_clips(match_id, round, player_steamid, player_name, round_won, kill_ticks, clutch_vs,
                              clutch_start_tick, end_tick)
      select '{MATCH}', * from (values {', '.join(filas)}) v;
    """)
    total = int(sql(f"select count(*) from match_clip_list where match_id = '{MATCH}'"))
    ok(total == len(clips) + 2, f"partida de prueba con {total} jugadas visibles")

    # 1. Corrida con el juego simulado (o el de verdad, con --juego: los .mp4 se copian para mirarlos).
    if juego:
        if not render_clip.is_admin():
            raise SystemExit("--juego: abre la terminal como administrador (el launcher de ClientMod lo es)")
        os.makedirs(revisar, exist_ok=True)
        encode = render_clip.encode

        def encode_y_copiar(cfg_, prefixes, segs, tick_interval, out):
            encode(cfg_, prefixes, segs, tick_interval, out)
            shutil.copyfile(out, os.path.join(revisar, os.path.basename(out)))

        render_clip.encode = encode_y_copiar
    else:
        render_clip.is_admin = lambda: True
        render_clip.record_session = fake_record
    sys.argv = ["procesar.py", "--config", cfg_path, "--max-partidas", "1", "--sin-diario"]
    t0 = time.time()
    procesar.main()
    print(f"   (corrida: {time.time() - t0:.0f} s)")

    estados = dict(l.split("|") for l in sql(
        f"select coalesce(video_status, 'null'), count(*) from match_clips where match_id = '{MATCH}' group by 1").splitlines())
    ok(estados.get("done") == str(len(clips) + 1), f"{estados.get('done')} jugadas con video (los {len(clips)} multikills y el clutch)")
    ok(estados.get("skipped") == "1" and "aparece" in sql(
        f"select video_error from match_clips where match_id = '{MATCH}' and round = 106"), "el jugador que no está en la demo: skipped")
    ok(not os.path.exists(os.path.join(tmp, "trabajo", "demos", UID + ".dem")), "la demo se borró (no quedan reintentos)")
    ok(not glob.glob(os.path.join(tmp, "videos", "*.mp4")), "los .mp4 locales se borraron")

    r2 = r2mod.R2(r2mod.load_env(os.path.join(RAIZ, ".env")))
    filas = [l.split("|") for l in sql(f"select id, video_key, video_bytes, video_seconds, round from match_clips "
                                       f"where match_id = '{MATCH}' and video_status = 'done' order by round").splitlines()]
    en_r2 = all(r2.head(k) == (200, int(b)) for _, k, b, _, _ in filas)
    ok(en_r2, f"los {len(filas)} videos están en R2 con el tamaño anotado")
    lukas = next(f for f in filas if f[4] == "26")
    ok(abs(float(lukas[3]) - (725 + 505) / 101) < 0.05, f"4k de Lukas: {lukas[3]} s (dos tramos de 7,2 y 5,0 s)")
    if juego:
        print(f"   Videos para mirar en {revisar}:")
        for f in filas:
            print(f"     ronda {f[4]}: {f[0]}.mp4 ({float(f[3]):.1f} s, {int(f[2]) / 1e6:.1f} MB)")

    # 2. Archivo de los 15 días: dos videos "viejos", uno con Drive y otro sin.
    a, b = filas[0][0], filas[1][0]
    sql(f"update match_clips set video_rendered_at = now() - interval '16 days' where id in ('{a}', '{b}');"
        f"update match_clips set video_drive_id = '1PruebaDriveLocal' where id = '{a}';")
    procesar.daily(render_clip.load_config(cfg_path), procesar.Api(procesar.load_env(os.path.join(RAIZ, ".env"))), r2, None)
    ok(r2.head(filas[0][1])[0] == 404 and r2.head(filas[1][1])[0] == 200, "archivo: borra de R2 solo el que está en Drive")
    ok(sql(f"select video_r2_deleted_at is not null from match_clips where id = '{a}'") == "t", "archivo: lo marca")

    # 3. Papelera: se borra la partida; sus videos van a la papelera y la tarea del día los borra de R2.
    os.remove(os.path.join(tmp, "trabajo", "estado.json"))
    sql(f"delete from matches where id = '{MATCH}'")
    procesar.daily(render_clip.load_config(cfg_path), procesar.Api(procesar.load_env(os.path.join(RAIZ, ".env"))), r2, None)
    ok(all(r2.head(k)[0] == 404 for _, k, _, _, _ in filas), "papelera: ningún video de prueba queda en R2")
    ok(sql("select count(*) from clip_video_trash where video_drive_id is null") == "0",
       "papelera: vacía (salvo lo de Drive, que espera a que Drive esté configurado)")

    sql("delete from clip_video_trash; delete from render_workers where name = 'render-local';"
        "update clip_config set per_player = 2, per_match = 10 where id = 1;")
    shutil.rmtree(tmp, ignore_errors=True)
    print("Todo OK" if not fallas else f"{fallas} FALLAS")
    sys.exit(1 if fallas else 0)


if __name__ == "__main__":
    main()
