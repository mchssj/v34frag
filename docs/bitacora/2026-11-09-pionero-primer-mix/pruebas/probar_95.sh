#!/usr/bin/env bash
# Prueba el replanteo 95 y su inversa dentro de UNA transacción que termina en rollback (no deja nada en la base).
# Uso: ./probar_95.sh docker          (Supabase local)
#      ./probar_95.sh vps             (por stdin a `docker exec -i supabase-db psql` en el VPS: ver la guía)
#      ./probar_95.sh "<conexión>"    (psql directo)
# Sin seasons 2 ni la definición pionero (la base local), las crea dentro de la transacción.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../../../.."
sin_tx() { grep -v -x -e 'begin;' -e 'commit;' "$1" | tr -d '\r'; }
fns="array['public.medal_metric_values(text,text,jsonb,uuid[])', 'public.medals_award(uuid[],uuid[])', 'public.medal_progress(uuid)']"
generar() {
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  echo "create temp table t_antes as select p, md5(pg_get_functiondef(p::regprocedure)) h from unnest($fns) p;"
  echo "create temp table t_avisos as select count(*) n from notifications;"
  sin_tx "$root/supabase/replanteo/95_pionero_primer_mix.sql"
  # Lo que falta en la base local: la definición y una temporada 2 (si no, el motor no da nada)
  echo "insert into medal_definitions (key, template, title, design, metric, aggregation, filters, target, status, activated_at)
        select 'pionero', 'pionero', 'Pionero: jugó el primer mix', '{\"metal\": \"oro\", \"label\": \"PIONERO\", \"band\": \"MIX #1\", \"accent\": \"pionero\"}',
               'first_match', 'once', '{}', 1, 'active', now()
         where not exists (select 1 from medal_definitions where key = 'pionero');"
  echo "insert into seasons (number, name, starts_at, ends_at, top_n, min_matches, reset_pct, reset_floor, tiers)
        select 2, 'Prueba 95', now(), now() + interval '30 days', 20, 10, 0, 1000, '[{\"from\": 1, \"name\": \"Top\", \"icon\": \"x\"}]'
         where medal_stats_since() is null;"
  # Base local: los mixes más viejos son de prueba y sin fichas. Si el primero no tiene jugadores con ficha, se lleva un
  # mix que sí los tenga un segundo antes del primero (solo dentro de esta transacción). En producción no hace nada.
  echo "update matches set played_at = (select min(coalesce(played_at, starts_at)) from matches where status = 'finished' and kind = 'mix') - interval '1 second'
         where id = (select m.id from matches m where m.status = 'finished' and m.kind = 'mix'
                        and exists (select 1 from match_player_stats s where s.match_id = m.id and s.player_id is not null)
                      order by coalesce(m.played_at, m.starts_at), m.id limit 1)
           and not exists (select 1 from match_player_stats s
                            where s.player_id is not null
                              and s.match_id = (select m.id from matches m where m.status = 'finished' and m.kind = 'mix'
                                                 order by coalesce(m.played_at, m.starts_at), m.id limit 1));"
  # El primer mix y sus jugadores con ficha
  echo "create temp table t_mix as select m.id from matches m where m.status = 'finished' and m.kind = 'mix'
          order by coalesce(m.played_at, m.starts_at), m.id limit 1;"
  echo "create temp table t_esperados as select distinct s.player_id from match_player_stats s
          where s.match_id = (select id from t_mix) and s.player_id is not null;"
  echo "create temp table t_def as select id from medal_definitions where key = 'pionero';"
  echo "create temp table t_excluido as select coalesce(
          (select player_id from t_esperados where player_id = '2e444310-8a50-4e45-8229-a42ef017f10b'),
          (select min(player_id::text)::uuid from t_esperados)) as player_id;"
  echo "create temp table t_previas as select pm.player_id from player_medals pm where pm.definition_id = (select id from t_def) and pm.source = 'auto';"
  echo "\\echo '--- Después de la 95'"
  echo "select (select m.kind from matches m where m.status = 'finished' order by coalesce(m.played_at, m.starts_at), m.id limit 1) as kind_del_mas_viejo,
               (select count(*) from t_esperados) as jugadores_del_primer_mix,
               (select count(*) from t_esperados) > 0
               and not exists (select player_id from medal_metric_values('first_match', 'once', '{}') except select player_id from t_esperados)
               and not exists (select player_id from t_esperados except select player_id from medal_metric_values('first_match', 'once', '{}'))
                 as first_match_es_el_primer_mix;"
  echo "insert into medal_exclusions (player_id, definition_id, reason) select (select player_id from t_excluido), (select id from t_def), 'Prueba 95';"
  echo "select medals_evaluate_all((select id from t_def)) as dadas;"
  echo "select (select count(*) from player_medals pm where pm.definition_id = (select id from t_def) and pm.source = 'auto'
                  and pm.player_id not in (select player_id from t_previas))
               = (select count(*) from t_esperados where player_id not in (select player_id from t_previas)) - 1 as todos_menos_uno,
               not exists (select 1 from player_medals pm where pm.definition_id = (select id from t_def)
                            and pm.player_id = (select player_id from t_excluido)) as excluido_sin_medalla,
               (select count(*) from notifications) - (select n from t_avisos) as avisos_nuevos;"
  echo "select medals_award(array[(select player_id from t_excluido)], array[(select id from t_def)]) = 0 as el_cron_tampoco_se_la_da,
               (select p.value from medal_progress((select player_id from t_excluido)) p where p.definition_id = (select id from t_def)) = 0 as progreso_excluido_0,
               (select p.value from medal_progress((select min(player_id::text)::uuid from t_esperados where player_id <> (select player_id from t_excluido))) p
                 where p.definition_id = (select id from t_def)) = 1 as progreso_otro_1;"
  echo "\\echo '--- Inversa'"
  echo "drop function if exists pg_temp.reemplazar(regprocedure, text[]);"
  sin_tx "$here/95_inversa.sql"
  echo "select bool_and(md5(pg_get_functiondef(p::regprocedure)) = h) as inversa_igual_a_antes from t_antes;"
  echo "select to_regclass('public.medal_exclusions') is null as sin_tabla;"
  echo 'rollback;'
}
case "${1:-}" in
  docker) generar | MSYS_NO_PATHCONV=1 docker exec -i supabase_db_v34frag-api psql -U postgres -X -q -P pager=off ;;
  vps)    generar ;;   # se manda por SSH: ver la guía
  *)      generar | psql "$1" -X -q -P pager=off ;;
esac
