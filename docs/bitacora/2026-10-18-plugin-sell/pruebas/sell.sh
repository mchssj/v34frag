#!/usr/bin/env bash
# Pruebas de !sell con bots: servidor local con csstv_sell compilado con SELL_DEBUG y csstv_reporter apartado.
# Uso: ADDR=127.0.0.1:27016 bash sell.sh
# Los bots no obedecen "buy" (solo compran con su IA), así que compran con csstv_sell_fakebuy, que hace lo mismo
# que el juego en el mismo frame. Venden con "sm_sell all" (no pueden usar menús).
# Lo que el plugin anota y responde sale del log de SourceMod ("[sell]" y "[respuesta a <bot>]").
set -u
RCON="E:/Css V34 Web/v34frag/docs/bitacora/2026-10-11-qol-servidor/pruebas/rcon.py"
SRV="E:/CSS DEDICATED SERVER/server/cstrike"
ADDR="${ADDR:-127.0.0.1:27016}"
PASS="$(sed -n 's/^rcon_password "\(.*\)"/\1/p' "$SRV/cfg/server.cfg")"
LOGS="$SRV/addons/sourcemod/logs"
Q() { python "$RCON" "$ADDR" "$PASS" "$@" 2>&1 | grep -av "rcon from"; }

uid() { Q "status" | sed -n "s/^# *\([0-9]*\) \"$1\" BOT.*/\1/p"; }
buy() { Q "csstv_sell_fakebuy $(uid "$1") $2" >/dev/null; sleep 0.3; }
cmd() { Q "csstv_sell_fakecmd $(uid "$1") $2" >/dev/null; sleep 0.3; }
sell() { cmd "$1" "sm_sell all"; }
dump() { Q "csstv_sell_dump $(uid "$1") ${2:-} ${3:-} ${4:-}" | grep -a "ventana" | sed 's/^/  /'; }
said() { grep -ah "respuesta a $1\]" "$LOGS"/L*.log | tail -n "${2:-1}" | sed 's/^.*\[v34frag\] /  -> /'; }
newround() { Q "mp_restartgame 1" >/dev/null; sleep 2.5; }

# bot_eco_limit alto: los bots no compran solos (así no se mezcla su IA con las compras de la prueba).
Q "mp_freezetime 15" "mp_startmoney 15000" "bot_eco_limit 16000" "bot_stop 1" "bot_kick" "bot_join_after_player 0" \
  "mp_autoteambalance 0" "mp_limitteams 0" "bot_quota 0" "bot_add_ct" "bot_add_t" >/dev/null
sleep 2
CT="$(Q status | sed -n 's/^# *[0-9]* "\([^"]*\)" BOT.*/\1/p' | sed -n 1p)"
T="$(Q status | sed -n 's/^# *[0-9]* "\([^"]*\)" BOT.*/\1/p' | sed -n 2p)"
echo "Bots: CT $CT, T $T"
newround

echo "1. Una sola compra (AK del T) y venta:"
dump "$T"; buy "$T" ak47; dump "$T"; sell "$T"; said "$T"; dump "$T"
echo "2. Varias en el mismo frame (chaleco + casco, HE, 2 flash):"
buy "$T" "vesthelm hegrenade flashbang flashbang"; dump "$T"; sell "$T"; said "$T"; dump "$T"
echo "3. Sin compras:"
sell "$T"; said "$T"
echo "4. Deagle del CT (la USP queda en el piso), kit y visión nocturna por separado:"
dump "$CT"; buy "$CT" deagle; buy "$CT" defuser; buy "$CT" nvgs; dump "$CT"; sell "$CT"; said "$CT"; dump "$CT"
echo "5. Chaleco dañado (100 -> 80): no se vende; el AK de la misma ronda sí:"
newround; buy "$T" vest; buy "$T" ak47; dump "$T" 80; sell "$T"; said "$T"; dump "$T"
echo "6. Granadas: 2 flash compradas y 1 lanzada (en v34 no se tiran al piso): se venden 1 flash y el humo:"
buy "$T" "flashbang smokegrenade"; buy "$T" flashbang; dump "$T"; dump "$T" - - 1; sell "$T"; said "$T"; dump "$T"
echo "7. Arma tirada al piso: no se vende:"
buy "$T" m4a1; cmd "$T" "use weapon_m4a1"; cmd "$T" "drop"; dump "$T"; sell "$T"; said "$T"
echo "8. Tope de 16000 (plata en 15900 después de comprar):"
buy "$T" awp; dump "$T" - 15900; sell "$T"; said "$T"; dump "$T"
echo "9. Afuera de la ventana (comprada al principio, vendida a los 21 s):"
newround; buy "$T" famas; sleep 21; dump "$T"; sell "$T"; said "$T"
echo "10. Ronda nueva: lo anterior ya no se vende:"
newround; sell "$T"; said "$T"
echo "11. Muerto:"
Q "sm_slay @t" >/dev/null 2>&1; Q "csstv_sell_fakecmd $(uid "$T") kill" >/dev/null; sleep 0.5; sell "$T"; said "$T"
