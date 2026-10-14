#!/usr/bin/env bash
# Escenarios con bots usados para probar la 1.6.0 en el servidor local ($2000$, csstv_send 0,
# plugin compilado con CSSTV_DEBUG= para tener el chat en el log). Se corrieron por partes:
# ./escenarios.sh team | knife | knife_timeout | recon | gg
# Los userid de los bots cambian en cada carga: mirarlos con  Q status.
cd "$(dirname "$0")" && source lib.sh
setup() {
  R "csstv_include_bots 1" "csstv_lo3 0" "csstv_abandon_players 0" "csstv_credits_interval 0" \
    "mp_autoteambalance 0" "mp_limitteams 0" "bot_join_after_player 0" >/dev/null
}
case "$1" in
  team)   # !team con nick, grupos, #userid, nick ambiguo y !swap
    setup
    Q "sm_team Shawn ct" "sm_team @ct ct" "sm_team @t spec" "sm_team @spec t" "sm_team a ct" \
      "sm_team @all spec" "sm_team @all t" "sm_team #6 ct" "sm_swap" "sleep:2" "sm_swap" ;;
  knife)  # cuchillo y !switch (primero lo intenta un bot del equipo que perdió)
    setup; R "csstv_knife_time 20" "sm_live knife mr2" >/dev/null
    wait_for "A cuchillo" 30
    R "csstv_debug_fakecmd ${CT:-7} sm_stay" >/dev/null          # todavía no hay ganador
    wait_for "Ganó la ronda de cuchillo" 180
    R "csstv_debug_fakecmd ${CT:-7} sm_switch" "sleep:1" "csstv_debug_fakecmd ${T:-8} sm_switch" >/dev/null
    wait_for "eligió" 10 && wait_for "La partida empieza" 10
    wait_for "Fin de la partida" 400 ;;
  knife_timeout)  # nadie elige; inventario en la ronda de cuchillo (requiere csstv_spike_armas)
    setup; R "csstv_knife_time 10" "sm_live knife mr3" >/dev/null
    wait_for "A cuchillo" 30; sleep 1; R "spike_inv ${CT:-7}" "spike_inv ${T:-8}" >/dev/null
    wait_for "Nadie eligió" 200 && wait_for "La partida empieza" 5 ;;
  recon)  # con la partida en vivo: sacar a un T y volver a meterlo como CT
    R "kick ${NAME:-Nick}" "sleep:2" "bot_add_ct ${NAME:-Nick}" >/dev/null
    wait_for "volvió y sigue" 15 ;;
  gg)     # 2 vs 2, csstv_gg_missing 0: votan los dos del equipo que pierde (uno vota dos veces)
    setup; R "csstv_gg_min_diff 1" "csstv_gg_missing 0" "sm_live mr3" >/dev/null
    wait_for "Ronda 2/6" 240
    R "csstv_debug_fakecmd $A sm_gg" "sleep:1" "csstv_debug_fakecmd $A sm_gg" "sleep:1" "csstv_debug_fakecmd $B sm_gg" >/dev/null
    wait_for "se rindió" 15 ;;
esac
