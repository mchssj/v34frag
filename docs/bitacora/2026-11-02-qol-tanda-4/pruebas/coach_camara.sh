#!/usr/bin/env bash
# Cámara del coach (csstv_coach 1.1.1): primera persona es el modo 3 en este motor en el servidor local, sin contacto con Supabase.
# Uso: coach_camara.sh <carpeta con los .smx>
#   csstv_reporter_dbg (CSSTV_DEBUG), csstv_qol, csstv_coach, csstv_pedir, v34_retake, v34_dm y qol_prueba
#   (pruebas/qol_prueba.sp de esta carpeta).
# Arranca con -condebug para contar en cstrike/console.log lo que llega a la consola.
# El cfg, la licencia y los plugins del servidor local se restauran al terminar.
set -u
B=$1
SV=/c/Users/Agus/Downloads/cssds
REPO=/c/Users/Agus/Documents/repo
CS=$SV/cstrike
SM=$CS/addons/sourcemod
CFG=$CS/cfg/sourcemod/csstv_reporter.cfg
LOG=$SM/logs/L$(date +%Y%m%d).log
CON=$CS/console.log
PW=$(grep -a -m1 '^rcon_password' "$CS/cfg/server.cfg" | sed -E 's/^rcon_password *"?([^" ]*)"?.*/\1/' | tr -d '\r')
A=127.0.0.1:27098
RC="$REPO/docs/bitacora/2026-10-11-qol-servidor/pruebas/rcon.py"
R() { for c in "$@"; do python "$RC" $A "$PW" "$c" >/dev/null 2>&1 || echo "RCON falló: $c"; done; }
O() { python "$RC" $A "$PW" "$1" 2>&1 | tr -d '\r' | grep -a -o -E "${2:-\[t\]}.*" | head -${3:-2}; }
mark() { echo; echo "=== $1"; OFF=$(stat -c %s "$LOG"); }
show() { tail -c +$((OFF + 1)) "$LOG" | grep -a -i -E "$1" | sed -E 's/^L [^ ]+ - //' | cut -c1-170 | sort -u | head -${2:-8}; }
spam() { local n; n=$(grep -a -c -E "$1" "$CON" 2>/dev/null); echo "${n:-0}"; }

T=$(mktemp -d)
cp "$CFG" "$T/rep.cfg"
cp "$SM/data/csstv/license.txt" "$T/lic" 2>/dev/null
cp "$SM/plugins/v34_retake.smx" "$T/v34_retake.smx"
rm -f "$SM"/data/csstv/queue/* "$CON" 2>/dev/null
restore() {
  taskkill //IM srcds.exe //F >/dev/null 2>&1
  cp "$T/rep.cfg" "$CFG"
  cp "$T/v34_retake.smx" "$SM/plugins/v34_retake.smx"
  rm -f "$SM/plugins/csstv_reporter.smx" "$SM/plugins/csstv_qol.smx" "$SM/plugins/csstv_coach.smx" "$SM/plugins/csstv_pedir.smx" "$SM/plugins/v34_dm.smx" "$SM/plugins/qol_prueba.smx"
  rm -f "$CS/cfg/sourcemod/csstv_qol.cfg" "$CS/cfg/sourcemod/csstv_pedir.cfg" "$CS/cfg/sourcemod/csstv_coach.cfg" "$CS/cfg/sourcemod/v34_dm.cfg"
  [ -f "$T/lic" ] && cp "$T/lic" "$SM/data/csstv/license.txt"
  rm -f "$SM"/data/csstv/queue/* "$SM"/data/csstv/live/* 2>/dev/null
}
trap restore EXIT

sed -i -E 's#^csstv_api_url .*#csstv_api_url "http://127.0.0.1:9/rest/v1/rpc/ingest_server_chunk"#; s/^csstv_send .*/csstv_send "0"/; s/^csstv_include_bots .*/csstv_include_bots "1"/; s/^csstv_min_players .*/csstv_min_players "1"/' "$CFG"
date +%s > "$SM/data/csstv/license.txt"
cp "$B/csstv_reporter_dbg.smx" "$SM/plugins/csstv_reporter.smx"
for p in csstv_qol csstv_coach v34_retake v34_dm qol_prueba; do cp "$B/$p.smx" "$SM/plugins/"; done
cp "$B/csstv_pedir_dbg.smx" "$SM/plugins/csstv_pedir.smx"

WD=$(cd "$SV" && pwd -W)
# +tv_port: el juego abierto (CMLauncher) ocupa el 27020
powershell.exe -NoProfile -Command "Start-Process -FilePath '$WD/srcds.exe' -WorkingDirectory '$WD' -ArgumentList '-console -condebug -game cstrike +tv_enable 1 -ip 127.0.0.1 -port 27098 -tickrate 66 -insecure +tv_port 27099 +maxplayers 12 +map de_dust2'"
sleep 28
R "bot_join_after_player 0" "bot_add_t Albert" "bot_add_t Allen" "mp_limitteams 0" "mp_autoteambalance 0" "bot_add_ct Bert" "bot_add_ct Bob" "bot_add_ct Cecil" "bot_add_ct Brett"
sleep 6

mark "Cámara del coach"
R "sm_fakecmd Brett sm_coach ct"; sleep 2
echo "al anotarse:        $(O 'sm_t_obs Brett' '\[t\] .*' 1)"
R "sm_fakecmd Brett spec_mode"; sleep 1
echo "después de spec_mode: $(O 'sm_t_obs Brett' '\[t\] .*' 1)"
R "sm_fakecmd Brett spec_mode" "sm_fakecmd Brett spec_mode"; sleep 1
echo "dos spec_mode más:    $(O 'sm_t_obs Brett' '\[t\] .*' 1)"
R "sm_t_kill Albert Bert"; sleep 1
echo "muere el que miraba:  $(O 'sm_t_obs Brett' '\[t\] .*' 1)"
echo; echo "=== errores"; grep -a -E "csstv_coach" "$SM/logs/errors_$(date +%Y%m%d).log" 2>/dev/null | tail -4 | cut -c1-180
