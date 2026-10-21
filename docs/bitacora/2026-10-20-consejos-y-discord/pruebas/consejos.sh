#!/usr/bin/env bash
# Pruebas de los consejos del chat y la línea del Discord con bots (reporter compilado con CSSTV_DEBUG=).
# Uso: ADDR=127.0.0.1:27016 bash consejos.sh
# Con CSSTV_DEBUG cada mensaje a todos queda en el log de SourceMod como "[chat todos]".
# Tiempos cortos: consejos cada 3 s, partida mr2 en $2000$ con 3 bots contra 1.
set -u
RCON="E:/Css V34 Web/v34frag/docs/bitacora/2026-10-11-qol-servidor/pruebas/rcon.py"
SRV="E:/CSS DEDICATED SERVER/server/cstrike"
ADDR="${ADDR:-127.0.0.1:27016}"
PASS="$(sed -n 's/^rcon_password "\(.*\)"/\1/p' "$SRV/cfg/server.cfg")"
LOGS="$SRV/addons/sourcemod/logs"
Q() { python "$RCON" "$ADDR" "$PASS" "$@" 2>&1 | grep -av "rcon from"; }
mark() { sleep 0.3; LAST="$(ls -t "$LOGS"/L*.log | head -1)"; LINES="$(wc -l < "$LAST")"; }
chat() { tail -n +"$((LINES + 1))" "$LAST" | grep -a "\[chat todos\]" | sed 's/^.*\[chat todos\] /  /'; }
state() { Q sm_csstv_status | grep -ao "estado: [^·]*"; }

Q "csstv_send 0" "csstv_tips_interval 0" "csstv_credits_interval 0" "csstv_include_bots 1" "csstv_min_players 2" \
  "csstv_abandon_players 0" "csstv_overtime 0" "csstv_lo3 0" "csstv_end_delay 2" "csstv_halftime_delay 1" \
  "csstv_pause_time 10" "mp_freezetime 1" "bot_kick" "bot_join_after_player 0" "mp_autoteambalance 0" \
  "mp_limitteams 0" "bot_quota 0" "bot_add_t" "bot_add_t" "bot_add_t" "bot_add_ct" >/dev/null
sleep 2

echo "1. Calentamiento, todo prendido (9 x 3 s): no salen !pause ni !gg"
state; mark; Q "csstv_tips_interval 3" >/dev/null; sleep 28; Q "csstv_tips_interval 0" >/dev/null; chat

echo "2. Calentamiento con csstv_sell 0 y csstv_calladmin_enabled 0: tampoco salen !sell ni !calladmin"
Q "csstv_sell 0" "csstv_calladmin_enabled 0" >/dev/null
mark; Q "csstv_tips_interval 3" >/dev/null; sleep 22; Q "csstv_tips_interval 0" >/dev/null; chat
Q "csstv_sell 1" "csstv_calladmin_enabled 1" >/dev/null

echo "3. Cvars cambiadas (ventana 0, 3 pausas de 30 s en modo 1, gg 5 sin faltantes) y en vivo: no salen !rtv ni !ready"
Q "csstv_sell_window 0" "csstv_pause_mode 1" "csstv_pause_max 3" "csstv_pause_time 30" "csstv_gg_min_diff 5" "csstv_gg_missing 0" \
  "csstv_maxrounds 30" "sm_live force" >/dev/null
sleep 3; state; mark; Q "csstv_tips_interval 3" >/dev/null; sleep 28; Q "csstv_tips_interval 0" >/dev/null; chat
Q "csstv_sell_window 5" "csstv_pause_mode 3" "csstv_pause_max 2" "csstv_pause_time 10" "csstv_gg_min_diff 8" "csstv_gg_missing 1" \
  "sm_cancelmatch" >/dev/null
sleep 3

echo "4. Fin de la partida (mr2): la última línea es la del Discord"
mark; Q "sm_live force mr2" >/dev/null
for _ in $(seq 1 90); do sleep 2; tail -n +"$((LINES + 1))" "$LAST" | grep -aq "Discord: dsc.gg" && break; done
chat | sed -n '/Fin de la partida\|se rindió/,$p'
state
