#!/usr/bin/env bash
# Prueba con bots de la pausa automática en el servidor local. Sin contacto con Supabase: la URL apunta a
# 127.0.0.1 y la licencia entra por la validación guardada. Uso: escenario.sh <reporter debug .smx>
# El cfg y la licencia del servidor local se restauran al terminar.
set -u
SV=/c/Users/Agus/Downloads/cssds
REPO=/c/Users/Agus/Documents/repo
CS=$SV/cstrike
SM=$CS/addons/sourcemod
CFG=$CS/cfg/sourcemod/csstv_reporter.cfg
LOG=$SM/logs/L$(date +%Y%m%d).log
PW=$(grep -a -m1 '^rcon_password' "$CS/cfg/server.cfg" | sed -E 's/^rcon_password *"?([^" ]*)"?.*/\1/' | tr -d '\r')
A=127.0.0.1:27098
R() { for c in "$@"; do python "$REPO/docs/bitacora/2026-10-11-qol-servidor/pruebas/rcon.py" $A "$PW" "$c" >/dev/null 2>&1 || echo "RCON falló: $c"; done; }
mark() { echo; echo "=== $1"; OFF=$(stat -c %s "$LOG"); }
show() { tail -c +$((OFF + 1)) "$LOG" | grep -a -i -E "pausa|volvi|se fue|sigue en|empieza|en vivo|alltalk|Se termin" | sed -E 's/^L [^ ]+ - //' | cut -c1-125; }

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

mark "Arranque: aviso y partida"
python "$REPO/docs/bitacora/2026-10-11-qol-servidor/pruebas/rcon.py" $A "$PW" "sm_live mr15" 2>&1 | cut -c1-120
sleep 16
R "mp_freezetime 12" "mp_roundtime 1" "bot_stop 1"
show

mark "1. Se va a mitad de ronda y vuelve antes: no hay pausa y no se gasta"
R "bot_kill" ; sleep 8     # siguiente ronda
sleep 13                   # termina el freezetime
R "kick Albert"; sleep 2
R "bot_add_t Albert"; sleep 4
R "bot_kill"; sleep 9      # la próxima ronda arranca sin pausa
show

mark "2. Se va en freezetime: pausa, y termina cuando vuelve"
R "kick Allen"; sleep 5
R "bot_add_t Allen"; sleep 6
show

mark "3. Se va otro: ya no hay pausa"
R "kick Bert"; sleep 4
R "bot_add_ct Bert"; sleep 3
show

mark "4. Partida nueva: se va a mitad de ronda, pausa en la próxima, termina por tiempo"
R "sm_cancelmatch"; sleep 3
R "csstv_autopause_time 12" "sm_live mr15"
sleep 16
R "mp_freezetime 6"
R "bot_kill"; sleep 8; sleep 7
R "kick Bob"; sleep 2
R "bot_kill"; sleep 24
show
R "sm_cancelmatch"; sleep 3

Q() { python "$REPO/docs/bitacora/2026-10-11-qol-servidor/pruebas/rcon.py" $A "$PW" "$1" 2>&1 | grep -a -E "\"$1\" =" | cut -c1-50; }
mark "5. Medio tiempo: quietos, alltalk 10 s y vuelve solo"
R "bot_add_ct Bob"; sleep 2
R "sm_live mr1"
sleep 16
R "mp_freezetime 3"; sleep 5
R "bot_kill"
echo "alltalk al terminar la ronda: $(Q sv_alltalk)"
sleep 7; echo "alltalk +7 s: $(Q sv_alltalk)"
sleep 6; echo "alltalk +13 s: $(Q sv_alltalk)"
sleep 9; echo "alltalk +22 s: $(Q sv_alltalk)"
show
R "sm_cancelmatch"
sleep 1
echo; echo "=== errores"; grep -a "csstv_reporter" "$SM/logs/errors_$(date +%Y%m%d).log" | grep -a -v "validar la licencia" | tail -4 | cut -c1-160
