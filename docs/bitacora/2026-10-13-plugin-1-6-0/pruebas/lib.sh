#!/usr/bin/env bash
# Funciones comunes de las pruebas con bots (servidor local, plugin compilado con CSSTV_DEBUG=).
# R: manda comandos por RCON. wait_for: espera un texto en el log de SourceMod desde el último R.
RCON="E:/Css V34 Web/v34frag/docs/bitacora/2026-10-11-qol-servidor/pruebas/rcon.py"
SRV="E:/CSS DEDICATED SERVER/server/cstrike"
LOG="$SRV/addons/sourcemod/logs/L$(date +%Y%m%d).log"
ADDR="26.228.23.45:27016"
PASS="$(sed -n 's/^rcon_password "\(.*\)"/\1/p' "$SRV/cfg/server.cfg")"
OFF=0
touch "$LOG"
R() { OFF=$(stat -c %s "$LOG"); python "$RCON" "$ADDR" "$PASS" "$@" 2>&1 | grep -v '^> ' || true; }
Q() { python "$RCON" "$ADDR" "$PASS" "$@" 2>&1; }   # muestra la respuesta
wait_for() {
  local end=$(( $(date +%s) + $2 )) pos
  until pos=$(tail -c +$((OFF + 1)) "$LOG" | grep -abo "$1" | head -1 | cut -d: -f1) && [ -n "$pos" ]; do
    [ "$(date +%s)" -ge "$end" ] && { echo "TIMEOUT: $1"; return 1; }
    sleep 1
  done
  OFF=$((OFF + pos + 1)); echo "OK: $1"
}
# userid de un bot de un lado (2 = T, 3 = CT) según el log de equipos del plugin de prueba: se usa "status".
bot_uid() { Q "status" | grep -o '# *[0-9]* "[^"]*"' | head -"$1" | tail -1 | grep -o '# *[0-9]*' | tr -dc '0-9'; }
