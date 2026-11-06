#!/usr/bin/env bash
# Prueba el replanteo 76 y su inversa dentro de UNA transacción que termina en rollback (no deja nada en la base).
# Uso: ./probar_76.sh "<cadena de conexión de psql>"     (o, con la Supabase local:  ./probar_76.sh docker)
# Comprueba también que la inversa deja match_clip_list y clip_archive_due exactamente como estaban.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../../../.."
sin_tx() { grep -v -x -e 'begin;' -e 'commit;' "$1" | tr -d '\r'; }
{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  echo "create temp table t_antes as select md5(pg_get_viewdef('public.match_clip_list'::regclass)) v, md5(pg_get_functiondef('public.clip_archive_due(text,integer,integer)'::regprocedure)) f, md5(pg_get_functiondef('public.manual_valores()'::regprocedure)) mv, (select count(*) from match_clip_list) n;"
  sin_tx "$root/supabase/replanteo/76_clips_destacados_y_rechazo.sql"
  echo "select (select count(*) from match_clip_list) = n as lista_igual_al_aplicar from t_antes;"
  sin_tx "$here/prueba_76.sql"
  echo "\echo '--- Inversa'"
  sin_tx "$root/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/76_clips_destacados_y_rechazo.sql"
  echo "select md5(pg_get_viewdef('public.match_clip_list'::regclass)) = v as vista_igual, md5(pg_get_functiondef('public.clip_archive_due(text,integer,integer)'::regprocedure)) = f as archivo_igual, md5(pg_get_functiondef('public.manual_valores()'::regprocedure)) = mv as manual_igual, to_regclass('public.match_clip_ranked') is null as sin_ranked from t_antes;"
  echo 'rollback;'
} | if [ "${1:-}" = docker ]; then
  MSYS_NO_PATHCONV=1 docker exec -i supabase_db_v34frag-api psql -U postgres -X -q -P pager=off
else
  psql "$1" -X -q -P pager=off
fi
