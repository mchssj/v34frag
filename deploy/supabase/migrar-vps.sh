#!/usr/bin/env bash
# Pasa la base de producción (Supabase en la nube) al Supabase del VPS (plan docs/bitacora/2026-11-03-supabase-en-vps,
# secciones 6 y 7). Corre en el VPS como root; lo lanza migrar.sh desde la PC, que deja las variables en
# /run/cmleague-migracion.env (tmpfs, 600) y lo borra al terminar:
#   ORIGEN_DB_URL         postgres://…@pooler…/postgres?sslmode=require (producción, sesión)
#   ORIGEN_URL            https://<ref>.supabase.co
#   ORIGEN_SERVICE_JWT    la service_role legacy de producción (para bajar los archivos de Storage)
#   MM_LISTENER_PASSWORD  la de producción: MM_LISTEN_URL solo cambia de host
#   URL_NUEVA             https://db.cmleague.lat
#
#   migrar-vps.sh               sobre un Supabase recién creado (sin tablas en public)
#   migrar-vps.sh --desde-cero  borra la base del VPS, la crea de nuevo y migra (ensayo repetido y corte)
#
# Pasos: 1. roles  2. esquema de public  3. triggers de auth.users y políticas de storage  4. datos de public, auth y
# storage (sin disparar triggers)  5. comparación fila a fila con el origen  6. archivos de Storage  7. URLs guardadas
# 8. mm_listener, ANALYZE y recarga de PostgREST. Se detiene en el primer error. Nunca escribe en el origen.
set -euo pipefail
aqui="$(cd "$(dirname "$0")" && pwd)"
set -a; . /run/cmleague-migracion.env; set +a
: "${ORIGEN_DB_URL:?}" "${ORIGEN_URL:?}" "${ORIGEN_SERVICE_JWT:?}" "${MM_LISTENER_PASSWORD:?}" "${URL_NUEVA:?}"
URL_VIEJA="${ORIGEN_URL%/}"

# Como postgres (dueño de public, igual que en la nube) o como supabase_admin (superusuario, para auth y storage).
pg()    { docker exec -i -e PGOPTIONS='-c TimeZone=UTC' supabase-db psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"; }
admin() { docker exec -i -e PGOPTIONS='-c TimeZone=UTC' supabase-db psql -X -q -v ON_ERROR_STOP=1 -U supabase_admin -d postgres "$@"; }
origen() { docker exec -i -e PGOPTIONS='-c TimeZone=UTC' supabase-db psql -X -q -v ON_ERROR_STOP=1 "$ORIGEN_DB_URL" "$@"; }
dump()  { docker exec -i supabase-db pg_dump "$ORIGEN_DB_URL" "$@"; }
t0=$(date +%s)
paso() { echo "== $1 ($(( $(date +%s) - t0 )) s)"; }

if [[ "${1:-}" == --desde-cero ]]; then
  paso "0. Base del VPS desde cero"
  sb down -v 2>&1 | grep -E "Removed|removed" | tr '\n' ' '; echo
  rm -rf /srv/supabase/oficial/docker/volumes/db/data
  sb arrancar >/dev/null 2>&1
  for i in $(seq 1 60); do
    sb ps --format '{{.Status}}' | grep -qv healthy || break
    sleep 3
  done
  sb ps --format '   {{.Name}} {{.Status}}'
fi

n="$(pg -At -c "select count(*) from pg_tables where schemaname = 'public'")"
[[ "$n" == 0 ]] || { echo "public ya tiene $n tablas: usar --desde-cero." >&2; exit 1; }

dir="/srv/supabase/migracion/$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 700 "$dir"
echo "Volcados en $dir"

paso "1. Roles"
pg -c "create role mm_listener login noinherit password '$MM_LISTENER_PASSWORD';"

paso "2. Esquema de public"
# Sin CREATE SCHEMA public (ya existe) ni los permisos por defecto de supabase_admin: los trae la imagen, iguales, y
# postgres no es superusuario para cambiarlos.
dump --schema-only --schema=public --no-owner |
  sed -e '/^CREATE SCHEMA public;$/d' -e '/^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin /d' > "$dir/public_esquema.sql"
pg < "$dir/public_esquema.sql" >/dev/null
echo "   $(pg -At -c "select count(*) from pg_tables where schemaname = 'public'") tablas, $(pg -At -c "select count(*) from pg_proc where pronamespace = 'public'::regnamespace") funciones"

paso "3. Triggers de auth.users y políticas de auth y storage"
origen -At > "$dir/auth_storage_extra.sql" <<'SQL'
select pg_get_triggerdef(t.oid) || ';'
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace s on s.oid = c.relnamespace
 where s.nspname = 'auth' and not t.tgisinternal;
select format('create policy %I on %I.%I as %s for %s to %s%s%s;', policyname, schemaname, tablename, permissive, cmd,
              (select string_agg(case when r = 'public' then 'public' else quote_ident(r) end, ', ') from unnest(roles) r),
              case when qual is not null then ' using (' || qual || ')' else '' end,
              case when with_check is not null then ' with check (' || with_check || ')' else '' end)
  from pg_policies where schemaname in ('auth', 'storage');
SQL
admin < "$dir/auth_storage_extra.sql"
echo "   $(grep -c '^CREATE TRIGGER' "$dir/auth_storage_extra.sql") triggers, $(grep -c '^create policy' "$dir/auth_storage_extra.sql") políticas"

paso "4. Datos (sin disparar triggers ni chequear FK)"
dump --data-only --schema=auth --exclude-table=auth.schema_migrations > "$dir/auth_datos.sql"
dump --data-only --table=storage.buckets --table=storage.objects > "$dir/storage_datos.sql"
dump --data-only --schema=public 2> >(grep -Ev "circular foreign-key|^pg_dump: (detail|hint)" >&2) > "$dir/public_datos.sql"
for f in auth_datos storage_datos public_datos; do
  { echo "set session_replication_role = replica;"; cat "$dir/$f.sql"; } | admin --single-transaction >/dev/null
  echo "   $f: $(du -h "$dir/$f.sql" | cut -f1)"
done

paso "5. Comparación fila a fila con el origen"
# Una línea por tabla: filas y md5 de las filas ordenadas. Antes de copiar los archivos y de cambiar las URLs. Sin los
# latidos (last_seen_at, last_poll_at): los servidores y el Worker los siguen escribiendo en la nube mientras corre.
huella() {
  "$1" -At <<'SQL'
select format('select %L, count(*), md5(coalesce(string_agg(md5((to_jsonb(t) - ''{last_seen_at,last_poll_at}''::text[])::text), '''' order by md5((to_jsonb(t) - ''{last_seen_at,last_poll_at}''::text[])::text)), '''')) from %I.%I t',
              schemaname || '.' || tablename, schemaname, tablename)
  from pg_tables
 where schemaname = 'public' or (schemaname = 'auth' and tablename <> 'schema_migrations')
    or (schemaname = 'storage' and tablename in ('buckets', 'objects'))
 order by schemaname, tablename
\gexec
SQL
}
huella origen > "$dir/huella_origen.txt"
huella admin > "$dir/huella_vps.txt"
if ! diff "$dir/huella_origen.txt" "$dir/huella_vps.txt" > "$dir/huella_diff.txt"; then
  echo "   DIFERENCIAS:"; head -20 "$dir/huella_diff.txt"; exit 1
fi
echo "   $(wc -l < "$dir/huella_vps.txt") tablas idénticas, $(awk -F'|' '{s+=$2} END {print s}' "$dir/huella_vps.txt") filas"

paso "6. Archivos de Storage"
admin <<'SQL'
create schema migracion;
create table migracion.objetos as
  select bucket_id, name, owner, owner_id, created_at, updated_at, last_accessed_at, user_metadata from storage.objects;
SQL
admin -At -F $'\t' -c "select bucket_id, name, coalesce(metadata->>'mimetype', 'application/octet-stream'),
  coalesce(metadata->>'cacheControl', 'max-age=3600'), coalesce((metadata->>'size')::bigint, -1) from storage.objects order by 1, 2" \
  > "$dir/objetos.tsv"
SERVICE_LOCAL="$(sed -n 's/^SERVICE_ROLE_KEY=//p' /etc/cmleague/supabase.env)" \
  python3 -I "$aqui/copiar_storage.py" "$dir/objetos.tsv"
# La subida con upsert deja al service_role como dueño: vuelven el dueño y las fechas de la nube.
admin <<'SQL'
update storage.objects o set owner = m.owner, owner_id = m.owner_id, created_at = m.created_at,
       updated_at = m.updated_at, last_accessed_at = m.last_accessed_at, user_metadata = m.user_metadata
  from migracion.objetos m where m.bucket_id = o.bucket_id and m.name = o.name;
drop schema migracion cascade;
SQL

paso "7. URLs guardadas ($URL_VIEJA -> $URL_NUEVA)"
admin -At -v vieja="$URL_VIEJA" -v nueva="$URL_NUEVA" > "$dir/urls.txt" <<'SQL'
set session_replication_role = replica;
select format('with c as (update %I.%I set %I = replace(%I::text, %L, %L)::%s where %I::text like %L returning 1) select %L, count(*) from c',
              table_schema, table_name, column_name, column_name, :'vieja', :'nueva',
              case when data_type = 'ARRAY' then udt_name::regtype::text else data_type end,
              column_name, '%' || :'vieja' || '%', table_schema || '.' || table_name || '.' || column_name)
  from information_schema.columns c
 where (table_schema = 'public' or (table_schema = 'auth' and table_name = 'users'))
   and (data_type in ('text', 'character varying', 'jsonb', 'json') or udt_name in ('_text', '_varchar'))
   and exists (select 1 from information_schema.tables t where t.table_schema = c.table_schema
               and t.table_name = c.table_name and t.table_type = 'BASE TABLE')
\gexec
SQL
awk -F'|' '$2 > 0 {print "   " $1 ": " $2 " filas"}' "$dir/urls.txt"
quedan="$(pg -At -c "select count(*) from pg_proc where prosrc like '%$URL_VIEJA%'")"
[[ "$quedan" == 0 ]] || echo "   OJO: $quedan funciones tienen la URL vieja en el código"

paso "8. ANALYZE y recarga de PostgREST"
admin -c "analyze;"
pg -c "notify pgrst, 'reload schema';"
docker restart supabase-rest >/dev/null

paso "Listo"
admin -At -c "select 'cuentas: ' || (select count(*) from auth.users) || ', archivos: ' || (select count(*) from storage.objects) ||
  ', partidas: ' || (select count(*) from public.matches) || ', base: ' || pg_size_pretty(pg_database_size('postgres'))"
