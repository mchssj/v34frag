#!/usr/bin/env bash
# Mix MR2 con bots: medio tiempo, pausa con tiempo, pausa terminada con !unpause, límite, admin y fin.
Q="$(dirname "$0")"
C="E:/CSS DEDICATED SERVER/server/cstrike/console.log"
OFF=0
# R: manda comandos por RCON y marca desde dónde buscar en el log.
R() { OFF=$(stat -c %s "$C"); python "$Q/rcon.py" 26.228.23.45:27035 cambiar_esta_clave "$@" >/dev/null 2>&1 || echo "RCON falló: $*"; }
# wait_for: espera el patrón en lo escrito después del último R (o del último wait_for que lo encontró).
wait_for() {
  local end=$(( $(date +%s) + $2 )) pos
  until pos=$(tail -c +$((OFF + 1)) "$C" | grep -abo "$1" | head -1 | cut -d: -f1) && [ -n "$pos" ]; do
    [ "$(date +%s)" -ge "$end" ] && { echo "TIMEOUT: $1"; return 1; }
    sleep 1
  done
  OFF=$((OFF + pos + 1))
  echo "OK: $1"
}
R "sm_cancelmatch" "csstv_send 0" "csstv_include_bots 1" "csstv_maxrounds 4" "csstv_ot_maxrounds 2" "csstv_lo3 0" \
  "csstv_pause_mode 3" "csstv_pause_max 1" "csstv_pause_time 15" "bot_join_after_player 0" "bot_quota 6"
sleep 3
R "sm_live force" "sleep:2" "mp_roundtime 1" "mp_freezetime 3"
wait_for "Ronda 2/4" 240 || exit 1
sleep 4                                             # ya en plena ronda
R "csstv_debug_fakecmd 4 sm_pause"
wait_for "pidió una pausa" 10 || exit 1
wait_for "Pausa táctica" 240 || exit 1              # empieza en la ronda 3, después del cambio de lado
wait_for "La pausa termina en 10 s" 20 || exit 1
wait_for "Se terminó el tiempo de la pausa" 20 || exit 1
sleep 4
R "csstv_debug_fakecmd 4 sm_pause"                  # ese equipo ya usó su pausa
wait_for "ya usó" 10 || exit 1
R "csstv_debug_fakecmd 3 sm_pause"                  # el otro equipo pide para la ronda 4
wait_for "pidió una pausa\|Pausa táctica" 10 || exit 1
wait_for "Pausa táctica" 240 || exit 1
sleep 2
R "csstv_debug_fakecmd 3 sm_unpause"
wait_for "listo para seguir" 10 || exit 1
R "csstv_debug_fakecmd 4 sm_unpause"
wait_for "Los dos equipos están listos" 10 || exit 1
wait_for "Round_Start" 10 || exit 1                 # se terminó el freezetime
sleep 3
R "sm_forcepause"
wait_for "pausa" 10 || exit 1
wait_for "Pausa del admin" 240 || exit 1
sleep 3
R "sm_forceunpause"
wait_for "Un admin terminó la pausa" 10 || exit 1
wait_for "Fin de la partida\|Prórroga" 600 || exit 1
echo "== FIN"
