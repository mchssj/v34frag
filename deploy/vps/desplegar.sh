#!/usr/bin/env bash
# CMLeague: sube una versión al VPS (plan docs/bitacora/2026-10-28-despliegue-vps-ovh, sección 5).
# Se corre desde la PC de Daniel (Git Bash) y, más adelante, desde el pipeline de GitHub. Entra como `deploy`.
#
# Uso: deploy/vps/desplegar.sh <api|web|hud> [--sin-pruebas]
#   api: pruebas y build de web/backend; sube server.mjs, season-tick.mjs, demos-sftp.mjs y notify-tick.mjs; reinicia cmleague-api y chequea
#        /api/health con el commit. Si el chequeo falla, vuelve sola a la versión anterior.
#   web: pruebas y build de web/frontend (VITE_API_URL, por defecto https://api.cmleague.lat); sube dist/.
#        No reinicia nada: Caddy sirve web/current.
#   hud: pruebas y build de hud/relay (relay.mjs y public/); reinicia cmleague-hud y chequea /healthz con el commit.
#        Si el servicio todavía está apagado (falta hud.json), solo sube la versión. Plan docs/bitacora/2026-10-29-hud-relay-vps.
#
# Variables (del entorno o del .env de la raíz): VPS_HOST (obligatoria), VPS_DEPLOY_USER (por defecto deploy),
# VITE_API_URL, SSH (por defecto el OpenSSH de Windows si existe, que es el que tiene la llave del VPS).
#
# Abre solo dos conexiones SSH: el `limit` de ufw corta a quien abre más de 6 en 30 segundos, y el OpenSSH de
# Windows no reusa conexiones. Por eso todo lo que pasa en el VPS va en un solo script (REMOTO, abajo), que recibe
# la versión por la entrada estándar. Sin rsync en la PC: se sube con tar.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARDAR=5

parte="${1:-}"
pruebas=1
[[ "${2:-}" == "--sin-pruebas" ]] && pruebas=0

paso() { printf '\n== %s\n' "$*"; }
falla() { printf '\n[!!] %s\n' "$*" >&2; exit 1; }

case "$parte" in
  api | web | hud) ;;
  *) falla "Uso: $0 <api|web|hud> [--sin-pruebas]" ;;
esac

# Solo las variables que hacen falta, sin cargar el resto del .env.
leer_env() {
  local v="${!1:-}"
  if [[ -z "$v" && -f "$RAIZ/.env" ]]; then
    v="$(grep -E "^$1=" "$RAIZ/.env" | tail -1 | cut -d= -f2- | tr -d '"\r' || true)"
  fi
  printf '%s' "$v"
}
HOST="$(leer_env VPS_HOST)"
USUARIO="$(leer_env VPS_DEPLOY_USER)"; USUARIO="${USUARIO:-deploy}"
[[ -n "$HOST" ]] || falla "Falta VPS_HOST (entorno o .env)."

if [[ -z "${SSH:-}" ]]; then
  if [[ -x /c/Windows/System32/OpenSSH/ssh.exe ]]; then SSH=/c/Windows/System32/OpenSSH/ssh.exe; else SSH=ssh; fi
fi
remoto() { "$SSH" -o BatchMode=yes -o ConnectTimeout=15 "$USUARIO@$HOST" "$@"; }

# Lo que corre en el VPS como deploy. Argumentos: parte, versión, cuántas guardar. Entrada: el tar.gz de la versión.
REMOTO='
set -euo pipefail
parte=$1; sha=$2; guardar=$3
base=/srv/cmleague/$parte; rel=$base/releases; destino=$rel/$sha
umask 022

rm -rf "$destino.subiendo"; mkdir -p "$destino.subiendo"
tar -xzf - --no-same-owner -C "$destino.subiendo"
anterior=$(readlink "$base/current" 2>/dev/null || true)
# Mismo nombre que la actual (se vuelve a subir): no hay a dónde volver.
[ "$anterior" = "$destino" ] && anterior=""
rm -rf "$destino"; mv "$destino.subiendo" "$destino"

apuntar() { ln -sfn "$1" "$base/current.nuevo" && mv -T "$base/current.nuevo" "$base/current"; }
echo "== current -> $sha (antes: ${anterior:-ninguna})"
apuntar "$destino"

chequear() {
  if [ "$parte" = api ]; then
    sudo systemctl restart cmleague-api
    # Directo a la API, sin pasar por Caddy ni por el DNS. Tiene que responder ok y con esta versión.
    for i in $(seq 1 20); do
      r=$(curl -s -m 3 http://127.0.0.1:8787/api/health || true)
      case "$r" in *"\"status\":\"ok\""*"\"version\":\"$sha\""*) echo "/api/health: $r"; return 0;; esac
      sleep 1
    done
    echo "/api/health no respondió bien: ${r:-sin respuesta}"
    return 1
  elif [ "$parte" = hud ]; then
    # Apagado hasta completar /etc/cmleague/hud.json: prenderlo lo dejaría reiniciándose en bucle.
    if [ "$(systemctl is-enabled cmleague-hud 2>/dev/null)" != enabled ]; then
      echo "cmleague-hud está apagado: la versión queda subida (se prende con systemctl enable --now cmleague-hud)."
      return 0
    fi
    sudo systemctl restart cmleague-hud
    for i in $(seq 1 20); do
      r=$(curl -s -m 3 http://127.0.0.1:8090/healthz || true)
      case "$r" in *"\"build\":\"$sha\""*) echo "/healthz: $r"; return 0;; esac
      sleep 1
    done
    echo "/healthz no respondió bien: ${r:-sin respuesta}"
    return 1
  else
    [ -s "$base/current/index.html" ] && echo "index.html en su lugar." && return 0
    echo "Falta index.html."
    return 1
  fi
}

echo "== Chequeo"
if ! chequear; then
  if [ -n "$anterior" ]; then
    echo "== FALLA: vuelta a $(basename "$anterior")"
    apuntar "$anterior"
    [ "$parte" = api ] && sudo systemctl restart cmleague-api
    [ "$parte" = hud ] && sudo systemctl restart cmleague-hud
  fi
  [ "$parte" = web ] || echo "Logs (desde ubuntu): sudo journalctl -u cmleague-$parte -n 50"
  exit 1
fi

echo "== Limpieza (quedan $guardar versiones)"
cd "$rel"
ls -1t | tail -n +$((guardar + 1)) | while read -r v; do
  [ "$rel/$v" = "$destino" ] || [ "$rel/$v" = "$anterior" ] || rm -rf -- "$v"
done
ls -1t
'

# Versión: el commit. Con cambios sin commit se marca, para que /api/health no diga un commit que no es.
cd "$RAIZ"
sha="$(git rev-parse --short=12 HEAD)"
if [[ -n "$(git status --porcelain -- "web/backend" "web/frontend" "hud/relay")" ]]; then
  sha="$sha-local$(date -u +%m%d%H%M)"
  echo "Aviso: hay cambios sin commit en web/ o hud/; la versión se llama $sha."
fi

paso "Conexión con $USUARIO@VPS"
remoto "test -d /srv/cmleague/$parte/releases" || falla "No entra por SSH o no existe /srv/cmleague/$parte/releases."

# --- Pruebas y build ---------------------------------------------------------------------------------------------
if [[ "$parte" == api ]]; then
  cd "$RAIZ/web/backend"
  if (( pruebas )); then
    paso "Pruebas de la API"
    pnpm typecheck
    pnpm test
  fi
  paso "Build de la API ($sha)"
  BUILD_SHA="$sha" pnpm build
  pnpm build:check
  local_dir="$RAIZ/web/backend/dist"
  archivos=(server.mjs server.mjs.map season-tick.mjs season-tick.mjs.map demos-sftp.mjs demos-sftp.mjs.map notify-tick.mjs notify-tick.mjs.map)
elif [[ "$parte" == hud ]]; then
  cd "$RAIZ/hud/relay"
  if (( pruebas )); then
    paso "Pruebas del relay"
    pnpm typecheck
    pnpm test
  fi
  paso "Build del relay ($sha)"
  BUILD_SHA="$sha" pnpm build:node
  local_dir="$RAIZ/hud/relay/dist-node"
  archivos=(relay.mjs relay.mjs.map public)
else
  cd "$RAIZ/web/frontend"
  api_url="${VITE_API_URL:-https://api.cmleague.lat}"
  if (( pruebas )); then
    paso "Pruebas del frontend"
    pnpm lint
    pnpm test
  fi
  paso "Build del frontend ($sha, API en $api_url)"
  # La variable del entorno le gana al .env.local (que apunta a localhost).
  VITE_API_URL="$api_url" pnpm build
  grep -rqF "$api_url" dist/assets || falla "El build no tiene $api_url adentro."
  # El mensaje de validación de src/lib/env.ts trae "http://localhost:8787)" de ejemplo: se busca la URL entre comillas.
  if grep -rqE "[\"'\`]http://localhost:8787[\"'\`]" dist/assets; then falla "El build apunta a localhost:8787."; fi
  local_dir="$RAIZ/web/frontend/dist"
  archivos=(.)
fi

# --- Subida, cambio de versión, chequeo y limpieza (una sola conexión) --------------------------------------------
paso "Subida a /srv/cmleague/$parte/releases/$sha"
printf -v cmd 'bash -c %q _ %q %q %q' "$REMOTO" "$parte" "$sha" "$GUARDAR"
tar -C "$local_dir" -czf - "${archivos[@]}" | remoto "$cmd" || falla "$parte $sha no quedó desplegada (ver arriba)."

printf '\n[OK] %s %s desplegada.\n' "$parte" "$sha"
