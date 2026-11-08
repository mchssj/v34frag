#!/usr/bin/env bash
# Prueba el replanteo 73 y su inversa en una base (staging) dentro de UNA transacción que termina en rollback.
# Uso: PGPASSWORD=... ./probar_73.sh "<cadena de conexión de psql>" <uuid admin> <uuid servidor mm>
# Comprueba también que la inversa deja mm_try_build y mm_set_config exactamente como estaban.
set -euo pipefail
conn="$1"; admin="$2"; server="$3"
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../../../.."
sin_tx() { grep -v -x -e 'begin;' -e 'commit;' "$1" | tr -d '\r'; }
{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  echo "create temp table t_antes as select p, md5(pg_get_functiondef(p::regprocedure)) h from unnest(array['public.mm_try_build(text)', 'public.mm_set_config(jsonb)']) p;"
  sin_tx "$root/supabase/replanteo/73_mm_equipos_con_rating.sql"
  sin_tx "$here/prueba_73.sql"
  echo "\\echo '--- 7. Inversa'"
  sin_tx "$root/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/73_mm_equipos_con_rating.sql"
  echo "select bool_and(md5(pg_get_functiondef(p::regprocedure)) = h) as inversa_igual_a_antes, to_regprocedure('public.mm_balance_elos(uuid[], integer[])') is null as sin_funcion from t_antes;"
  echo "select count(*) = 0 as sin_columnas from information_schema.columns where table_name in ('mm_config', 'mm_lobby_players') and column_name like 'balance%';"
  echo 'rollback;'
} | psql "$conn" -X -q -v admin="$admin" -v server="$server" -P pager=off
