#!/usr/bin/env bash
# Inicio por !ready con y sin ronda de cuchillo (plugin 1.8.0). Servidor local en $2000$ con
# 2 bots T y 1 CT, plugin compilado con CSSTV_DEBUG= (para csstv_debug_fakecmd y el chat en el log).
# Uso: ./escenario_ready.sh knife | noknife   (los userid de los bots: mirarlos con  Q status)
cd "$(dirname "$0")" && source ../../2026-10-13-plugin-1-6-0/pruebas/lib.sh
R "csstv_send 0" "csstv_include_bots 1" "csstv_lo3 0" "csstv_abandon_players 0" "csstv_credits_interval 0" \
  "csstv_min_players 3" "csstv_maxrounds 4" "csstv_overtime 0" "csstv_knife_time 10" "csstv_end_delay 2" \
  "mp_autoteambalance 0" "mp_limitteams 0" "bot_join_after_player 0" >/dev/null
ready_all() { for u in ${UIDS:-2 3 4}; do R "csstv_debug_fakecmd $u sm_ready" >/dev/null; done; }
case "$1" in
  knife)
    R "csstv_ready_knife 1" >/dev/null; ready_all
    wait_for "Ronda de cuchillo" 15 && wait_for "A cuchillo" 30
    wait_for "Nadie eligió\|eligió" 200 && wait_for "La partida empieza" 30
    wait_for "Fin de la partida" 600 ;;
  noknife)
    R "csstv_ready_knife 0" >/dev/null; ready_all
    wait_for "La partida empieza" 15 ;;
esac
