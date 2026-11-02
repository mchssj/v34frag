#!/usr/bin/env bash
# Prueba con bots de la tanda de QOL en el servidor local, sin contacto con Supabase (como
# 2026-11-02-aviso-y-pausa-automatica/pruebas/escenario.sh).
# Uso: qol.sh <reporter debug .smx> <csstv_qol.smx> <csstv_coach.smx> <qol_prueba.smx>
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
O() { python "$RC" $A "$PW" "$1" 2>&1 | grep -a -o -E '\[t\][^"]*' | head -3; }
mark() { echo; echo "=== $1"; OFF=$(stat -c %s "$LOG"); }
show() { tail -c +$((OFF + 1)) "$LOG" | grep -a -i -E "$1" | sed -E 's/^L [^ ]+ - //' | cut -c1-150; }

cp "$CFG" /tmp/rep.cfg.bak
cp "$SM/data/csstv/license.txt" /tmp/lic.bak 2>/dev/null
rm -f "$SM"/data/csstv/queue/* 2>/dev/null
restore() {
  taskkill //IM srcds.exe //F >/dev/null 2>&1
  cp /tmp/rep.cfg.bak "$CFG"
  rm -f "$SM/plugins/csstv_reporter.smx" "$SM/plugins/csstv_qol.smx" "$SM/plugins/csstv_coach.smx" "$SM/plugins/qol_prueba.smx"
  rm -f "$CS/cfg/sourcemod/csstv_qol.cfg" "$CS/cfg/sourcemod/csstv_coach.cfg"
  [ -f /tmp/lic.bak ] && cp /tmp/lic.bak "$SM/data/csstv/license.txt"
  rm -f "$SM"/data/csstv/queue/* "$SM"/data/csstv/live/* 2>/dev/null
}
trap restore EXIT

sed -i -E 's#^csstv_api_url .*#csstv_api_url "http://127.0.0.1:9/rest/v1/rpc/ingest_server_chunk"#; s/^csstv_send .*/csstv_send "0"/; s/^csstv_include_bots .*/csstv_include_bots "1"/; s/^csstv_min_players .*/csstv_min_players "1"/' "$CFG"
date +%s > "$SM/data/csstv/license.txt"
cp "$1" "$SM/plugins/csstv_reporter.smx"; cp "$2" "$SM/plugins/csstv_qol.smx"; cp "$3" "$SM/plugins/csstv_coach.smx"; cp "$4" "$SM/plugins/qol_prueba.smx"

WD=$(cd "$SV" && pwd -W)
powershell.exe -NoProfile -Command "Start-Process -FilePath '$WD/srcds.exe' -WorkingDirectory '$WD' -ArgumentList '-console -game cstrike -ip 127.0.0.1 -port 27098 -tickrate 66 -insecure +tv_port 27099 +maxplayers 12 +map de_dust2'"
sleep 28
R "bot_join_after_player 0" "bot_add_t Albert" "bot_add_t Allen" "bot_add_ct Bert" "bot_add_ct Bob" "bot_add_ct Brett"
sleep 6

python "$RC" $A "$PW" "sm_qol_status" 2>&1 | grep -a -o -E "\[QOL\][^\"]*" | head -1
mark "1. Calentamiento: reaparece"
R "sm_fakecmd Albert kill"; sleep 0.5
O "sm_t_info Albert"; sleep 2.5
O "sm_t_info Albert"
R "csstv_qol_warmup_respawn 0" "sm_fakecmd Allen kill"; sleep 3
echo "(apagado) $(O 'sm_t_info Allen')"
R "csstv_qol_warmup_respawn 1"

mark "2. Coach"
R "sm_fakecmd Brett sm_coach ct"; sleep 1.5
O "sm_t_obs Brett"
R "sm_fakecmd Brett spec_next"; sleep 0.5; O "sm_t_obs Brett"
R "sm_fakecmd Brett spec_mode"; sleep 0.5; O "sm_t_obs Brett"
R "sm_fakecmd Brett spec_mode"; sleep 0.5; O "sm_t_obs Brett"
R "sm_fakecmd Bert kill"; sleep 0.5; O "sm_t_obs Brett"
show "coach"

mark "3. Cuchillo: elige el capitán (el que le da nombre al equipo)"
R "csstv_qol_c4_afk 5" "sm_live knife mr3"; sleep 12
R "bot_stop 1"
R "sm_fakecmd Albert kill" "sm_fakecmd Allen kill"; sleep 3
CAP=$(tail -c +$((OFF + 1)) "$LOG" | grep -a -o -E 'Elige el lado su capitán, [A-Za-z]+' | tail -1 | awk '{print $NF}')
OTRO=Bert; [ "$CAP" = Bert ] && OTRO=Bob
echo "capitán: $CAP · prueba otro: $OTRO"
R "sm_fakecmd $OTRO sm_switch"; sleep 1
R "sm_fakecmd Albert sm_stay"; sleep 1
R "sm_fakecmd $CAP sm_switch"; sleep 12
show "cuchillo|capitán|juega de|eligió|Nadie|lo elige"
O "sm_t_obs Brett"

mark "4. C4 de un AFK (csstv_qol_c4_afk 5): primera ronda en vivo, bots quietos"
sleep 4   # LO3
python "$RC" $A "$PW" "sm_qol_status" 2>&1 | grep -a -o -E "\[QOL\][^\"]*" | head -1
O "sm_t_c4"
sleep 25; O "sm_t_c4"   # LO3 (unos 7 s) + freezetime + 5 s
show "C4"

mark "5. Mejor de la ronda"
R "csstv_qol_c4_afk 0" "bot_stop 0"; sleep 110
python "$RC" $A "$PW" "sm_qol_status" 2>&1 | grep -a -o -E "último: [^\"]*" | head -1   # el chat de csstv_qol no queda en el log
R "sm_cancelmatch"; sleep 1
echo; echo "=== errores"; grep -a -E "csstv_(reporter|qol|coach)" "$SM/logs/errors_$(date +%Y%m%d).log" | grep -a -v "validar la licencia" | tail -6 | cut -c1-180
