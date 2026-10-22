#!/usr/bin/env bash
# Prueba del nombre CMLeague con bots (reporter compilado con CSSTV_DEBUG=, que deja el chat en el log).
# Uso: ADDR=127.0.0.1:27016 bash nombre.sh
# El cfg local no define csstv_chat_tag: se prueba el valor por defecto nuevo.
# Tiempos cortos: partida mr2 en $2000$ con 3 bots contra 1.
set -u
RCON="E:/Css V34 Web/v34frag/docs/bitacora/2026-10-11-qol-servidor/pruebas/rcon.py"
SRV="E:/CSS DEDICATED SERVER/server/cstrike"
ADDR="${ADDR:-127.0.0.1:27016}"
PASS="$(sed -n 's/^rcon_password "\(.*\)"/\1/p' "$SRV/cfg/server.cfg")"
LOGS="$SRV/addons/sourcemod/logs"
Q() { python "$RCON" "$ADDR" "$PASS" "$@" 2>&1 | grep -av "rcon from"; }
mark() { sleep 0.3; LAST="$(ls -t "$LOGS"/L*.log | head -1)"; LINES="$(wc -l < "$LAST")"; }
chat() { tail -n +"$((LINES + 1))" "$LAST" | grep -a "\[chat todos\]" | sed 's/^.*\[chat todos\] /  /'; }

Q "csstv_send 0" >/dev/null
echo "1. Versiones y autor"
Q "sm plugins list" | grep -a "CSSTV\|csstv"
for p in csstv_reporter csstv_sell csstv_calladmin csstv_allchat; do Q "sm plugins info $p" | grep -a "Author\|Version"; done

echo "2. Valor por defecto del prefijo"
Q "csstv_chat_tag"

Q "csstv_tips_interval 0" "csstv_credits_interval 0" "csstv_include_bots 1" "csstv_min_players 2" \
  "csstv_abandon_players 0" "csstv_overtime 0" "csstv_lo3 0" "csstv_end_delay 2" "csstv_halftime_delay 1" \
  "mp_freezetime 1" "bot_kick" "bot_join_after_player 0" "mp_autoteambalance 0" \
  "mp_limitteams 0" "bot_quota 0" "bot_add_t" "bot_add_t" "bot_add_t" "bot_add_ct" >/dev/null
sleep 2

echo "3. Partida mr2: mensajes y resumen final con [CMLeague]"
mark; Q "sm_live force mr2" >/dev/null
for _ in $(seq 1 90); do sleep 2; tail -n +"$((LINES + 1))" "$LAST" | grep -aq "Discord: dsc.gg" && break; done
chat | head -8; echo "  ..."; chat | sed -n '/Fin de la partida\|se rindió/,$p'

echo "4. Con csstv_chat_tag cambiado, el prefijo sigue al cfg"
mark; Q "csstv_chat_tag Prueba" "csstv_tips_interval 2" >/dev/null; sleep 3; Q "csstv_tips_interval 0" "csstv_chat_tag CMLeague" >/dev/null; chat | head -2
