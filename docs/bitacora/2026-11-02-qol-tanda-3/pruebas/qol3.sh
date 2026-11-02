#!/usr/bin/env bash
# Prueba con bots de la tercera tanda de QOL en el servidor local, sin contacto con Supabase.
# Uso: qol3.sh <reporter debug .smx> <csstv_qol.smx> <csstv_pedir con PEDIR_DEBUG .smx> <qol_prueba.smx>
# El cfg, la licencia y los plugins del servidor local se restauran al terminar.
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
O() { python "$RC" $A "$PW" "$1" 2>&1 | tr -d '\r' | grep -a -o -E "${2:-\[t\]}.*" | head -${3:-2}; }
mark() { echo; echo "=== $1"; OFF=$(stat -c %s "$LOG"); }
show() { tail -c +$((OFF + 1)) "$LOG" | grep -a -i -E "$1" | sed -E 's/^L [^ ]+ - //' | cut -c1-160; }

cp "$CFG" /tmp/rep.cfg.bak
cp "$SM/data/csstv/license.txt" /tmp/lic.bak 2>/dev/null
rm -f "$SM"/data/csstv/queue/* 2>/dev/null
restore() {
  taskkill //IM srcds.exe //F >/dev/null 2>&1
  cp /tmp/rep.cfg.bak "$CFG"
  rm -f "$SM/plugins/csstv_reporter.smx" "$SM/plugins/csstv_qol.smx" "$SM/plugins/csstv_pedir.smx" "$SM/plugins/qol_prueba.smx"
  rm -f "$CS/cfg/sourcemod/csstv_qol.cfg" "$CS/cfg/sourcemod/csstv_pedir.cfg"
  [ -f /tmp/lic.bak ] && cp /tmp/lic.bak "$SM/data/csstv/license.txt"
  rm -f "$SM"/data/csstv/queue/* "$SM"/data/csstv/live/* 2>/dev/null
}
trap restore EXIT

sed -i -E 's#^csstv_api_url .*#csstv_api_url "http://127.0.0.1:9/rest/v1/rpc/ingest_server_chunk"#; s/^csstv_send .*/csstv_send "0"/; s/^csstv_include_bots .*/csstv_include_bots "1"/; s/^csstv_min_players .*/csstv_min_players "1"/' "$CFG"
date +%s > "$SM/data/csstv/license.txt"
cp "$1" "$SM/plugins/csstv_reporter.smx"; cp "$2" "$SM/plugins/csstv_qol.smx"; cp "$3" "$SM/plugins/csstv_pedir.smx"; cp "$4" "$SM/plugins/qol_prueba.smx"

WD=$(cd "$SV" && pwd -W)
# +tv_port: el juego abierto (CMLauncher) ocupa el 27020
powershell.exe -NoProfile -Command "Start-Process -FilePath '$WD/srcds.exe' -WorkingDirectory '$WD' -ArgumentList '-console -game cstrike -ip 127.0.0.1 -port 27098 -tickrate 66 -insecure +tv_port 27099 +maxplayers 12 +map de_dust2'"
sleep 28
R "bot_join_after_player 0" "bot_add_t Albert" "bot_add_t Allen" "bot_add_ct Bert" "bot_add_ct Bob"
sleep 6

mark "1. Granadas en el calentamiento"
R "bot_stop 1" "sm_fakecmd Albert sm_nades"; sleep 1
O "sm_t_info Albert"
R "sm_fakecmd Albert use weapon_hegrenade"; sleep 1
R "sm_fakecmd Albert +attack"; sleep 0.6; R "sm_fakecmd Albert -attack"; sleep 2
echo "después de tirar la HE: $(O 'sm_t_info Albert')"

mark "2. Pausa técnica pedida a mitad de ronda"
R "sm_live mr3"; sleep 14
R "mp_freezetime 20" "sm_fakecmd Bert sm_tech"; sleep 1
R "bot_kill"; sleep 8
show "técnica"

mark "3. Pedir un arma (en la pausa, que es freezetime)"
R "sm_t_money Allen 5000"
O "sm_pedir_fake Albert ak47" "\[Pedir\]"
O "sm_pedir_fakeuse Allen" "\[Pedir\]"
sleep 0.5
O "sm_t_info Albert"; O "sm_t_info Allen"
echo "--- sm_eq (consola)"; O "sm_eq" "\[(T|CT)\]" 5

mark "4. Fin de la pausa con !unpause de los dos"
R "sm_fakecmd Bert sm_unpause" "sm_fakecmd Albert sm_unpause"; sleep 5
R "sm_fakecmd Bert sm_tech"; sleep 1   # segunda técnica en la misma mitad
show "listo|Se sigue|ya usó"

mark "5. Clutch y reconexión con plata y equipo"
sleep 20   # termina el freezetime
R "sm_fakecmd Allen kill"; sleep 1
O "sm_qol_status" "clutch: .*" 1
R "sm_t_money Albert 3700"; sleep 0.5
O "sm_t_info Albert"
R "kick Albert"; sleep 2; R "bot_add_t Albert"; sleep 2
R "bot_kill"; sleep 9   # ronda siguiente: Albert aparece
O "sm_t_info Albert"
R "sm_cancelmatch"; sleep 1
echo; echo "=== errores"; grep -a -E "csstv_(reporter|qol|pedir)" "$SM/logs/errors_$(date +%Y%m%d).log" | grep -a -v "validar la licencia" | tail -6 | cut -c1-180
