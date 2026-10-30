"""Compara, tramo por tramo, la kill que mira el control de "pasó de largo" antes y después del cambio.

Uso (desde la raíz del repo): python docs/bitacora/2026-10-30-render-kill-cerca-del-salto/pruebas/comparar_salto.py
    <demo.dem> <clips.json>
clips.json: las filas de match_clips de la partida (id, round, player_name, player_steamid, kill_ticks,
clutch_start_tick, end_tick), como json_agg. Sin el juego: solo lee la demo."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "render"))
import leer_demo  # noqa: E402
import procesar  # noqa: E402
import render_clip  # noqa: E402

demo, clips = sys.argv[1], json.load(open(sys.argv[2], encoding="utf-8"))
d = leer_demo.Demo(demo).parse()
rounds = leer_demo.rounds(d)
offset = procesar.tick_offset(d, rounds, clips)
seg_cfg = {"pre_seconds": 3, "post_seconds": 2, "split_gap_seconds": 8}
jobs = [procesar.build_job(d, rounds, c, offset, seg_cfg) for c in clips]
lead = round(0.5 / d.tick_interval)
slack = round(render_clip.SEEK_SLACK_SECONDS / d.tick_interval)
passes = render_clip.plan_passes(jobs, lead, round(15 / d.tick_interval))
kills = [k for r in rounds for k in r["kills"] if not k["suicide"]]
first = lambda t: next((k for k in kills if k["tick"] >= t), None)  # noqa: E731
line = lambda k: f"{k['tick']} {k['attacker']} killed {k['victim']}" if k else "-"  # noqa: E731
print(f"desfase {offset}, {len(passes)} pasadas")
for n, plan in enumerate(passes, 1):
    for j0, (t0, t1), job, i in plan:
        old, new = first(j0), first(j0 + lead + slack)
        mark = "" if old is new else "   <- cambia"
        print(f"p{n} {job['key']} tramo {i} j0 {j0}: antes {line(old)} ({(old['tick'] - j0) / 100 if old else '-'} s)"
              f" | ahora {line(new)}{mark}")
