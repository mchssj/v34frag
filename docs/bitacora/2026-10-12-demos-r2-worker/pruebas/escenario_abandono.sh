#!/usr/bin/env bash
# Plugin 1.3.0 con bots (build CSSTV_DEBUG) en el servidor local de Daniel, arrancado con +map $2000$
# y la cola vacía. No cambia de mapa (eso volvería a cargar csstv_reporter.cfg con csstv_send 1).
# Formato estándar de prueba: $2000$ y 3 bots T contra 1 CT, para que termine rápido.
#   E: !live mr99         => rechazado
#   F: !live force mr2    => MR2 (gana quien llega a 3); termina sola con demo
#   G: abandono           => sin jugadores 5 s => cancelada por abandono, con demo
# Todas las esperas de prueba son de 10 s o menos (csstv_abandon_seconds 5, csstv_end_delay 2, csstv_halftime_delay 1).
# Uso: escenario_abandono.sh <host:puerto> <rcon_password>
Q="$(dirname "$0")/../../2026-10-11-qol-servidor/pruebas"
SRV="E:/CSS DEDICATED SERVER/server/cstrike"
C="$SRV/addons/sourcemod/logs/L$(date +%Y%m%d).log"
QUEUE="$SRV/addons/sourcemod/data/csstv/queue"
H="$1"; P="$2"; OFF=0
R() { OFF=$(stat -c %s "$C"); python "$Q/rcon.py" "$H" "$P" "$@" 2>&1 || echo "RCON falló: $*"; }
wait_for() {
  local end=$(( $(date +%s) + $2 )) pos
  until pos=$(tail -c +$((OFF + 1)) "$C" | grep -abo "$1" | head -1 | cut -d: -f1) && [ -n "$pos" ]; do
    [ "$(date +%s)" -ge "$end" ] && { echo "TIMEOUT: $1"; return 1; }
    sleep 1
  done
  OFF=$((OFF + pos + 1))
  echo "OK: $1"
}
show() { f=$(ls -t "$QUEUE"/*.json 2>/dev/null | head -1); [ -n "$f" ] && python -c "import json,sys; d=json.load(open(sys.argv[1],encoding='utf-8')); print('   cola:', d['match_uid'], d.get('status'), d.get('cancel_reason'), 'demo=', d.get('demo'), 'max_rounds', d.get('max_rounds'), 'marcador', d['score'], 'winner', d['winner'])" "$f"; }

R "sm_cancelmatch" "csstv_send 0" "csstv_include_bots 1" "csstv_min_players 2" "csstv_overtime 1" "csstv_lo3 0"   "csstv_abandon_players 0" "csstv_abandon_seconds 5" "csstv_end_delay 2" "csstv_halftime_delay 1" "mp_roundtime 1" "mp_freezetime 1"   "bot_kick" "bot_join_after_player 0" "mp_autoteambalance 0" "mp_limitteams 0"   "bot_add_t" "bot_add_t" "bot_add_t" "bot_add_ct" >/dev/null
sleep 3

echo "== E: formato inválido"
R "sm_live force mr99" | grep -a "mr1 a mr30" && echo "   rechazado"

echo "== F: !live force mr2"
R "sm_live force mr2" >/dev/null
wait_for "Ronda 1/4 " 30 || exit 1                 # MR2: cuatro rondas de reglamentario
wait_for "terminada" 400 || exit 1
show

sleep 3                                              # vuelve al calentamiento (csstv_end_delay 2)
echo "== G: abandono"
R "csstv_abandon_players 4" "sm_live force" >/dev/null
wait_for "Grabando demo" 30 || exit 1
wait_for "Ronda 2/30" 200 || exit 1
R "bot_kick" >/dev/null
wait_for "se cancela en 5 s" 10 || exit 1
wait_for "cancelada por abandono" 15 || exit 1
show
R "csstv_abandon_players 0" "bot_add_t" "bot_add_t" "bot_add_t" "bot_add_ct" >/dev/null
