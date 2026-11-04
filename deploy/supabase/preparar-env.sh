#!/usr/bin/env bash
# Arma /etc/cmleague/supabase.env en el VPS (plan docs/bitacora/2026-11-03-supabase-en-vps). Se corre desde la raíz
# del repo en la PC de Daniel, en Git Bash:
#   deploy/supabase/preparar-env.sh            (no pisa un supabase.env que ya exista)
#   deploy/supabase/preparar-env.sh --forzar   (solo antes del primer arranque: POSTGRES_PASSWORD queda en la base)
#
# - De la API de gestión de producción (SUPABASE_ACCESS_TOKEN_PROD): el JWT secret y las claves legacy (JWT HS256).
#   Así valen las mismas claves que hoy:
#     ANON_KEY y SERVICE_ROLE_KEY: las legacy (eyJ…), las que usan el Worker de demos y el render.
#     SUPABASE_PUBLISHABLE_KEY y SUPABASE_SECRET_KEY: las opacas (sb_…), las que usan la API y el .env.
#     Kong cambia una opaca por el JWT legacy (ANON_KEY_ASYMMETRIC y SERVICE_ROLE_KEY_ASYMMETRIC = las legacy):
#     PostgREST y Storage lo validan con el JWT secret, sin par de claves ES256.
# - SMTP_PASS: RESEND_SMTP_KEY.
# - El resto de los secretos se generan acá con openssl. DASHBOARD_PASSWORD se suma al .env de la raíz
#   (SUPABASE_VPS_DASHBOARD_PASSWORD) y POSTGRES_PASSWORD también (SUPABASE_VPS_POSTGRES_PASSWORD).
# Nunca imprime un valor.
set -euo pipefail
raiz="$(cd "$(dirname "$0")/../.." && pwd)"
aqui="$raiz/deploy/supabase"
ref=wmzfwsizashpszxlvpeb
forzar="${1:-}"
ssh_exe=/c/Windows/System32/OpenSSH/ssh.exe   # el de Git Bash no usa el agente con la llave

leer() { { grep "^$1=" "$raiz/.env" || true; } | tail -1 | cut -d= -f2- | tr -d '\r"'; }
destino="$(leer VPS_USER)@$(leer VPS_HOST)"

if [[ "$forzar" != --forzar ]] && "$ssh_exe" -o BatchMode=yes "$destino" 'sudo test -f /etc/cmleague/supabase.env'; then
  echo "Ya existe /etc/cmleague/supabase.env en el VPS. Con --forzar se reemplaza (solo antes del primer arranque)." >&2
  exit 1
fi

jwt="$(curl -fsS -m 20 -H "Authorization: Bearer $(leer SUPABASE_ACCESS_TOKEN_PROD)" \
  "https://api.supabase.com/v1/projects/$ref/postgrest" | python -I -c 'import json,sys;print(json.load(sys.stdin)["jwt_secret"])')"
[[ ${#jwt} -ge 32 ]] || { echo "No se pudo leer el JWT secret de producción." >&2; exit 1; }
legacy() { curl -fsS -m 20 -H "Authorization: Bearer $(leer SUPABASE_ACCESS_TOKEN_PROD)"   "https://api.supabase.com/v1/projects/$ref/api-keys?reveal=true" |
  python -I -c 'import json,sys;print(next(k["api_key"] for k in json.load(sys.stdin) if k["type"]=="legacy" and k["name"]==sys.argv[1]))' "$1"; }
anon_jwt="$(legacy anon)"; service_jwt="$(legacy service_role)"

hex() { openssl rand -hex "$1"; }
# Si el VPS ya tiene un supabase.env, se conservan sus contraseñas (la de Postgres ya quedó en la base).
pg_pass="$(leer SUPABASE_VPS_POSTGRES_PASSWORD)"; [[ -n "$pg_pass" ]] || pg_pass="$(hex 24)"
dash_pass="$(leer SUPABASE_VPS_DASHBOARD_PASSWORD)"; [[ -n "$dash_pass" ]] || dash_pass="$(hex 16)"

declare -A v=(
  [POSTGRES_PASSWORD]="$pg_pass"
  [JWT_SECRET]="$jwt"
  [ANON_KEY]="$anon_jwt"
  [SERVICE_ROLE_KEY]="$service_jwt"
  [ANON_KEY_ASYMMETRIC]="$anon_jwt"
  [SERVICE_ROLE_KEY_ASYMMETRIC]="$service_jwt"
  [SUPABASE_PUBLISHABLE_KEY]="$(leer PRODUCTION_SUPABASE_ANON_KEY)"
  [SUPABASE_SECRET_KEY]="$(leer PRODUCTION_SUPABASE_SERVICE_KEY)"
  [DASHBOARD_PASSWORD]="$dash_pass"
  [SECRET_KEY_BASE]="$(hex 48)"
  [VAULT_ENC_KEY]="$(hex 16)"
  [PG_META_CRYPTO_KEY]="$(hex 24)"
  [S3_PROTOCOL_ACCESS_KEY_ID]="$(hex 16)"
  [S3_PROTOCOL_ACCESS_KEY_SECRET]="$(hex 32)"
  [REALTIME_DB_ENC_KEY]="$(hex 8)"
  [LOGFLARE_PUBLIC_ACCESS_TOKEN]="$(hex 24)"
  [LOGFLARE_PRIVATE_ACCESS_TOKEN]="$(hex 24)"
  [SMTP_PASS]="$(leer RESEND_SMTP_KEY)"
)
for k in ANON_KEY SERVICE_ROLE_KEY SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY; do [[ -n "${v[$k]}" ]] || { echo "Falta $k en el .env" >&2; exit 1; }; done

# La plantilla con los valores puestos: solo cambian las líneas KEY= de la tabla.
armado="$(tr -d '\r' < "$aqui/supabase.env.example" | while IFS= read -r linea; do
  k="${linea%%=*}"
  if [[ "$linea" == *=* && "$linea" != \#* && -n "${v[$k]+x}" ]]; then printf '%s=%s\n' "$k" "${v[$k]}"; else printf '%s\n' "$linea"; fi
done)"

printf '%s\n' "$armado" | "$ssh_exe" -o BatchMode=yes "$destino" \
  'sudo sh -c "install -d -m 755 /etc/cmleague && umask 077 && cat > /etc/cmleague/supabase.env.nuevo && mv -f /etc/cmleague/supabase.env.nuevo /etc/cmleague/supabase.env"'
echo "Listo: /etc/cmleague/supabase.env en el VPS (root, 600)."

# Las dos contraseñas propias quedan en el .env de la raíz (no se versiona), para entrar a Postgres y a Studio.
for par in "SUPABASE_VPS_POSTGRES_PASSWORD=$pg_pass" "SUPABASE_VPS_DASHBOARD_PASSWORD=$dash_pass"; do
  grep -q "^${par%%=*}=" "$raiz/.env" || printf '%s\n' "$par" >> "$raiz/.env"
done
echo "Contraseñas de Postgres y de Studio guardadas en el .env de la raíz (SUPABASE_VPS_*)."
