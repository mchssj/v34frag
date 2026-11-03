#!/usr/bin/env bash
# Prueba de punta a punta, con bots, de las reservas de torneo y PCW (replanteo 56, reporter 2.9.0): el servidor local
# (E:\CSS DEDICATED SERVER) contra la base LOCAL del backend (contenedor supabase_db_v34frag-api), nunca contra la real.
#
#   bash e2e_bots.sh <carpeta de la rama feat/mm-claim-en-sala>
#
# 1. Guarda una copia de la base local dentro del contenedor (/tmp/antes_e2e56.dump) y aplica la 45 y de la 48 a la 56.
# 2. Siembra un torneo BO3 y dos PCW BO1 con bots como plantel: el build de pruebas (CSSTV_DEBUG) les da un SteamID
#    falso y estable por nombre. Tienen que ser perfiles de BotProfile.db (bot_add_ct <nombre> elige el perfil; con otro
#    nombre no agrega nada): Arnold, Brett, Kurt, Kyle y Moe (Alfa); Quade, Quintin, Rip, Zach y Chad (Beta).
# 3. Arranca el servidor local con el 2.9.0 de pruebas apuntando a la base local, y un bucle que llama a mm_tick().
# 4. Torneo: iniciar, veto con reloj, toma, cfg del tipo, mapas, resultado, mapa siguiente y fin de la serie.
# 5. PCW: listos, veto, fila, arranque automático; y otra PCW con un equipo incompleto: abandono y sanción.
# 6. Al salir (también si falla): apaga el servidor, restaura su cfg, su plugin y la licencia, vacía la cola, saca las
#    cfg live_*.cfg que agregó y restaura la base desde la copia.
set -u
REPO="${1:?falta la carpeta del repo con la rama feat/mm-claim-en-sala}"
SV="/e/CSS DEDICATED SERVER/server"
CS="$SV/cstrike"
SM="$CS/addons/sourcemod"
DB=supabase_db_v34frag-api
CFG="$CS/cfg/sourcemod/csstv_reporter.cfg"
A=127.0.0.1:27098
RC="$REPO/docs/bitacora/2026-10-11-qol-servidor/pruebas/rcon.py"
TMP="$(mktemp -d)"
LOG="$SM/logs/L$(date +%Y%m%d).log"
PW=$(grep -a -m1 '^rcon_password' "$CS/cfg/server.cfg" | sed -E 's/^rcon_password *"?([^" ]*)"?.*/\1/' | tr -d '\r')
TOKEN="tok-e2e56-local"
SRV=e2e56000-0000-4000-8000-000000000001
U_ORG=e2e56000-0000-4000-8000-000000000002
U_CA=e2e56000-0000-4000-8000-000000000003
U_CB=e2e56000-0000-4000-8000-000000000004
T_A=e2e56000-0000-4000-8000-000000000011
T_B=e2e56000-0000-4000-8000-000000000012
EVT=e2e56000-0000-4000-8000-000000000021
M_T=e2e56000-0000-4000-8000-000000000031
M_P=e2e56000-0000-4000-8000-000000000032
M_P2=e2e56000-0000-4000-8000-000000000033
OK=0; FALLAS=0
ALFA="Arnold Brett Kurt Kyle Moe"; BETA="Quade Quintin Rip Zach Chad"; ALFA4="Arnold Brett Kurt Kyle"; BETA4="Quade Quintin Rip Zach"

sql() { docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -qtA "$@"; }
como() { sql -c "select set_config('request.jwt.claims', '{\"sub\":\"$1\",\"role\":\"authenticated\"}', false); $2" | tail -1; }
R() { for c in "$@"; do python "$RC" "$A" "$PW" "$c" >/dev/null 2>&1 || echo "  (rcon falló: $c)"; done; }
Q() { python "$RC" "$A" "$PW" "$1" 2>&1 | grep -a -o -E "\"$1\" = \"[^\"]*\"" | cut -d'"' -f4; }
paso() { printf '\n== %s\n' "$*"; }
ok() { OK=$((OK + 1)); echo "  OK: $*"; }
falla() { FALLAS=$((FALLAS + 1)); echo "  FALLA: $*"; }
igual() { if [ "$2" = "$3" ]; then ok "$1 ($2)"; else falla "$1: esperaba '$3' y hay '$2'"; fi; }
# esperar <descripción> <consulta que devuelve t> [segundos]
esperar() {
  local i
  for i in $(seq 1 "${3:-120}"); do
    [ "$(sql -c "$2" 2>/dev/null)" = t ] && { ok "$1 (${i} s)"; return 0; }
    sleep 1
  done
  falla "$1 (después de ${3:-120} s)"
  return 1
}
reserva() { sql -c "select $2 from match_bookings where match_id = '$1' order by created_at desc limit 1"; }

restaurar() {
  paso "Restauración"
  [ -n "${TICK:-}" ] && kill "$TICK" 2>/dev/null
  taskkill //IM srcds.exe //F >/dev/null 2>&1
  sleep 2
  cp "$TMP/rep.cfg.bak" "$CFG" 2>/dev/null
  rm -f "$SM/plugins/csstv_reporter.smx"
  [ -f "$TMP/rep.smx.bak" ] && cp "$TMP/rep.smx.bak" "$SM/plugins/csstv_reporter.smx"
  [ -f "$TMP/lic.bak" ] && cp "$TMP/lic.bak" "$SM/data/csstv/license.txt"
  rm -f "$SM"/data/csstv/queue/* "$SM/data/csstv/mm.txt" "$SM/data/csstv/mm_pw.txt" 2>/dev/null
  [ -f "$TMP/mm.txt.bak" ] && cp "$TMP/mm.txt.bak" "$SM/data/csstv/mm.txt"
  [ -f "$TMP/mm_pw.txt.bak" ] && cp "$TMP/mm_pw.txt.bak" "$SM/data/csstv/mm_pw.txt"
  for k in official pcw mm mix; do [ -f "$TMP/had_live_$k" ] || rm -f "$CS/cfg/csstv/live_$k.cfg"; done
  # Primero las inversas: las tablas nuevas dependen de las de la copia y no dejarían que pg_restore --clean las borre.
  sql -c "delete from match_vetos where by_user is null or team_id is null" >/dev/null 2>&1
  for f in 56_iniciar_torneo_pcw 55_mm_foto_jugador 54_mm_imagen_mvp 53_match_list_sin_mm 52_mm_cuentas_sin_ficha \
           51_mm_min_account_days_cero 50_mm_min_mixes_cero 49_mm_claim_en_sala 48_matchmaking 45_anticheat; do
    sql -f - < "$REPO/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/$f.sql" >/dev/null 2>&1 || echo "  (inversa $f no aplicó)"
  done
  if docker exec "$DB" sh -c 'pg_restore -U supabase_admin -d postgres --clean --if-exists --single-transaction /tmp/antes_e2e56.dump' >/dev/null 2>&1; then
    echo "  Base local restaurada: $(sql -c "select (select count(*) from matches) || ' partidas, ' || (select count(*) from auth.users) || ' cuentas, mm_config: ' || coalesce(to_regclass('public.mm_config')::text, 'no')")"
  else
    echo "  FALLA: no se pudo restaurar la base local. La copia sigue en el contenedor: /tmp/antes_e2e56.dump"
  fi
  rm -rf "$TMP"
  printf '\n== Resultado: %d comprobaciones bien, %d fallas\n' "$OK" "$FALLAS"
}
trap restaurar EXIT

paso "Preparación"
tasklist 2>/dev/null | grep -qi srcds && { echo "Hay un srcds corriendo: apagalo antes."; trap - EXIT; exit 1; }
docker exec "$DB" sh -c 'pg_dump -U supabase_admin -d postgres -Fc -f /tmp/antes_e2e56.dump' || { echo "No se pudo copiar la base."; trap - EXIT; exit 1; }
echo "  Copia de la base local en el contenedor: /tmp/antes_e2e56.dump"
ANON=$(cd "$REPO/web/backend" && pnpm exec supabase status -o env 2>/dev/null | sed -n -E 's/^ANON_KEY="?([^"]*)"?/\1/p')
[ -n "$ANON" ] || { echo "No se pudo leer la clave pública de la base local."; exit 1; }
for f in 45_anticheat 48_matchmaking 49_mm_claim_en_sala 50_mm_min_mixes_cero 51_mm_min_account_days_cero 52_mm_cuentas_sin_ficha \
         53_match_list_sin_mm 54_mm_imagen_mvp 55_mm_foto_jugador 56_iniciar_torneo_pcw; do
  sql -f - < "$REPO/supabase/replanteo/$f.sql" >/dev/null || { echo "Falló el replanteo $f"; exit 1; }
done
echo "  Replanteos 45 y 48 a 56 aplicados en la base local"

# SteamID falso de cada bot, como Stats_ClientKey con CSSTV_DEBUG (en SteamID64 para players.steam_id).
python - "$TMP/bots.sql" <<'PY'
import sys
def sid64(name):
    h = 5381
    for ch in name:
        h = ((h << 5) + h + ord(ch)) & 0x7FFFFFFF
    x, y = h & 1, 999000000 + (h >> 1) % 100000
    return 76561197960265728 + 2 * y + x
eq = {'Alfa': ['Arnold', 'Brett', 'Kurt', 'Kyle', 'Moe'], 'Beta': ['Quade', 'Quintin', 'Rip', 'Zach', 'Chad']}
rows = [f"('{n}', '{sid64(n)}', '{t}', {i})" for t, ns in eq.items() for i, n in enumerate(ns, 1)]
open(sys.argv[1] + '.sids', 'w').write(' '.join(f"{n}={sid64(n)}" for ns in eq.values() for n in ns))
open(sys.argv[1], 'w').write('create temp table bots (nick text, sid text, eq text, n int);\ninsert into bots values ' + ', '.join(rows) + ';\n')
PY
sid() { tr ' ' '
' < "$TMP/bots.sql.sids" | sed -n "s/^$1=//p"; }
SID_A4="'$(sid Arnold)', '$(sid Brett)', '$(sid Kurt)', '$(sid Kyle)'"
SID_B4="'$(sid Quade)', '$(sid Quintin)', '$(sid Rip)', '$(sid Zach)'"
sql >/dev/null <<SQL
$(cat "$TMP/bots.sql")
insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
  select x, x || '@e2e.local', now(), now() - interval '30 days', 'authenticated', 'authenticated' from unnest(array['$U_ORG', '$U_CA', '$U_CB']::uuid[]) x;
update profiles set role = 'organizer' where id = '$U_ORG';
insert into players (nick, steam_id, user_id)
  select b.nick, b.sid, case when b.n = 1 and b.eq = 'Alfa' then '$U_CA'::uuid when b.n = 1 then '$U_CB'::uuid end from bots b;
insert into teams (id, name, tag, owner_id, captain_id, kind) values
  ('$T_A', 'Alfa E2E', 'ALF', '$U_CA', '$U_CA', 'official'), ('$T_B', 'Beta E2E', 'BET', '$U_CB', '$U_CB', 'official');
insert into team_members (team_id, player_id) select case when b.eq = 'Alfa' then '$T_A'::uuid else '$T_B'::uuid end, p.id
  from players p join bots b on b.sid = p.steam_id;
insert into map_pool (name, versions, active, position, veto_default)
  select m, array[m], true, 990, false from unnest(array['de_dust2', 'de_nuke', 'de_train', 'de_cbble', 'de_aztec']) m on conflict (name) do nothing;
insert into events (id, name, organizer_id, status, map_pool, veto_turn_seconds)
  values ('$EVT', 'Copa E2E', '$U_ORG', 'in_progress', array['de_dust2', 'de_nuke', 'de_train', 'de_cbble', 'de_aztec'], 15);
insert into tournament_registration_players (event_id, team_id, player_id) select '$EVT', tm.team_id, tm.player_id from team_members tm where tm.team_id in ('$T_A', '$T_B');
insert into matches (id, event_id, kind, status, best_of, team1, team2, link_code) values ('$M_T', '$EVT', 'official', 'upcoming', 3, '$T_A', '$T_B', 'E2ET5');
insert into game_servers (id, name, token_hash, active, official_enabled, pcw_enabled, connect_address, region)
  values ('$SRV', 'E2E local', encode(sha256(convert_to('$TOKEN', 'UTF8')), 'hex'), true, true, true, '127.0.0.1:27098', 'Sudamerica');
SQL
igual "semilla: 10 bots en los dos planteles del torneo" "$(sql -c "select count(*) from tournament_registration_players where event_id = '$EVT'")" 10

# Plugin de pruebas y cfg del servidor local (se restauran al salir).
cp "$CFG" "$TMP/rep.cfg.bak"
cp "$SM/plugins/csstv_reporter.smx" "$TMP/rep.smx.bak" 2>/dev/null
cp "$SM/data/csstv/license.txt" "$TMP/lic.bak" 2>/dev/null
cp "$SM/data/csstv/mm.txt" "$TMP/mm.txt.bak" 2>/dev/null
cp "$SM/data/csstv/mm_pw.txt" "$TMP/mm_pw.txt.bak" 2>/dev/null
rm -f "$SM"/data/csstv/queue/* "$SM/data/csstv/mm.txt" "$SM/data/csstv/mm_pw.txt" 2>/dev/null
for k in official pcw mm mix; do
  [ -f "$CS/cfg/csstv/live_$k.cfg" ] && touch "$TMP/had_live_$k"
  cp "$REPO/server/cfg/csstv/live_$k.cfg" "$CS/cfg/csstv/live_$k.cfg"
done
( cd "$REPO/server/addons/sourcemod/scripting" && "$SM/scripting/spcomp.exe" csstv_reporter.sp CSSTV_DEBUG=1 -i"$SM/scripting/include" -iinclude -o"$TMP/csstv_reporter.smx" ) >/dev/null \
  || { echo "No compiló el reporter de pruebas."; exit 1; }
cp "$TMP/csstv_reporter.smx" "$SM/plugins/csstv_reporter.smx"
python - "$CFG" "$ANON" "$TOKEN" <<'PY'
import sys, re
p, anon, tok = sys.argv[1:]
s = open(p, encoding='utf-8', errors='replace').read()
want = {
  'csstv_api_url': 'http://127.0.0.1:54321/rest/v1/rpc/ingest_server_chunk', 'csstv_api_key': anon, 'csstv_server_token': tok,
  'csstv_send': '1', 'csstv_include_bots': '1', 'csstv_min_players': '1', 'csstv_mm': '1', 'csstv_mm_poll': '2',
  'csstv_series_next_delay': '60', 'csstv_demo': '0', 'csstv_clips': '0', 'csstv_claim': '0', 'csstv_ready_knife': '0',
  'csstv_overtime': '0', 'csstv_server_tag': 'e2e',
}
for k, v in want.items():
    line = f'{k} "{v}"'
    s, n = re.subn(rf'^{k} .*$', line, s, flags=re.M)
    if n == 0:
        s += '\n' + line
open(p, 'w', encoding='utf-8').write(s + '\n')
PY
date +%s > "$SM/data/csstv/license.txt"

( while true; do sql -c "select mm_tick()" >/dev/null 2>&1; sleep 2; done ) &
TICK=$!

paso "Servidor local"
WD=$(cd "$SV" && pwd -W)
powershell.exe -NoProfile -Command "Start-Process -FilePath '$WD/srcds.exe' -WorkingDirectory '$WD' -ArgumentList '-console -game cstrike -ip 127.0.0.1 -port 27098 -tickrate 66 -insecure +maxplayers 14 +map de_cbble'"
esperar "el servidor consulta a la base local" "select exists (select 1 from mm_server_state where server_id = '$SRV' and last_poll_at > now() - interval '10 seconds' and plugin_version = '2.9.0')" 90 || exit 1
R "bot_quota_mode normal" "bot_join_after_player 0" "bot_chatter off"

# ---------------------------------------------------------------------------------------------------------------
paso "Torneo BO3: iniciar, veto con reloj (15 s por turno) y toma"
igual "servidor libre y apto para torneos" "$(sql -c "select server_is_free('$SRV', 'official')")" t
como "$U_ORG" "select match_start('$M_T', '$SRV', 5)" >/dev/null
igual "reserva en veto con el servidor ocupado" "$(reserva $M_T "status || ':' || (server_id = '$SRV')")" "veto:true"
esperar "el veto termina solo (al azar) y la reserva queda asignada" "select status = 'assigned' from match_bookings where match_id = '$M_T' and status <> 'cancelled'" 120
igual "veto completo, sin autor (turnos vencidos)" "$(sql -c "select count(*) || ':' || count(*) filter (where by_user is null) from match_vetos where match_id = '$M_T'")" "4:4"
esperar "el servidor la toma (taken)" "select taken_at is not null from match_bookings where match_id = '$M_T' and status = 'assigned'" 40
MAPA1=$(reserva $M_T "(match_series_maps(match_id))[1]")
sleep 25   # carga el mapa 1 del veto
echo "  mapa 1 del veto: $MAPA1"
igual "contraseña de la reserva puesta" "$(Q sv_password)" "$(reserva $M_T password)"

play_map() { # $1 = número de mapa
  R "bot_kick" "mp_autoteambalance 0" "mp_limitteams 0"
  sleep 4   # que se vayan todos antes de volver a agregarlos (si no, aparece "(1)Quade")
  for n in $ALFA; do R "bot_add_ct $n"; done
  for n in $BETA; do R "bot_add_t $n"; done
  sleep 8
  R "sm_live mr1"
  sleep 14
  if [ "$1" = 1 ]; then
    igual "live_official.cfg: fuego amigo" "$(Q mp_friendlyfire)" 1
    igual "live_official.cfg: sin charla del medio tiempo" "$(Q csstv_half_alltalk)" 0
    igual "live_official.cfg: sin !gg" "$(Q csstv_gg_min_diff)" 0
  fi
  esperar "mapa $1 en vivo" "select status = 'live' from match_bookings where match_id = '$M_T' and status not in ('cancelled')" 20
  # Se mata a los de Beta por nombre: Alfa gana cada ronda, esté del lado que esté (no depende del cambio de lado).
  for n in $BETA; do R "sm_slay $n"; done
  sleep 14
  for n in $BETA; do R "sm_slay $n"; done
}

play_map 1
esperar "la base suma el mapa 1 y la reserva pasa a entre mapas (mapa 2)" "select status = 'between' and map_no = 2 from match_bookings where match_id = '$M_T' and status <> 'cancelled'" 90
igual "serie 1-0 o 0-1" "$(sql -c "select score1 + score2 from matches where id = '$M_T'")" 1
sleep 75   # 60 s de csstv_series_next_delay y la carga del mapa 2
play_map 2
esperar "la base suma el mapa 2" "select status = 'finished' or (status = 'between' and map_no = 3) from match_bookings where match_id = '$M_T' and status <> 'cancelled'" 90
if [ "$(reserva $M_T status)" = between ]; then
  echo "  Quedó 1-1: se juega el mapa 3"
  sleep 75
  play_map 3
fi
esperar "la serie termina y se cierra la reserva" "select status = 'finished' and end_reason = 'series_end' from match_bookings where match_id = '$M_T'" 90
igual "partida terminada con ganador" "$(sql -c "select status || ':' || (winner is not null) from matches where id = '$M_T'")" "finished:true"
igual "mapas jugados vinculados a la serie" "$(sql -c "select count(*) >= 2 from matches where parent_match_id = '$M_T'")" t
esperar "el servidor queda libre" "select server_is_free('$SRV', 'official')" 30
# El plugin cambia la contraseña cuando vuelve al calentamiento y el poll ya no trae la reserva.
PWR=$(reserva $M_T password); i=0
while [ "$(Q sv_password)" = "$PWR" ] && [ $i -lt 60 ]; do sleep 1; i=$((i + 1)); done
[ "$(Q sv_password)" != "$PWR" ] && ok "contraseña rotada al terminar (${i} s)" || falla "la contraseña de la reserva sigue puesta (60 s)"

# ---------------------------------------------------------------------------------------------------------------
paso "PCW: listos, veto (30 s por turno), fila y arranque automático"
sql >/dev/null <<SQL
insert into teams (id, name, tag, owner_id, captain_id, kind, parent_team_id) values
  ('e2e56000-0000-4000-8000-000000000013', 'Alfa PCW', 'PCW', '$U_CA', '$U_CA', 'pcw', '$T_A'),
  ('e2e56000-0000-4000-8000-000000000014', 'Beta PCW', 'PCW', '$U_CB', '$U_CB', 'pcw', '$T_B');
insert into team_members (team_id, player_id) select 'e2e56000-0000-4000-8000-000000000013', id from players where steam_id in ($SID_A4);
insert into team_members (team_id, player_id) select 'e2e56000-0000-4000-8000-000000000014', id from players where steam_id in ($SID_B4);
insert into matches (id, kind, status, best_of, team1, team2, link_code) values
  ('$M_P', 'pcw', 'upcoming', 1, 'e2e56000-0000-4000-8000-000000000013', 'e2e56000-0000-4000-8000-000000000014', 'E2EP6'),
  ('$M_P2', 'pcw', 'upcoming', 1, 'e2e56000-0000-4000-8000-000000000013', 'e2e56000-0000-4000-8000-000000000014', 'E2EP7');
insert into pcw_posts (team_id, by_user, best_of, status, match_id, map_pool) values
  ('e2e56000-0000-4000-8000-000000000013', '$U_CA', 1, 'matched', '$M_P', array['de_dust2', 'de_nuke', 'de_train']),
  ('e2e56000-0000-4000-8000-000000000013', '$U_CA', 1, 'matched', '$M_P2', array['de_dust2', 'de_nuke', 'de_train']);
SQL
como "$U_CA" "select pcw_ready('$M_P')" >/dev/null
igual "un equipo listo" "$(reserva $M_P status)" ready
como "$U_CB" "select pcw_ready('$M_P')" >/dev/null
igual "los dos listos: veto" "$(reserva $M_P status)" veto
esperar "veto al azar y la fila le da el servidor" "select status = 'assigned' and server_id = '$SRV' from match_bookings where match_id = '$M_P' and status <> 'cancelled'" 150
esperar "el servidor la toma" "select taken_at is not null from match_bookings where match_id = '$M_P' and status = 'assigned'" 40
sleep 20
R "bot_kick"
sleep 4
for n in $ALFA4; do R "bot_add_ct $n"; done
for n in $BETA4; do R "bot_add_t $n"; done
esperar "el plugin informa los dos equipos en regla (4 y 4)" "select side_ok1 and side_ok2 and side_n1 = 4 and side_n2 = 4 from match_bookings where match_id = '$M_P' and status = 'assigned'" 40
sql -c "update match_bookings set wait_deadline = now() - interval '1 second' where match_id = '$M_P' and status = 'assigned'"
esperar "vence la espera con los dos: arranca solo" "select status = 'live' from match_bookings where match_id = '$M_P' and status not in ('cancelled', 'abandoned')" 40
sleep 8
igual "live_pcw.cfg: fuego amigo" "$(Q mp_friendlyfire)" 1
igual "live_pcw.cfg: !gg permitido" "$(Q csstv_gg_min_diff)" 8
R "sm_cancelmatch"
sleep 3
sql -c "update profiles set role = 'moderator' where id = '$U_ORG'"
como "$U_ORG" "select match_booking_release('$M_P')" >/dev/null
esperar "un moderador libera el servidor" "select server_is_free('$SRV', 'pcw')" 30

paso "PCW con un equipo incompleto: abandono y sanción"
sleep 6
como "$U_CA" "select pcw_ready('$M_P2')" >/dev/null
como "$U_CB" "select pcw_ready('$M_P2')" >/dev/null
esperar "la PCW toma el servidor" "select status = 'assigned' and taken_at is not null from match_bookings where match_id = '$M_P2' and status <> 'cancelled'" 180
sleep 20
R "bot_kick"
sleep 4
for n in $ALFA4; do R "bot_add_ct $n"; done
for n in Quade Quintin; do R "bot_add_t $n"; done
esperar "el plugin informa Beta fuera de regla (2 en su lado)" "select side_ok1 and not side_ok2 and side_n2 = 2 from match_bookings where match_id = '$M_P2' and status = 'assigned'" 40
sql -c "update match_bookings set wait_deadline = now() - interval '1 second' where match_id = '$M_P2' and status = 'assigned'"
esperar "abandono de Beta" "select status = 'abandoned' and abandoned_side = 2 from match_bookings where match_id = '$M_P2'" 20
igual "PCW cancelada por abandono, sin ganador" "$(sql -c "select status || ':' || cancel_reason || ':' || (winner is null) from matches where id = '$M_P2'")" "cancelled:abandoned:true"
igual "sanción de 3 días a Beta E2E" "$(sql -c "select (team_pcw_ban_until('$T_B') between now() + interval '71 hours' and now() + interval '73 hours')")" t
N=$(sql -c "select count(*) from pcw_bans where player_id in (select player_id from team_members where team_id = 'e2e56000-0000-4000-8000-000000000014')")
igual "sanción a los 4 jugadores del bando" "$N" 4
if [ "$N" != 4 ]; then
  echo "  Integrantes del bando Beta:"; sql -c "select '    ' || p.nick || ' ' || p.steam_id || ' left_at=' || coalesce(tm.left_at::text, '-') from team_members tm join players p on p.id = tm.player_id where tm.team_id = 'e2e56000-0000-4000-8000-000000000014'"
  echo "  Sanciones:"; sql -c "select '    ' || coalesce(t.name, p.nick) || ' hasta ' || b.until from pcw_bans b left join teams t on t.id = b.team_id left join players p on p.id = b.player_id"
fi
igual "Alfa E2E sin sanción" "$(sql -c "select team_pcw_ban_until('$T_A') is null")" t
esperar "el servidor queda libre" "select server_is_free('$SRV', 'pcw')" 30

paso "Errores del plugin"
ERR="$SM/logs/errors_$(date +%Y%m%d).log"
if [ -f "$ERR" ] && grep -a -i "csstv_reporter" "$ERR" | grep -a -v -i "licencia" | tail -5 | grep -q .; then
  grep -a -i "csstv_reporter" "$ERR" | grep -a -v -i "licencia" | tail -5 | cut -c1-200
else
  echo "  Sin errores del reporter."
fi
grep -a -i -E "Reserva .*tomada|Terminó la reserva|mapa siguiente|cerró la reserva" "$LOG" | tail -10 | sed -E 's/^L [^ ]+ - //' | cut -c1-150
