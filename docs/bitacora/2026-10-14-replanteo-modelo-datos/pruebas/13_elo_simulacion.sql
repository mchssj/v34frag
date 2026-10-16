-- Pruebas de supabase/replanteo/13_elo_simulacion.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '{"role":"anon"}'
         else format('{"sub":"%s","role":"authenticated"}', u) end, true) $$;
grant execute on function pg_temp.como(text) to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-1300-4000-8000-0000000000ad', 'admin13@test.local', '{"tag":"Admin13"}'),
  ('aaaaaaaa-1300-4000-8000-000000000001', 'u13@test.local', '{"tag":"Usuario13"}');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-1300-4000-8000-0000000000ad';
-- La base local puede no tener la fila (el motor usa entonces los valores por defecto).
insert into public.elo_config(id) values (1) on conflict (id) do nothing;

-- Un mix 16-10 con 10 SteamID (todos juegan las 26 rondas); el primero tiene ficha.
insert into public.matches(id, kind, status, map, score1, score2, winner_side, played_at)
values ('cccccccc-1300-4000-8000-000000000001', 'mix', 'finished', 'de_dust2', 16, 10, 1, now() + interval '1 day');
insert into public.match_player_stats(match_id, steam_id, team, nick, rounds, rating)
  select 'cccccccc-1300-4000-8000-000000000001', '7656119813' || lpad(i::text, 7, '0'), case when i <= 5 then 1 else 2 end, 'S13n' || i, 26, 1
    from generate_series(1, 10) i;
insert into public.players(id, nick, steam_id) values ('dddddddd-1300-4000-8000-000000000001', 'Ficha13', '76561198130000001');

set local role authenticated;
select pg_temp.como('aaaaaaaa-1300-4000-8000-0000000000ad');
select public.elo_recompute_all();

do $$
declare
  cfg  record;
  e1   int;
  r    record;
begin
  select * into cfg from public.elo_config where id = 1;
  select elo into e1 from public.player_elo where steam_id = '76561198130000001';

  -- Con el doble de base, los del mix sembrado ganan o pierden el doble (equipos nuevos y parejos: ±base).
  select * into r from public.elo_simulate(cfg.base * 2, cfg.bonus_max, cfg.bonus_factor, cfg.elo_floor, cfg.start_elo, cfg.min_pct, cfg.full_pct)
   where steam_id = '76561198130000001';
  assert r.player_id = 'dddddddd-1300-4000-8000-000000000001' and r.name = 'Ficha13', 'ficha del jugador';
  assert r.elo_before = e1 and r.elo_after - r.elo_before = cfg.base and r.changed and r.abs_delta = cfg.base, format('ganador: %s', row_to_json(r));
  assert r.matches_before = r.matches_after, 'partidas';
  select * into r from public.elo_simulate(cfg.base * 2, cfg.bonus_max, cfg.bonus_factor, cfg.elo_floor, cfg.start_elo, cfg.min_pct, cfg.full_pct)
   where steam_id = '76561198130000006';
  assert r.player_id is null and r.name = 'S13n6' and r.delta = -cfg.base and r.search like '%s13n6%', format('perdedor sin ficha: %s', row_to_json(r));

  -- Con los mismos valores no cambia nadie.
  assert not exists (select 1 from public.elo_simulate(cfg.base, cfg.bonus_max, cfg.bonus_factor, cfg.elo_floor, cfg.start_elo, cfg.min_pct, cfg.full_pct) s where s.changed),
         'con los mismos valores cambió alguien';

  -- Con un mínimo de participación del 100 %, los que jugaron menos rondas quedan sin ELO.
  update public.match_player_stats set rounds = 20 where match_id = 'cccccccc-1300-4000-8000-000000000001' and steam_id = '76561198130000002';
  select * into r from public.elo_simulate(cfg.base, cfg.bonus_max, cfg.bonus_factor, cfg.elo_floor, cfg.start_elo, 100, 100)
   where steam_id = '76561198130000002';
  assert r.elo_after is null and r.matches_after = 0 and r.changed, format('sin participación: %s', row_to_json(r));

  -- Nada quedó guardado.
  assert (select elo from public.player_elo where steam_id = '76561198130000001') = e1, 'la simulación cambió el ELO';
  assert (select (base, min_pct, updated_at) = (cfg.base, cfg.min_pct, cfg.updated_at) from public.elo_config where id = 1), 'la simulación cambió la configuración';

  -- Valores inválidos: el mensaje de elo_set_config.
  begin
    perform public.elo_simulate(1, cfg.bonus_max, cfg.bonus_factor, cfg.elo_floor, cfg.start_elo, cfg.min_pct, cfg.full_pct);
    raise exception 'aceptó una base de 1';
  exception when invalid_parameter_value then
    assert sqlerrm = 'La base tiene que estar entre 5 y 100', sqlerrm;
  end;
end $$;

-- Un usuario común no puede simular.
select pg_temp.como('aaaaaaaa-1300-4000-8000-000000000001');
do $$
begin
  perform public.elo_simulate(30, 5, 10, 100, 1000, 35, 90);
  raise exception 'un usuario común simuló';
exception when insufficient_privilege then
  null;
end $$;
reset role;

-- Un anónimo no tiene permiso de ejecutarla.
set local role anon;
do $$
begin
  perform public.elo_simulate(30, 5, 10, 100, 1000, 35, 90);
  raise exception 'un anónimo simuló';
exception when insufficient_privilege then
  raise notice '13: simulación del recálculo del ELO OK';
end $$;
reset role;

rollback;
