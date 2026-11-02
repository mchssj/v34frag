#!/usr/bin/env bash
# Prueba con bots del alltalk del medio tiempo (2.8.3 / 2.7.4) en el servidor local, sin contacto con Supabase,
# como escenario.sh. Uso: medio_tiempo.sh <reporter debug .smx>
# Muestra sv_alltalk segundo a segundo desde el final de la mitad y cuándo empieza la ronda siguiente.
set -u
SV=/c/Users/Agus/Downloads/cssds
REPO=/c/Users/Agus/Documents/repo
CS=$SV/cstrike
SM=$CS/addons/sourcemod
CFG=$CS/cfg/sourcemod/csstv_reporter.cfg
LOG=$SM/logs/L$(date +%Y%m%d).log
PW=$(grep -a -m1 '^rcon_password' "$CS/cfg/server.cfg" | sed -E 's/^rcon_password *"?([^" ]*)"?.*/\1/' | tr -d '\r')
A=127.0.0.1:27098
RC="$REPO/docs/bitacora/2026-10-11-qol-servidor/pruebas/rcon.py"
R() { for c in "$@"; do python "$RC" $A "$PW" "$c" >/dev/null 2>&1 || echo "RCON falló: $c"; done; }
Q() { python "$RC" $A "$PW" "$1" 2>&1 | grep -a -o -E "\"$1\" = \"[^\"]*\"" | cut -d'"' -f4; }

cp "$CFG" /tmp/rep.cfg.bak
cp "$SM/plugins/csstv_reporter.smx" /tmp/rep.smx.bak 2>/dev/null
cp "$SM/data/csstv/license.txt" /tmp/lic.bak 2>/dev/null
rm -f "$SM"/data/csstv/queue/* 2>/dev/null
restore() {
  taskkill //IM srcds.exe //F >/dev/null 2>&1
  cp /tmp/rep.cfg.bak "$CFG"
  rm -f "$SM/plugins/csstv_reporter.smx"
  [ -f /tmp/rep.smx.bak ] && cp /tmp/rep.smx.bak "$SM/plugins/csstv_reporter.smx"
  [ -f /tmp/lic.bak ] && cp /tmp/lic.bak "$SM/data/csstv/license.txt"
  rm -f "$SM"/data/csstv/queue/* 2>/dev/null
}
trap restore EXIT

sed -i -E 's#^csstv_api_url .*#csstv_api_url "http://127.0.0.1:9/rest/v1/rpc/ingest_server_chunk"#; s/^csstv_send .*/csstv_send "0"/; s/^csstv_include_bots .*/csstv_include_bots "1"/; s/^csstv_min_players .*/csstv_min_players "1"/' "$CFG"
date +%s > "$SM/data/csstv/license.txt"
cp "$1" "$SM/plugins/csstv_reporter.smx"

WD=$(cd "$SV" && pwd -W)
powershell.exe -NoProfile -Command "Start-Process -FilePath '$WD/srcds.exe' -WorkingDirectory '$WD' -ArgumentList '-console -game cstrike -ip 127.0.0.1 -port 27098 -tickrate 66 -insecure +maxplayers 12 +map de_dust2'"
sleep 28
R "bot_join_after_player 0" "bot_add_t Albert" "bot_add_t Allen" "bot_add_ct Bert" "bot_add_ct Bob"
sleep 5
R "sm_live mr1"
sleep 16
R "mp_freezetime 15" "bot_stop 1"
sleep 2
OFF=$(stat -c %s "$LOG")
R "bot_kill"                    # en MR1 la primera ronda es la mitad
T0=$(date +%s)
for i in $(seq 0 30); do
  echo "+$(( $(date +%s) - T0 )) s  sv_alltalk=$(Q sv_alltalk)"
  sleep 0.6
done
echo; echo "=== log desde el final de la mitad"
tail -c +$((OFF + 1)) "$LOG" | grep -a -i -E "medio tiempo|alltalk|en vivo|restart|reinicio|Se termin|World triggered|Round_" | sed -E 's/^L [^ ]+ - //' | cut -c1-125
R "sm_cancelmatch"
sleep 1
echo; echo "=== errores"; grep -a "csstv_reporter" "$SM/logs/errors_$(date +%Y%m%d).log" | grep -a -v "validar la licencia" | tail -4 | cut -c1-160
