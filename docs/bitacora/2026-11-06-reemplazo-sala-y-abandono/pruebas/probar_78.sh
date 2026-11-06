#!/usr/bin/env bash
# Prueba el replanteo 78 y su inversa dentro de UNA transacción que termina en rollback (no deja nada en la base).
# Uso: ./probar_78.sh "<cadena de conexión de psql>"     (o, con la Supabase local:  ./probar_78.sh docker)
# Con el worker del matchmaking corriendo, pararlo antes (su vuelta de mm_tick espera los bloqueos de la prueba).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../../../.."
sin_tx() { grep -v -x -e 'begin;' -e 'commit;' "$1" | tr -d '\r'; }
fns="array['public.mm_elo_delta(uuid,text,integer,double precision,double precision,integer)',
  'public.mm_replace_open(uuid,smallint,uuid,text)', 'public.mm_replace_arrived(uuid,uuid)', 'public.mm_lobby_json(uuid,uuid)',
  'public.mm_replace_info(text)', 'public.mm_set_config(jsonb)', 'public.manual_valores()']"
{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  echo "create temp table t_antes as select p, md5(pg_get_functiondef(p::regprocedure)) h from unnest($fns) p;"
  sin_tx "$root/supabase/replanteo/78_mm_reemplazo_sala_y_abandono.sql"
  sin_tx "$here/prueba_78.sql"
  echo "\\echo '--- Inversa'"
  sin_tx "$root/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/78_mm_reemplazo_sala_y_abandono.sql"
  echo "select bool_and(md5(pg_get_functiondef(p::regprocedure)) = h) as inversa_igual_a_antes from t_antes;"
  echo "select count(*) = 0 as sin_columnas from information_schema.columns where (table_name = 'mm_config' and column_name like 'abandon\\_%\\_m%') or (table_name = 'mm_replacements' and column_name like '%\\_round');"
  echo "select to_regprocedure('public.mm_game_room(uuid)') is null and to_regprocedure('public.mm_lobby_replacements(uuid)') is null as sin_funciones;"
  echo 'rollback;'
} | if [ "${1:-}" = docker ]; then
  MSYS_NO_PATHCONV=1 docker exec -i supabase_db_v34frag-api psql -U postgres -X -q -P pager=off
else
  psql "$1" -X -q -P pager=off
fi
