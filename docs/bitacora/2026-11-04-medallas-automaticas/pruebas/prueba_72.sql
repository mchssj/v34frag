-- Prueba del replanteo 72 con datos inventados. Corre todo en una transacción y la deshace: no deja nada.
-- Uso (base local): cat supabase/replanteo/72_medallas_automaticas.sql (sin el commit final) + este archivo | psql
-- Si 72 ya está aplicado, alcanza con este archivo.

begin;

-- Un jugador con 25 mixes terminados (21 ganados seguidos y 4 perdidos), todos en de_dust2.
insert into players (id, nick, steam_id) values ('00000000-0000-0000-0000-00000000f001', 'prueba72', 'STEAM_PRUEBA_72');
insert into player_elo (steam_id, elo, peak_elo, matches) values ('STEAM_PRUEBA_72', 1510, 1530, 25);

insert into matches (id, status, kind, map, winner_side, played_at)
select ('00000000-0000-0000-0000-0000000a' || lpad(g::text, 4, '0'))::uuid, 'finished', 'mix', 'de_dust2',
       case when g <= 21 then 1 else 2 end, now() - make_interval(days => 30 - g)
  from generate_series(1, 25) g;

insert into match_player_stats (match_id, steam_id, nick, team, player_id, kills, deaths, assists, headshots,
                                damage, rounds, first_kills, k4, k5, plants, defuses, rating)
select ('00000000-0000-0000-0000-0000000a' || lpad(g::text, 4, '0'))::uuid, 'STEAM_PRUEBA_72', 'prueba72', 1,
       '00000000-0000-0000-0000-00000000f001', 24, 10, 4, 12, 2200, 24, 3, 1, case when g = 1 then 1 else 0 end, 2, 1, 1.5
  from generate_series(1, 25) g;

-- Datos del reporter 2.7 en todos: 22 kills con AWP, 10 con AK y 10 con M4 por mix, 1 clutch por mix.
insert into match_player_extra (match_id, steam_id, rounds_survived, rounds_won_ct, rounds_won_t, pistol_won, eco_won,
                                bombs_exploded, clutch_1v1, clutch_1v2, clutch_1v3, clutch_1v4, clutch_1v5, clutch_tries,
                                weapon_kills, weapon_hs)
select ('00000000-0000-0000-0000-0000000a' || lpad(g::text, 4, '0'))::uuid, 'STEAM_PRUEBA_72', 8, 5, 5, 1, 0, 1,
       1, 0, 0, 0, 0, 2, '{"awp": 4, "ak47": 10, "m4a1": 10}'::jsonb, '{}'::jsonb
  from generate_series(1, 25) g;

-- 1) Primera corrida.
select medals_award(array['00000000-0000-0000-0000-00000000f001'::uuid]) as dadas;
select medal_key, title from player_medals where player_id = '00000000-0000-0000-0000-00000000f001' order by medal_key;

do $$
declare
  k text[] := array(select medal_key from player_medals where player_id = '00000000-0000-0000-0000-00000000f001');
  esperadas text[] := array['primer_mix', 'progresion_10_mixes', 'primera_victoria', 'victorias_10', 'racha_5', 'racha_10',
    'racha_15', 'dano_10k', 'dano_50k', 'hs_35', 'hs_45', 'kda_1_2', 'kda_1_5', 'kda_2_0', 'adr_70', 'adr_85',
    'entry_50', 'multikill_10', 'plantadas_25', 'desactivadas_10', 'mvp_mix_10', 'elo_1200', 'elo_1500',
    'clutch_10', 'awp_100', 'rifles_500', 'pistolas_25', 'explotadas_10', 'lado_ct_100', 'lado_t_100',
    'sobreviviente_100', 'mapa_dust2_10'];
  faltan text[] := array(select unnest(esperadas) except select unnest(k));
  sobran text[] := array(select unnest(k) intersect select unnest(array['hs_55', 'adr_100', 'kills_1000', 'elo_1800',
    'mapa_dust2_50', 'awp_500', 'victorias_50', 'progresion_50_mixes', 'eco_ganado_5', 'aces_5']));
begin
  if cardinality(faltan) > 0 then raise exception 'faltan medallas: %', faltan; end if;
  if cardinality(sobran) > 0 then raise exception 'medallas de más: %', sobran; end if;
  raise notice 'OK: % medallas, todas las esperadas', cardinality(k);
end $$;

-- 2) No se dan dos veces.
do $$ begin
  if medals_award(array['00000000-0000-0000-0000-00000000f001'::uuid]) <> 0 then raise exception 'se dieron dos veces'; end if;
  raise notice 'OK: la segunda corrida no da nada';
end $$;

-- 3) El mínimo de 20 mixes: con 19 mixes, sin HS, KDA ni ADR.
delete from player_medals where player_id = '00000000-0000-0000-0000-00000000f001';
delete from matches where id in (select ('00000000-0000-0000-0000-0000000a' || lpad(g::text, 4, '0'))::uuid
                                   from generate_series(20, 25) g);
select medals_award(array['00000000-0000-0000-0000-00000000f001'::uuid]);
do $$ begin
  if exists (select 1 from player_medals where player_id = '00000000-0000-0000-0000-00000000f001'
              and (medal_key like 'hs\_%' or medal_key like 'kda\_%' or medal_key like 'adr\_%')) then
    raise exception 'dio HS, KDA o ADR con menos de 20 mixes';
  end if;
  raise notice 'OK: con 19 mixes no hay HS, KDA ni ADR';
end $$;

-- 4) Cierre de temporada: una temporada con este jugador como único elegible.
insert into seasons (id, number, name, status, starts_at, ends_at, closed_at, top_n, min_matches, reset_pct, reset_floor, tiers)
values ('00000000-0000-0000-0000-00000000f0f0', 900, 'Prueba 72', 'closed', now() - interval '60 days', now(), now(), 20, 5, 0, 2001, (select tiers from season_config where id = 1));
insert into season_standings (season_id, player_id, rank, eligible, elo, peak_elo, matches, wins, losses, elo_after, tier, icon)
values ('00000000-0000-0000-0000-00000000f0f0', '00000000-0000-0000-0000-00000000f001', 1, true, 1510, 1530, 19, 19, 0, 1510, 'Campeón', '🏆');
-- La medalla por puesto que ya da season_close_run (sin clave): medals_award_season le pone podio_puesto_1.
insert into player_medals (player_id, title, icon, season_id, rank, tier, source)
values ('00000000-0000-0000-0000-00000000f001', 'Prueba 72 · #1', '🏆', '00000000-0000-0000-0000-00000000f0f0', 1, 'Campeón', 'temporada');
select medals_award_season('00000000-0000-0000-0000-00000000f0f0') as de_temporada;
select medal_key, title from player_medals where season_id = '00000000-0000-0000-0000-00000000f0f0' order by medal_key;
do $$ begin
  if (select count(*) from player_medals where season_id = '00000000-0000-0000-0000-00000000f0f0'
       and medal_key in ('podio_puesto_1', 'mvp_temporada', 'top_fragger_temporada', 'rey_hs_temporada',
                         'mejor_awp_temporada')) <> 5 then
    -- mas_mejorado necesita elo_delta > 0: estos datos no lo tienen
    raise exception 'medallas de temporada distintas de las esperadas';
  end if;
  if medals_award_season('00000000-0000-0000-0000-00000000f0f0') <> 0 then raise exception 'temporada dada dos veces'; end if;
  raise notice 'OK: podio con su clave, 4 medallas de temporada y no se repiten';
end $$;

-- 5) Los enganches están instalados.
do $$ begin
  if position('medals_award_match' in pg_get_functiondef('public.csstv_ingest(uuid, jsonb)'::regprocedure)) = 0 then
    raise exception 'csstv_ingest no llama a medals_award_match';
  end if;
  if position('medals_award_season' in pg_get_functiondef('public.season_close_run(uuid,uuid)'::regprocedure)) = 0 then
    raise exception 'season_close_run no llama a medals_award_season';
  end if;
  raise notice 'OK: csstv_ingest y season_close_run enganchados';
end $$;

rollback;
