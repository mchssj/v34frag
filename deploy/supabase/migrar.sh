#!/usr/bin/env bash
# Lanza migrar-vps.sh en el VPS desde la PC de Daniel (Git Bash, raíz del repo). Plan docs/bitacora/2026-11-03-supabase-en-vps.
#   deploy/supabase/migrar.sh               sobre un Supabase recién instalado
#   deploy/supabase/migrar.sh --desde-cero  borra la base del VPS y migra de nuevo (ensayo repetido y corte)
#
# Una sola conexión SSH (el `limit` de ufw corta la séptima en 30 s): por stdin van los dos scripts y las credenciales
# del origen, que quedan en /run/cmleague-migracion.env (tmpfs, root 600) solo mientras corre y se borran al terminar,
# aunque falle. Nunca escribe en producción: solo la lee.
set -euo pipefail
raiz="$(cd "$(dirname "$0")/../.." && pwd)"
ref=wmzfwsizashpszxlvpeb
ssh_exe=/c/Windows/System32/OpenSSH/ssh.exe
leer() { { grep "^$1=" "$raiz/.env" || true; } | tail -1 | cut -d= -f2- | tr -d '\r"'; }
destino="$(leer VPS_USER)@$(leer VPS_HOST)"
modo="${1:-}"
[[ -z "$modo" || "$modo" == --desde-cero ]] || { echo "Uso: migrar.sh [--desde-cero]" >&2; exit 1; }

db_url="$(PGU="$(leer PG_USER)" PGP="$(leer PG_PASSWORD)" PGH="$(leer PG_HOST)" PGPORT_="$(leer PG_PORT)" python -I -c '
import os, urllib.parse as u
print("postgresql://%s:%s@%s:%s/postgres?sslmode=require" % (u.quote(os.environ["PGU"], safe=""),
      u.quote(os.environ["PGP"], safe=""), os.environ["PGH"], os.environ["PGPORT_"]))')"
service_jwt="$(curl -fsS -m 20 -H "Authorization: Bearer $(leer SUPABASE_ACCESS_TOKEN_PROD)" \
  "https://api.supabase.com/v1/projects/$ref/api-keys?reveal=true" |
  python -I -c 'import json,sys;print(next(k["api_key"] for k in json.load(sys.stdin) if k["type"]=="legacy" and k["name"]=="service_role"))')"
[[ -n "$(leer MM_LISTENER_PASSWORD)" ]] || { echo "Falta MM_LISTENER_PASSWORD en el .env" >&2; exit 1; }

b64() { tr -d '\r' < "$1" | base64 -w0; }
{
  echo 'set -u; d=$(mktemp -d); trap "sudo rm -f /run/cmleague-migracion.env; rm -rf \$d" EXIT'
  echo "echo '$(b64 "$raiz/deploy/supabase/migrar-vps.sh")' | base64 -d > \$d/migrar-vps.sh"
  echo "echo '$(b64 "$raiz/deploy/supabase/copiar_storage.py")' | base64 -d > \$d/copiar_storage.py"
  printf 'ORIGEN_DB_URL=%s\nORIGEN_URL=%s\nORIGEN_SERVICE_JWT=%s\nMM_LISTENER_PASSWORD=%s\nURL_NUEVA=%s\n' \
    "$db_url" "https://$ref.supabase.co" "$service_jwt" "$(leer MM_LISTENER_PASSWORD)" "https://db.cmleague.lat" |
    base64 -w0 | sed 's/.*/echo "&" | base64 -d | sudo sh -c "umask 077 \&\& cat > \/run\/cmleague-migracion.env"/'
  echo
  echo "sudo bash \$d/migrar-vps.sh $modo"
} | "$ssh_exe" -o BatchMode=yes "$destino" 'bash -s'
