#!/usr/bin/env bash
# Vigía de la web (plan docs/bitacora/2026-11-20-proteccion-ddos). Lo lanza cmleague-vigia.timer cada minuto.
# Avisa por Discord (DISCORD_UPTIME_WEBHOOK) cuando un sitio falla dos veces seguidas y cuando vuelve; nada más, para no llenar el canal.
# shortcut: corre en el mismo VPS, así que si se cae el VPS entero no avisa; lo cubre un chequeo de afuera (Worker con cron).

set -uo pipefail

ESTADO=${ESTADO:-/run/cmleague-vigia}
SITIOS=${SITIOS:-"https://cmleague.lat/ https://api.cmleague.lat/ https://db.cmleague.lat/rest/v1/"}
# Paquetes por segundo que entran al VPS (promedio entre dos pasadas). Lo normal el 2026-11-20 fue de 10 a 500; el
# flood de esa madrugada pasó de 800 de promedio en 10 minutos. Cuenta también lo que descarta el firewall.
UMBRAL_PPS=${UMBRAL_PPS:-1500}
mkdir -p "$ESTADO"

avisar() {
  [[ -n "${DISCORD_UPTIME_WEBHOOK:-}" ]] || { echo "sin webhook: $1"; return 0; }
  curl -fsS -m 15 -H 'Content-Type: application/json' -d "{\"content\":\"$1\"}" "$DISCORD_UPTIME_WEBHOOK" >/dev/null \
    || echo "no se pudo avisar: $1"
}

# Tráfico entrante: avisa al pasar el umbral (aunque la web aguante) y cuando vuelve a lo normal.
# La placa de la ruta por defecto, de /proc (el servicio no puede usar `ip`: necesita netlink, que está restringido).
iface=$(awk '$2=="00000000"{print $1; exit}' /proc/net/route)
if [[ -n "$iface" ]]; then
  ahora=$(date +%s)
  # Paquetes recibidos: en /proc/net/dev, después del nombre, van los bytes y después los paquetes.
  rx=$(awk -v i="$iface" '{sub(/^ +/, ""); split($0, c, /[: ]+/)} c[1]==i{print c[3]+0; exit}' /proc/net/dev)
  t0=""; rx0=""; previo=""
  [[ -f "$ESTADO/trafico" ]] && read -r t0 rx0 previo < "$ESTADO/trafico"
  estado=${previo:-normal}
  if [[ -n "${t0:-}" && -n "$rx" ]] && (( ahora > t0 && rx >= rx0 )); then
    pps=$(( (rx - rx0) / (ahora - t0) ))
    if (( pps > UMBRAL_PPS )) && [[ "$estado" == normal ]]; then
      estado=alto; avisar ":warning: Posible ataque: entran $pps paquetes por segundo al VPS (lo normal es menos de 500). Por ahora es solo un aviso: si la web se cae, llega otro."
    elif (( pps <= UMBRAL_PPS )) && [[ "$estado" == alto ]]; then
      estado=normal; avisar ":white_check_mark: El tráfico al VPS volvió a lo normal ($pps paquetes por segundo)."
    fi
  fi
  echo "$ahora $rx $estado" > "$ESTADO/trafico"
fi

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
