#!/usr/bin/env bash
# Arma la base "referencia_permisos" en el contenedor de la Supabase local, sin tocar la base postgres (la copia de
# producción): los esquemas de Supabase (auth, storage, extensions…) copiados de la base local, los permisos por
# defecto de public que tiene una Supabase recién creada, y después lo mismo que carga web/backend/scripts/db-local.sh:
# supabase/schema/public.sql, auth_storage.sql, las migraciones posteriores a BASE y supabase/replanteo/ en orden
# numérico, hasta la que se pase (por defecto, la 112: lo que tiene producción).
# Es la base "como la dejan las migraciones": sus permisos son los que producción debería tener.
# Uso: bash referencia.sh [ultima_replanteo] [nombre_de_la_base]
set -euo pipefail

aqui="$(cd "$(dirname "$0")" && pwd)"
raiz="$(cd "$aqui/../../../.." && pwd)"
hasta="${1:-112}"
C="supabase_db_$(sed -n 's/^project_id = "\(.*\)"/\1/p' "$raiz/web/backend/supabase/config.toml")"
DB="${2:-referencia_permisos}"
admin_sql() { docker exec -i "$C" psql -U supabase_admin -d "$1" -v ON_ERROR_STOP=1 -q "${@:2}"; }
# Con LF, como los guarda el repo: un checkout de Windows los deja con CRLF y cambia el texto de las funciones.
pg_sql() { tr -d "\r" | docker exec -i "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q "$@"; }

admin_sql postgres -c "drop database if exists $DB;" -c "create database $DB;"
# Los esquemas de Supabase sin public. Fallan solo las políticas de storage y los triggers de auth que usan funciones
# de public: los crean las migraciones.
docker exec "$C" sh -c "pg_dump -U supabase_admin -d postgres --schema-only --exclude-schema=public > /tmp/ref_no_public.sql"
docker exec "$C" sh -c "psql -U supabase_admin -d $DB -q -f /tmp/ref_no_public.sql > /tmp/ref_no_public.log 2>&1" || true
admin_sql "$DB" <<'SQL'
-- Las políticas de storage las crean auth_storage.sql y las migraciones.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;
alter schema public owner to postgres;
grant usage on schema public to anon, authenticated, service_role;
-- Los permisos por defecto de public de una Supabase nueva (los de la base local y los de producción).
alter default privileges for role postgres in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public grant all on sequences to postgres, anon, authenticated, service_role;
SQL

echo "Cargando en $DB…"
pg_sql < "$raiz/supabase/schema/public.sql" >/dev/null
pg_sql < "$raiz/supabase/schema/auth_storage.sql" >/dev/null
base="$(tr -d '[:space:]' < "$raiz/supabase/schema/BASE")"
for f in "$raiz"/supabase/migrations/*.sql; do
  n="$(basename "$f")"
  [[ "${n%%_*}" > "$base" ]] && pg_sql < "$f" >/dev/null
done
while IFS= read -r n; do
  (( 10#${n%%_*} <= 10#$hasta )) || continue
  pg_sql < "$raiz/supabase/replanteo/$n" >/dev/null
done < <(cd "$raiz/supabase/replanteo" && printf '%s\n' [0-9]*.sql | sort -V)
echo "Listo: $DB con los replanteos hasta el $hasta."
