#!/usr/bin/env bash
# Prueba en el servidor LOCAL el nombre de la web con la partida en vivo (bots, csstv_send 0, nada sale a la web).
# Uso: probar_local.sh <raiz_srcds> <rcon.py> <reporter.smx> <qol.smx> [simple]
# Cambia csstv_reporter.smx y csstv_qol.smx del servidor local, prueba, apaga y los deja como estaban.
set -u
SV="$1"; RC="$2"; REP="$3"; QOL="$4"; MODO="${5:-}"
CS="$SV/cstrike"; PL="$CS/addons/sourcemod/plugins"; A=127.0.0.1:27016; OK=0; MAL=0
tasklist 2>/dev/null | grep -qi srcds && { echo "Hay un srcds corriendo."; exit 1; }
PW=$(grep -a -m1 '^rcon_password' "$CS/cfg/server.cfg" | sed -E 's/^rcon_password *"?([^" ]*)"?.*/\1/' | tr -d '\r')
BK=$(mktemp -d); cp "$PL/csstv_reporter.smx" "$PL/csstv_qol.smx" "$BK/"
fin() { taskkill //IM srcds.exe //F >/dev/null 2>&1; sleep 2; cp "$BK"/*.smx "$PL/"; rm -f "$CS"/addons/sourcemod/data/csstv/queue/* "$CS"/addons/sourcemod/data/csstv/live/e2e-* 2>/dev/null; }
trap fin EXIT; trap "exit 1" TERM INT
cp "$REP" "$PL/csstv_reporter.smx"; cp "$QOL" "$PL/csstv_qol.smx"
rcon() { PYTHONIOENCODING=utf-8 python "$RC" $A "$PW" "$1" 2>/dev/null; }
uid() { rcon status | grep -a -F "\"$1\"" | sed -E 's/^# *([0-9]+) .*/\1/' | head -1; }
esta() { rcon status | grep -a -q -F "\"$1\""; }
# "log off / log on" vacía el log del juego antes de contar.
cambios() { rcon "log off" >/dev/null; sleep 1; local n; n=$(cat "$CS"/logs/*.log 2>/dev/null | grep -a -c "changed name"); rcon "log on" >/dev/null; echo "$n"; }
ver() { if [ "$2" = 1 ]; then OK=$((OK+1)); echo "  OK: $1"; else MAL=$((MAL+1)); echo "  FALLA: $1 | $(rcon status | grep -a BOT | grep -a -oE '"[^"]+"' | tr '\n' ' ')"; fi; }
fake() { rcon "csstv_webnick_fake $1 $2" >/dev/null; }
WD=$(cd "$SV" && pwd -W)
powershell.exe -NoProfile -Command "Start-Process -WindowStyle Minimized -FilePath '$WD/srcds.exe' -WorkingDirectory '$WD' -ArgumentList '-console -game cstrike -ip 127.0.0.1 -port 27016 +maxplayers 20 +map de_dust2 -tickrate 66 -insecure'"
for i in $(seq 1 60); do rcon status | grep -a -q "de_dust2" && break; sleep 1; done; sleep 3
for c in "csstv_send 0" "log on" "bot_quota_mode normal" "bot_join_after_player 0" "bot_chatter off" "mp_autoteambalance 0" "mp_limitteams 0" "bot_stop 1" "csstv_auto_ready 0" "bot_add_ct Brett" "bot_add_ct Arnold" "bot_add_t Kurt" "bot_add_t Zed" "bot_add_ct Wade"; do rcon "$c" >/dev/null; done; sleep 4
echo "reporter: $(rcon 'sm plugins info csstv_reporter.smx' | grep -a -i version | tr -d '\r' | xargs)  qol: $(rcon 'sm plugins info csstv_qol.smx' | grep -a -i version | tr -d '\r' | xargs)"
contar() { local n0 n1; n0=$(cambios); "${@:2}"; sleep "$1"; n1=$(cambios); N=$((n1 - n0)); }

if [ "$MODO" != simple ]; then
  echo "== Calentamiento"
  contar 3 fake "$(uid Brett)" FichaBrett; ver "ficha en el calentamiento ($N cambios)" "$([ $N -le 2 ] && esta FichaBrett && echo 1)"
  contar 3 rcon "sm_rename FichaBrett Otro" >/dev/null; ver "se cambia y vuelve ($N)" "$([ $N -le 4 ] && esta FichaBrett && echo 1)"
fi
if [ "$MODO" != simple ]; then
  echo "== Ronda de cuchillo"
  rcon "sm_live knife" >/dev/null; sleep 12
  contar 4 fake "$(uid Wade)" FichaWade; ver "la ficha llega en el cuchillo ($N), $(rcon csstv_state | grep -a -oE '= "[^"]*"')" "$([ $N -le 2 ] && esta FichaWade && echo 1)"
  rcon "sm_cancelmatch" >/dev/null; rcon "sm_endmatch" >/dev/null; rcon "changelevel de_dust2" >/dev/null; sleep 12; for c in "csstv_send 0" "log on" "bot_stop 1" "csstv_auto_ready 0"; do rcon "$c" >/dev/null; done
  rcon status | grep -a -q Wade || { rcon "bot_kick" >/dev/null; sleep 2; }
  for b in "ct Brett" "ct Arnold" "t Kurt" "t Zed" "ct Wade"; do esta "${b#* }" || rcon "bot_add_$b" >/dev/null; done; sleep 4
fi
echo "== En vivo"
rcon "sm_live mr2" >/dev/null; sleep 12
contar 5 fake "$(uid Kurt)" FichaKurt; ver "la ficha llega en vivo ($N cambios en 5 s)" "$([ $N -le 2 ] && esta FichaKurt && echo 1)"
if [ "$MODO" != simple ]; then
  contar 3 rcon "sm_rename FichaKurt KurtTrucho" >/dev/null; ver "en vivo, con ficha, se cambia y vuelve ($N)" "$([ $N -le 4 ] && esta FichaKurt && echo 1)"
  rcon "csstv_webnick_fake $(uid Arnold) FichaArnold 1" >/dev/null; contar 3 rcon "sm_rename Arnold ArnoldVip" >/dev/null; ver "en vivo, un VIP se lo cambia ($N)" "$([ $N -le 2 ] && esta ArnoldVip && echo 1)"
  contar 3 rcon "sm_rename Wade WadeTrucho" >/dev/null; ver "en vivo, sin ficha, vuelve al suyo ($N)" "$([ $N -le 4 ] && esta Wade && echo 1)"
  contar 5 fake "$(uid Zed)" FichaKurt; ver "nombre repetido, sin bucle ($N)" "$([ $N -le 6 ] && echo 1)"; echo "     quedó: $(rcon status | grep -a BOT | grep -a -oE '"[^"]+"' | tr '\n' ' ')"
  for x in 1 2 3 4 5 6 7 8; do rcon "sm_rename Brett Spam$x" >/dev/null; rcon "sm_rename Spam$x Spam" >/dev/null; done; sleep 16; ver "spam de cambios: lo frena el tope y al final vuelve" "$(esta Brett && echo 1)"
  for raro in '100%d%s' '#Cstrike' 'a{b}c' '~tilde' '"con espacio"' 'ñandú✿' '12345678901234567890123456789012345'; do
    contar 4 fake "$(rcon status | grep -a BOT | tail -1 | sed -E 's/^# *([0-9]+) .*/\1/')" "$raro"; ver "nombre $raro, sin bucle ($N): $(rcon status | grep -a BOT | tail -1 | grep -a -oE '"[^"]+"')" "$([ $N -le 6 ] && echo 1)"
  done
fi
echo "== $OK bien, $MAL fallas"; grep -a "Nombre de la web" "$CS/addons/sourcemod/logs/L$(date +%Y%m%d).log" | tail -14 | cut -c1-150
grep -a -iE "csstv_(reporter|qol)" "$CS/addons/sourcemod/logs/errors_$(date +%Y%m%d).log" 2>/dev/null | tail -3 | cut -c1-200
