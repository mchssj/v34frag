#!/usr/bin/env bash
# Prueba el replanteo 145 y su inversa dentro de UNA transacción que termina en rollback (no deja nada en la base).
# Uso: ./probar_145.sh docker     (Supabase local)     o     ./probar_145.sh "<cadena de conexión de psql>"
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../../../.."
sin_tx() { grep -v -x -e 'begin;' -e 'commit;' "$1" | tr -d '\r'; }
firma="select md5(string_agg(pg_get_functiondef(o), '' order by o::text)) h from unnest(array['public.mm_elo_delta(uuid,text,integer,double precision,double precision,integer)','public.mm_left_last_round(uuid,uuid)']::regprocedure[]) o"
{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  echo "create temp table t_antes as $firma;"
  sin_tx "$root/supabase/replanteo/145_mm_abandono_reemplazo.sql"
  sin_tx "$here/prueba_145.sql"
  echo "\\echo '--- Inversa'"
  sin_tx "$root/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/145_mm_abandono_reemplazo.sql"
  echo "select (select h from t_antes) = h as inversa_igual_a_antes, to_regprocedure('public.mm_rounds_before(uuid,uuid)') is null as sin_funcion from ($firma) x;"
  echo 'rollback;'
} | if [ "${1:-}" = docker ]; then
  MSYS_NO_PATHCONV=1 docker exec -i supabase_db_v34frag-api psql -U postgres -X -q -P pager=off
else
  psql "$1" -X -q -P pager=off
fi
