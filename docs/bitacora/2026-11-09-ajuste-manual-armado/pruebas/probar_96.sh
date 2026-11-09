#!/usr/bin/env bash
# Prueba el replanteo 96 y su inversa dentro de UNA transacción que termina en rollback (no deja nada en la base).
# Uso: ./probar_96.sh docker          (Supabase local)
#      ./probar_96.sh vps             (imprime el SQL: se manda por stdin a `docker exec -i supabase-db psql` en el VPS)
#      ./probar_96.sh "<conexión>"    (psql directo)
# Necesita un servidor con mm_enabled y sin sala activa (lo elige solo) y fichas sin cuenta con rating reciente.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../../../.."
sin_tx() { grep -v -x -e 'begin;' -e 'commit;' "$1" | tr -d '\r'; }
generar() {
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  echo "create temp table t_antes as select p, md5(pg_get_functiondef(p::regprocedure)) h
          from unnest(array['public.mm_balance_elos(uuid[],integer[])', 'public.mm_tick()']) p;"
  # 10 fichas sin cuenta con rating reciente, y otra (fuera de esas 10) que hoy llega al tope del rating (+200)
  echo "create temp table t_fichas as
          select p.id player_id, mm_player_elo(p.id) elo, row_number() over (order by p.id) n
            from players p join player_recent_rating(array(select id from players), (select balance_rating_days from mm_config)) r on r.player_id = p.id
           where p.user_id is null order by p.id limit 10;"
  echo "update mm_config set balance_rating = true;"
  echo "create temp table t_tope as
          select p.id player_id from players p
           where p.id not in (select player_id from t_fichas)
             and p.id in (select player_id from player_recent_rating(array(select id from players), (select balance_rating_days from mm_config)) where rating > 1.4)
             and mm_balance_elos(array[p.id], array[1000]) = array[1000 + (select balance_rating_cap from mm_config)]
           limit 1;"
  echo "update mm_config set balance_rating_cap = 200 where balance_rating_cap <> 200;"
  echo "create temp table t_antes_elos as
          select 'encendido' modo, mm_balance_elos(array(select player_id from t_fichas order by n), array(select elo from t_fichas order by n)) v;"
  echo "update mm_config set balance_rating = false;"
  echo "insert into t_antes_elos select 'apagado', mm_balance_elos(array(select player_id from t_fichas order by n), array(select elo from t_fichas order by n));"
  echo "update mm_config set balance_rating = true;"
  echo "select count(*) = 10 as hay_10_fichas, (select count(*) from t_tope) = 1 as hay_ficha_con_tope from t_fichas;"
  echo "select id as server from game_servers where mm_enabled and not exists (select 1 from mm_lobbies l where l.server_id = game_servers.id and l.status not in ('finished', 'cancelled')) limit 1 \gset"
  echo "\echo '--- Replanteo 96'"
  sin_tx "$root/supabase/replanteo/96_mm_ajuste_manual_armado.sql"
  sin_tx "$here/prueba_96.sql"
  echo "\echo '--- Inversa'"
  echo "drop function if exists pg_temp.reemplazar(regprocedure, text[]);"
  sin_tx "$here/96_inversa.sql"
  echo "select bool_and(md5(pg_get_functiondef(p::regprocedure)) = h) as inversa_igual_a_antes, string_agg(p, ', ') filter (where md5(pg_get_functiondef(p::regprocedure)) <> h) as distintas from t_antes;"
  echo "select to_regclass('public.mm_balance_overrides') is null and to_regclass('public.mm_balance_override_log') is null
               and to_regprocedure('public.mm_balance_override_set(uuid,integer,text,text,integer)') is null as sin_tablas_ni_funciones;"
  echo 'rollback;'
}
case "${1:-}" in
  docker) generar | MSYS_NO_PATHCONV=1 docker exec -i supabase_db_v34frag-api psql -U postgres -X -q -P pager=off ;;
  vps)    generar ;;
  *)      generar | psql "$1" -X -q -P pager=off ;;
esac
