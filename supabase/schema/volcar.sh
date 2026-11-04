#!/usr/bin/env bash
# Vuelca SOLO el esquema `public` de la Supabase real (sin datos) a supabase/schema/public.sql.
# Requiere pg_dump >= 17 y las variables PG_* del .env de la raíz (Session pooler).
# Uso: supabase/schema/volcar.sh <ultima-migracion-aplicada-en-produccion>
#   ej: supabase/schema/volcar.sh 20261013140000
set -euo pipefail

raiz="$(cd "$(dirname "$0")/../.." && pwd)"
dir="$raiz/supabase/schema"
base="${1:?Indica la última migración que ya está aplicada en producción (ej: 20261013140000)}"

leer() { grep "^$1=" "$raiz/.env" | tail -1 | cut -d= -f2- | tr -d '\r'; }
export PGHOST="${PGHOST:-$(leer PG_HOST)}" PGPORT="${PGPORT:-$(leer PG_PORT)}" PGUSER="${PGUSER:-$(leer PG_USER)}" \
       PGPASSWORD="${PGPASSWORD:-$(leer PG_PASSWORD)}" PGDATABASE=postgres

tmp="$(mktemp)"
pg_dump --schema-only --schema=public --no-owner -f "$tmp"

# Limpieza para poder cargarlo en una Supabase local:
#  - \restrict / \unrestrict: metacomandos de psql 18 que el psql del contenedor no conoce.
#  - CREATE SCHEMA public y su comentario: el esquema ya existe.
#  - ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin: son de la plataforma, la Supabase local
#    ya los trae y el rol postgres no puede cambiarlos.
sed -E \
  -e '/^\\(un)?restrict /d' \
  -e '/^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin /d' \
  -e '/^CREATE SCHEMA public;$/d' \
  -e "/^COMMENT ON SCHEMA public IS /d" \
  "$tmp" > "$dir/public.sql"
rm -f "$tmp"

echo "$base" > "$dir/BASE"
echo "Esquema volcado en supabase/schema/public.sql (base: $base)."
