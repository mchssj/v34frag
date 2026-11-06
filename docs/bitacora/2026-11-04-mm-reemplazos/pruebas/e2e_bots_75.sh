#!/usr/bin/env bash
# Prueba de punta a punta, con bots, de los reemplazos del matchmaking (replanteo 75, reporter 2.10.0): el servidor local
# (E:\CSS DEDICATED SERVER) contra la base LOCAL del backend (contenedor supabase_db_v34frag-api), nunca contra la real.
#
#   bash e2e_bots_75.sh <carpeta del repo>
#
# 1. Guarda una copia de la base local dentro del contenedor (/tmp/antes_e2e75.dump). La base local ya tiene la 75.
# 2. Siembra una sala 5v5 asignada al servidor local, con 10 bots de jugadores (el build de pruebas, CSSTV_DEBUG, les da un
#    SteamID falso y estable por nombre) y una cuenta más para el reemplazo (el bot Albert).
# 3. Arranca el servidor con el 2.10.0 de pruebas apuntando a la base local, y un bucle que llama a mm_tick().
# 4. Sala en vivo; Moe se va; !callreplace (sm_callreplace_as, los bots votan Sí): Moe abandona y se abre el pedido;
#    Albert lo toma, entra y va al lado de su equipo; Moe vuelve y queda de espectador; el abandono queda cubierto.
# 5. Quade se va y no vuelve: a los 2 minutos se llama un reemplazo solo. Se cancela la partida y el pedido vence.
# 6. Al salir (también si falla): apaga el servidor, restaura su cfg, su plugin y la licencia, vacía la cola, saca las
#    cfg live_*.cfg que agregó y restaura la base desde la copia.
set -u
REPO="${1:?falta la carpeta del repo}"
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
TOKEN="tok-e2e75-local"
SRV=e2e75000-0000-4000-8000-000000000001
MATCH=e2e75000-0000-4000-8000-000000000031
LOBBY=e2e75000-0000-4000-8000-000000000041
OK=0; FALLAS=0
ALFA="Arnold Brett Kurt Kyle Moe"; BETA="Quade Quintin Rip Zach Chad"; REP=Albert

sql() { MSYS_NO_PATHCONV=1 docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -qtA "$@"; }
como() { sql -c "select set_config('request.jwt.claims', '{\"sub\":\"$1\",\"role\":\"authenticated\"}', false); $2" | tail -1; }
R() { for c in "$@"; do python "$RC" "$A" "$PW" "$c" >/dev/null 2>&1 || echo "  (rcon falló: $c)"; done; }
# lado <bot>: su equipo actual (2 T, 3 CT, 1 espectador), con sm_mm_sides del build de pruebas.
lado() { python "$RC" "$A" "$PW" "sm_mm_sides" 2>/dev/null | grep -a -o -E "[;=]$1=[0-9]" | head -1 | grep -o -E "[0-9]$"; }
paso() { printf '\n== %s\n' "$*"; }
ok() { OK=$((OK + 1)); echo "  OK: $*"; }
falla() { FALLAS=$((FALLAS + 1)); echo "  FALLA: $*"; }
igual() { if [ "$2" = "$3" ]; then ok "$1 ($2)"; else falla "$1: esperaba '$3' y hay '$2'"; fi; }
esperar() {
  local i
  for i in $(seq 1 "${3:-120}"); do
    [ "$(sql -c "$2" 2>/dev/null)" = t ] && { ok "$1 (${i} s)"; return 0; }
    sleep 1
  done
  falla "$1 (después de ${3:-120} s)"
  return 1
}
# esperar_log <descripción> <regex> [segundos]: una línea nueva del log del servidor desde que empezó la prueba.
esperar_log() {
  local i
  for i in $(seq 1 "${3:-60}"); do
    tail -c +"$LOG0" "$LOG" 2>/dev/null | grep -a -q -E "$2" && { ok "$1 (${i} s)"; return 0; }
    sleep 1
  done
  falla "$1 (después de ${3:-60} s)"
  return 1
}
sid() { tr ' ' '
' < "$TMP/bots.sql.sids" | sed -n "s/^$1=//p"; }
uid() { sql -c "select user_id from players where steam_id = '$(sid "$1")'"; }
key() { sql -c "select csstv_steam2('$(sid "$1")')"; }
poll() { sql -c "select substring(csstv_mm_poll('$TOKEN', 'e2e') from '(?:^|\n)$1=([^\n]*)')"; }

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
  if MSYS_NO_PATHCONV=1 docker exec "$DB" sh -c 'pg_restore -U supabase_admin -d postgres --clean --if-exists --single-transaction /tmp/antes_e2e75.dump' >/dev/null 2>&1; then
    echo "  Base local restaurada: $(sql -c "select (select count(*) from matches) || ' partidas, ' || (select count(*) from auth.users) || ' cuentas, mm_replacements: ' || (select count(*) from mm_replacements)")"
  else
    echo "  FALLA: no se pudo restaurar la base local. La copia sigue en el contenedor: /tmp/antes_e2e75.dump"
  fi
  rm -rf "$TMP"
  printf '\n== Resultado: %d comprobaciones bien, %d fallas\n' "$OK" "$FALLAS"
}
trap restaurar EXIT

paso "Preparación"
tasklist 2>/dev/null | grep -qi srcds && { echo "Hay un srcds corriendo: apagalo antes."; trap - EXIT; exit 1; }
[ "$(sql -c "select to_regclass('public.mm_replacements') is not null")" = t ] || { echo "La base local no tiene la 75."; trap - EXIT; exit 1; }
MSYS_NO_PATHCONV=1 docker exec "$DB" sh -c 'pg_dump -U supabase_admin -d postgres -Fc -f /tmp/antes_e2e75.dump' || { echo "No se pudo copiar la base."; trap - EXIT; exit 1; }
echo "  Copia de la base local en el contenedor: /tmp/antes_e2e75.dump"
ANON=$(cd "$REPO/web/backend" && pnpm exec supabase status -o env 2>/dev/null | sed -n -E 's/^ANON_KEY="?([^"]*)"?/\1/p')
[ -n "$ANON" ] || { echo "No se pudo leer la clave pública de la base local."; exit 1; }

# SteamID falso de cada bot, como Stats_ClientKey con CSSTV_DEBUG (en SteamID64 para players.steam_id).
python - "$TMP/bots.sql" <<'PY'
import sys
def sid64(name):
    h = 5381
    for ch in name:
        h = ((h << 5) + h + ord(ch)) & 0x7FFFFFFF
    x, y = h & 1, 999000000 + (h >> 1) % 100000
    return 76561197960265728 + 2 * y + x
eq = {1: ['Arnold', 'Brett', 'Kurt', 'Kyle', 'Moe'], 2: ['Quade', 'Quintin', 'Rip', 'Zach', 'Chad'], 0: ['Albert']}
rows = [f"('{n}', '{sid64(n)}', {t})" for t, ns in eq.items() for n in ns]
open(sys.argv[1] + '.sids', 'w').write(' '.join(f"{n}={sid64(n)}" for ns in eq.values() for n in ns))
open(sys.argv[1], 'w').write('create temp table bots (nick text, sid text, team int);\ninsert into bots values ' + ', '.join(rows) + ';\n')
PY
sql >/dev/null <<SQL
$(cat "$TMP/bots.sql")
alter table bots add column uid uuid default gen_random_uuid();
update mm_config set replace_enabled = true, require_anticheat = false, min_mixes = 0, min_account_days = 0, reconnect_minutes = 2,
  replace_min_rounds_left = 4, replace_link_minutes = 10 where id = 1;
insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
  select uid, uid || '@e2e75.local', now(), now() - interval '30 days', 'authenticated', 'authenticated' from bots;
insert into players (nick, steam_id, user_id) select nick, sid, uid from bots;
insert into game_servers (id, name, token_hash, active, mm_enabled, connect_address, region)
  values ('$SRV', 'E2E 75 local', encode(sha256(convert_to('$TOKEN', 'UTF8')), 'hex'), true, true, '127.0.0.1:27098', 'Sudamerica');
insert into matches (id, kind, status, best_of, side1_name, side2_name, server_id, link_code)
  values ('$MATCH', 'mm', 'upcoming', 1, 'team_Arnold', 'team_Quade', '$SRV', 'E2ER5');
insert into mm_lobbies (id, mode, status, match_id, server_id, map, password, assign_deadline)
  values ('$LOBBY', '5v5', 'assigned', '$MATCH', '$SRV', 'de_dust2', 'pw7575e2e', now() + interval '10 minutes');
insert into mm_lobby_players (lobby_id, user_id, player_id, team, elo, joined_at, accepted_at)
  select '$LOBBY', b.uid, p.id, b.team, 1000, now(), now() from bots b join players p on p.user_id = b.uid where b.team in (1, 2);
SQL
igual "semilla: sala con 10 jugadores" "$(sql -c "select count(*) from mm_lobby_players where lobby_id = '$LOBBY'")" 10
U_MOE=$(uid Moe); U_QUADE=$(uid Quade); U_REP=$(uid $REP)
[ -n "$U_MOE" ] && [ -n "$U_REP" ] || { echo "No se encontraron las cuentas sembradas."; exit 1; }

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
  'csstv_demo': '0', 'csstv_clips': '0', 'csstv_claim': '0', 'csstv_ready_knife': '0', 'csstv_overtime': '0',
  'csstv_server_tag': 'e2e', 'csstv_autopause': '0',
}
for k, v in want.items():
    line = f'{k} "{v}"'
    s, n = re.subn(rf'^{k} .*$', line, s, flags=re.M)
    if n == 0:
        s += '\n' + line
open(p, 'w', encoding='utf-8').write(s + '\n')
PY
date +%s > "$SM/data/csstv/license.txt"
LOG0=$(( $(stat -c %s "$LOG" 2>/dev/null || echo 0) + 1 ))

( while true; do sql -c "select mm_tick()" >/dev/null 2>&1; sleep 2; done ) &
TICK=$!

paso "Servidor local y sala"
WD=$(cd "$SV" && pwd -W)
powershell.exe -NoProfile -Command "Start-Process -FilePath '$WD/srcds.exe' -WorkingDirectory '$WD' -ArgumentList '-console -game cstrike -ip 127.0.0.1 -port 27098 -tickrate 66 -insecure +maxplayers 14 +map de_cbble'"
esperar "el servidor consulta a la base local con el 2.10.0" "select exists (select 1 from mm_server_state where server_id = '$SRV' and last_poll_at > now() - interval '10 seconds' and plugin_version = '2.10.0')" 90 || exit 1
esperar "el servidor toma la sala" "select status = 'connecting' from mm_lobbies where id = '$LOBBY'" 40 || exit 1
sleep 25   # cambia a de_dust2
R "bot_quota_mode normal" "bot_join_after_player 0" "bot_chatter off" "mp_autoteambalance 0" "mp_limitteams 0" "bot_kick"
sleep 4
for n in $ALFA; do R "bot_add_ct $n"; done
for n in $BETA; do R "bot_add_t $n"; done
esperar "los 10 conectados" "select count(*) = 10 from mm_lobby_players where lobby_id = '$LOBBY' and connected_at is not null" 40 || exit 1
sleep 6
R "sm_live"
esperar "sala en vivo" "select status = 'live' from mm_lobbies where id = '$LOBBY'" 30 || exit 1
sleep 12
igual "poll en vivo: se puede pedir en los dos equipos" "$(poll replace)" "1,1"

paso "!callreplace: Moe se va, su equipo vota y se llama el reemplazo"
R "bot_kick Moe"
esperar "Moe figura desconectado" "select left_at is not null from mm_lobby_players where lobby_id = '$LOBBY' and user_id = '$U_MOE'" 20
sleep 12   # el poll en vivo (cada 10 s) trae a Moe en away=
R "sm_callreplace_as Arnold \"$(key Moe)\""   # entre comillas: la consola corta en los :
esperar "pasa el voto: Moe abandona en el acto y se abre el pedido (voto)" "select exists (select 1 from mm_replacements where lobby_id = '$LOBBY' and replaced_user_id = '$U_MOE' and source = 'vote' and status = 'open') and (select abandoned from mm_lobby_players where lobby_id = '$LOBBY' and user_id = '$U_MOE')" 20
esperar_log "el servidor anuncia el voto aprobado" "Pasó el voto: se busca un reemplazo para" 5
igual "abandonos sin cubrir: 1 en el equipo 1" "$(poll abandons)" "1,0"
igual "el equipo 1 ya no puede pedir otro" "$(poll replace)" "0,1"
R "sm_callreplace_as Brett \"$(key Moe)\""
sleep 2
igual "un segundo voto no abre otro pedido" "$(sql -c "select count(*) from mm_replacements where lobby_id = '$LOBBY'")" 1
igual "el segundo voto ni se abre (espera del equipo)" "$(tail -c +"$LOG0" "$LOG" | grep -a -c "Pasó el voto")" 1

paso "Albert toma el link, entra y va al lado de su equipo"
TOK=$(sql -c "select token from mm_replacements where lobby_id = '$LOBBY' and status = 'open'")
igual "Albert lo toma" "$(como "$U_REP" "select mm_replace_take('$TOK')")" "$LOBBY"
T1=$(poll t1)
case ",$T1," in
  *",$(key Moe),"*) falla "el plantel del equipo 1 todavía tiene a Moe: $T1" ;;
  *",$(key $REP),"*) ok "el plantel del equipo 1 tiene a Albert y no a Moe" ;;
  *) falla "Albert no está en el plantel del equipo 1: $T1" ;;
esac
sleep 12   # el poll en vivo trae el plantel nuevo
L_ARNOLD=$(lado Arnold)
echo "  Arnold (equipo 1) juega del lado $L_ARNOLD (2 T, 3 CT)"
if [ "$L_ARNOLD" = 3 ]; then R "bot_add_t $REP"; else R "bot_add_ct $REP"; fi   # del lado contrario al de su equipo
esperar_log "Albert entra de reemplazo a su equipo" "Albert.*entró de reemplazo en" 30
sleep 2
igual "Albert juega del mismo lado que Arnold" "$(lado $REP)" "$L_ARNOLD"
esperar "llegó: el pedido queda conectado y el abandono de Moe cubierto" "select (select status from mm_replacements where lobby_id = '$LOBBY' and replaced_user_id = '$U_MOE') = 'connected' and (select replaced_by from mm_lobby_players where lobby_id = '$LOBBY' and user_id = '$U_MOE') = '$U_REP'" 30
igual "abandonos sin cubrir: ninguno" "$(poll abandons)" "0,0"
igual "sin derrota automática" "$(sql -c "select forfeit_team is null from mm_lobbies where id = '$LOBBY'")" t

paso "Moe vuelve: queda de espectador"
R "bot_add_ct Moe"
esperar_log "Moe pasa a espectador" "Moe.*(ya tiene reemplazo|no es de la sala).*espectador" 30
sleep 2
igual "Moe queda de espectador" "$(lado Moe)" 1

paso "Quade se va y no vuelve: reemplazo automático a los 2 minutos"
R "bot_kick Quade"
esperar "Quade figura desconectado" "select left_at is not null from mm_lobby_players where lobby_id = '$LOBBY' and user_id = '$U_QUADE'" 20
esperar "a los 2 minutos abandona y se abre el pedido (automático)" "select exists (select 1 from mm_replacements where lobby_id = '$LOBBY' and replaced_user_id = '$U_QUADE' and source = 'auto' and status = 'open')" 160

paso "Se cancela la partida: el pedido abierto vence"
R "sm_cancelmatch"
esperar "la sala se cancela" "select status = 'cancelled' from mm_lobbies where id = '$LOBBY'" 40
esperar "el pedido de Quade vence" "select status = 'expired' and token is null from mm_replacements where lobby_id = '$LOBBY' and replaced_user_id = '$U_QUADE'" 20

paso "Errores del plugin"
ERR="$SM/logs/errors_$(date +%Y%m%d).log"
if [ -f "$ERR" ] && grep -a -i "csstv_reporter" "$ERR" | grep -a -v -i "licencia" | tail -5 | grep -q .; then
  grep -a -i "csstv_reporter" "$ERR" | grep -a -v -i "licencia" | tail -5 | cut -c1-200
else
  echo "  Sin errores del reporter."
fi
tail -c +"$LOG0" "$LOG" | grep -a -i -E "reemplazo|espectador|Pasó el voto|callreplace" | tail -12 | sed -E 's/^L [^ ]+ - //' | cut -c1-170
