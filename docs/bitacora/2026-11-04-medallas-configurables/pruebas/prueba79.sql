-- Pruebas del replanteo 79 (correr después de aplicarlo, en una base con partidas). Termina con un raise para deshacer
-- todo y devolver el resultado como mensaje. Cada línea dice "ok" o "MAL". Pruebas mínimas: sección 13 del plan.
do $$
declare
  v_admin uuid; v_user uuid; v_def uuid; v_def2 uuid; v_def3 uuid; v_p uuid; v_s uuid; v_match uuid; v_steam text;
  r text := ''; j jsonb; n integer; m integer; v_t timestamptz; v_n numeric;
begin
  select id into v_admin from profiles where role = 'admin' order by id limit 1;
  select id into v_user from profiles where role = 'user' order by id limit 1;

  -- 0. Temporada BETA (Daniel, 2026-11-06): sus stats no cuentan y, mientras dure, el motor no da ninguna medalla
  delete from seasons;
  insert into seasons(number, name, starts_at, ends_at, top_n, min_matches, reset_pct, reset_floor, tiers)
  select 1, 'BETA', '2000-01-01', '2099-01-01', top_n, 1, reset_pct, reset_floor, tiers from season_config;
  r := r || E'
0a durante la BETA no hay desde cuándo: ' || case when medal_stats_since() is null then 'ok' else 'MAL' end;
  r := r || E'
0b durante la BETA no se gana ninguna: ' || case when not exists (select 1 from medal_metric_values('kills', 'total', '{}'))
                                                                and not exists (select 1 from medal_metric_values('first_match', 'once', '{}'))
                                                                and not exists (select 1 from medal_metric_values('played_season', 'once', '{"season":1}'))
                                                                and medals_award(null) = 0 then 'ok' else 'MAL' end;
  -- Cierra la BETA y empieza la temporada 2 (por ahora antes de todas las partidas: todas cuentan; en la 17 se corre)
  delete from medal_queue;
  update seasons set status = 'closed', ends_at = '2000-01-02', closed_at = '2000-01-02' where number = 1;
  insert into seasons(number, name, starts_at, ends_at, top_n, min_matches, reset_pct, reset_floor, tiers)
  select 2, 'Temporada 2', '2000-01-02', '2099-01-01', top_n, 1, reset_pct, reset_floor, tiers from season_config;
  r := r || E'
0c al empezar la T2 todos a la cola: ' || case when (select count(*) from medal_queue)
                                                                  = (select count(distinct player_id) from match_player_stats where player_id is not null)
                                                             then 'ok' else 'MAL' end;
  delete from medal_queue;

  -- 1. Tramos con definición y medallas viejas convertidas
  r := r || E'\n1 tramos con definición: ' || case when (select count(*) from season_config c, jsonb_array_elements(c.tiers) t where t ? 'definition') = 5 then 'ok' else 'MAL' end;
  r := r || E'\n1b sin medallas sin definición: ' || case when not exists (select 1 from player_medals where definition_id is null) then 'ok' else 'MAL' end;

  -- 2. Un admin crea un borrador (victorias, objetivo 3)
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into medal_definitions(key, template, title, design, metric, aggregation, filters, target)
  values ('prueba_victorias_3', 'victorias', '3 victorias', '{"number":"3","label":"VICTORIAS","metal":"bronce","accent":"victorias"}',
          'mixes_won', 'total', '{}', 3)
  returning id into v_def;
  r := r || E'\n2 diseño con clave rara rechazado: ' || case when true then 'ok' else 'MAL' end;
  begin
    insert into medal_definitions(key, template, title, design, metric, aggregation, target) values ('x_mal', 'victorias', 'x', '{"color":"#fff"}', 'kills', 'total', 1);
    r := r || ' MAL';
  exception when others then null; end;

  -- 3. Calcular y activar con retro: da lo mismo que dice el cálculo (otorga al cruzar el objetivo)
  n := medal_preview('mixes_won', 'total', '{}', 3);
  j := medal_activate(v_def, true);
  r := r || E'\n3 retro = calcular (' || n || '): ' || case when (j->>'awarded')::int = n and n > 0 then 'ok' else 'MAL' end;
  execute 'reset role';

  -- 4. No duplica
  r := r || E'\n4 no duplica: ' || case when medals_award(null, array[v_def]) = 0 then 'ok' else 'MAL' end;

  -- 5. Aviso con el dibujo
  r := r || E'\n5 aviso con dibujo: ' || case when exists (select 1 from notifications where type = 'medal_granted' and data->'medal'->>'id' = v_def::text
                                                                                and data->'medal'->>'template' = 'victorias' and data->'medal'->>'number' = '3')
                                         then 'ok' else 'MAL' end;

  -- 6. La retroactiva coincide con la evaluación por mix: otra igual, sin retro, por la cola
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into medal_definitions(key, template, title, design, metric, aggregation, filters, target)
  values ('prueba_victorias_3b', 'victorias', '3 victorias (cola)', '{"metal":"bronce"}', 'mixes_won', 'total', '{}', 3) returning id into v_def2;
  j := medal_activate(v_def2, false);
  execute 'reset role';
  r := r || E'\n6a sin retro da 0: ' || case when (j->>'awarded')::int = 0 then 'ok' else 'MAL' end;
  delete from medal_queue;
  perform medal_enqueue(array(select distinct player_id from match_player_stats where player_id is not null));
  j := medals_evaluate_pending(100000);
  r := r || E'\n6b motor = retroactiva: ' || case when (select count(*) from player_medals where definition_id = v_def2)
                                                     = (select count(*) from player_medals where definition_id = v_def) then 'ok' else 'MAL' end;
  r := r || E'\n6c cola vacía: ' || case when not exists (select 1 from medal_queue) then 'ok' else 'MAL' end;

  -- 7. Al guardar las stats de un mix terminado, las medallas llegan en el acto y la cola queda vacía
  select match_id into v_match from match_player_stats s join matches mm on mm.id = s.match_id where mm.status = 'finished' and s.player_id is not null limit 1;
  insert into medal_definitions(key, template, title, metric, aggregation, filters, target, status, activated_at, retroactive)
  values ('prueba_kills_1', 'kills', '1 kill', 'kills', 'total', '{}', 1, 'active', now(), false) returning id into v_def3;
  update match_player_stats set kills = kills where match_id = v_match;
  r := r || E'
7 al guardar el mix: ' || case when (select count(*) from player_medals where definition_id = v_def3)
                                                     = (select count(*) from player_stats ps
                                                         where ps.kills >= 1 and ps.player_id in (select player_id from match_player_stats where match_id = v_match))
                                                and not exists (select 1 from medal_queue) then 'ok' else 'MAL' end;

  -- 7b. Si la evaluación falla, el mix se guarda igual y los jugadores quedan en la cola para el cron
  insert into medal_definitions(key, template, title, metric, aggregation, filters, target, status, activated_at, retroactive)
  values ('prueba_rota', 'hs_pct', 'rota', 'hs_pct', 'avg_min_matches', '{"min_matches":"x"}', 1, 'active', now(), false);
  update match_player_stats set kills = kills where match_id = v_match;
  r := r || E'
7b falla y queda en la cola: ' || case when (select count(*) from medal_queue) > 0 then 'ok' else 'MAL' end;
  delete from medal_definitions where key = 'prueba_rota';
  delete from medal_queue;

  -- 8. Un mix sin match_player_extra cuenta como sin dato (no suma kills con AWP)
  select s.player_id, s.steam_id, s.match_id into v_p, v_steam, v_match
    from match_player_stats s join match_player_extra e using (match_id, steam_id)
   where s.player_id is not null and jsonb_typeof(e.weapon_kills->'awp') = 'number' limit 1;
  n := (select value from medal_metric_values('weapon_kills', 'total', '{"weapons":["awp"]}', array[v_p]));
  delete from match_player_extra where match_id = v_match and steam_id = v_steam;
  m := coalesce((select value from medal_metric_values('weapon_kills', 'total', '{"weapons":["awp"]}', array[v_p])), 0);
  r := r || E'\n8 sin dato no suma (' || n || ' -> ' || m || '): ' || case when m < n then 'ok' else 'MAL' end;

  -- 9. Promedios con mínimo de mixes
  r := r || E'\n9 mínimo de mixes: ' || case when (select count(*) from medal_metric_values('hs_pct', 'avg_min_matches', '{"min_matches":1000}')) = 0
                                               and (select count(*) from medal_metric_values('hs_pct', 'avg_min_matches', '{"min_matches":1}')) > 0 then 'ok' else 'MAL' end;

  -- 10. Progreso
  select player_id into v_p from match_player_stats where player_id is not null limit 1;
  r := r || E'\n10 progreso: ' || case when (select value from medal_progress(v_p) where definition_id = v_def) = (select wins from player_stats where player_id = v_p)
                                  then 'ok' else 'MAL' end;

  -- 11. Un usuario no activa ni calcula ni ve borradores
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform medal_preview('kills', 'total', '{}', 1); r := r || E'\n11 usuario: MAL';
  exception when sqlstate '42501' then r := r || E'\n11 usuario 42501: ok'; end;
  execute 'reset role';

  -- 12. La condición de una activa no cambia; el dibujo sí
  begin update medal_definitions set target = 5 where id = v_def; r := r || E'\n12 objetivo de activa: MAL';
  exception when others then r := r || E'\n12 objetivo de activa: ok'; end;
  update medal_definitions set design = design || '{"metal":"oro"}' where id = v_def;

  -- 13. No se archiva una de un tramo; una de carrera sí y se conserva
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform medal_archive((select id from medal_definitions where key = 'season_podio_1')); r := r || E'\n13 archivar tramo: MAL';
  exception when others then r := r || E'\n13 archivar tramo: ok'; end;
  perform medal_archive(v_def);
  r := r || E'\n13b archivada conserva: ' || case when exists (select 1 from player_medals where definition_id = v_def) then 'ok' else 'MAL' end;
  execute 'reset role';

  -- 14. Un tramo con una definición que no es de temporada no se acepta
  begin update season_config set tiers = jsonb_set(tiers, '{0,definition}', '"prueba_victorias_3b"'); r := r || E'\n14 tramo con medalla de carrera: MAL';
  exception when others then r := r || E'\n14 tramo con medalla de carrera: ok'; end;

  -- 15. Una manual se puede dar dos veces (dos torneos)
  select id into v_def3 from medal_definitions where key = 'campeon_torneo';
  insert into player_medals(player_id, title, definition_id, source) values (v_p, 'Torneo A', v_def3, 'admin'), (v_p, 'Torneo B', v_def3, 'admin');
  r := r || E'\n15 manual repetida: ok';

  -- 17. La T2 empieza a mitad de las partidas de un jugador: lo de antes (la BETA) no cuenta, salvo Fundador y Pionero
  select s.player_id into v_p from match_player_stats s join matches mm on mm.id = s.match_id and mm.status = 'finished'
   where s.player_id is not null group by s.player_id order by count(*) desc limit 1;
  select at into v_t from (select coalesce(mm.played_at, mm.starts_at) as at from match_player_stats s
                             join matches mm on mm.id = s.match_id and mm.status = 'finished' where s.player_id = v_p order by 1) x
   offset (select count(*) / 2 from match_player_stats s join matches mm on mm.id = s.match_id and mm.status = 'finished' where s.player_id = v_p)
   limit 1;
  update seasons set ends_at = v_t, closed_at = v_t where number = 1;
  update seasons set starts_at = v_t where number = 2;
  v_n := (select sum(s.kills) from match_player_stats s join matches mm on mm.id = s.match_id and mm.status = 'finished'
           where s.player_id = v_p and coalesce(mm.played_at, mm.starts_at) >= v_t);
  r := r || E'
17a kills solo desde la T2 (' || v_n || ' de ' || (select kills from player_stats where player_id = v_p) || '): '
         || case when (select value from medal_metric_values('kills', 'total', '{}', array[v_p])) = v_n
                      and v_n < (select kills from player_stats where player_id = v_p) then 'ok' else 'MAL' end;
  r := r || E'
17b ELO máximo desde la T2: ' || case when (select value from medal_metric_values('elo_peak', 'max', '{}', array[v_p]))
                                                          is not distinct from (select max(s.elo_after)::numeric from match_player_stats s
                                                                                  join matches mm on mm.id = s.match_id and mm.status = 'finished'
                                                                                 where s.player_id = v_p and coalesce(mm.played_at, mm.starts_at) >= v_t)
                                                     then 'ok' else 'MAL' end;
  r := r || E'
17c MVP desde la T2: ' || case when coalesce((select value from medal_metric_values('mvp_mixes', 'total', '{}', array[v_p])), 0)
                                                     = (select count(*) from mix_list where status = 'finished' and mvp_player_id = v_p and at >= v_t)
                                              then 'ok' else 'MAL' end;
  r := r || E'
17d Fundador con la BETA: ' || case when (select value from medal_metric_values('played_season', 'once', '{"season":1}', array[v_p])) = 1
                                                   then 'ok' else 'MAL' end;
  r := r || E'
17e Pionero con el primer mix: ' || case when (select count(*) from medal_metric_values('first_match', 'once', '{}')) > 0 then 'ok' else 'MAL' end;
  r := r || E'
17f temporadas jugadas sin la BETA: ' || case when (select value from medal_metric_values('seasons_played', 'total', '{}', array[v_p])) = 1
                                                             then 'ok' else 'MAL' end;

  -- 16. El cierre de temporada otorga por definición, con aviso y dibujo
  select id into v_s from seasons where status = 'active';
  if v_s is null then
    insert into seasons(number, name, starts_at, ends_at, top_n, min_matches, reset_pct, reset_floor, tiers)
    select 1, 'Prueba', '2020-01-01', '2099-01-01', top_n, 1, reset_pct, reset_floor, tiers from season_config returning id into v_s;
  end if;
  update seasons set min_matches = 1 where id = v_s;
  j := season_close_run(v_s, null);
  select count(*), count(definition_id) into n, m from player_medals where season_id = v_s;
  r := r || E'\n16 cierre (' || n || ' medallas): ' || case when n > 0 and n = m then 'ok' else 'MAL' end;
  r := r || E'\n16b puesto 1 con podio 1: ' || case when (select d.key from player_medals pm join medal_definitions d on d.id = pm.definition_id
                                                          where pm.season_id = v_s and pm.rank = 1) = 'season_podio_1' then 'ok' else 'MAL' end;
  r := r || E'\n16c aviso con dibujo y sin emoji: ' || case when exists (select 1 from notifications where type = 'season_closed'
                                                                               and data->'medal'->'design'->>'template' = 'podio'
                                                                               and data->'medal'->'design'->>'label' like 'S%'
                                                                               and not (data->'medal' ? 'icon')) then 'ok' else 'MAL' end;

  raise exception 'RESULTADO: %', r;
end $$;
