#!/usr/bin/env bash
# Prueba el reporter 2.12.0 (baneos) en el servidor LOCAL con bots y la base local apagada (prueba el caso "la web no
# responde": todo queda en la cola a disco). Nada sale a producción: csstv_api_url del servidor local es 127.0.0.1.
# Uso: probar_local.sh <raiz_srcds> <rcon.py> <reporter.smx>
# Cambia csstv_reporter.smx y data/csstv/bans*.txt del servidor local, prueba, apaga y los deja como estaban.
set -u
SV="$1"; RC="$2"; REP="$3"
# Sin SourceTV (-nohltv): el 27020 lo puede tener ocupado el juego abierto en la misma PC.
CS="$SV/cstrike"; PL="$CS/addons/sourcemod/plugins"; DT="$CS/addons/sourcemod/data/csstv"; A=127.0.0.1:27016; OK=0; MAL=0
tasklist 2>/dev/null | grep -qi srcds && { echo "Hay un srcds corriendo."; exit 1; }
grep -a -q '^csstv_api_url "http://127.0.0.1' "$CS/cfg/sourcemod/csstv_reporter.cfg" || { echo "El servidor local no apunta a la base local."; exit 1; }
PW=$(grep -a -m1 '^rcon_password' "$CS/cfg/server.cfg" | sed -E 's/^rcon_password *"?([^" ]*)"?.*/\1/' | tr -d '\r')
BK=$(mktemp -d); cp "$PL/csstv_reporter.smx" "$BK/"; cp "$CS/cfg/banned_user.cfg" "$BK/" 2>/dev/null; ls "$DT/queue" > "$BK/queue.txt"
fin() {
  taskkill //IM srcds.exe //F >/dev/null 2>&1; sleep 2; cp "$BK/csstv_reporter.smx" "$PL/"; rm -f "$DT/bans.txt" "$DT/bans_pend.txt"
  [ -f "$BK/banned_user.cfg" ] && cp "$BK/banned_user.cfg" "$CS/cfg/"
  for f in "$DT"/queue/*; do [ -e "$f" ] && ! grep -qxF "$(basename "$f")" "$BK/queue.txt" && rm -f "$f"; done
}
trap fin EXIT; trap "exit 1" TERM INT
cp "$REP" "$PL/csstv_reporter.smx"
printf 'STEAM_0:1:111|0;STEAM_0:0:222|1999999999;STEAM_0:0:333|1000\n203.0.113.0/24|0|STEAM_0:1:5,STEAM_0:0:6;198.51.100.7/32|1999999999|\n' > "$DT/bans.txt"
rm -f "$DT/bans_pend.txt"
rcon() { PYTHONIOENCODING=utf-8 python "$RC" $A "$PW" "$1" 2>/dev/null; }
uid() { rcon status | grep -a -F "\"$1\"" | sed -E 's/^# *([0-9]+) .*/\1/' | head -1; }
esta() { rcon status | grep -a -q -F "\"$1\""; }
ver() { if [ "$2" = 1 ]; then OK=$((OK+1)); echo "  OK: $1"; else MAL=$((MAL+1)); echo "  FALLA: $1"; fi; }
t() { rcon "csstv_bans_test $1 $2" | tr -d '\r'; }
pend() { grep -a -c "^$1" "$DT/bans_pend.txt" 2>/dev/null || echo 0; }
WD=$(cd "$SV" && pwd -W)
powershell.exe -NoProfile -Command "Start-Process -WindowStyle Minimized -FilePath '$WD/srcds.exe' -WorkingDirectory '$WD' -ArgumentList '-console -game cstrike -ip 127.0.0.1 -port 27016 +maxplayers 20 +map de_dust2 -tickrate 66 -insecure -nohltv +tv_enable 0'"
for i in $(seq 1 60); do rcon status | grep -a -q "de_dust2" && break; sleep 1; done; sleep 3
for c in "bot_quota_mode normal" "bot_join_after_player 0" "bot_chatter off" "bot_stop 1" "csstv_auto_ready 0" "bot_add_ct Brett" "bot_add_t Kurt"; do rcon "$c" >/dev/null; done; sleep 3
echo "reporter: $(rcon 'sm plugins info csstv_reporter.smx' | grep -a -i version | tr -d '\r' | xargs)"

echo "== Copia local (bans.txt)"
ver "carga 3 SteamID y 2 IPs" "$(rcon sm_csstv_bans | grep -a -q '3 SteamID y 2 IPs' && echo 1)"
ver "SteamID permanente" "$(t STEAM_1:1:111 1.2.3.4 | grep -a -q 'por SteamID' && echo 1)"
ver "SteamID con vencimiento futuro" "$(t STEAM_0:0:222 1.2.3.4 | grep -a -q 'por SteamID' && echo 1)"
ver "SteamID vencido no" "$(t STEAM_0:0:333 1.2.3.4 | grep -a -q 'no baneado' && echo 1)"
ver "IP dentro del rango" "$(t STEAM_0:1:77 203.0.113.200 | grep -a -q 'por IP' && echo 1)"
ver "IP fuera del rango" "$(t STEAM_0:1:77 203.0.114.1 | grep -a -q 'no baneado' && echo 1)"
ver "exceptuado en el rango" "$(t STEAM_1:0:6 203.0.113.9 | grep -a -q 'no baneado' && echo 1)"
ver "IP exacta (/32)" "$(t STEAM_0:1:77 198.51.100.7 | grep -a -q 'por IP' && echo 1)"
ver "la de al lado de la exacta no" "$(t STEAM_0:1:77 198.51.100.8 | grep -a -q 'no baneado' && echo 1)"

echo "== Expulsión (csstv_bans_fake)"
rcon "csstv_bans_fake $(uid Kurt) 60 Cheats" >/dev/null; sleep 2
ver "echa al bot" "$(esta Kurt || echo 1)"

echo "== !banip, !unbanip, !unban y sm_addban (la web no responde: a la cola)"
ver "rango demasiado grande, rechazado" "$(rcon 'sm_banip 10.0.0.0/8 60 x' | grep -a -q 'inválido' && echo 1)"
ver "IP inválida, rechazada" "$(rcon 'sm_banip 300.1.1.1 60 x' | grep -a -q 'inválido' && echo 1)"
ver "banea un /24" "$(rcon 'sm_banip 192.0.2.0/24 60 Prueba de rango' | grep -a -q 'Baneada 192.0.2.0/24' && echo 1)"
ver "la copia lo tiene al instante" "$(t STEAM_0:1:77 192.0.2.50 | grep -a -q 'por IP' && echo 1)"
rcon "sm_unbanip 192.0.2.0/24" >/dev/null
ver "!unbanip lo saca de la copia" "$(t STEAM_0:1:77 192.0.2.50 | grep -a -q 'no baneado' && echo 1)"
rcon "sm_unban STEAM_0:1:111" >/dev/null
ver "!unban lo saca de la copia" "$(t STEAM_0:1:111 1.2.3.4 | grep -a -q 'no baneado' && echo 1)"
rcon "sm_addban 30 STEAM_1:1:999 Prueba" >/dev/null
ver "sm_addban entra a la copia" "$(t STEAM_0:1:999 1.2.3.4 | grep -a -q 'por SteamID' && echo 1)"
ver "sm_addban no escribe banned_user.cfg" "$(grep -a -q '1:999' "$CS/cfg/banned_user.cfg" 2>/dev/null || echo 1)"
sleep 4
ver "en la cola: ip_add, ip_lift, ban_lift y ban_add" "$([ "$(pend csstv_ban_ip_add)" -ge 1 ] && [ "$(pend csstv_ban_ip_lift)" -ge 1 ] && [ "$(pend csstv_ban_lift)" -ge 1 ] && [ "$(pend csstv_ban_add)" -ge 1 ] && echo 1)"
echo "     cola: $(cut -f1 "$DT/bans_pend.txt" 2>/dev/null | tr '\n' ' ')"
rcon sm_csstv_bans >/dev/null; sleep 4
ver "sincronizar sin la web deja la copia como estaba" "$(t STEAM_0:0:222 1.2.3.4 | grep -a -q 'por SteamID' && echo 1)"

echo "== csstv_bans 0"
rcon "csstv_bans 0" >/dev/null
ver "!banip vuelve al de SourceMod" "$(rcon 'sm_banip 192.0.2.9 5 x' | grep -a -qv 'Vale en los tres' && echo 1)"
rcon "csstv_bans 1" >/dev/null

echo "== $OK bien, $MAL fallas"
grep -a "Baneo:" "$CS/addons/sourcemod/logs/L$(date +%Y%m%d).log" | tail -4 | cut -c1-160
grep -a -iE "csstv_reporter|bans" "$CS/addons/sourcemod/logs/errors_$(date +%Y%m%d).log" 2>/dev/null | tail -4 | cut -c1-200
