-- Pruebas de supabase/replanteo/26_clips.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.s(n int) returns text language sql immutable as $$ select '7656119826' || lpad(n::text, 7, '0') $$;
create function pg_temp.ficha(p_steam text) returns uuid language sql as $$
  select player_id from public.match_clip_list where match_id = 'cccccccc-2600-4000-8000-000000000001' and player_steamid = p_steam $$;

-- Una ficha con su SteamID principal (1) y uno adicional (2); el 3 sin ficha y el 4 con otra ficha.
insert into public.players(id, nick, steam_id) values
  ('dddddddd-2600-4000-8000-000000000001', 'Ficha26', pg_temp.s(1)),
  ('dddddddd-2600-4000-8000-000000000002', 'Otra26', pg_temp.s(4));
insert into public.player_extra_steam_ids(steam_id, player_id) values (pg_temp.s(2), 'dddddddd-2600-4000-8000-000000000001');
insert into public.matches(id, kind, status, map, score1, score2, winner_side, played_at) values
  ('cccccccc-2600-4000-8000-000000000001', 'mix', 'finished', 'de_dust2', 13, 7, 1, now());
insert into public.match_clips(match_id, round, player_steamid, player_name, round_won, kill_ticks) values
  ('cccccccc-2600-4000-8000-000000000001', 1, pg_temp.s(1), 'conPrincipal', true, '{1,2,3}'),
  ('cccccccc-2600-4000-8000-000000000001', 2, pg_temp.s(2), 'conAdicional', true, '{4,5,6,7}'),
  ('cccccccc-2600-4000-8000-000000000001', 3, pg_temp.s(3), 'suelto', true, '{8,9,10}'),
  ('cccccccc-2600-4000-8000-000000000001', 4, pg_temp.s(4), '', true, '{11,12,13}');

do $$
begin
  perform pg_temp.ok(pg_temp.ficha(pg_temp.s(1)) = 'dddddddd-2600-4000-8000-000000000001', 'SteamID principal: su ficha');
  perform pg_temp.ok(pg_temp.ficha(pg_temp.s(2)) = 'dddddddd-2600-4000-8000-000000000001', 'SteamID adicional: la misma ficha');
  perform pg_temp.ok(pg_temp.ficha(pg_temp.s(3)) is null, 'SteamID sin ficha: sin ficha');
  perform pg_temp.ok((select player_name from public.match_clip_list where player_steamid = pg_temp.s(4)) = 'Otra26',
                     'sin nick en el clip: el de la ficha');
  perform pg_temp.ok((select player_name from public.match_clip_list where player_steamid = pg_temp.s(2)) = 'conAdicional',
                     'con nick en el clip: el del clip');

  -- El SteamID 3 se suma como adicional después de jugar: su clip viejo pasa a la ficha sin tocar los datos.
  insert into public.player_extra_steam_ids(steam_id, player_id) values (pg_temp.s(3), 'dddddddd-2600-4000-8000-000000000001');
  perform pg_temp.ok(pg_temp.ficha(pg_temp.s(3)) = 'dddddddd-2600-4000-8000-000000000001', 'adicional sumado después: el clip viejo pasa a la ficha');

  -- La ficha quedó con tres clips (SteamID 1, 2 y 3) y se muestran 2; más el de la otra ficha.
  perform pg_temp.ok((select count(*) from public.match_clip_list where match_id = 'cccccccc-2600-4000-8000-000000000001') = 3,
                     'adicional sumado después: el tope por ficha lo incluye');
end $$;

-- Tope por ficha: en otra partida, la ficha tiene tres 3k con dos SteamID distintos; se muestran 2 (los más tardíos).
insert into public.matches(id, kind, status, map, score1, score2, winner_side, played_at) values
  ('cccccccc-2600-4000-8000-000000000002', 'mix', 'finished', 'de_dust2', 13, 7, 1, now());
insert into public.match_clips(match_id, round, player_steamid, player_name, round_won, kill_ticks) values
  ('cccccccc-2600-4000-8000-000000000002', 1, pg_temp.s(1), 'a', true, '{1,2,3}'),
  ('cccccccc-2600-4000-8000-000000000002', 2, pg_temp.s(2), 'b', true, '{4,5,6}'),
  ('cccccccc-2600-4000-8000-000000000002', 3, pg_temp.s(2), 'c', true, '{7,8,9}'),
  ('cccccccc-2600-4000-8000-000000000002', 4, pg_temp.s(4), 'd', true, '{10,11,12}');

do $$
begin
  perform pg_temp.ok((select array_agg(round order by round) from public.match_clip_list
                       where match_id = 'cccccccc-2600-4000-8000-000000000002' and player_id = 'dddddddd-2600-4000-8000-000000000001')
                     = array[2, 3], 'tope por ficha: 2 entre sus dos SteamID, los más tardíos');
  perform pg_temp.ok((select count(*) from public.match_clip_list where match_id = 'cccccccc-2600-4000-8000-000000000002') = 3,
                     'tope por ficha: la otra ficha no se ve afectada');
end $$;

rollback;
