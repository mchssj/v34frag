#!/usr/bin/env bash
# Carga la copia de producción (copiar_datos.sh) en la Supabase LOCAL, sobre el esquema actual de producción
# (REPLANTEO=0), que es donde encajan esos datos. Después se puede aplicar supabase/replanteo/ encima, igual
# que se haría en el corte.
# Carga como superusuario local con session_replication_role = replica: no se disparan triggers (por
# ejemplo, el que crea profiles al insertar en auth.users) ni se chequean FK durante la carga.
set -euo pipefail

aqui="$(cd "$(dirname "$0")" && pwd)"
raiz="$(cd "$aqui/../../../.." && pwd)"
backend="$raiz/web/backend"
copia="${PROD_COPY_DIR:-$HOME/.v34frag/prod-copy}"
contenedor="supabase_db_$(sed -n 's/^project_id = "\(.*\)"/\1/p' "$backend/supabase/config.toml")"
[[ -f "$copia/public.sql" && -f "$copia/auth_users.sql" ]] || { echo "Falta la copia: correr copiar_datos.sh"; exit 1; }

(cd "$backend" && REPLANTEO=0 bash scripts/db-local.sh reset) | grep -E "pendiente|omitido|cargado"

cargar() {
  { echo "set session_replication_role = replica;"; cat "$1"; } |
    docker exec -i "$contenedor" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q >/dev/null
}
cargar "$copia/auth_users.sql"
cargar "$copia/public.sql"
docker exec -i "$contenedor" psql -U postgres -d postgres -q -c "notify pgrst, 'reload schema';" >/dev/null
echo "Datos de producción cargados en la base local (copia del $(cat "$copia/FECHA"))."
