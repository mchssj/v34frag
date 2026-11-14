#!/usr/bin/env bash
# Copia de producción en la Supabase LOCAL, con la estructura y los datos de producción (después del corte del
# 2026-11-03, producción ya tiene el replanteo: copiar_datos.sh y cargar_datos.sh de la bitácora del replanteo son
# de antes y ya no sirven).
#
#   copiar  pg_dump de solo lectura de producción (por el túnel de PG_* del .env de la raíz):
#           el esquema public completo (estructura y datos), los datos de auth.users, y las políticas de Storage
#           y los triggers de auth.users que dependen de public. Queda en ~/.v34frag/prod-copy/AAAA-MM-DD/
#           (o $PROD_COPY_DIR): tiene emails y hashes de contraseñas, nunca va al repo ni sale de esta máquina.
#   cargar  BORRA el public local y carga la última copia (o la carpeta que se le pase). auth.users se reemplaza.
#   todo    copiar y después cargar.
#
# Después de cargar, los replanteos de main que producción todavía no tenga se aplican a mano, en orden.
# Túnel: ssh -L 5433:127.0.0.1:5432 <VPS_USER>@<VPS_HOST> (en Windows, con el ssh de C:\Windows\System32\OpenSSH).
set -euo pipefail

backend="$(cd "$(dirname "$0")/.." && pwd)"
raiz="$(cd "$backend/../.." && pwd)"
copias="${PROD_COPY_DIR:-$HOME/.v34frag/prod-copy}"
contenedor="supabase_db_$(sed -n 's/^project_id = "\(.*\)"/\1/p' "$backend/supabase/config.toml")"

leer() { grep "^$1=" "$raiz/.env" | tail -1 | cut -d= -f2- | tr -d '\r'; }
# pg_dump 18 agrega \restrict / \unrestrict, que el psql 17 del contenedor local no entiende.
limpiar() { sed -E '/^\\(un)?restrict /d'; }
local_sql() { docker exec -i "$contenedor" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

copiar() {
  # El .env de la raíz del repo principal (los worktrees no lo tienen).
  [[ -f "$raiz/.env" ]] || raiz="$(git -C "$raiz" worktree list --porcelain | sed -n '1s/^worktree //p')"
  export PGHOST="$(leer PG_HOST)" PGPORT="$(leer PG_PORT)" PGUSER="$(leer PG_USER)" PGPASSWORD="$(leer PG_PASSWORD)" \
         PGDATABASE=postgres PGSSLMODE="$(leer PG_SSLMODE)" PGOPTIONS='-c default_transaction_read_only=on'
  psql -At -c 'select 1' >/dev/null || { echo "No llego a producción: ¿está abierto el túnel?" >&2; exit 1; }
  destino="$copias/$(date -u +%Y-%m-%d)"
  mkdir -p "$destino"
  pg_dump --schema=public --no-owner | limpiar > "$destino/public_completo.sql"
  pg_dump --data-only --table=auth.users --no-owner | limpiar > "$destino/auth.sql"
  # Lo de afuera de public que depende de public: se borra con el drop schema y hay que recrearlo.
  psql -At > "$destino/recrear_dependencias.sql" <<'SQL'
select pg_get_triggerdef(t.oid) || ';' from pg_trigger t
 where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal order by t.tgname;
select format('drop policy if exists %I on storage.objects;', policyname) || chr(10) ||
       format('create policy %I on storage.objects as %s for %s to %s', policyname, permissive, cmd, array_to_string(roles, ', '))
       || coalesce(' using (' || qual || ')', '') || coalesce(' with check (' || with_check || ')', '') || ';'
  from pg_policies where schemaname = 'storage' and tablename = 'objects' order by policyname;
SQL
  date -u +%Y-%m-%dT%H:%M:%SZ > "$destino/FECHA"
  echo "Copia de producción en $destino ($(cat "$destino/FECHA")):"
  ls -la "$destino" | awk 'NR>3 {print "  " $5 "\t" $9}'
}

cargar() {
  dir="${1:-$(ls -d "$copias"/20??-??-?? | sort | tail -1)}"
  for f in public_completo.sql auth.sql recrear_dependencias.sql; do
    [[ -f "$dir/$f" ]] || { echo "Falta $dir/$f: correr '$0 copiar'" >&2; exit 1; }
  done
  echo "Cargando la copia del $(cat "$dir/FECHA") en $contenedor (se borra el public local)..."
  local_sql -c 'drop schema if exists public cascade;' 2>/dev/null
  # auth.users antes que public: las claves foráneas de public a auth.users se validan al cargarlas.
  # (Con public borrado ya no está el trigger que crea profiles al insertar una cuenta.)
  { echo 'set session_replication_role = replica;'; echo 'truncate auth.users cascade;'; cat "$dir/auth.sql"; } |
    local_sql > "$dir/carga_auth.log"
  # public es de postgres, como en producción y con db-local.sh: las migraciones y las pruebas corren como postgres.
  local_sql -c 'create schema public authorization postgres;'
  # Los privilegios por defecto de supabase_admin solo los puede poner supabase_admin: van aparte.
  sed -E '/^CREATE SCHEMA public;$/d; /^COMMENT ON SCHEMA public /d; /^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin /d' \
    "$dir/public_completo.sql" |
    docker exec -i "$contenedor" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q > "$dir/carga.log"
  grep -E '^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin ' "$dir/public_completo.sql" | local_sql
  local_sql < "$dir/recrear_dependencias.sql" >/dev/null
  # Ajustes que solo tienen sentido en local (ver el archivo).
  docker exec -i "$contenedor" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$backend/scripts/local-overrides.sql" >/dev/null
  local_sql -c "notify pgrst, 'reload schema';"
  echo "Listo: $(local_sql -At -c 'select count(*) from auth.users') cuentas y $(local_sql -At -c 'select count(*) from public.matches') partidas."
}

case "${1:-}" in
  copiar) copiar ;;
  cargar) cargar "${2:-}" ;;
  todo)   copiar; cargar "$destino" ;;
  *) echo "Uso: $0 copiar|cargar [carpeta]|todo" >&2; exit 1 ;;
esac
