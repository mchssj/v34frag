-- Pruebas de supabase/replanteo/25_ajustes_elo_admin.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', u), true) $$;
create function pg_temp.s(n int) returns text language sql immutable as $$ select '7656119825' || lpad(n::text, 7, '0') $$;
create function pg_temp.error(q text) returns text language plpgsql as $$
begin
  execute q;
  return null;
exception when others then return sqlerrm;
end $$;
create function pg_temp.elo(n int) returns integer language sql as $$ select elo from public.player_elo where steam_id = pg_temp.s(n) $$;
create function pg_temp.f(n int) returns uuid language sql immutable as $$ select ('dddddddd-2500-4000-8000-00000000000' || n)::uuid $$;
grant execute on function pg_temp.ok(boolean, text), pg_temp.como(text), pg_temp.s(int), pg_temp.error(text), pg_temp.elo(int), pg_temp.f(int)
  to authenticated, anon;

-- Sin mixes, ELO, ajustes ni temporadas de la base local (vuelven con el rollback).
delete from public.match_player_stats;
delete from public.match_crashes;
delete from public.matches where kind = 'mix';
delete from public.elo_adjustments;
delete from public.player_elo;
delete from public.player_medals where season_id is not null;
delete from public.seasons;
insert into public.elo_config(id) values (1) on conflict (id) do nothing;
update public.elo_config set start_elo = 1000, elo_floor = 100 where id = 1;

-- Admin, un usuario y cuatro fichas: la 1 con un SteamID adicional (el 5); la 4 sin SteamID.
insert into auth.users (id, email, raw_user_meta_data, encrypted_password) values
  ('aaaaaaaa-2500-4000-8000-0000000000ad', 'admin25@test.local', '{"tag":"Admin25"}', 'x'),
  ('aaaaaaaa-2500-4000-8000-000000000001', 'u1-25@test.local', '{"tag":"Uno25"}', 'x');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-2500-4000-8000-0000000000ad';
insert into public.players(id, nick, steam_id) values
  (pg_temp.f(1), 'Alfa25', pg_temp.s(1)), (pg_temp.f(2), 'Beta25', pg_temp.s(2)), (pg_temp.f(3), 'Gama25', pg_temp.s(3)),
  (pg_temp.f(4), 'Delta25', null);
insert into public.player_extra_steam_ids(steam_id, player_id) values (pg_temp.s(5), pg_temp.f(1));

-- ---------- permisos ----------
set local role authenticated;
select pg_temp.como('aaaaaaaa-2500-4000-8000-000000000001');
select pg_temp.ok(pg_temp.error(format('select * from public.elo_adjust_players(array[%L]::uuid[], 20, null, %L)', pg_temp.f(1), 'x')) like 'Solo un admin%',
  'un usuario común no ajusta');
select pg_temp.como('aaaaaaaa-2500-4000-8000-0000000000ad');
select pg_temp.ok(pg_temp.error('select public.elo_recompute_all()') like 'permission denied%', 'ni un admin recalcula desde la web');
select pg_temp.ok(pg_temp.error('select * from public.elo_simulate(30, 5, 10, 100, 1000, 35, 90)') like 'permission denied%', 'ni simula');
select pg_temp.ok(pg_temp.error('select public.elo_set_config(30, 5, 10, 100, 1000, true, 35, 90)') = 'Recalcular el ELO ya no está disponible desde la web',
  'guardar la configuración con recalcular falla');
select pg_temp.ok(pg_temp.error('select public.elo_set_config(30, 5, 10, 100, 1000, false, 35, 90)') is null, 'guardarla sin recalcular sí');

-- ---------- validaciones ----------
select pg_temp.ok(pg_temp.error(format('select * from public.elo_adjust_players(array[%L]::uuid[], 20, 1500, %L)', pg_temp.f(1), 'x')) like 'Elegí sumar o restar%',
  'sumar y fijar a la vez no');
select pg_temp.ok(pg_temp.error(format('select * from public.elo_adjust_players(array[%L]::uuid[], null, null, %L)', pg_temp.f(1), 'x')) like 'Elegí sumar o restar%',
  'ni ninguno de los dos');
select pg_temp.ok(pg_temp.error(format('select * from public.elo_adjust_players(array[%L]::uuid[], 0, null, %L)', pg_temp.f(1), 'x')) like 'El ajuste tiene que estar%',
  'sumar 0 no');
select pg_temp.ok(pg_temp.error(format('select * from public.elo_adjust_players(array[%L]::uuid[], 501, null, %L)', pg_temp.f(1), 'x')) like 'El ajuste tiene que estar%',
  'más de 500 no');
select pg_temp.ok(pg_temp.error(format('select * from public.elo_adjust_players(array[%L]::uuid[], 20, null, %L)', pg_temp.f(1), ' ')) like 'El motivo es obligatorio%',
  'motivo obligatorio');
select pg_temp.ok(pg_temp.error(format('select * from public.elo_adjust_players(array[%L, %L]::uuid[], 20, null, %L)', pg_temp.f(1), pg_temp.f(1), 'x')) like 'Elegí de 1 a 10%',
  'sin repetir');
select pg_temp.ok(pg_temp.error(format('select * from public.elo_adjust_players(array(select gen_random_uuid() from generate_series(1, 11)), 20, null, %L)', 'x')) like 'Elegí de 1 a 10%',
  'hasta 10 jugadores');
select pg_temp.ok(pg_temp.error(format('select * from public.elo_adjust_players(array[%L]::uuid[], 20, null, %L)', pg_temp.f(4), 'x')) like 'Algún jugador no existe o no tiene SteamID%',
  'una ficha sin SteamID no se ajusta');

-- ---------- sumar ----------
create temp table r1 as select * from public.elo_adjust_players(array[pg_temp.f(1), pg_temp.f(2)], 20, null, ' mix caído ');
reset role;
select pg_temp.ok((select count(*) = 2 and bool_and(elo_before = 1000 and elo_after = 1020 and adjustment_id is not null) from r1),
  'sumar 20 a dos fichas sin ELO: 1000 → 1020');
select pg_temp.ok(pg_temp.elo(1) = 1020 and pg_temp.elo(2) = 1020 and pg_temp.elo(5) is null, 'el ELO queda en el SteamID principal');
select pg_temp.ok((select reason = 'mix caído' and delta = 20 and set_elo is null and created_by = 'aaaaaaaa-2500-4000-8000-0000000000ad'
                     from public.elo_adjustments where steam_id = pg_temp.s(1)), 'el ajuste guarda el motivo, el cambio y quién');

-- ---------- fijar ----------
set local role authenticated;
select pg_temp.como('aaaaaaaa-2500-4000-8000-0000000000ad');
create temp table r2 as select * from public.elo_adjust_players(array[pg_temp.f(1), pg_temp.f(2)], null, 1020, 'nada que cambiar');
reset role;
select pg_temp.ok((select bool_and(adjustment_id is null and elo_before = 1020 and elo_after = 1020) from r2),
  'fijar en el ELO que ya tienen no crea ajustes');
set local role authenticated;
select pg_temp.como('aaaaaaaa-2500-4000-8000-0000000000ad');
create temp table r3 as select * from public.elo_adjust_players(array[pg_temp.f(1)], null, 1500, 'corrección');
create temp table r4 as select * from public.elo_adjust_players(array[pg_temp.f(3)], null, 50, 'debajo del piso');
create temp table r5 as select * from public.elo_adjust_players(array[pg_temp.f(3)], -30, null, 'resta');
reset role;
select pg_temp.ok((select elo_before = 1020 and elo_after = 1500 from r3) and pg_temp.elo(1) = 1500, 'fijar en 1500');
select pg_temp.ok((select set_elo = 1500 and delta = 480 from public.elo_adjustments where id = (select adjustment_id from r3)),
  'el "fijar" guarda el valor y el cambio de ese momento');
select pg_temp.ok((select elo_after = 100 from r4), 'fijar respeta el piso');
select pg_temp.ok((select elo_before = 100 and elo_after = 100 from r5) and pg_temp.elo(3) = 100, 'restar respeta el piso');

-- ---------- el recálculo tiene en cuenta los ajustes ----------
-- Un mix de ayer que Alfa (con su adicional) le ganó a Beta: el recálculo lo aplica y después los ajustes de hoy.
insert into public.matches(id, kind, status, map, score1, score2, winner_side, played_at)
values ('eeeeeeee-2500-4000-8000-000000000001', 'mix', 'finished', 'de_dust2', 16, 10, 1, now() - interval '1 day');
insert into public.match_player_stats(match_id, steam_id, team, nick, rounds, rating) values
  ('eeeeeeee-2500-4000-8000-000000000001', pg_temp.s(5), 1, 'a', 26, 1),
  ('eeeeeeee-2500-4000-8000-000000000001', pg_temp.s(2), 2, 'b', 26, 1);
select public.elo_recompute_all();
select pg_temp.ok(pg_temp.elo(1) = 1500, 'el recálculo vuelve a fijar el "fijar" (no suma el cambio de ese momento)');
select pg_temp.ok(pg_temp.elo(2) = 990, 'y suma el ajuste de Beta después del mix que perdió (1000 − 30 + 20)');
select pg_temp.ok(pg_temp.elo(3) = 100, 'Gama queda en el piso');

-- ---------- lo ve el jugador ----------
set local role anon;
select pg_temp.ok((select count(*) = 2 from public.player_elo_adjustment_list where player_id = pg_temp.f(1)),
  'el perfil público muestra los dos ajustes de Alfa');
select pg_temp.ok((select set_elo = 1500 and reason = 'corrección' from public.player_elo_adjustment_list where player_id = pg_temp.f(1) and set_elo is not null),
  'con el valor fijado y el motivo');
set local role authenticated;
select pg_temp.como('aaaaaaaa-2500-4000-8000-000000000001');
select pg_temp.ok((select count(*) = 0 from public.admin_elo_adjustment_list), 'el listado del admin no lo ve un usuario común');
select pg_temp.como('aaaaaaaa-2500-4000-8000-0000000000ad');
select pg_temp.ok((select count(*) = 5 and bool_and(created_by_alias = 'Admin25') from public.admin_elo_adjustment_list where nick like '%25'),
  'el admin ve los ajustes con quién los hizo');
select pg_temp.ok((select count(*) = 2 from public.admin_elo_adjustment_list where search like '%alfa25%'), 'y los busca por alias');

-- ---------- deshacer ----------
select pg_temp.como('aaaaaaaa-2500-4000-8000-000000000001');
select pg_temp.ok(pg_temp.error(format('select public.elo_remove_adjustment(%s)', (select adjustment_id from r1 where player_id = pg_temp.f(2)))) like 'Solo un admin%',
  'un usuario común no deshace');
select pg_temp.como('aaaaaaaa-2500-4000-8000-0000000000ad');
reset role;
create temp table antes as select pg_temp.elo(2) as beta;
set local role authenticated;
select pg_temp.como('aaaaaaaa-2500-4000-8000-0000000000ad');
select public.elo_remove_adjustment((select adjustment_id from r1 where player_id = pg_temp.f(2)));
reset role;
select pg_temp.ok(pg_temp.elo(2) = (select beta from antes) - 20, 'deshacer un "sumar" resta su cambio');

set local role authenticated;
select pg_temp.como('aaaaaaaa-2500-4000-8000-0000000000ad');
select public.elo_remove_adjustment((select adjustment_id from r3));
reset role;
create temp table sin_fijar as select pg_temp.elo(1) as alfa;
select pg_temp.ok((select alfa from sin_fijar) < 1500 and (select alfa from sin_fijar) = 1050, 'deshacer un "fijar" recalcula: vuelve al ELO de sus mixes y ajustes (1000 + 30 + 20)');
select public.elo_recompute_all();
select pg_temp.ok(pg_temp.elo(1) = (select alfa from sin_fijar), 'y da lo mismo que un recálculo');

-- Con una temporada abierta después del ajuste, deshacer también recalcula (el pico arranca en el comienzo).
set local role authenticated;
select pg_temp.como('aaaaaaaa-2500-4000-8000-0000000000ad');
select public.season_start();
select public.elo_remove_adjustment((select adjustment_id from r1 where player_id = pg_temp.f(1)));
reset role;
create temp table con_temporada as select steam_id, elo, peak_elo from public.player_elo where steam_id like '7656119825%';
select public.elo_recompute_all();
select pg_temp.ok(not exists (select 1 from con_temporada c join public.player_elo e using (steam_id) where e.elo <> c.elo or e.peak_elo <> c.peak_elo),
  'deshacer un ajuste anterior a una temporada da lo mismo que un recálculo');
select pg_temp.ok(pg_temp.error('select public.elo_remove_adjustment(-1)') like 'No existe el ajuste%', 'deshacer uno que no existe');

rollback;
