#!/usr/bin/env bash
# Funciones para probar csstv_calladmin con bots en el servidor local (build CALLADMIN_DEBUG).
# Uso: source lib.sh  (ADDR=192.168.1.113:27016 por defecto)
# Lo que el plugin responde sale del log de SourceMod ("[respuesta a <bot>]" y "[calladmin]").
RCON="E:/Css V34 Web/v34frag/docs/bitacora/2026-10-11-qol-servidor/pruebas/rcon.py"
SRV="E:/CSS DEDICATED SERVER/server/cstrike"
ADDR="${ADDR:-192.168.1.113:27016}"
PASS="$(sed -n 's/^rcon_password "\(.*\)"/\1/p' "$SRV/cfg/server.cfg")"
LOGS="$SRV/addons/sourcemod/logs"
Q() { python "$RCON" "$ADDR" "$PASS" "$@" 2>&1 | grep -av "rcon from"; }

bots() { Q status | sed -n 's/^# *[0-9]* "\([^"]*\)" BOT.*/\1/p'; }
uid() { Q status | sed -n "s/^# *\([0-9]*\) \"$1\" BOT.*/\1/p"; }
cmd() { Q "csstv_calladmin_fakecmd $(uid "$1") $2" >/dev/null; sleep 0.5; }
role() { Q "csstv_calladmin_setadmin $(uid "$1") $2" | grep -av "^>"; }
map() { Q status | sed -n 's/^map *: *\([^ ]*\).*/\1/p'; }
mix() { Q csstv_calladmin_mixstate | grep -a "mix="; }
# Marca en el log para leer solo lo que pasó después.
mark() { sleep 0.3; LAST="$(ls -t "$LOGS"/L*.log | head -1)"; LINES="$(wc -l < "$LAST")"; }
since() { tail -n +"$((LINES + 1))" "$LAST" | grep -a "$1" | sed 's/^L [^:]*:[^:]*:[^:]*: //'; }
# Espera a que cargue el mapa nuevo y a que vuelvan los bots.
waitmap() { for _ in $(seq 1 40); do sleep 1; [ "$(map)" = "$1" ] && [ "$(bots | wc -l)" -ge 4 ] && return 0; done; echo "  (el mapa no cambió a $1)"; return 1; }
