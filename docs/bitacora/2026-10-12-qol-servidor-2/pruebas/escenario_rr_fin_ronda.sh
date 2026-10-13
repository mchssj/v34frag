#!/usr/bin/env bash
# !rr después del fin de la ronda (la ronda ya se contó): el marcador, el TAB, el chaleco,
# las granadas y el kit tienen que volver a como estaban al empezarla.
# Uso: UIDS="6 7 8" GEAR=7 bash escenario_rr_fin_ronda.sh   (GEAR = userid del CT al que se le da equipo)
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
inv() { for u in $UIDS; do python "$RCON" 26.228.23.45:27016 cambiar_esta_clave "spike_inv $u" >/dev/null; done; }
score() { python "$RCON" 26.228.23.45:27016 cambiar_esta_clave "sm_score" | grep -a "Equipo A"; }
R "sm plugins reload csstv_reporter" "sleep:1" "csstv_send 0" "csstv_include_bots 1" "csstv_lo3 0" "csstv_maxrounds 6" \
  "csstv_abandon_players 0" "csstv_credits_interval 0" "mp_freezetime 3" "mp_roundtime 2"
R "sm_live force"
wait_for "Ronda 1/6" 60 || exit 1
R "spike_give $GEAR item_assaultsuit" "spike_give $GEAR weapon_flashbang" "spike_give $GEAR weapon_flashbang" \
  "spike_give $GEAR weapon_hegrenade" "spike_give $GEAR item_defuser" "spike_give $GEAR weapon_deagle"
wait_for "Ronda 2/6" 240 || exit 1
sleep 1
echo "== inicio de la ronda 2"; score; inv
# El fin de ronda no queda en el log de SourceMod: se espera a que cambie el marcador.
before=$(score | grep -o "[0-9]* - [0-9]*")
until [ "$(score | grep -o "[0-9]* - [0-9]*")" != "$before" ]; do sleep 1; done
echo "== fin de la ronda 2"; score; inv
R "sm_rr"
wait_for "repite la ronda" 10 || exit 1
wait_for "Ronda 2/6" 15 || exit 1
echo "== después de !rr"; score; inv
