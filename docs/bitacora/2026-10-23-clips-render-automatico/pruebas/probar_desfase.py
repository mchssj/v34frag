"""Prueba sin el juego de la parte de procesar.py que ubica las jugadas en la demo.

Arma jugadas como las mandaría el plugin a partir de una demo real (los 3k y 4k que encuentra leer_demo, con los
ticks corridos un desfase conocido y un tick de ruido, el SteamID en formato 64 y un clutch sin kills) y comprueba
que procesar.py recupera el desfase, los ticks exactos del .dem, el nombre del jugador y los tramos.

Uso:  python -I probar_desfase.py <demo.dem> [desfase]
"""
import os
import sys

RENDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "render")
sys.path.insert(0, os.path.abspath(RENDER))
import leer_demo  # noqa: E402
import procesar  # noqa: E402

fallas = 0


def ok(cond, msg):
    global fallas
    print(("OK: " if cond else "FALLA: ") + msg)
    fallas += not cond


def steam64(sid):
    _, y, z = sid.split(":")
    return str(procesar.STEAM64_BASE + int(z) * 2 + int(y))


demo, desfase = sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 237
d = leer_demo.Demo(demo).parse()
rounds = leer_demo.rounds(d)
reales = leer_demo.clips(rounds)
clips = []
for i, c in enumerate(reales):
    ruido = [(-1, 0, 1)[(i + j) % 3] for j in range(len(c["kill_ticks"]))]
    clips.append({"id": f"{i:08d}-0000-4000-8000-000000000000", "player_steamid": steam64(c["steamid"]),
                  "player_name": c["name"], "kill_ticks": [t - desfase + r for t, r in zip(c["kill_ticks"], ruido)],
                  "clutch_start_tick": None, "end_tick": None, "_real": c})
# Un clutch sin kills en la ronda 5: el del último que mata, desde la muerte anterior hasta el fin de la ronda
# (el inicio es una muerte y el fin, un round_end: con eso solo también sale el desfase).
r5 = rounds[4]
victima = r5["kills"][-1]
victima = {"victim_steamid": victima["attacker_steamid"], "victim": victima["attacker"]}
inicio = r5["kills"][-2]["tick"]
clutch = {"id": "99999999-0000-4000-8000-000000000000", "player_steamid": steam64(victima["victim_steamid"]),
          "player_name": victima["victim"], "kill_ticks": [], "clutch_start_tick": inicio - desfase,
          "end_tick": r5["end"]["tick"] - desfase}

ok(procesar.tick_offset(d, rounds, clips + [clutch]) == desfase, f"desfase recuperado ({desfase})")
ok(procesar.tick_offset(d, rounds, [clutch]) == desfase, "desfase solo con el fin de ronda de un clutch")
ok(procesar.tick_offset(d, rounds, []) is None, "sin jugadas: sin desfase")

seg_cfg = {"pre_seconds": 3, "post_seconds": 2, "split_gap_seconds": 8}
iguales = True
for c in clips:
    j = procesar.build_job(d, rounds, c, desfase, seg_cfg)
    real = c["_real"]
    iguales &= procesar.clip_events(d, rounds, c, desfase) == real["kill_ticks"] and j["player"] == real["name"]
ok(iguales, f"{len(clips)} jugadas: ticks exactos del .dem y nombre de la demo")

lukas = next(c for c in clips if c["_real"]["kill_ticks"] == [234981, 235042, 235201, 237919])
j = procesar.build_job(d, rounds, lukas, desfase, seg_cfg)
ok(j["segs"] == [(234981 - 303, 235201 + 202), (237919 - 303, 237919 + 202)], f"4k de Lukas: dos tramos {j['segs']}")

j = procesar.build_job(d, rounds, clutch, desfase, seg_cfg)
ok(procesar.clip_events(d, rounds, clutch, desfase) == [inicio, r5["end"]["tick"]],
   "clutch: del inicio al fin de la ronda")
ok(j["player"] == victima["victim"], f"clutch: nombre {j['player']}")

ok(procesar.account_id("STEAM_0:1:5") == 11 and procesar.account_id(str(procesar.STEAM64_BASE + 11)) == 11,
   "STEAM_0:1:5 y su SteamID64 son la misma cuenta")
ok(procesar.account_id("BOT:Gary") is None and procesar.account_id("") is None, "bot y vacío: sin cuenta")

bot = {"id": "x", "player_steamid": "BOT:3", "player_name": "NoEsta", "kill_ticks": [1, 2, 3],
       "clutch_start_tick": None, "end_tick": None}
try:
    procesar.build_job(d, rounds, bot, desfase, seg_cfg)
    ok(False, "jugador que no está en la demo: skipped")
except procesar.Skip as e:
    ok("no aparece" in str(e), f"jugador que no está en la demo: skipped ({e})")
try:
    procesar.build_job(d, rounds, lukas, None, seg_cfg)
    ok(False, "sin desfase: skipped")
except procesar.Skip as e:
    ok(True, f"sin desfase: skipped ({e})")

print("Todo OK" if not fallas else f"{fallas} FALLAS")
sys.exit(1 if fallas else 0)
