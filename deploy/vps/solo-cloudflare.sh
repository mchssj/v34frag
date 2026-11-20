#!/usr/bin/env bash
# 80 y 443 solo para Cloudflare y las máquinas de los servidores de juego, y el UDP del HUD solo para esas máquinas
# (plan docs/bitacora/2026-11-20-proteccion-ddos).
# Sin esto, quien conozca la IP del VPS se saltea Cloudflare: los floods del 2026-11-20 le pegaron directo a la IP.
# El corte va en el firewall y no en Caddy, para que lo directo se descarte antes de llegar a Caddy.
#
#   sudo bash solo-cloudflare.sh on    con el DNS en Cloudflare y la nube naranja en cmleague.lat, www, api y db
#   sudo bash solo-cloudflare.sh off   vuelta atrás: 80, 443 y el UDP del HUD abiertos a todos, como antes
#
# PERMITIDOS: las IPs de las máquinas de los servidores de juego (hoy solo MVZG, donde están el #1, el #2 y el #3).
#   - Pueden entrar directo a 80 y 443, porque el reporter le habla a db.cmleague.lat y su DNS puede tardar en ver
#     a Cloudflare.
#   - Son las únicas que pueden mandar el UDP del HUD (puertos 27500-27519); sin esto, cualquiera podía inundar el relay.
#   **Si se suma un servidor de juego en otra máquina, hay que agregar su IP acá y volver a correr `on`**: si no, su
#   HUD no llega al relay. También si MVZG cambia de IP.
# hud.cmleague.lat va en "DNS only": con el 443 cerrado, los streamers no lo pueden abrir.
# El propio VPS no pasa por ufw (sale y vuelve por lo).

set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "correr con sudo" >&2; exit 1; }
PERMITIDOS=${PERMITIDOS:-"190.104.34.3"}
MARCA="cloudflare"

# Borra las reglas que puso este script (por el comentario), de abajo hacia arriba para que no se corran los números.
borrar() {
  local n
  for n in $(ufw status numbered | grep -E "# ($MARCA|permitido directo)\$" | grep -oE '^\[ *[0-9]+\]' | tr -d '[] ' | sort -rn || true); do
    ufw --force delete "$n" >/dev/null
  done
}

case "${1:-}" in
  on)
    rangos=$( { curl -fsS -m 15 https://www.cloudflare.com/ips-v4/; echo; curl -fsS -m 15 https://www.cloudflare.com/ips-v6/; } | grep -E '[0-9a-f:.]+/[0-9]+')
    [[ $(wc -l <<<"$rangos") -ge 10 ]] || { echo "lista de Cloudflare incompleta" >&2; exit 1; }
    borrar
    # Primero se abre para Cloudflare y los permitidos; recién después se cierra para el resto.
    for r in $rangos; do ufw allow proto tcp from "$r" to any port 80,443 comment "$MARCA" >/dev/null; done
    for ip in $PERMITIDOS; do
      ufw allow proto tcp from "$ip" to any port 80,443 comment "permitido directo" >/dev/null
      ufw allow proto udp from "$ip" to any port 27500:27519 comment "permitido directo" >/dev/null
    done
    for regla in "80/tcp" "443/tcp" "443/udp" "27500:27519/udp"; do ufw delete allow "$regla" >/dev/null 2>&1 || true; done
    echo "listo: 80 y 443 solo para Cloudflare ($(wc -l <<<"$rangos") rangos) y $PERMITIDOS; UDP del HUD solo para $PERMITIDOS"
    ;;
  off)
    ufw allow 80/tcp comment 'HTTP (certificados y redireccion)' >/dev/null
    ufw allow 443/tcp comment 'HTTPS' >/dev/null
    ufw allow 27500:27519/udp comment 'Relay del HUD' >/dev/null
    borrar
    echo "listo: 80, 443 y el UDP del HUD abiertos a todos"
    ;;
  *) echo "uso: $0 on|off" >&2; exit 1 ;;
esac
