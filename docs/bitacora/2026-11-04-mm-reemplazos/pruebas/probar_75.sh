#!/usr/bin/env bash
# Prueba el replanteo 75 y su inversa dentro de UNA transacción que termina en rollback (no deja nada en la base).
# Uso: ./probar_75.sh "<cadena de conexión de psql>"     (o, con la Supabase local:  ./probar_75.sh docker)
# Comprueba también que la inversa deja las siete funciones exactamente como estaban.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../../../.."
sin_tx() { grep -v -x -e 'begin;' -e 'commit;' "$1" | tr -d '\r'; }
fns="array['public.mm_tick()', 'public.csstv_mm_report(text,uuid,text,text)', 'public.csstv_mm_poll(text,text,text)',
  'public.mm_elo_delta(uuid,text,integer,double precision,double precision,integer)',
  'public.mm_player_card(uuid,uuid,mm_lobby_players)', 'public.mm_set_config(jsonb)', 'public.manual_valores()']"
{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  echo "create temp table t_antes as select p, md5(pg_get_functiondef(p::regprocedure)) h from unnest($fns) p;"
  sin_tx "$root/supabase/replanteo/75_mm_reemplazos.sql"
  sin_tx "$here/prueba_75.sql"
  echo "\\echo '--- Inversa'"
  sin_tx "$root/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/75_mm_reemplazos.sql"
  echo "select bool_and(md5(pg_get_functiondef(p::regprocedure)) = h) as inversa_igual_a_antes, to_regclass('public.mm_replacements') is null as sin_tabla from t_antes;"
  echo "select count(*) = 0 as sin_columnas from information_schema.columns where table_name in ('mm_config', 'mm_lobby_players') and (column_name like 'replace%');"
  echo 'rollback;'
} | if [ "${1:-}" = docker ]; then
  MSYS_NO_PATHCONV=1 docker exec -i supabase_db_v34frag-api psql -U postgres -X -q -P pager=off
else
  psql "$1" -X -q -P pager=off
fi
