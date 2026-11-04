#!/usr/bin/env bash
# Prueba con bots de la cuarta tanda de QOL en el servidor local, sin contacto con Supabase.
# Uso: qol4.sh <carpeta con los .smx>
#   csstv_reporter_dbg (CSSTV_DEBUG), csstv_qol, csstv_coach, csstv_pedir, v34_retake, v34_dm y qol_prueba
#   (docs/bitacora/2026-11-02-qol-tanda-3/pruebas/qol_prueba.sp).
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
powershell.exe -NoProfile -Command "Start-Process -FilePath '$WD/srcds.exe' -WorkingDirectory '$WD' -ArgumentList '-console -condebug -game cstrike -ip 127.0.0.1 -port 27098 -tickrate 66 -insecure +tv_port 27099 +maxplayers 12 +map de_dust2'"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(cd "$(dirname "$0")" && pwd -W)/segundo_monitor.ps1" &   # la ventana del srcds al segundo monitor
sleep 28
R "bot_join_after_player 0" "bot_add_t Albert" "bot_add_t Allen" "bot_add_ct Bert" "bot_add_ct Bob" "bot_add_ct Brett"
sleep 6

mark "1. Consola: 20 s de calentamiento"
A0=$(spam "estado:"); D0=$(spam "Uso: sm_dm"); sleep 20
echo "líneas nuevas con 'estado:': $(( $(spam 'estado:') - A0 )) · con 'Uso: sm_dm': $(( $(spam 'Uso: sm_dm') - D0 ))"
O "sm_qol_status" "\[QOL\].*" 1
echo "csstv_state = $(O 'csstv_state' '"csstv_state" = "[^"]*"' 1)  sm_dm_on = $(O 'sm_dm_on' '"sm_dm_on" = "[^"]*"' 1)  sm_retake_on = $(O 'sm_retake_on' '"sm_retake_on" = "[^"]*"' 1)"

mark "2. !faltan"
O "sm_faltan" "\[CMLeague\].*" 1
R "sm_fakecmd Albert sm_ready" "sm_fakecmd Bert sm_ready"
O "sm_faltan" "\[CMLeague\].*" 1

mark "3. Coach"
R "sm_fakecmd Brett sm_coach ct"; sleep 1
O "sm_t_info Brett"

mark "4. Partida mr3: plata para espectadores, sonidos y resumen del medio tiempo"
R "sm_live mr3"; sleep 12
R "mp_freezetime 4"
for r in 1 2 3; do
  R "sm_fakecmd Bert kill" "sm_fakecmd Bob kill"; sleep 9
  echo "ronda $r: $(O 'sm_qol_status' 'plata: .*' 1)"
done
show "Ronda [0-9]|Última ronda|Medio tiempo|MVP hasta ahora|Mejor ADR" 10
sleep 16
mark "5. Después del medio tiempo: match point"
R "sm_fakecmd Albert kill" "sm_fakecmd Allen kill"; sleep 9
show "Ronda [0-9]|Match point" 6
R "sm_cancelmatch"; sleep 1

mark "6. Consola al final"
echo "total en console.log · 'estado:': $(spam 'estado:') · 'Uso: sm_dm': $(spam 'Uso: sm_dm') · 'Fotos en vivo': $(spam 'Fotos en vivo')"
echo; echo "=== errores"; grep -a -E "csstv_(reporter|qol|pedir|coach)|v34_(dm|retake)" "$SM/logs/errors_$(date +%Y%m%d).log" 2>/dev/null | grep -a -v "validar la licencia" | tail -8 | cut -c1-180
