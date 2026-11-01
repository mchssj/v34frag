"""Muestra cómo grabaría procesar.py unas jugadas: tramos, comandos de cámara y quién está vivo en cada salto.

Uso:  python -X utf8 analizar_jugadas.py <demo.dem> <jugadas.jsonl>

jugadas.jsonl: una fila de match_clips por línea, como la da
  psql -At -c "select to_json(c) from match_clips c where id in (...)"
más "player_name" (el nombre de la jugada en match_clip_list).
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "render"))
import leer_demo  # noqa: E402
import procesar  # noqa: E402
import render_clip  # noqa: E402

d = leer_demo.Demo(sys.argv[1]).parse()
rs = leer_demo.rounds(d)
cfg = {"pre_seconds": 3, "post_seconds": 2, "split_gap_seconds": 8}
clips = [json.loads(line) for line in open(sys.argv[2], encoding="utf-8")]
print(d.header["map"], d.header["playback_ticks"], "ticks,", len(rs), "rondas, errores de lectura:", len(d.errors))
off = procesar.tick_offset(d, rs, clips)
print("desfase", off)
for c in clips:
    j = procesar.build_job(d, rs, c, off, cfg)
    sid, t0 = j["steamid"], j["segs"][0][0]
    print(f"\n{c['id'][:8]} ronda {c['round']}: {j['player']!r} ({sid}) tramos {j['segs']}")
    print("  cámara:", render_clip.spec_target(d, sid, t0))
    for s in sorted(leer_demo.alive_at(d, t0), key=lambda s: d.slot_at(s, t0) or 0):
        print(f"  vivo: {d.slot_at(s, t0):>2} {d.name_at(s, t0)!r}")
