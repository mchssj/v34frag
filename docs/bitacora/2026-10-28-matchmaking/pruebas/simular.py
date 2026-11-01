#!/usr/bin/env python3
"""Simula en local cada situación del matchmaking contra una cuenta real de la web. Solo base local.

Uso: python simular.py <paso>      (la API en :8788 y el worker tienen que estar corriendo)

  preparar     crea 9 jugadores de prueba y un servidor falso (se hace solo la primera vez)
  pop          los 9 entran a la cola y aceptan: con vos en la cola, salta "Partida encontrada"
  rechazo      los 9 entran, uno rechaza: la sala se cancela y volvés a la cola
  nadie        los 9 entran y no aceptan: vence el plazo
  veto         los capitanes de prueba banean hasta que te toque o quede un mapa
  conectar     el servidor toma la sala y entran todos (podés pasar "faltan" para dejarte afuera)
  vivo         arranca la partida
  meVoy        te desconectás: aparece el aviso con la cuenta regresiva
  vuelvo       volvés a tiempo
  abandono     vence tu plazo: quedás como abandono y con sanción
  otroSeVa     se desconecta otro jugador
  ganar        termina la partida y gana tu equipo
  perder       termina la partida y pierde tu equipo
  cancelar     el servidor cancela la partida
  invitar      un jugador de prueba te invita a su grupo
  sancion      te pone una sanción de la escala
  exclusion    te excluye del matchmaking por un día
  limpiar      cancela salas, vacía la cola y saca sanciones y exclusiones
  borrar       limpiar, y además borra jugadores y servidor de prueba
"""
import hashlib, json, os, random, secrets, subprocess, sys, tempfile, time, urllib.error, urllib.request

API = os.environ.get("SIM_API", "http://127.0.0.1:8788")
AUTH = "http://127.0.0.1:54321/auth/v1"
DB = ["docker", "exec", "-i", "supabase_db_v34frag-api", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-tA"]
STATE = os.path.join(tempfile.gettempdir(), "mm_simular.json")
SERVER = "00000000-0000-4000-8000-0000000000bb"
STEAM_BASE = 76561199900000000


def sql(text):
    r = subprocess.run(DB, input=text.encode(), capture_output=True)
    if r.returncode:
        raise SystemExit("Error de base: " + r.stderr.decode(errors="replace")[-400:])
    return r.stdout.decode(errors="replace").strip()


def http(method, url, body=None, token=None, key=None):
    h = {"Content-Type": "application/json"}
    if token: h["Authorization"] = "Bearer " + token
    if key: h["apikey"] = key
    req = urllib.request.Request(url, method=method, headers=h, data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")[:300]


def envkey(name):
    return subprocess.run(["docker", "exec", "supabase_storage_v34frag-api", "printenv", name], capture_output=True).stdout.decode().strip()


def me():
    """La cuenta real: la última que inició sesión fuera de las de prueba, o SIM_ME (un correo)."""
    who = os.environ.get("SIM_ME")
    cond = f"u.email = '{who}'" if who else "u.email not like '%@test.local'"
    r = sql(f"select u.id, p.steam_id, csstv_steam2(p.steam_id) from auth.users u join players p on p.user_id = u.id where {cond} order by u.last_sign_in_at desc nulls last limit 1")
    if not r: raise SystemExit("No encontré una cuenta con ficha de jugador.")
    return r.split("|")


def load():
    if not os.path.exists(STATE) or not sql(f"select 1 from game_servers where id = '{SERVER}'"):
        preparar()
    return json.load(open(STATE))


def preparar():
    anon, service = envkey("ANON_KEY"), envkey("SERVICE_KEY")
    uid = me()[0]
    elo = int(sql(f"select coalesce(mm_player_elo((select id from players where user_id = '{uid}')), 1000)") or 1000)
    pw, token = secrets.token_hex(12), secrets.token_hex(24)
    sql(f"""update mm_config set open = true, min_mixes = 0, min_account_days = 0, require_anticheat = false;
insert into game_servers (id, name, token_hash, active, mm_enabled, connect_address)
  values ('{SERVER}', 'Servidor simulado', encode(sha256(convert_to('{token}', 'UTF8')), 'hex'), true, true, '127.0.0.1:27016')
  on conflict (id) do update set token_hash = excluded.token_hash;
insert into mm_server_state (server_id, last_poll_at) values ('{SERVER}', now() + interval '7 days')
  on conflict (server_id) do update set last_poll_at = excluded.last_poll_at, unavailable_until = null;""")
    users = []
    for i in range(9):
        email = f"mmsim{i}@test.local"
        steam = str(STEAM_BASE + i)
        s, r = http("POST", AUTH + "/admin/users", {"email": email, "password": pw, "email_confirm": True}, token=service, key=service)
        if s not in (200, 201):
            u = sql(f"select id from auth.users where email = '{email}'")
            if not u: raise SystemExit(f"No pude crear {email}: {r}")
            http("PUT", f"{AUTH}/admin/users/{u}", {"password": pw}, token=service, key=service)
        else:
            u = r["id"]
        sql(f"""insert into players (nick, user_id, steam_id) select 'sim{i}', '{u}', '{steam}' where not exists (select 1 from players where user_id = '{u}');
insert into player_elo (steam_id, elo, peak_elo) values ('{steam}', {elo + (i - 4) * 10}, {elo}) on conflict (steam_id) do update set elo = excluded.elo;""")
        users.append({"email": email, "uid": u, "steam": steam})
    json.dump({"anon": anon, "pw": pw, "token": token, "users": users}, open(STATE, "w"))
    print("Listo: 9 jugadores de prueba y un servidor simulado.")


def tok(d, u):
    s, t = http("POST", AUTH + "/token?grant_type=password", {"email": u["email"], "password": d["pw"]}, key=d["anon"])
    if s != 200: raise SystemExit(f"No pude entrar con {u['email']}: {t}")
    return t["access_token"]


def lobby():
    r = sql("""select l.id, l.status, l.match_id, l.veto_turn from mm_lobbies l where l.status not in ('finished', 'cancelled') order by l.created_at desc limit 1""")
    return r.split("|") if r else [None] * 4


def wait(status, secs=15):
    for _ in range(secs):
        l = lobby()
        if l[1] in status: return l
        time.sleep(1)
    return lobby()


def enter(d):
    for u in d["users"]:
        s, r = http("POST", API + "/api/v1/mm/queue", {"mode": "5v5", "region": None}, token=tok(d, u))
        if s != 200: print(" ", u["email"], s, str(r)[:120])
    print("En cola:", sql("select count(*) from mm_queue"))


def pop(d, accept=True, decline=False):
    enter(d)
    uid = me()[0]
    if not sql(f"select 1 from mm_queue where user_id = '{uid}'") and not lobby()[0]:
        print("Vos todavía no estás en la cola. Tocá Buscar partida: tenés 2 minutos.")
    l = wait(("accepting",), 120)
    if l[1] != "accepting":
        return print("No se armó la sala.", l[1])
    print("¡Sala armada! Mirá la web.")
    if decline:
        time.sleep(4)
        print("rechazar:", http("POST", API + "/api/v1/mm/lobby/decline", token=tok(d, d["users"][0]))[0])
    elif accept:
        for u in d["users"]:
            http("POST", API + "/api/v1/mm/lobby/accept", token=tok(d, u))
            time.sleep(0.4)
        print("Aceptaron los 9. Falta que aceptes vos, o vence el plazo.")


def veto(d):
    by = {u["uid"]: u for u in d["users"]}
    for _ in range(12):
        l = lobby()
        if l[1] != "veto": return print("Veto terminado. Estado:", l[1])
        cap = sql(f"select user_id from mm_lobby_players where lobby_id = '{l[0]}' and is_captain and team = {l[3]}")
        if cap not in by:
            return print("Te toca banear a vos: elegí un mapa en la web (tenés el tiempo del veto) y volvé a correr este paso.")
        m = sql(f"""select mm.map from mm_mode_maps mm join mm_lobbies x on x.id = '{l[0]}' and x.mode = mm.mode
                     where not exists (select 1 from match_vetos v where v.match_id = x.match_id and v.map = mm.map) order by random() limit 1""")
        print(" banean", m, http("POST", f"{API}/api/v1/matches/{l[2]}/veto", {"map": m}, token=tok(d, by[cap]))[0])
        time.sleep(1.5)


def report(d, event, data=None):
    l = lobby()
    if not l[0]: raise SystemExit("No hay sala activa.")
    arg = f"'{data}'" if data else "null"
    r = sql(f"select csstv_mm_report('{d['token']}', '{l[0]}', '{event}', {arg})")
    return r


def conectar(d, faltan=False):
    l = wait(("assigned", "connecting"), 20)
    if l[1] not in ("assigned", "connecting"): return print("La sala no está asignada; estado:", l[1], "(¿falta el veto?)")
    if l[1] == "assigned": report(d, "taken")
    uid, _, steam2 = me()
    for u in d["users"]:
        report(d, "connected", sql(f"select csstv_steam2('{u['steam']}')"))
    if faltan:
        return print("Conectados todos menos vos. Si vence el plazo, se cancela y te sanciona.")
    report(d, "connected", steam2)
    print("Conectados los 10. Sigue: vivo")


def finish(d, won):
    l = lobby()
    if l[1] != "live": return print("La partida no está en vivo; estado:", l[1])
    uid = me()[0]
    team = int(sql(f"select team from mm_lobby_players where lobby_id = '{l[0]}' and user_id = '{uid}'"))
    winner = team if won else 3 - team
    s1, s2 = (16, 9) if winner == 1 else (9, 16)
    uidg = "sim-" + secrets.token_hex(4)
    gid = sql(f"""insert into matches (kind, status, score1, score2, map, played_at, server_id, side1_name, side2_name, winner_side, external_id)
  select 'mix', 'finished', {s1}, {s2}, l.map, now(), l.server_id, 'A', 'B', {winner}, '{uidg}' from mm_lobbies l where l.id = '{l[0]}' returning id""").splitlines()[0]
    rows = sql(f"select lp.player_id, p.steam_id, p.nick, lp.team from mm_lobby_players lp join players p on p.id = lp.player_id where lp.lobby_id = '{l[0]}'").splitlines()
    vals = []
    for r in rows:
        pid, steam, nick, t = r.split("|")
        k, dd = random.randint(8, 26), random.randint(8, 22)
        vals.append(f"('{gid}', '{steam}', {t}, {k}, {dd}, {random.randint(1, 8)}, {random.randint(2, k)}, {k * 90}, '{pid}', '{nick}', {s1 + s2}, "
                    f"{k // 5}, 1, 0, 0, {random.randint(0, 4)}, {random.randint(0, 4)}, {random.randint(0, 3)}, {random.randint(0, 2)}, {round(0.6 + k / 25, 2)})")
    sql("insert into match_player_stats (match_id, steam_id, team, kills, deaths, assists, headshots, damage, player_id, nick, rounds, k2, k3, k4, k5, first_kills, first_deaths, plants, defuses, rating) values " + ",".join(vals))
    sql(f"select csstv_link_game('{gid}', (select link_code from matches where id = '{l[2]}'), 1); select elo_apply_match('{gid}');")
    print(("Ganó" if won else "Perdió"), "tu equipo", f"{s1}-{s2}. Estado:", sql(f"select status from mm_lobbies where id = '{l[0]}'"))


def limpiar():
    uid = me()[0]
    sql(f"""select mm_cancel_lobby(id, 'Simulación limpiada') from mm_lobbies where status not in ('finished', 'cancelled');
delete from mm_queue; delete from mm_party_invites; delete from mm_party_members; delete from mm_parties;
delete from mm_penalties where user_id = '{uid}' or user_id in (select id from auth.users where email like 'mmsim%@test.local');
delete from mm_penalty_log where user_id = '{uid}'; delete from mm_bans where user_id = '{uid}';""")
    print("Limpio: sin salas, cola, grupos ni sanciones.")


def borrar():
    limpiar()
    sql(f"""delete from match_player_stats where match_id in (select id from matches where server_id = '{SERVER}');
delete from matches where server_id = '{SERVER}';
delete from player_elo where steam_id in (select steam_id from players where user_id in (select id from auth.users where email like 'mmsim%@test.local'));
delete from game_servers where id = '{SERVER}';
delete from players where user_id in (select id from auth.users where email like 'mmsim%@test.local');
delete from auth.users where email like 'mmsim%@test.local';""")
    if os.path.exists(STATE): os.remove(STATE)
    print("Borrados los jugadores y el servidor de prueba. Tu ELO local puede haber cambiado por las partidas simuladas.")


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        return print(__doc__)
    a = sys.argv[1]
    if a == "preparar": return preparar()
    if a == "limpiar": return limpiar()
    if a == "borrar": return borrar()
    d = load()
    uid, steam, steam2 = me()
    if a == "pop": pop(d)
    elif a == "rechazo": pop(d, decline=True)
    elif a == "nadie": pop(d, accept=False)
    elif a == "veto": veto(d)
    elif a == "conectar": conectar(d, len(sys.argv) > 2 and sys.argv[2] == "faltan")
    elif a == "vivo": print(report(d, "live"), lobby()[1])
    elif a == "meVoy": print(report(d, "left", steam2), "Mirá el aviso en toda la web.")
    elif a == "vuelvo": print(report(d, "back", steam2))
    elif a == "abandono":
        report(d, "left", steam2)
        sql(f"update mm_lobby_players set left_at = now() - interval '1 hour' where user_id = '{uid}' and lobby_id = '{lobby()[0]}'")
        time.sleep(4); print("Abandono:", sql(f"select abandoned from mm_lobby_players where user_id = '{uid}' and lobby_id = '{lobby()[0]}'"))
    elif a == "otroSeVa": print(report(d, "left", sql(f"select csstv_steam2('{d['users'][0]['steam']}')")))
    elif a == "ganar": finish(d, True)
    elif a == "perder": finish(d, False)
    elif a == "cancelar": print(report(d, "abort", "El servidor canceló la partida"))
    elif a == "invitar":
        pid = sql(f"select id from players where user_id = '{uid}'")
        print(http("POST", API + "/api/v1/mm/party/invites", {"player_id": pid}, token=tok(d, d["users"][0]))[0])
    elif a == "sancion": print(sql(f"select mm_penalize('{uid}', 'Sanción simulada'); select until from mm_penalties where user_id = '{uid}'"))
    elif a == "exclusion": print(sql(f"insert into mm_bans (user_id, until, reason) values ('{uid}', now() + interval '1 day', 'Exclusión simulada') returning until"))
    else: print(__doc__)


if __name__ == "__main__":
    main()
