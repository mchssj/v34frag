"""
Control independiente de los clips de una partida: recalcula, a partir del log del servidor
(recibido con logaddress), las kills de cada jugador por ronda y los clutches con las reglas del
plan, y lo compara con lo que guardó la base local en match_clips.

Uso:  python -I control_log.py <server.log> <match_uid>
Lee la partida de la Supabase LOCAL (docker exec … psql). Toma del log la última partida (desde
el último sm_live por RCON, con csstv_lo3 0). Sin !rr en la partida: el log no sabe qué ronda se
anuló.
"""
import json
import re
import subprocess
import sys

KILL = re.compile(r'"(.+?)<\d+><[^>]*><(TERRORIST|CT)>" killed "(.+?)<\d+><[^>]*><(TERRORIST|CT)>" with')
SUICIDE = re.compile(r'"(.+?)<\d+><[^>]*><(TERRORIST|CT)>" committed suicide')
JOINED = re.compile(r'"(.+?)<\d+><[^>]*><[^>]*>" joined team "(TERRORIST|CT)"')
WIN = re.compile(r'Team "(TERRORIST|CT)" triggered "(Terrorists_Win|CTs_Win|Target_Bombed|Bomb_Defused|Target_Saved|Hostages_Not_Rescued|All_Hostages_Rescued|VIP_Escaped|VIP_Assassinated)"')
TAG = re.compile(r'"(.+?)<\d+><[^>]*><(TERRORIST|CT)>"')


def rounds_from_log(lines):
    """Lista de rondas: {round, kills{jugador:n}, clutch{jugador:vs}, winner}."""
    # El chat de SourceMod no viaja por logaddress: la partida empieza en el último sm_live por RCON.
    # Con csstv_lo3 0 hay un solo reinicio, y la ronda que abre es la 1 en vivo.
    start = max(i for i, l in enumerate(lines) if 'command "sm_live' in l)
    # Equipo inicial de cada jugador: el de su primera aparición en la partida o, si antes aparece un
    # "joined team" (el cambio de lados del medio tiempo), el contrario de ese.
    other = {"TERRORIST": "CT", "CT": "TERRORIST"}
    team = {}
    for l in lines[start:]:
        m = JOINED.search(l)
        if m:
            team.setdefault(m.group(1), other[m.group(2)])
            continue
        for m in TAG.finditer(l):
            team.setdefault(m.group(1), m.group(2))

    out, n = [], 0
    cur = None

    def new_round():
        return {"kills": {}, "dead": set(), "clutcher": {}, "clutch": {}, "max": {"TERRORIST": 0, "CT": 0}}

    def check(r, gone):
        alive = {"TERRORIST": [], "CT": []}
        for p, t in team.items():
            if p not in r["dead"] or p == gone:
                alive[t].append(p)
        for t in alive:
            r["max"][t] = max(r["max"][t], len(alive[t]))
        if gone is not None:
            alive[team[gone]].remove(gone)
        for t, rv in (("TERRORIST", "CT"), ("CT", "TERRORIST")):
            if len(alive[t]) == 1 and len(alive[rv]) >= 1 and t not in r["clutcher"] and r["max"][t] >= 2:
                c = alive[t][0]
                r["clutcher"][t] = c
                r["clutch"][c] = min(len(alive[rv]), 5)

    for l in lines[start:]:
        m = JOINED.search(l)
        if m:
            team[m.group(1)] = m.group(2)
            continue
        if 'World triggered "Round_Start"' in l:
            cur = new_round()
            continue
        if cur is None:
            continue
        m = KILL.search(l)
        if m:
            killer, kt, victim, vt = m.groups()
            team[killer], team[victim] = kt, vt
            if kt != vt:
                cur["kills"][killer] = cur["kills"].get(killer, 0) + 1
            cur["dead"].add(victim)
            check(cur, victim)
            continue
        m = SUICIDE.search(l)
        if m:
            team[m.group(1)] = m.group(2)
            cur["dead"].add(m.group(1))
            check(cur, m.group(1))
            continue
        m = WIN.search(l)
        if m:
            n += 1
            out.append({"round": n, "kills": cur["kills"], "clutch": cur["clutch"], "winner": m.group(1), "team": dict(team)})
            cur = None
    return out


def expected(rounds):
    rows = {}
    for r in rounds:
        for p in set(r["kills"]) | set(r["clutch"]):
            k = min(r["kills"].get(p, 0), 5)
            won = r["team"][p] == r["winner"]
            vs = r["clutch"].get(p)
            if k >= 3 or (vs and won):
                rows[(r["round"], p)] = {"kills": k, "won": won, "vs": vs}
    return rows


def psql(q):
    return subprocess.run(["docker", "exec", "-i", "supabase_db_v34frag-api", "psql", "-U", "postgres", "-At", "-c", q],
                          capture_output=True, text=True, check=True).stdout


def rounds_played(uid):
    """Rondas de la partida (lo que viene después en el log es el calentamiento)."""
    return int(psql("select score1 + score2 from matches where external_id = '%s'" % uid.replace("'", "")))


def from_db(uid):
    q = ("select coalesce(json_agg(json_build_object('round', c.round, 'name', c.player_name, 'kills', cardinality(c.kill_ticks),"
         " 'won', c.round_won, 'vs', c.clutch_vs, 'ticks', c.kill_ticks, 'start', c.clutch_start_tick, 'end', c.end_tick)), '[]')"
         " from match_clips c join matches m on m.id = c.match_id where m.external_id = '%s'" % uid.replace("'", ""))
    raw = psql(q)
    return {(c["round"], c["name"]): c for c in json.loads(raw)}


def main():
    lines = open(sys.argv[1], encoding="utf-8", errors="replace").read().splitlines()
    total = rounds_played(sys.argv[2])
    exp = expected([r for r in rounds_from_log(lines) if r["round"] <= total])
    got = from_db(sys.argv[2])
    fallas = 0
    for key in sorted(set(exp) | set(got)):
        e, g = exp.get(key), got.get(key)
        if e is None or g is None:
            print("FALLA ronda %d %s: log=%s base=%s" % (key[0], key[1], e, g))
            fallas += 1
            continue
        # Un clutch perdido con 3+ kills: el plugin lo manda igual (la web no lo cuenta como clutch).
        if e["kills"] != g["kills"] or e["won"] != g["won"] or (e["vs"] or None) != (g["vs"] or None):
            print("FALLA ronda %d %s: log=%s base=%s" % (key[0], key[1], e, g))
            fallas += 1
            continue
        ticks = g["ticks"]
        orden = all(a <= b for a, b in zip(ticks, ticks[1:]))
        clutch_ok = g["vs"] is None or (g["start"] is not None and g["end"] is not None and g["start"] <= g["end"])
        print("OK ronda %2d %-8s %d kills%s%s ticks=%s%s" % (
            key[0], key[1], g["kills"], (" clutch 1v%d" % g["vs"]) if g["vs"] else "", "" if g["won"] else " (perdida)",
            ticks, "" if orden and clutch_ok else "  <-- ticks fuera de orden"))
        if not (orden and clutch_ok):
            fallas += 1
    print("%d registros en la base, %d esperados por el log, %d fallas" % (len(got), len(exp), fallas))
    sys.exit(1 if fallas else 0)


if __name__ == "__main__":
    main()
