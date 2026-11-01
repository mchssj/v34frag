"""Arma, sin el juego, los pasos de consola de cada tramo de una partida (como record_session, sin reintentos) y
revisa cómo los reparte console_lines.

Uso (desde la raíz del repo): python docs/bitacora/2026-10-30-render-linea-consola-larga/pruebas/lineas_consola.py
    <demo.dem> <clips.json>
clips.json: las filas de match_clips de la partida, como json_agg (ver clips_dust2.json)."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "render"))
import leer_demo  # noqa: E402
import procesar  # noqa: E402
import render_clip as rc  # noqa: E402

demo, clips = sys.argv[1], json.load(open(sys.argv[2], encoding="utf-8"))
d = leer_demo.Demo(demo).parse()
rounds = leer_demo.rounds(d)
offset = procesar.tick_offset(d, rounds, clips)
jobs = [procesar.build_job(d, rounds, c, offset, {"pre_seconds": 3, "post_seconds": 2, "split_gap_seconds": 8})
        for c in clips]
lead = round(0.5 / d.tick_interval)
passes = rc.plan_passes(jobs, lead, round(15 / d.tick_interval))
errors, split = [], 0
for n_pass, plan in enumerate(passes, 1):
    n = 0
    for j0, (t0, t1), job, i in plan:
        spec = rc.spec_target(d, job["steamid"], j0) + ["spec_mode 3", "hidepanel specmenu", "hidepanel specgui",
                                                         "hidepanel overview", "overview_mode 0", "hud_saytext_time 0"]
        steps = [["demo_pause", f"demo_gototick {j0}"] + spec + ["hideconsole", "gameui_hide"],
                 spec + ["hideconsole", "gameui_hide", f"startmovie cmleague/cuadros/{job['key']}_{i}_", "demo_resume"],
                 ["demo_pause", "endmovie", "hideconsole", "gameui_hide"]]
        for cmds in steps:
            before = len(rc.console_line(cmds, n + 1))
            lines = rc.console_lines(cmds, n + 1)
            if len(lines) == 1 and lines[0] != cmds:
                errors.append(f"un paso que cabía cambió: {cmds}")
            kept = [c for line in lines for c in line]
            for k, line in enumerate(lines):
                n += 1
                size = len(rc.console_line(line, n))
                if size > rc.CONSOLE_MAX:
                    errors.append(f"línea de {size}: {line}")
                if "hideconsole" not in line:
                    errors.append(f"línea sin hideconsole: {line}")
                if line[0].startswith("spec_next") or (line[0] == "hideconsole" and line[1:2] and
                                                       line[1].startswith("spec_next")):
                    errors.append(f"spec_next separado de su spec_player: {line}")
            # Los comandos originales, en el mismo orden (sin contar los hideconsole, que se agregan al partir).
            if [c for c in kept if c != "hideconsole"] != [c for c in cmds if c != "hideconsole"]:
                errors.append(f"cambió el orden o faltan comandos: {cmds} -> {lines}")
            # Pares que no se pueden separar: startmovie con demo_resume y demo_pause con demo_gototick.
            for line in lines:
                for first, second in (("startmovie", "demo_resume"), ("demo_pause", "demo_gototick")):
                    if any(c.startswith(second) for c in line) != any(c.startswith(first) for c in line)                             and any(c.startswith(first) for c in cmds) and any(c.startswith(second) for c in cmds):
                        errors.append(f"{first} y {second} quedaron en líneas distintas: {lines}")
            if len(lines) > 1:
                split += 1
                print(f"pasada {n_pass}, {job['key']} tramo {i}: un paso de {before} en {len(lines)} líneas:")
                for k, line in enumerate(lines):
                    print(f"   {len(rc.console_line(line, n - len(lines) + 1 + k))}: {line}")
print(f"{len(passes)} pasadas, {split} pasos partidos, {len(errors)} errores")
for e in errors:
    print("ERROR", e)
sys.exit(1 if errors else 0)
