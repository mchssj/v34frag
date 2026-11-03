#!/usr/bin/env bash
# Tercera prueba con bots de la cuarta tanda: coach (plata y !pause), !rr de los capitanes, kill, !rtv en vivo y MVP del medio tiempo en la demo en el servidor local, sin contacto con Supabase.
# Uso: qol4c.sh <carpeta con los .smx>
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

DEMOS=$CS/csstv_demos
reply() { tail -c +$((OFF + 1)) "$LOG" | grep -a -E "respuesta a $1|chat todos" | sed -E 's/^L [^ ]+ - //' | cut -c1-190 | tail -${2:-2}; }

mark "1. Coach y partida"
R "sm_fakecmd Brett sm_coach ct"; sleep 1
R "bot_stop 1" "bot_dont_shoot 1" "sm_live mr3"; sleep 14
R "mp_freezetime 6"
O "sm_coach_status" "\[Coach\].*" 1
CA=$(tail -c +$((OFF + 1)) "$LOG" | grep -a -o "La partida empieza: Equipo [A-Za-z]*" | tail -1 | sed 's/.*Equipo //')
CB=$(tail -c +$((OFF + 1)) "$LOG" | grep -a -o "vs Equipo [A-Za-z]*" | tail -1 | sed 's/.*Equipo //')
echo "capitanes: $CA (CT) y $CB (T)"

mark "2. El coach pide la pausa"
R "sm_fakecmd Brett sm_pause"; sleep 1
reply Brett 1
R "sm_forceunpause"

mark "3. kill y !rtv en vivo"
R "sm_fakecmd Albert kill" "sm_fakecmd Albert explode"; sleep 1
O "sm_t_info Albert" "\[t\] Albert equipo=[0-9] [a-z]*" 1
mark "3b"
R "sm_fakecmd Albert sm_rtv"; sleep 1
reply Albert 1

mark "4. !rr: un no capitán, y después los dos capitanes"
NC=$( [ "$CB" = Albert ] && echo Allen || echo Albert )
R "sm_fakecmd $NC sm_rr"; sleep 1; reply $NC 1
R "sm_fakecmd $CA sm_rr"; sleep 1; reply $CA 1
R "sm_fakecmd $CB sm_rr"; sleep 1; reply $CB 1

mark "5. Hasta el medio tiempo"
sleep 12
for r in 1 2 3; do
  for v in Bert Bob Cecil; do R "sm_t_kill Albert $v"; done; sleep 13
done
show "MVP hasta ahora|Mejor ADR|Medio tiempo" 4
R "sm_cancelmatch"; sleep 8

mark "6. La demo"
D=$(ls -t "$DEMOS"/*.dem 2>/dev/null | head -1)
echo "demo: $(basename "$D") $(stat -c %s "$D" 2>/dev/null) bytes"
for t in "MVP hasta ahora" "Mejor ADR" "pide repetir" "repite la ronda"; do echo "  '$t': $(grep -a -c "$t" "$D")"; done

echo; echo "=== errores"; grep -a -E "csstv_(reporter|qol|pedir|coach)|v34_(dm|retake)" "$SM/logs/errors_$(date +%Y%m%d).log" 2>/dev/null | grep -a -v "validar la licencia" | tail -8 | cut -c1-180
