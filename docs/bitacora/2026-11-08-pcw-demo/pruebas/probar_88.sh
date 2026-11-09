#!/usr/bin/env bash
# Prueba el replanteo 88 y su inversa dentro de UNA transacción que termina en rollback (no deja nada en la base).
# Compara la estructura antes de la 88 y después de su inversa (estructura.sql): tienen que ser iguales.
# Uso: ./probar_88.sh "<cadena de conexión de psql>"     (o, con la Supabase local:  ./probar_88.sh docker)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../../../.."
sin_tx() { grep -v -x -e 'begin;' -e 'commit;' "$1" | tr -d '\r'; }
est="$(grep -v '^--' "$root/docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/estructura.sql" | tr -d '\r' | sed 's/order by 1, 2;//')"
{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  echo "create temp table t_antes as $est;"
  echo "create temp table t_fn_antes as select p.oid::regprocedure::text f, md5(pg_get_functiondef(p.oid)) d from pg_proc p where p.oid in ('public.elo_apply_match(uuid)'::regprocedure, 'public.elo_recompute_all()'::regprocedure);"
  echo "select elo_recompute_all();"   # ELO de referencia: el que da un recálculo antes de la 88
  # Sin ninguna PCW en la base (producción, 2026-11-09), una de prueba: se deshace con el resto.
  echo "do \$\$ begin if not exists (select 1 from matches where kind = 'pcw') then insert into matches (kind, status) values ('pcw', 'upcoming'); end if; end \$\$;"
  # Una PCW ya jugada con ELO (antes de la 88): el mix con ELO más viejo, vinculado a una PCW. La 88 tiene que recalcular.
  echo "create temp table t88_pre as select (select id from matches m where m.kind = 'mix' and m.status = 'finished' and m.parent_match_id is null and exists (select 1 from match_player_stats s where s.match_id = m.id and s.elo_after is not null) order by coalesce(m.played_at, m.starts_at) limit 1) g, (select id from matches where kind = 'pcw' limit 1) p;"
  echo "update matches m set parent_match_id = t.p, parent_side1 = 1 from t88_pre t where m.id = t.g;"
  sin_tx "$root/supabase/replanteo/88_pcw_sin_elo.sql"
  sin_tx "$here/prueba_88.sql"
  echo "\\echo '--- Inversa'"
  sin_tx "$root/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/88_pcw_sin_elo.sql"
  echo "create temp table t_despues as $est;"
  echo "select 'falta: ' || k || ' ' || v from (select * from t_antes except select * from t_despues) a(k, v)"
  echo "union all select 'sobra: ' || k || ' ' || v from (select * from t_despues except select * from t_antes) b(k, v);"
  echo "select 'inversa igual a antes: ' || (not exists (select * from t_antes except select * from t_despues) and not exists (select * from t_despues except select * from t_antes));"
  echo "select 'funciones iguales a antes: ' || not exists (select f, d from t_fn_antes except select p.oid::regprocedure::text, md5(pg_get_functiondef(p.oid)) from pg_proc p where p.oid in ('public.elo_apply_match(uuid)'::regprocedure, 'public.elo_recompute_all()'::regprocedure));"
  echo 'rollback;'
} | if [ "${1:-}" = docker ]; then
  MSYS_NO_PATHCONV=1 docker exec -i supabase_db_v34frag-api psql -U postgres -X -q -At -P pager=off
else
  psql "$1" -X -q -At -P pager=off
fi
