-- Pruebas de supabase/replanteo/34_elo_por_ficha.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', u), true) $$;
create function pg_temp.s(n int) returns text language sql immutable as $$ select '7656119834' || lpad(n::text, 7, '0') $$;
create function pg_temp.f() returns uuid language sql immutable as $$ select 'dddddddd-3400-4000-8000-000000000001'::uuid $$;
-- Un mix 5 contra 5 terminado (ganador null = empate). El rating de cada uno depende de su número.
create function pg_temp.mix(n int, d numeric, w int, t1 int[], t2 int[]) returns void language sql as $$
  insert into public.matches(id, kind, status, map, score1, score2, winner_side, played_at)
  values (('cccccccc-3400-4000-8000-00000000000' || n)::uuid, 'mix', 'finished', 'de_dust2',
          case w when 1 then 16 when 2 then 10 else 15 end, case w when 1 then 10 when 2 then 16 else 15 end, w,
          '2026-01-01'::timestamptz + d * interval '1 day');
  insert into public.match_player_stats(match_id, steam_id, team, nick, rounds, rating)
  select ('cccccccc-3400-4000-8000-00000000000' || n)::uuid, pg_temp.s(x.j), x.t, 'n34-' || x.j, 30, 0.6 + (x.j % 9) * 0.1
    from (select unnest(t1) j, 1 t union all select unnest(t2), 2) x $$;
-- Foto del ELO de los demás: la fila de player_elo y sus filas de los mixes.
create function pg_temp.demas() returns text language sql as $$
  select md5(coalesce((select string_agg(format('%s|%s|%s|%s|%s|%s', steam_id, elo, peak_elo, mu, sigma, matches), ',' order by steam_id)
                         from public.player_elo where steam_id not in (pg_temp.s(1), pg_temp.s(2))), '') ||
             (select string_agg(format('%s|%s|%s|%s|%s|%s', match_id, steam_id, elo_before, elo_after, elo_delta, win_prob), ',' order by match_id, steam_id)
                from public.match_player_stats where steam_id not in (pg_temp.s(1), pg_temp.s(2)))) $$;
-- Los mixes de la ficha (SteamID 1 y 2) rehechos a mano con su win_prob: rondas completas, sin piso ni ajustes.
create function pg_temp.a_mano() returns integer language sql as $$
  select 1000 + sum(case when x.res = 1 then greatest(x.d, 1) when x.res = 0 then least(x.d, -1) else x.d end)::integer
    from (select r.res, round(60 * (r.res - s.win_prob::double precision))
                        + greatest(-5, least(5, round((s.rating - 1) * 10)::integer)) d
            from public.match_player_stats s join public.matches m on m.id = s.match_id,
                 lateral (select case m.winner_side when s.team then 1.0 when 3 - s.team then 0.0 else 0.5 end res) r
           where s.steam_id in (pg_temp.s(1), pg_temp.s(2)) and s.win_prob is not null) x $$;
create function pg_temp.fila(n int) returns text language sql as $$
  select format('%s|%s|%s', elo, peak_elo, matches) from public.player_elo where steam_id = pg_temp.s(n) $$;
create function pg_temp.historial() returns text language sql as $$
  select string_agg(format('%s|%s|%s|%s', match_id, elo_before, elo_after, win_prob), ',' order by match_id)
    from public.match_player_stats where steam_id in (pg_temp.s(1), pg_temp.s(2)) $$;
-- Avisos de ELO (los del pedido de SteamID no cuentan).
create function pg_temp.avisos() returns bigint language sql as $$
  select count(*) from public.notifications where type in ('level_changed', 'season_ranked', 'elo_adjusted') $$;
grant execute on function pg_temp.ok(boolean, text), pg_temp.como(text), pg_temp.s(int), pg_temp.f(), pg_temp.demas(),
  pg_temp.a_mano(), pg_temp.fila(int), pg_temp.historial(), pg_temp.avisos() to authenticated;

-- Sin mixes, ELO, ajustes ni temporadas de la base local (vuelven con el rollback).
delete from public.match_player_stats;
delete from public.match_crashes;
delete from public.matches where kind = 'mix';
delete from public.elo_adjustments;
delete from public.player_elo;
delete from public.player_medals where season_id is not null;
delete from public.seasons;
insert into public.elo_config(id) values (1) on conflict (id) do nothing;
update public.elo_config set base = 30, bonus_max = 5, bonus_factor = 10, elo_floor = 100, start_elo = 1000, min_pct = 35, full_pct = 90
 where id = 1;

-- Admin y una cuenta con ficha (SteamID 1). El SteamID 2 es la misma persona, que jugó sin vincularlo.
-- Nunca juegan el mismo mix. Del 10 al 19, otros jugadores.
insert into auth.users (id, email, raw_user_meta_data, encrypted_password) values
  ('aaaaaaaa-3400-4000-8000-0000000000ad', 'admin34@test.local', '{"tag":"Admin34"}', 'x'),
  ('aaaaaaaa-3400-4000-8000-000000000001', 'u1-34@test.local', '{"tag":"Uno34"}', 'x');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-3400-4000-8000-0000000000ad';
insert into public.players(id, nick, user_id, steam_id) values (pg_temp.f(), 'Uno34', 'aaaaaaaa-3400-4000-8000-000000000001', pg_temp.s(1));
select pg_temp.mix(1, 1, 1, array[1, 10, 11, 12, 13], array[14, 15, 16, 17, 18]);
select pg_temp.mix(2, 2, 2, array[2, 14, 10, 15, 11], array[12, 16, 13, 17, 19]);
select pg_temp.mix(3, 3, 2, array[10, 12, 14, 16, 18], array[1, 11, 13, 15, 17]);
select pg_temp.mix(4, 4, 1, array[2, 11, 12, 13, 19], array[10, 14, 15, 16, 17]);
select pg_temp.mix(5, 5, 2, array[1, 15, 16, 18, 19], array[10, 11, 12, 13, 14]);
select pg_temp.mix(6, 6, null, array[10, 11, 15, 16, 17], array[2, 12, 13, 14, 18]);
select public.elo_recompute_all();

create temp table antes as
  select pg_temp.demas() demas, pg_temp.fila(1) f1, pg_temp.fila(2) f2, pg_temp.historial() hist,
         (select mu from public.player_elo where steam_id = pg_temp.s(1)) mu1,
         pg_temp.avisos() avisos;
grant select on antes to authenticated;

-- ---------- sumar: aprobar el pedido ----------
insert into public.steam_requests(player_id, steam_id, kind) values (pg_temp.f(), pg_temp.s(2), 'add');
set local role authenticated;
select pg_temp.como('aaaaaaaa-3400-4000-8000-0000000000ad');
select public.approve_steam_request((select id from public.steam_requests where steam_id = pg_temp.s(2) and status = 'pending'));
reset role;
do $$ begin
  perform pg_temp.ok((select demas from antes) = pg_temp.demas(), 'al aprobar, el ELO, el pico y los mixes de los demás quedan igual');
  perform pg_temp.ok(not exists (select 1 from public.player_elo where steam_id = pg_temp.s(2)), 'el SteamID nuevo ya no tiene ELO propio');
  perform pg_temp.ok((select elo = pg_temp.a_mano() and matches = 6 from public.player_elo where steam_id = pg_temp.s(1)),
                     'el ELO de la ficha es el de rehacer a mano sus 6 mixes con su win_prob');
  perform pg_temp.ok((select bool_and(elo_after - elo_before = elo_delta) and count(*) = 6
                        from public.match_player_stats where steam_id in (pg_temp.s(1), pg_temp.s(2))),
                     'cada mix de la ficha tiene su ELO antes y después');
  perform pg_temp.ok((select elo_before = 1000 from public.match_player_stats
                       where match_id = 'cccccccc-3400-4000-8000-000000000001' and steam_id = pg_temp.s(1)), 'el primero arranca en 1000');
  perform pg_temp.ok((select a.elo_before = b.elo_after
                        from public.match_player_stats a, public.match_player_stats b
                       where a.match_id = 'cccccccc-3400-4000-8000-000000000002' and a.steam_id = pg_temp.s(2)
                         and b.match_id = 'cccccccc-3400-4000-8000-000000000001' and b.steam_id = pg_temp.s(1)),
                     'el mix del SteamID 2 sigue al del SteamID 1');
  perform pg_temp.ok((select mu from public.player_elo where steam_id = pg_temp.s(1)) = (select mu1 from antes),
                     'μ: el de la ficha (empata en mixes con el SteamID nuevo y gana la clave)');
  perform pg_temp.ok((select avisos from antes) = pg_temp.avisos(), 'no crea notificaciones');
end $$;

-- ---------- quitar el adicional ----------
set local role authenticated;
select public.admin_remove_steam(pg_temp.s(2));
reset role;
do $$ begin
  perform pg_temp.ok((select demas from antes) = pg_temp.demas(), 'al quitar, los demás siguen igual');
  perform pg_temp.ok(pg_temp.fila(1) = (select f1 from antes) and pg_temp.fila(2) = (select f2 from antes)
                     and pg_temp.historial() = (select hist from antes),
                     'la ficha y el SteamID libre vuelven a como estaban antes de sumarlo');
  perform pg_temp.ok((select sigma = 25.0 / 3 from public.player_elo where steam_id = pg_temp.s(2)), 'el SteamID libre arranca con el σ de uno nuevo');
  perform pg_temp.ok((select avisos from antes) = pg_temp.avisos(), 'tampoco crea notificaciones');
end $$;

-- ---------- quitar el principal ----------
set local role authenticated;
select public.link_steam_id(pg_temp.s(2), pg_temp.f());
create temp table junta as select mu, elo from public.player_elo where steam_id = pg_temp.s(1);
select public.link_steam_id(pg_temp.s(1), null);
reset role;
do $$ begin
  perform pg_temp.ok((select steam_id = pg_temp.s(2) from public.players where id = pg_temp.f()), 'el SteamID 2 pasa a ser el principal');
  perform pg_temp.ok((select demas from antes) = pg_temp.demas(), 'los demás siguen igual');
  perform pg_temp.ok(pg_temp.fila(1) = (select f1 from antes), 'el SteamID 1 libre vuelve a su ELO');
  perform pg_temp.ok((select split_part(f2, '|', 1) = split_part(pg_temp.fila(2), '|', 1) from antes), 'la ficha queda con el ELO del SteamID 2');
  perform pg_temp.ok((select e.mu = j.mu from public.player_elo e, junta j where e.steam_id = pg_temp.s(2)),
                     'la ficha conserva su μ aunque cambie de principal');
end $$;

-- ---------- con un "fijar", un ajuste y un cierre de temporada en el medio ----------
-- Ahora la ficha es el SteamID 2 y el 1 está libre. Fijar 1500 al 1 (día 2,5), +20 a la ficha (día 3,5),
-- temporada del día 0,5 al 4,5 (reinicio al 50 % sobre 900) y otra activa desde el 4,5.
insert into public.elo_adjustments(steam_id, delta, set_elo, reason, applied_at)
  values (pg_temp.s(1), 1, 1500, 'prueba', '2026-01-03 12:00+00'), (pg_temp.s(2), 20, null, 'prueba', '2026-01-04 12:00+00');
insert into public.seasons(number, name, status, starts_at, ends_at, closed_at, top_n, min_matches, reset_pct, reset_floor, tiers)
  select 1, 'T1', 'closed', '2026-01-01 12:00+00'::timestamptz, '2026-01-05 12:00+00'::timestamptz, '2026-01-05 12:00+00'::timestamptz, 20, 1, 50, 900, tiers from public.season_config
  union all
  select 2, 'T2', 'active', '2026-01-05 12:00+00', '2026-02-05 12:00+00', null, 20, 1, 50, 900, tiers from public.season_config;
select public.elo_recompute_all();
create temp table antes2 as select pg_temp.demas() demas, pg_temp.avisos() avisos;
grant select on antes2 to authenticated;

set local role authenticated;
select public.link_steam_id(pg_temp.s(1), pg_temp.f());
reset role;
create temp table h as
  select regexp_replace(match_id::text, '^.*(.)$', '\1')::int n, elo_before b, elo_after a
    from public.match_player_stats where steam_id in (pg_temp.s(1), pg_temp.s(2));
do $$ begin
  perform pg_temp.ok((select demas from antes2) = pg_temp.demas(), 'con ajustes y temporadas, los demás siguen igual');
  perform pg_temp.ok((select b = 1500 from h where n = 3), 'el "fijar" queda en su lugar: el mix siguiente arranca en 1500');
  perform pg_temp.ok((select h4.b = h3.a + 20 from h h4, h h3 where h4.n = 4 and h3.n = 3), 'el ajuste de +20 también');
  perform pg_temp.ok((select h5.b = 900 + round((h4.a - 900) * 0.5) from h h5, h h4 where h5.n = 5 and h4.n = 4),
                     'el cierre de temporada reinicia al 50 % sobre 900 antes del mix siguiente');
  perform pg_temp.ok((select e.peak_elo = greatest(h5.b, h5.a, h6.a) and e.elo = h6.a and e.matches = 6
                        from public.player_elo e, h h5, h h6 where e.steam_id = pg_temp.s(2) and h5.n = 5 and h6.n = 6),
                     'el pico arranca de nuevo con la temporada y el ELO es el del último mix');
  perform pg_temp.ok((select avisos from antes2) = pg_temp.avisos(), 'sin notificaciones');
end $$;

-- ---------- sin mixes ----------
do $$ begin
  perform pg_temp.ok(public.elo_recompute_player(pg_temp.s(99)) = 0 and not exists (select 1 from public.player_elo where steam_id = pg_temp.s(99)),
                     'un SteamID sin mixes ni ajustes no queda con ELO');
end $$;
-- Un ajuste de hoy, después de la temporada que cerró el 5 de enero.
insert into public.elo_adjustments(steam_id, delta, reason) values (pg_temp.s(98), 20, 'prueba');
create temp table ficha as select pg_temp.fila(2) f;
do $$ declare v text; begin
  perform public.elo_recompute_player(pg_temp.s(98));
  v := pg_temp.fila(98);
  perform public.elo_recompute_all();
  perform pg_temp.ok(v = pg_temp.fila(98) and v = '1020|1020|0', 'sin mixes pero con un ajuste: igual que el recálculo general');
  -- Lo que se aparta la ficha del cálculo exacto (sus mixes viejos se jugaron como dos jugadores).
  raise notice 'INFO: ficha por ficha % y exacto %', (select f from ficha), pg_temp.fila(2);
end $$;

-- ---------- permisos ----------
set local role authenticated;
do $$ begin
  perform public.elo_recompute_player(pg_temp.s(1));
  raise exception 'FALLA: un usuario no debería poder recalcular';
exception when insufficient_privilege then
  raise notice 'OK: elo_recompute_player no se llama desde la web';
end $$;
reset role;

rollback;
