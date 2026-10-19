#!/usr/bin/env bash
# Pruebas de !claim con bots: servidor local con la build CSSTV_DEBUG (SteamID falso por nombre de bot),
# cfg apuntado a la Supabase LOCAL (replanteo 01 a 18) y un game_servers con el token del cfg.
# Uso: bash claim.sh <user_id de una cuenta sin ficha>
# Las respuestas del plugin salen del log de SourceMod ("[respuesta a <bot>]").
set -u
source "$(dirname "$0")/../../2026-10-17-mixes-en-vivo/pruebas/lib.sh"
USER_ID="$1"
LOGS="$SRV/addons/sourcemod/logs"

uid() { Q "status" | sed -n "s/^# *\([0-9]*\) \"$1\" BOT.*/\1/p"; }
code() { SQL "insert into claim_codes(code, user_id, expires_at) values ('$1', '$USER_ID', now() + interval '$2') on conflict do nothing"; }
claim() { Q "csstv_debug_fakecmd $(uid "$1") sm_claim $2" >/dev/null; sleep "${3:-3}"; }
replies() { cat "$LOGS"/L*.log | grep -a "respuesta a $1\]" | tail -n "$2" | sed 's/^.*\[respuesta a /  [/'; }

B1="$(Q status | sed -n 's/^# *[0-9]* "\([^"]*\)" BOT.*/\1/p' | sed -n 1p)"
B2="$(Q status | sed -n 's/^# *[0-9]* "\([^"]*\)" BOT.*/\1/p' | sed -n 2p)"
B3="$(Q status | sed -n 's/^# *[0-9]* "\([^"]*\)" BOT.*/\1/p' | sed -n 3p)"
echo "Bots: $B1, $B2, $B3"

echo "1. Código bueno, cuenta sin ficha ($B1):"
code K7P2QX '10 minutes'; claim "$B1" K7P2QX; replies "$B1" 2
echo "2. Mismo SteamID con un código nuevo, después de 10 s ($B1):"
sleep 8; code K7P2QY '10 minutes'; claim "$B1" K7P2QY; replies "$B1" 2
echo "3. Otro SteamID, código en minúsculas ($B2): pedido de adicional"
code K7P2QZ '10 minutes'; claim "$B2" k7p2qz; replies "$B2" 2
echo "4. El mismo pedido otra vez ($B2), después de 10 s:"
sleep 8; code K7P2RA '10 minutes'; claim "$B2" K7P2RA; replies "$B2" 2
echo "5. Código inventado ($B3):"
claim "$B3" ZZZZZZ; replies "$B3" 2
echo "6. Dos pedidos seguidos ($B3):"
claim "$B3" ZZZZZY 1; replies "$B3" 1
echo "7. Formato malo y sin código ($B3):"
claim "$B3" abc 1; replies "$B3" 1
claim "$B3" "" 1; replies "$B3" 1
echo "8. Código vencido ($B3), después de 10 s:"
sleep 9; code K7P2RB '-1 minute'; claim "$B3" K7P2RB; replies "$B3" 2
echo "9. csstv_send 0 ($B3):"
Q "csstv_send 0" >/dev/null; sleep 9; claim "$B3" K7P2RC 1; replies "$B3" 1; Q "csstv_send 1" >/dev/null

echo "Base:"
SQL "select p.nick, s.steam_id, s.is_primary from player_steam_all s join players p on p.id = s.player_id where p.user_id = '$USER_ID'" | sed 's/^/  ficha: /'
SQL "select status, steam_id, nick from steam_requests where user_id = '$USER_ID'" | sed 's/^/  pedido: /'
SQL "select ok, nick, result from claim_log order by id desc limit 6" | sed 's/^/  registro: /'
