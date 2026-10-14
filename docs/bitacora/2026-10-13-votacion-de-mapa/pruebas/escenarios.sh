#!/usr/bin/env bash
# Pruebas de la votación de mapa con bots (servidor local, plugin compilado con CSSTV_DEBUG=,
# donde los bots cuentan como votantes). Uso: bash escenarios.sh <escenario>
# Antes: csstv_send 0 y la cola vacía (un cambio de mapa recarga el cfg con csstv_send 1).
source "$(dirname "$0")/../../2026-10-13-plugin-1-6-0/pruebas/lib.sh"
uids() { Q "status" | grep -o '# *[0-9]* "[^"]*" BOT' | grep -v SourceTV | grep -o '# *[0-9]*' | tr -dc '0-9
'; }
F() { R "csstv_debug_fakecmd $1 $2"; sleep 0.5; }   # comando como si lo escribiera ese bot
case "$1" in
  bots)   # 5 bots (5 votantes: hacen falta 3)
    R "csstv_send 0; csstv_include_bots 1; csstv_rtv_wait 0; csstv_rtv_cooldown 120; bot_kick; bot_join_after_player 0; mp_autoteambalance 0; mp_limitteams 0"
    for i in 1 2 3; do R "bot_add_t"; done; for i in 1 2; do R "bot_add_ct"; done; sleep 3; uids ;;
  rtv)    # !rtv, repetido, "rtv" en el chat, !unrtv
    set -- $(uids)
    F $1 "sm_rtv"; wait_for "quiere cambiar de mapa (1/3)" 5
    F $1 "sm_rtv"; wait_for "Ya pediste cambiar de mapa (1/3)" 5
    F $2 "say rtv"; wait_for "quiere cambiar de mapa (2/3)" 5
    F $2 "sm_unrtv"; wait_for "ya no quiere cambiar de mapa (1/3)" 5
    F $1 "sm_unrtv"; wait_for "ya no quiere cambiar de mapa (0/3)" 5 ;;
  buscar) # !vote con parte del nombre, sin coincidencias, varias coincidencias, mapa fuera de la lista
    set -- $(uids)
    F $1 "sm_vote zzz"; wait_for 'No hay ningún mapa que coincida con "zzz"' 5
    F $1 "sm_vote de_dust2"; wait_for "vota por de_dust2_ob" 5   # de_dust2 no está en la lista: la única coincidencia
    F $1 "sm_vote inferno"   # de_inferno y de_inferno_classic: abre el menú filtrado (no deja rastro en el log)
    F $1 "say !vote cache"; wait_for "vota por de_cache (1/3). Para cambiar de mapa: 1/3" 5
    F $1 "sm_nominate cache"; wait_for "Ya votaste por de_cache" 5
    F $1 "sm_unrtv"; wait_for "(0/3)" 5 ;;
  menu)   # !rtv + !vote llegan a 3 sin que un mapa tenga 3: abre la votación (sin humanos no se muestra)
    set -- $(uids)
    F $1 "sm_rtv"; F $2 "sm_vote mirage"; F $3 "sm_vote cache"
    wait_for "El mapa no cambia (nadie votó)" 5   # sin humanos SourceMod la cierra en el momento
    F $4 "sm_rtv"; wait_for "Hubo una votación hace poco" 5 ;;
  partida) # en partida no se vota y los votos se borran al empezar
    set -- $(uids)
    R "sm plugins reload csstv_reporter"; R "csstv_send 0; csstv_include_bots 1; csstv_rtv_wait 0"   # sin la espera de una votación anterior
    F $1 "sm_vote cache"; wait_for "vota por de_cache (1/3)" 5
    R "sm_live"; wait_for "La partida empieza" 10
    F $2 "sm_rtv"; wait_for "El mapa solo se puede votar en el calentamiento" 5
    R "sm_cancelmatch"; sleep 1; Q "sm_csstv_status" | grep "estado"
    F $2 "sm_vote cache"; wait_for "vota por de_cache (1/3)" 5;;   # 1/3: el voto de antes de la partida se borró
  cambio) # 3 votos por el mismo mapa: cambia directo (y !live queda bloqueado esos 5 s)
    set -- $(uids)
    F $1 "sm_vote nuke"; F $2 "sm_vote nuke"; F $3 "sm_vote nuke"
    wait_for "juntó los votos (3/3)" 5; wait_for "Cambiando a de_nuke_old_blue_ep en 5 s" 5
    Q "sm_live"
    sleep 15; Q "csstv_send 0"; Q "status" | grep "^map" ;;
  espera) # csstv_rtv_wait después de cargar el mapa
    Q "csstv_send 0"; R "csstv_rtv_wait 30"; set -- $(uids)
    [ -n "$1" ] && { F $1 "sm_rtv"; wait_for "Se puede votar el mapa en" 5; } ;;
esac
