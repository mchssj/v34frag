#!/usr/bin/env bash
# Cierre programado del firewall (docs/bitacora/2026-11-20-proteccion-ddos, parte 3). Lo lanza systemd-run una sola vez:
#   sudo systemd-run --on-active=70m --unit=cmleague-cierre-firewall -p RuntimeMaxSec=4h /bin/bash /srv/cmleague/cerrar-firewall-programado.sh
# Antes de cerrar mira los últimos 15 minutos de la API y la base: si todavía hay jugadores entrando directo (routers con
# el DNS viejo), no cierra y vuelve a probar cada 30 minutos, hasta 6 veces. Avisa por Discord (DISCORD_UPTIME_WEBHOOK).

set -uo pipefail
. /etc/cmleague/vigia.env 2>/dev/null || true
MAX_DIRECTOS=${MAX_DIRECTOS:-2}
cf='^(173\.245\.|103\.2[12]\.|103\.31\.|141\.101\.|108\.162\.|190\.93\.|188\.114\.|197\.234\.|198\.41\.|162\.15[89]\.|104\.(1[6-9]|2[0-7])\.|172\.(6[4-9]|7[01])\.|131\.0\.7[2-5]\.|2400:cb00|2606:4700|2803:f800|2405:b500|2405:8100|2a06:98c|2c0f:f248)'
propios='^(190\.104\.34\.3|148\.113\.148\.184|2607:5300:205:200::eb59|127\.0\.0\.1|::1)$'

avisar() {
  echo "$1"
  [[ -n "${DISCORD_UPTIME_WEBHOOK:-}" ]] || return 0
  curl -fsS -m 15 -H 'Content-Type: application/json' -d "{\"content\":\"$1\"}" "$DISCORD_UPTIME_WEBHOOK" >/dev/null || true
}

for intento in 1 2 3 4 5 6; do
  t=$(( $(date +%s) - 900 ))
  # Jugadores reales que todavía entran directo: IPs distintas en la API o la base, sin contar Cloudflare, MVZG ni el VPS.
  directos=$(cat /var/log/caddy/api.log /var/log/caddy/db.log \
    | jq -r --argjson t "$t" 'select(.ts>$t)|.request.remote_ip' 2>/dev/null \
    | grep -vE "$cf" | grep -vE "$propios" | sort -u | wc -l)
  if (( directos <= MAX_DIRECTOS )); then
    if salida=$(bash /srv/cmleague/solo-cloudflare.sh on 2>&1); then
      sleep 5
      web=$(curl -s -o /dev/null -m 10 -w '%{http_code}' https://cmleague.lat/)
      api=$(curl -s -o /dev/null -m 10 -w '%{http_code}' https://api.cmleague.lat/)
      if [[ "$web" == 200 && "$api" =~ ^[23] ]]; then
        avisar ":lock: Firewall cerrado: 80 y 443 solo para Cloudflare y MVZG ($directos jugadores todavía entraban directo). Web $web, API $api. Para abrir: sudo bash /srv/cmleague/solo-cloudflare.sh off"
      else
        bash /srv/cmleague/solo-cloudflare.sh off >/dev/null 2>&1
        avisar ":warning: Cerré el firewall pero la web ($web) o la API ($api) no respondieron por Cloudflare: lo volví a abrir."
      fi
    else
      avisar ":warning: No se pudo cerrar el firewall: $salida"
    fi
    exit 0
  fi
  avisar ":hourglass: Firewall sin cerrar todavía: $directos jugadores siguen entrando directo (DNS viejo). Intento $intento de 6, reintento en 30 min."
  (( intento < 6 )) && sleep 1800
done
avisar ":x: Firewall sin cerrar después de 6 intentos: todavía hay jugadores con el DNS viejo. Queda abierto; revisar a mano."
