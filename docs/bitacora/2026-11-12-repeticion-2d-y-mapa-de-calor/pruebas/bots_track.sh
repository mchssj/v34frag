#!/usr/bin/env bash
# Repetición 2D (reporter 2.11.0): un mix MR3 entre bots en el servidor local, sin contacto con Supabase.
# Uso: [PLATA=1] [EXTRA=<otro.smx>] bots_track.sh <csstv_reporter.smx> <carpeta de salida>
# Deja en la salida el .trk, el resultado de la cola (con kill_pos) y el log. Restaura el servidor al terminar.
set -u
SMX=$1; OUTD=$2
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
O() { python "$RC" $A "$PW" "$1" 2>&1 | tr -d '\r'; }

T=$(mktemp -d)
cp "$CFG" "$T/rep.cfg"
cp "$SM/data/csstv/license.txt" "$T/lic" 2>/dev/null
cp "$SM/plugins/csstv_reporter.smx" "$T/old.smx" 2>/dev/null
rm -f "$SM"/data/csstv/queue/* 2>/dev/null
restore() {
  taskkill //IM srcds.exe //F >/dev/null 2>&1
  cp "$T/rep.cfg" "$CFG"
  if [ -f "$T/old.smx" ]; then cp "$T/old.smx" "$SM/plugins/csstv_reporter.smx"; else rm -f "$SM/plugins/csstv_reporter.smx"; fi
  [ -f "$T/lic" ] && cp "$T/lic" "$SM/data/csstv/license.txt"
  rm -f "$SM"/data/csstv/queue/* "$SM"/data/csstv/live/* "$SM/plugins/zz_prueba.smx" 2>/dev/null
}
trap restore EXIT

sed -i -E 's#^csstv_api_url .*#csstv_api_url "http://127.0.0.1:9/rest/v1/rpc/ingest_server_chunk"#; s/^csstv_send .*/csstv_send "0"/; s/^csstv_include_bots .*/csstv_include_bots "1"/; s/^csstv_min_players .*/csstv_min_players "1"/; s/^csstv_mm .*/csstv_mm "0"/' "$CFG"
date +%s > "$SM/data/csstv/license.txt"
cp "$SMX" "$SM/plugins/csstv_reporter.smx"
# Un plugin de prueba más (por ejemplo granadas_prueba.smx); se saca al terminar.
[ -n "${EXTRA:-}" ] && cp "$EXTRA" "$SM/plugins/zz_prueba.smx"

WD=$(cd "$SV" && pwd -W)
powershell.exe -NoProfile -Command "Start-Process -FilePath '$WD/srcds.exe' -WorkingDirectory '$WD' -ArgumentList '-console -game cstrike +tv_enable 1 -ip 127.0.0.1 -port 27098 -tickrate 66 -insecure +tv_port 27099 +maxplayers 12 +map de_dust2'"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$REPO/docs/bitacora/2026-11-02-qol-tanda-4/pruebas/segundo_monitor.ps1" &
sleep 28
R "csstv_send 0" "csstv_demo 1" "csstv_track 1" "bot_join_after_player 0" "mp_limitteams 0" "mp_autoteambalance 0" "bot_quota_mode normal"
R "bot_add_t" "bot_add_t" "bot_add_t" "bot_add_ct" "bot_add_ct" "bot_add_ct"
sleep 6
R "mp_freezetime 2" "mp_roundtime 1.5" "sm_live mr3"
# Con plata los bots compran granadas (live.cfg pone la de siempre; se cambia después del vivo).
[ -n "${PLATA:-}" ] && { sleep 20; R "mp_startmoney 16000" "mp_maxmoney 16000"; }
echo "en vivo: $(date +%T)"
for i in $(seq 1 150); do   # hasta 25 min (con alargue)
  sleep 10
  if ls "$SM"/data/csstv/queue/*.json >/dev/null 2>&1; then echo "resultado en la cola: $(date +%T)"; break; fi
done
sleep 12   # la cola de la demo (DEMO_TAIL_SECONDS) y el cierre del .trk
mkdir -p "$OUTD"
TRK=$(ls -t "$CS"/csstv_demos/*.trk 2>/dev/null | head -1)
[ -n "$TRK" ] && cp "$TRK" "$OUTD/" && echo "trk: $(basename "$TRK") $(stat -c %s "$TRK") bytes, $(wc -l < "$TRK") líneas"
cp "$SM"/data/csstv/queue/*.json "$OUTD/" 2>/dev/null
grep -a -E "csstv|Partida|Repetición|Demo" "$LOG" | tail -15 > "$OUTD/log.txt"
grep -a -i "track\|csstv_reporter" "$SM/logs/errors_$(date +%Y%m%d).log" 2>/dev/null | tail -5
