-- Pruebas de supabase/replanteo/37_reinicio_total.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', u), true) $$;
create function pg_temp.s(n int) returns text language sql immutable as $$ select '7656119837' || lpad(n::text, 7, '0') $$;
create function pg_temp.elo(n int) returns integer language sql as $$ select elo from public.player_elo where steam_id = pg_temp.s(n) $$;
create function pg_temp.todos() returns text language sql as $$
  select string_agg(format('%s|%s|%s', steam_id, elo, peak_elo), ',' order by steam_id) from public.player_elo $$;
grant execute on function pg_temp.ok(boolean, text), pg_temp.como(text), pg_temp.s(int), pg_temp.elo(int), pg_temp.todos()
  to authenticated;

-- ---------- fórmula ----------
select pg_temp.ok(public.season_reset_elo(2540, 10, 2001, false) = 2055 and public.season_reset_elo(1500, 10, 2001, false) = 1500,
  'sin todos: como la de 3 parámetros (debajo del piso no cambia)');
select pg_temp.ok(public.season_reset_elo(2540, 10, 2001, true) = 2055 and public.season_reset_elo(1001, 10, 2001, true) = 1901
                  and public.season_reset_elo(2001, 10, 2001, true) = 2001,
  'con todos: debajo del piso sube hacia el piso y conserva el 10 % de la distancia');
select pg_temp.ok(public.season_reset_elo(2540, 0, 1000, true) = 1000 and public.season_reset_elo(400, 0, 1000, true) = 1000,
  'con todos y 0 %: todos quedan en el piso (reinicio total)');
select pg_temp.ok(public.season_reset_elo(400, 100, 1000, true) = 400, 'con 100 % nadie cambia');
select pg_temp.ok((select not reset_all from public.season_config), 'la configuración arranca sin reinicio total');

-- ---------- datos (sin los mixes, el ELO ni las temporadas de la base local; vuelven con el rollback) ----------
delete from public.match_player_stats;
delete from public.match_crashes;
delete from public.matches where kind = 'mix';
delete from public.elo_adjustments;
delete from public.player_elo;
delete from public.player_medals where season_id is not null;
delete from public.seasons;
insert into public.elo_config(id) values (1) on conflict (id) do nothing;

insert into auth.users (id, email, raw_user_meta_data, encrypted_password) values
  ('aaaaaaaa-3700-4000-8000-0000000000ad', 'admin37@test.local', '{"tag":"Admin37"}', 'x'),
  ('aaaaaaaa-3700-4000-8000-000000000001', 'u1-37@test.local', '{"tag":"Uno37"}', 'x');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-3700-4000-8000-0000000000ad';
insert into public.players(id, nick, steam_id) values
  ('dddddddd-3700-4000-8000-000000000001', 'Alfa37', pg_temp.s(1)),
  ('dddddddd-3700-4000-8000-000000000002', 'Beta37', pg_temp.s(2)),
  ('dddddddd-3700-4000-8000-000000000003', 'Gama37', pg_temp.s(3));
-- 1 en 2540 (nivel 10), 2 en 1500 y 3 en 2001 (justo en el piso).
select public.elo_add_adjustment(array[pg_temp.s(1)], 1540, 'prueba 37', now() - interval '20 days');
select public.elo_add_adjustment(array[pg_temp.s(2)], 500, 'prueba 37', now() - interval '20 days');
select public.elo_add_adjustment(array[pg_temp.s(3)], 1001, 'prueba 37', now() - interval '20 days');
select pg_temp.ok(pg_temp.elo(1) = 2540 and pg_temp.elo(2) = 1500 and pg_temp.elo(3) = 2001, 'pretemporada: 2540, 1500 y 2001');

-- ---------- configuración, apertura y cambios ----------
set local role authenticated;
select pg_temp.como('aaaaaaaa-3700-4000-8000-0000000000ad');
select public.set_season_config(30, 20, 1, 10, 2001, (select tiers from public.season_config), p_reset_all => true);
select pg_temp.ok((select reset_all from public.season_config), 'set_season_config guarda el reinicio total');
select public.set_season_config(30, 20, 1, 10, 2001, (select tiers from public.season_config));
select pg_temp.ok((select not reset_all from public.season_config), 'set_season_config sin p_reset_all lo apaga');
select public.set_season_config(30, 20, 1, 10, 2001, (select tiers from public.season_config), true);
select public.season_start();
select pg_temp.ok((select reset_all from public.seasons where number = 1), 'season_start copia el reinicio total de la configuración');
select public.season_update((select id from public.seasons where number = 1), p_reset_all => false);
select pg_temp.ok((select not reset_all from public.seasons where number = 1), 'season_update lo cambia');
select public.season_update((select id from public.seasons where number = 1), p_top_n => 15);
select pg_temp.ok((select not reset_all and top_n = 15 from public.seasons where number = 1), 'season_update sin p_reset_all no lo toca');
select public.season_update((select id from public.seasons where number = 1), p_reset_all => true, p_reset_pct => 0);
select pg_temp.ok((select reset_all from public.season_list where number = 1), 'season_list devuelve reset_all');

-- ---------- vista previa ----------
select pg_temp.ok((select count(*) filter (where reset) = 1 and bool_and(elo_after = elo or reset)
                     from public.season_preview(20, 1, 0, 2001)),
  'vista previa sin todos: solo se reinicia el de más ELO que el piso');
select pg_temp.ok((select count(*) filter (where reset) = 2 and bool_and(elo_after = 2001)
                     from public.season_preview(20, 1, 0, 2001, true)),
  'vista previa con todos y 0 %: todos quedan en 2001 y se reinician los dos que no estaban en el piso');
select pg_temp.ok((select (r ->> 'reset')::int = 2 and (r ->> 'max_drop')::int = 539
                     from public.season_preview_summary(20, 1, 0, 2001, true) r),
  'resumen con todos: 2 reinicios y la baja más grande es 539');
select pg_temp.ok((select elo_after = 2001 from public.season_live_standings where player_id = 'dddddddd-3700-4000-8000-000000000002'),
  'el ranking en vivo usa el reinicio total de la temporada');
reset role;

-- ---------- cierre ----------
update public.seasons set starts_at = now() - interval '10 days' where number = 1;
set local role authenticated;
select pg_temp.como('aaaaaaaa-3700-4000-8000-0000000000ad');
create temp table cierre as select public.season_close((select id from public.seasons where number = 1), 'estoy seguro') r;
reset role;
select pg_temp.ok((select (r ->> 'reset')::int = 2 from cierre), 'el cierre cuenta 2 reinicios');
select pg_temp.ok(pg_temp.elo(1) = 2001 and pg_temp.elo(2) = 2001 and pg_temp.elo(3) = 2001, 'después del cierre todos quedan en 2001');
select pg_temp.ok((select bool_and(peak_elo = elo) from public.player_elo), 'el pico de la temporada nueva arranca en el ELO');
select pg_temp.ok((select bool_and(elo_after = 2001) and count(*) = 3 from public.season_standings), 'la foto guarda el ELO después del reinicio');
select pg_temp.ok((select reset_all from public.seasons where number = 2), 'la temporada siguiente toma el reinicio total de la configuración');

-- ---------- recálculos ----------
create temp table antes as select pg_temp.todos() t;
select public.elo_recompute_all();
select pg_temp.ok(pg_temp.todos() = (select t from antes), 'elo_recompute_all llega al mismo ELO');
select public.elo_recompute_player(pg_temp.s(2));
select pg_temp.ok(pg_temp.todos() = (select t from antes), 'elo_recompute_player llega al mismo ELO');

rollback;
