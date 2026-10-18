#!/usr/bin/env bash
# Pruebas con bots de los mixes en vivo (servidor local con la build CSSTV_DEBUG y la Supabase LOCAL).
# Q: comandos por RCON (muestra la respuesta). SQL: consulta a la base local.
RCON="E:/Css V34 Web/v34frag/docs/bitacora/2026-10-11-qol-servidor/pruebas/rcon.py"
SRV="E:/CSS DEDICATED SERVER/server/cstrike"
ADDR="${ADDR:-172.24.0.1:27016}"   # con Docker corriendo, srcds escucha en la interfaz de Docker
PASS="$(sed -n 's/^rcon_password "\(.*\)"/\1/p' "$SRV/cfg/server.cfg")"
Q() { python "$RCON" "$ADDR" "$PASS" "$@" 2>&1; }
SQL() { docker exec -i supabase_db_v34frag-api psql -U postgres -At -c "$1"; }
# Partida de prueba: 3 bots T contra 1 CT en $2000$, envío a la base local.
setup() {
  Q "csstv_include_bots 1" "csstv_min_players 2" "csstv_abandon_players 0" "csstv_overtime 0" "csstv_lo3 0" \
    "csstv_end_delay 2" "csstv_halftime_delay 1" "mp_freezetime 1" "bot_kick" "bot_join_after_player 0" \
    "mp_autoteambalance 0" "mp_limitteams 0" "bot_add_t" "bot_add_t" "bot_add_t" "bot_add_ct" >/dev/null
}
