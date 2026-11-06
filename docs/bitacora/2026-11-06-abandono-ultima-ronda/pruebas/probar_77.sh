#!/usr/bin/env bash
# Prueba el replanteo 77 y su inversa dentro de UNA transacción que termina en rollback (no deja nada en la base).
# Uso: ./probar_77.sh "<cadena de conexión de psql>"     (o, con la Supabase local:  ./probar_77.sh docker)
# Comprueba también que la inversa deja csstv_link_game exactamente como estaba.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../../../.."
sin_tx() { grep -v -x -e 'begin;' -e 'commit;' "$1" | tr -d '\r'; }
{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  echo "create temp table t_antes as select md5(pg_get_functiondef('public.csstv_link_game(uuid,text,integer)'::regprocedure)) h;"
  sin_tx "$root/supabase/replanteo/77_mm_abandono_ultima_ronda.sql"
  sin_tx "$here/prueba_77.sql"
  echo "\\echo '--- Inversa'"
  sin_tx "$root/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/77_mm_abandono_ultima_ronda.sql"
  echo "select md5(pg_get_functiondef('public.csstv_link_game(uuid,text,integer)'::regprocedure)) = h as inversa_igual_a_antes,"
  echo "       to_regprocedure('public.mm_left_last_round(uuid,uuid)') is null as sin_funcion from t_antes;"
  echo 'rollback;'
} | if [ "${1:-}" = docker ]; then
  MSYS_NO_PATHCONV=1 docker exec -i supabase_db_v34frag-api psql -U postgres -X -q -P pager=off
else
  psql "$1" -X -q -P pager=off
fi
