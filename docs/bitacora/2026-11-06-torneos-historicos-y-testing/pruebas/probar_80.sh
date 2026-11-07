#!/usr/bin/env bash
# Prueba el replanteo 80 y su inversa dentro de UNA transacción que termina en rollback (no deja nada en la base).
# Compara la estructura antes de la 80 y después de su inversa (estructura.sql): tienen que ser iguales.
# Uso: ./probar_80.sh "<cadena de conexión de psql>"     (o, con la Supabase local:  ./probar_80.sh docker)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../../../.."
sin_tx() { grep -v -x -e 'begin;' -e 'commit;' "$1" | tr -d '\r'; }
est="$(grep -v '^--' "$root/docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/estructura.sql" | tr -d '\r' | sed 's/order by 1, 2;//')"
{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  echo "create temp table t_antes as $est;"
  sin_tx "$root/supabase/replanteo/80_torneos_historicos_testing.sql"
  sin_tx "$here/prueba_80.sql"
  echo "\\echo '--- Inversa'"
  echo "delete from notifications where data::text like '%T80 %' or type in ('admin_event_review', 'admin_game_review', 'event_reviewed', 'game_reviewed');"
  echo "update matches set parent_match_id = null, parent_side1 = null where parent_match_id in (select id from matches where event_id in (select id from events where name like 'T80 %'));"
  echo "delete from matches where event_id in (select id from events where name like 'T80 %');"
  echo "delete from tournament_registration_players where event_id in (select id from events where name like 'T80 %');"
  echo "delete from tournament_registrations where event_id in (select id from events where name like 'T80 %');"
  echo "alter table events disable trigger user; delete from events where name like 'T80 %'; alter table events enable trigger user;"
  echo "delete from teams where kind = 'historic';"
  sin_tx "$root/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/80_torneos_historicos_testing.sql"
  echo "create temp table t_despues as $est;"
  echo "select 'falta: ' || k || ' ' || v from (select * from t_antes except select * from t_despues) a(k, v)"
  echo "union all select 'sobra: ' || k || ' ' || v from (select * from t_despues except select * from t_antes) b(k, v);"
  echo "select 'inversa igual a antes: ' || (not exists (select * from t_antes except select * from t_despues) and not exists (select * from t_despues except select * from t_antes));"
  echo 'rollback;'
} | if [ "${1:-}" = docker ]; then
  MSYS_NO_PATHCONV=1 docker exec -i supabase_db_v34frag-api psql -U postgres -X -q -At -P pager=off
else
  psql "$1" -X -q -At -P pager=off
fi
