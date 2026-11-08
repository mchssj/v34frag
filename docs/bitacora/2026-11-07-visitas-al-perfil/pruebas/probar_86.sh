#!/usr/bin/env bash
# Prueba el replanteo 86 y su inversa dentro de UNA transacción que termina en rollback (no deja nada en la base).
# Compara la estructura antes de la 84 y después de su inversa (estructura.sql): tienen que ser iguales.
# Uso: ./probar_86.sh "<cadena de conexión de psql>"     (o, con la Supabase local:  ./probar_86.sh docker)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../../../.."
sin_tx() { grep -v -x -e 'begin;' -e 'commit;' "$1" | tr -d '\r'; }
est="$(grep -v '^--' "$root/docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/estructura.sql" | tr -d '\r' | sed 's/order by 1, 2;//')"
{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  echo "create temp table t_antes as $est;"
  sin_tx "$root/supabase/replanteo/86_visitas_al_perfil.sql"
  sin_tx "$here/prueba_86.sql"
  echo "\\echo '--- Inversa'"
  sin_tx "$root/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/86_visitas_al_perfil.sql"
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
