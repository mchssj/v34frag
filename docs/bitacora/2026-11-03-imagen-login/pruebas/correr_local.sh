#!/usr/bin/env bash
# Corre las pruebas del replanteo 67 en la base local del backend (contenedor supabase_db_v34frag-api), dentro de una
# sola transacción que se deshace: aplica la 67, las pruebas y la inversa. No deja nada. Carga pg_safeupdate como
# PostgREST, para que un UPDATE sin WHERE falle igual que en staging (replanteo 62). Corre como supabase_admin, que puede cargarlo.
#
#   bash correr_local.sh <carpeta del repo>
set -euo pipefail
repo="${1:?falta la carpeta del repo}"
aqui="$(cd "$(dirname "$0")" && pwd)"
db="${DB_CONTAINER:-supabase_db_v34frag-api}"
sin_tx() { grep -v -E '^(begin|commit);\r?$' "$1"; }

{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  echo "load 'safeupdate';"
  sin_tx "$repo/supabase/replanteo/67_imagen_login.sql"
  cat "$aqui/67.sql"
  sin_tx "$repo/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/67_imagen_login.sql"
  cat <<'SQL'
do $$
begin
  if to_regclass('public.site_config') is not null or to_regprocedure('public.site_auth_image()') is not null then
    raise exception 'FALLA inversa 67';
  end if;
  raise notice 'OK: la inversa de la 67';
end $$;
SQL
  echo 'rollback;'
} | docker exec -i "$db" psql -U supabase_admin -d postgres -q -v ON_ERROR_STOP=1
