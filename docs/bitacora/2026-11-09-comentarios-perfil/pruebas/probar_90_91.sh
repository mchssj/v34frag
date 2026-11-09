#!/usr/bin/env bash
# Prueba los replanteos 90 y 91 y sus inversas dentro de UNA transacción que termina en rollback (no deja nada).
# Compara la estructura antes de la 90 y después de las inversas: tienen que ser iguales.
# Uso: ./probar_90_91.sh "<cadena de conexión de psql>"     (o, con la Supabase local:  ./probar_90_91.sh docker)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../../../.."
sin_tx() { grep -v -x -e 'begin;' -e 'commit;' "$1" | tr -d '\r'; }
est="$(grep -v '^--' "$root/docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/estructura.sql" | tr -d '\r' | sed 's/order by 1, 2;//')"
rev="$root/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas"
{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  # La base local vieja no tiene la foto del matchmaking (replanteo 55): un reemplazo solo para la prueba.
  echo "do \$\$ begin if to_regprocedure('public.mm_player_photo(uuid)') is null then"
  echo "  execute 'create function public.mm_player_photo(uuid) returns text language sql as \$f\$ select null::text \$f\$'; end if; end \$\$;"
  # Y tampoco la categoría de notificaciones `friends` (replanteo 85).
  echo "do \$\$ begin if pg_get_constraintdef((select oid from pg_constraint where conname = 'notifications_category_check')) not like '%friends%' then"
  echo "  alter table notifications drop constraint notifications_category_check;"
  echo "  alter table notifications add constraint notifications_category_check check (category = any (array['team', 'tournament', 'pcw', 'elo', 'season', 'account', 'news', 'admin', 'mm', 'friends'])); end if; end \$\$;"
  echo "create temp table t_antes as $est;"
  sin_tx "$root/supabase/replanteo/90_jugadores_verificados.sql"
  sin_tx "$root/supabase/replanteo/91_comentarios_y_votos_perfil.sql"
  sin_tx "$here/prueba_90_91.sql"
  echo "\echo '--- Inversas'"
  sin_tx "$rev/91_comentarios_y_votos_perfil.sql"
  sin_tx "$rev/90_jugadores_verificados.sql"
  echo "create temp table t_despues as $est;"
  echo "select 'falta: ' || k || ' ' || v from (select * from t_antes except select * from t_despues) a(k, v)"
  echo "union all select 'sobra: ' || k || ' ' || v from (select * from t_despues except select * from t_antes) b(k, v);"
  echo "select 'inversas iguales a antes: ' || (not exists (select * from t_antes except select * from t_despues) and not exists (select * from t_despues except select * from t_antes));"
  echo 'rollback;'
} | if [ "${1:-}" = docker ]; then
  MSYS_NO_PATHCONV=1 docker exec -i supabase_db_v34frag-api psql -U postgres -X -q -At -P pager=off
else
  psql "$1" -X -q -At -P pager=off
fi
