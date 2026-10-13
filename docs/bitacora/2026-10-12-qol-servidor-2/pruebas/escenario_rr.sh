#!/usr/bin/env bash
# !rr con bots en $2000$ (1 CT vs 2 T): foto de la ronda 2, !rr a mitad de la ronda y comparación.
# Requiere el plugin compilado con CSSTV_DEBUG= y csstv_spike_armas.smx cargado.
RCON="E:/Css V34 Web/v34frag/docs/bitacora/2026-10-11-qol-servidor/pruebas/rcon.py"
LOG="E:/CSS DEDICATED SERVER/server/cstrike/addons/sourcemod/logs/L$(date +%Y%m%d).log"
OFF=0
R() { OFF=$(stat -c %s "$LOG"); python "$RCON" 26.228.23.45:27016 cambiar_esta_clave "$@" >/dev/null 2>&1 || echo "RCON falló: $*"; }
wait_for() {
  local end=$(( $(date +%s) + $2 )) pos
  until pos=$(tail -c +$((OFF + 1)) "$LOG" | grep -abo "$1" | head -1 | cut -d: -f1) && [ -n "$pos" ]; do
    [ "$(date +%s)" -ge "$end" ] && { echo "TIMEOUT: $1"; return 1; }
    sleep 1
  done
  OFF=$((OFF + pos + 1)); echo "OK: $1"
}
inv() { for u in "$@"; do python "$RCON" 26.228.23.45:27016 cambiar_esta_clave "spike_inv $u" >/dev/null; done; }
R "sm plugins reload csstv_reporter" "sleep:1" "csstv_send 0" "csstv_include_bots 1" "csstv_lo3 0" "csstv_maxrounds 6" \
  "csstv_abandon_players 0" "csstv_credits_interval 20" "mp_freezetime 3" "mp_roundtime 2"
R "sm_live force"
wait_for "Ronda 2/6" 240 || exit 1
sleep 1
inv $UIDS                                            # foto propia, para comparar
sleep 6
R "sm_rr"
wait_for "repite la ronda" 10 || exit 1
wait_for "\[rr\]" 15 || exit 1
sleep 1
inv $UIDS
wait_for "Ronda 2/6" 10 || exit 1
