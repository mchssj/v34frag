#!/usr/bin/env bash
# Prueba el replanteo 92 y su inversa dentro de UNA transacción que termina en rollback (no deja nada en la base).
# Compara la estructura y las funciones que cambian antes de la 92 y después de su inversa: tienen que ser iguales.
# Necesita la 88 aplicada o no, da igual; necesita la 56 y la 30.
# Uso: ./probar_92.sh "<cadena de conexión de psql>"     (o, con la Supabase local:  ./probar_92.sh docker)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../../../.."
sin_tx() { grep -v -x -e 'begin;' -e 'commit;' "$1" | tr -d '\r'; }
est="$(grep -v '^--' "$root/docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/estructura.sql" | tr -d '\r' | sed 's/order by 1, 2;//')"
fns="'public.accept_pcw(uuid, text, uuid[], text[], uuid)', 'public.pcw_cleanup()', 'public.create_pcw_post(text, integer, text, timestamp with time zone, text, uuid[], text[], uuid, text[])', 'public.veto_sequence(integer, integer)', 'public.match_map_pool(uuid)', 'public.match_series_maps(uuid)', 'public.notification_category(text)', 'public.servers_free(text)'"
fn_sel="select f, md5(pg_get_functiondef(to_regprocedure(f))) d from unnest(array[$fns]) f"
{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  echo "create temp table t_antes as $est;"
  echo "create temp table t_fn_antes as $fn_sel;"
  sin_tx "$root/supabase/replanteo/92_pcw_ofertas.sql"
  sin_tx "$here/prueba_92.sql"
  echo "\\echo '--- Inversa'"
  sin_tx "$root/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/92_pcw_ofertas.sql"
  echo "create temp table t_despues as $est;"
  echo "select 'falta: ' || k || ' ' || v from (select * from t_antes except select * from t_despues) a(k, v)"
  echo "union all select 'sobra: ' || k || ' ' || v from (select * from t_despues except select * from t_antes) b(k, v);"
  echo "select 'inversa igual a antes: ' || (not exists (select * from t_antes except select * from t_despues) and not exists (select * from t_despues except select * from t_antes));"
  echo "select 'funciones iguales a antes: ' || not exists (select * from t_fn_antes except $fn_sel);"
  echo 'rollback;'
} | if [ "${1:-}" = docker ]; then
  MSYS_NO_PATHCONV=1 docker exec -i supabase_db_v34frag-api psql -U postgres -X -q -At -P pager=off
else
  psql "$1" -X -q -At -P pager=off
fi
