-- Pruebas de la 110. Las corre probar_110.sh: replanteo, pruebas e inversa en una transacción que se deshace.
\set ON_ERROR_STOP 1
begin;
-- Si la base local ya tiene la 110, se borra dentro de esta transacción (se deshace al final).
drop function if exists public.widget_player(uuid, text, timestamptz);
\i :r110

create temp table ids (k text primary key, v uuid);
grant select on ids to anon;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  pa uuid; pb uuid; pc uuid; t uuid;
  sa text := (76561197960265728 + floor(random() * 1e9)::bigint)::text;
  sb text := (76561197960265728 + floor(random() * 1e9)::bigint)::text;
  sc text := (76561197960265728 + floor(random() * 1e9)::bigint)::text;
  m1 uuid; m2 uuid; m3 uuid; m4 uuid; m5 uuid;
  w jsonb; v_start int := (select start_elo from elo_config limit 1);
  v_season boolean := not exists (select 1 from seasons where status = 'active');
begin
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    values (ua, ua || '@prueba110.local', now(), now(), 'authenticated', 'authenticated'),
           (ub, ub || '@prueba110.local', now(), now(), 'authenticated', 'authenticated');
  insert into players (nick, user_id, steam_id, privacy) values ('w110_a', ua, sa, 'public') returning id into pa;
  insert into players (nick, user_id, steam_id, privacy) values ('w110_b', ub, sb, 'private') returning id into pb;
  insert into players (nick, steam_id) values ('w110_c', sc) returning id into pc;
  insert into profile_details (user_id, country) values (ua, 'ZZ110'), (ub, 'ZZ110')
    on conflict (user_id) do update set country = excluded.country;
  insert into ids values ('a', pa), ('b', pb), ('c', pc);
  insert into player_elo (steam_id, elo, peak_elo, matches) values (sa, 99999, 99999, 3), (sb, 99998, 99998, 1);
  insert into teams (name, tag, kind) values ('Widget 110', 'W110', 'official') returning id into t;
  insert into team_members (team_id, player_id, role) values (t, pa, 'player');

  -- m1: hace 1 h, gana (+20, con stats del reporter 2.7.0). m2: hace 3 h, pierde (-15, sin extra).
  -- m3: hace 30 h, empate sin ELO. m4: cancelado. m5: oficial. Ninguno de los dos últimos cuenta.
  insert into matches (kind, status, best_of, side1_name, side2_name, map, played_at, score1, score2, winner_side)
    values ('mix', 'finished', 1, 'a', 'b', 'de_dust2', now() - interval '1 hour', 13, 5, 1) returning id into m1;
  insert into matches (kind, status, best_of, side1_name, side2_name, map, played_at, score1, score2, winner_side)
    values ('mix', 'finished', 1, 'a', 'b', 'de_inferno', now() - interval '3 hours', 13, 10, 2) returning id into m2;
  insert into matches (kind, status, best_of, side1_name, side2_name, map, played_at, score1, score2, winner_side)
    values ('mix', 'finished', 1, 'a', 'b', 'de_nuke', now() - interval '30 hours', 15, 15, null) returning id into m3;
  insert into matches (kind, status, best_of, side1_name, side2_name, map, played_at)
    values ('mix', 'cancelled', 1, 'a', 'b', 'de_nuke', now() - interval '2 hours') returning id into m4;
  insert into matches (kind, status, best_of, map, played_at, score1, score2)
    values ('official', 'finished', 1, 'de_nuke', now() - interval '2 hours', 13, 0) returning id into m5;
  update matches set winner_side = null where id = m3;

  insert into match_player_stats (match_id, steam_id, player_id, nick, team, kills, deaths, assists, headshots, damage, rounds,
                                  k1, k2, k3, k4, k5, first_kills, elo_before, elo_after, elo_delta)
    values (m1, sa, pa, 'w110_a', 1, 25, 10, 3, 12, 2600, 18, 10, 3, 1, 1, 0, 4, 1000, 1020, 20),
           (m2, sa, pa, 'w110_a', 1, 15, 18, 2, 5, 1900, 23, 8, 2, 1, 0, 0, 2, 1020, 1005, -15),
           (m3, sa, pa, 'w110_a', 2, 20, 20, 5, 8, 2500, 30, 10, 2, 2, 0, 0, 3, null, null, null),
           (m4, sa, pa, 'w110_a', 1, 9, 9, 0, 1, 900, 10, 9, 0, 0, 0, 0, 0, null, null, null),
           (m5, sa, pa, 'w110_a', 1, 30, 0, 0, 10, 3000, 13, 0, 0, 0, 0, 1, 5, null, null, null);
  insert into match_player_extra (match_id, steam_id, pistol_won, clutch_1v1, clutch_1v2, weapon_kills)
    values (m1, sa, 2, 1, 1, '{"awp": 3, "scout": 1, "knife": 1, "ak47": 20}');

  -- 1. Ficha inexistente.
  if public.widget_player(gen_random_uuid(), 'all', null) is not null then raise exception 'FALLA 1: inexistente no es null'; end if;
  raise notice 'ok 1: ficha inexistente = null';

  -- 2. Período inválido.
  begin
    perform public.widget_player(pa, 'semana', null);
    raise exception 'FALLA 2: aceptó un período inválido';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'ok 2: período inválido rechazado';

  -- 3. Hoy desde hace 2 h: solo m1.
  w := public.widget_player(pa, 'today', now() - interval '2 hours');
  if w->'period' @> '{"v":1,"d":0,"e":0,"elo":20,"kills":25,"sniper":4,"knife":1,"clutches":2,"pistols":2,"entries":4}' is not true
    then raise exception 'FALLA 3: %', w->'period'; end if;
  raise notice 'ok 3: hoy = solo el mix de hace 1 h, con las stats de match_player_extra';

  -- 4. 24 h: m1 y m2. Un mix sin match_player_extra suma 0 en esas stats.
  w := public.widget_player(pa, '24h', null);
  if w->'period' @> '{"v":1,"d":1,"e":0,"elo":5,"kills":40,"deaths":28,"rounds":41,"sniper":4,"pistols":2}' is not true
    then raise exception 'FALLA 4: %', w->'period'; end if;
  if (w->'period'->>'rating') is null then raise exception 'FALLA 4: sin rating'; end if;
  raise notice 'ok 4: 24 h = dos mixes, ELO +5, rating %', w->'period'->>'rating';

  -- 5. Histórico: el empate sin ELO cuenta como E y suma 0. Ni el cancelado ni el oficial cuentan.
  w := public.widget_player(pa, 'all', null);
  if w->'period' @> '{"v":1,"d":1,"e":1,"elo":5,"kills":60}' is not true then raise exception 'FALLA 5: %', w->'period'; end if;
  raise notice 'ok 5: histórico = V-D-E 1-1-1';

  -- 6. Últimos resultados, del más nuevo al más viejo.
  if w->'ultimos' <> '[{"r":"V","elo":20},{"r":"D","elo":-15},{"r":"E","elo":null}]'::jsonb
    then raise exception 'FALLA 6: %', w->'ultimos'; end if;
  raise notice 'ok 6: últimos = V, D, E';

  -- 7. ELO, puesto, país y equipo.
  if w @> jsonb_build_object('nick', (select nick from players where id = pa), 'team_tag', 'W110', 'country', 'ZZ110', 'elo', 99999, 'peak_elo', 99999,
                             'rank', 1, 'country_rank', 1) is not true then raise exception 'FALLA 7: %', w - 'period' - 'ultimos'; end if;
  w := public.widget_player(pb, 'all', null);
  if w @> '{"rank":2,"country_rank":2}' is not true then raise exception 'FALLA 7b: %', w - 'period' - 'ultimos'; end if;
  raise notice 'ok 7: ELO, puesto 1, primero de su país y tag del equipo';

  -- 8. Ficha sin ELO ni mixes: ELO inicial, sin puesto y todo en 0.
  w := public.widget_player(pc, 'today', null);
  if w @> jsonb_build_object('elo', v_start, 'rank', null, 'country_rank', null, 'team_tag', null, 'ultimos', '[]'::jsonb) is not true
     or w->'period' @> '{"v":0,"d":0,"e":0,"elo":0,"kills":0}' is not true or w->'period'->'rating' <> 'null'
    then raise exception 'FALLA 8: %', w; end if;
  raise notice 'ok 8: ficha sin ELO ni mixes';

  -- 9. Temporada: desde el comienzo de la activa.
  if v_season then
    insert into seasons (number, name, status, starts_at, ends_at, top_n, min_matches, reset_pct, reset_floor, tiers)
      select 9110, 'Prueba 110', 'active', now() - interval '2 hours', now() + interval '28 days', c.top_n, c.min_matches, c.reset_pct, c.reset_floor, c.tiers from season_config c limit 1;
    w := public.widget_player(pa, 'season', null);
    if w->'period' @> '{"v":1,"d":0,"e":0}' is not true then raise exception 'FALLA 9: %', w->'period'; end if;
    raise notice 'ok 9: temporada = desde su comienzo';
  else
    raise notice 'salteada 9: ya hay una temporada activa en la base local';
  end if;
end $$;

-- 10. Como anónimo (la API pública): anda, y el país de un perfil privado no se ve.
set local role anon;
do $$
declare w jsonb;
begin
  w := public.widget_player((select v from ids where k = 'a'), 'all', null);
  if w->>'country' is distinct from 'ZZ110' then raise exception 'FALLA 10: país del público = %', w->>'country'; end if;
  w := public.widget_player((select v from ids where k = 'b'), 'all', null);
  if w is null or w->>'country' is not null then raise exception 'FALLA 10b: %', w - 'period' - 'ultimos'; end if;
  raise notice 'ok 10: anónimo ve el país del perfil público y no el del privado';
end $$;
reset role;

-- 11. Inversa.
\i :rev110
do $$ begin
  if to_regprocedure('public.widget_player(uuid,text,timestamptz)') is not null then raise exception 'FALLA 11: la inversa no la borró'; end if;
  raise notice 'ok 11: inversa';
end $$;

rollback;
