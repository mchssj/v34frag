#!/usr/bin/env bash
# Vigía de la web (plan docs/bitacora/2026-11-20-proteccion-ddos). Lo lanza cmleague-vigia.timer cada minuto.
# Avisa por Discord (DISCORD_UPTIME_WEBHOOK) cuando un sitio falla dos veces seguidas y cuando vuelve; nada más, para no llenar el canal.
# shortcut: corre en el mismo VPS, así que si se cae el VPS entero no avisa; lo cubre un chequeo de afuera (Worker con cron).

set -uo pipefail

ESTADO=${ESTADO:-/run/cmleague-vigia}
SITIOS=${SITIOS:-"https://cmleague.lat/ https://api.cmleague.lat/ https://db.cmleague.lat/rest/v1/"}
mkdir -p "$ESTADO"

avisar() {
  [[ -n "${DISCORD_UPTIME_WEBHOOK:-}" ]] || { echo "sin webhook: $1"; return 0; }
  curl -fsS -m 15 -H 'Content-Type: application/json' -d "{\"content\":\"$1\"}" "$DISCORD_UPTIME_WEBHOOK" >/dev/null \
    || echo "no se pudo avisar: $1"
}

for url in $SITIOS; do
  f="$ESTADO/$(echo "$url" | tr -c 'a-z0-9' '_')"
  codigo=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$url")
  # Cualquier respuesta que no sea un 5xx cuenta como viva: la API responde 302 y db 401 sin clave.
  if [[ "$codigo" =~ ^[1-4] ]]; then
    [[ "$(cat "$f" 2>/dev/null)" == caido ]] && avisar ":white_check_mark: $url volvió a responder ($codigo)."
    echo ok > "$f"
  else
    previo=$(cat "$f" 2>/dev/null)
    case "$previo" in
      caido) ;;
      falla1) echo caido > "$f"; avisar ":rotating_light: $url no responde ($codigo) hace 2 minutos." ;;
      *) echo falla1 > "$f" ;;
    esac
    echo "$url: $codigo ($previo)"
  fi
done
