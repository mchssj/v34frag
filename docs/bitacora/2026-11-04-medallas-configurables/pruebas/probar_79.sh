#!/usr/bin/env bash
# Prueba el replanteo 79, las definiciones iniciales y la inversa dentro de UNA transacción que termina en rollback
# (no deja nada en la base). Pensado para correrlo contra producción antes de aplicar la 79 de verdad.
# Uso: ./probar_79.sh "<cadena de conexión de psql>"     (o, con la Supabase local:  ./probar_79.sh docker)
# Sin un mix en curso y con cmleague-mm parado: la 79 crea triggers en matches y match_player_stats.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../../../.."
sin_tx() { grep -v -x -e 'begin;' -e 'commit;' "$1" | tr -d '\r'; }
fns="array['public.season_close_run(uuid,uuid)', 'public.tg_notify_season_standings()',
  'public.tg_notify_player_medals()', 'public.season_tiers_ok(jsonb)']"
{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  echo "create temp table t_antes as select p, md5(pg_get_functiondef(p::regprocedure)) h from unnest($fns) p;"
  echo "create temp table t_medallas as select id, title, icon from player_medals;"
  echo "create temp table t_tramos as select id, tiers from seasons;"
  echo "create temp table t_avisos as select count(*) n from notifications;"
  sin_tx "$root/supabase/replanteo/79_medallas_configurables.sql"
  sin_tx "$here/definiciones_iniciales.sql"
  echo "\\echo '--- Después de la 79 y las definiciones (con la BETA abierta)'"
  echo "select (select count(*) from medal_definitions) as definiciones,
               (select count(*) from medal_definitions where status = 'active') as activas,
               medal_stats_since() is null as beta_sin_desde,
               (select count(*) from player_medals where source = 'auto') = 0 as sin_medallas_del_motor,
               (select count(*) from notifications) = (select n from t_avisos) as sin_avisos_nuevos,
               (select count(*) from medal_queue) = 0 as cola_vacia,
               not exists (select 1 from player_medals where definition_id is null) as todas_con_definicion,
               (select count(*) from player_medals) = (select count(*) from t_medallas) as mismas_medallas,
               (select bool_and(t ? 'definition') from seasons s, jsonb_array_elements(s.tiers) t where s.status = 'active') as tramos_con_medalla,
               position('(replanteo 79)' in pg_get_functiondef('public.season_close_run(uuid,uuid)'::regprocedure)) > 0 as cierre_enganchado;"
  echo "\\echo '--- Inversa'"
  echo "drop function if exists pg_temp.reemplazar(regprocedure, text[]);   -- la 79 y la inversa crean la misma"
  sin_tx "$here/79_inversa.sql"
  echo "select bool_and(md5(pg_get_functiondef(p::regprocedure)) = h) as inversa_igual_a_antes from t_antes;"
  echo "select to_regclass('public.medal_definitions') is null and to_regclass('public.medal_queue') is null
               and to_regprocedure('public.medal_stats_since()') is null as sin_tablas_ni_funciones;"
  echo "select not exists (select id, title, icon from player_medals except select id, title, icon from t_medallas)
               and (select count(*) from player_medals) = (select count(*) from t_medallas) as medallas_como_antes;"
  echo "select not exists (select id, tiers from seasons except select id, tiers from t_tramos) as tramos_como_antes;"
  echo 'rollback;'
} | if [ "${1:-}" = docker ]; then
  MSYS_NO_PATHCONV=1 docker exec -i supabase_db_v34frag-api psql -U postgres -X -q -P pager=off
else
  psql "$1" -X -q -P pager=off
fi
