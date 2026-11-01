-- Pruebas de supabase/replanteo/24_temporadas.sql (correr con la migración aplicada). Todo con rollback.
-- En una transacción now() no avanza: la temporada 1 se corre 15 días para atrás y los mixes van entre medio.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', u), true) $$;
create function pg_temp.s(n int) returns text language sql immutable as $$ select '7656119824' || lpad(n::text, 7, '0') $$;
-- Mensaje del error de una sentencia, o null si no falla.
create function pg_temp.error(q text) returns text language plpgsql as $$
begin
  execute q;
  return null;
exception when others then return sqlerrm;
end $$;
create function pg_temp.elo(n int) returns integer language sql as $$ select elo from public.player_elo where steam_id = pg_temp.s(n) $$;
-- Un mix terminado: el bando 1 (SteamID a) le gana al bando 2 (SteamID b), en la fecha dada.
create function pg_temp.mix(id uuid, a int, b int, at timestamptz) returns void language sql as $$
  insert into public.matches(id, kind, status, map, score1, score2, winner_side, played_at)
  values (id, 'mix', 'finished', 'de_dust2', 16, 10, 1, at);
  insert into public.match_player_stats(match_id, steam_id, team, nick, rounds, rating) values
    (id, pg_temp.s(a), 1, 'n' || a, 26, 1), (id, pg_temp.s(b), 2, 'n' || b, 26, 1) $$;
grant execute on function pg_temp.ok(boolean, text), pg_temp.como(text), pg_temp.s(int), pg_temp.error(text), pg_temp.elo(int)
  to authenticated, anon, service_role;

-- ---------- reglas ----------
select pg_temp.ok(public.season_tiers_ok((select tiers from public.season_config)), 'los tramos por defecto son válidos');
select pg_temp.ok((select jsonb_array_length(tiers) = 5 and tiers->0->>'name' = 'Campeón' and tiers->4->>'name' = 'Top {top}'
                     from public.season_config), 'tramos por defecto: Campeón, 🥈, 🥉, Top 10 y Top N');
select pg_temp.ok((select duration_days = 30 and top_n = 20 and min_matches = 20 and reset_pct = 10 and reset_floor = 2001
                     from public.season_config), 'configuración por defecto: 30 días, top 20, 20 mixes, 10 % y piso 2001');
select pg_temp.ok(not public.season_tiers_ok('[{"from":2,"name":"x","icon":"x"}]'), 'tramos: tienen que empezar en el puesto 1');
select pg_temp.ok(not public.season_tiers_ok('[{"from":1,"to":1,"name":"x","icon":"x"},{"from":3,"name":"y","icon":"y"}]'), 'tramos: sin huecos');
select pg_temp.ok(not public.season_tiers_ok('[{"from":1,"to":3,"name":"x","icon":"x"}]'), 'tramos: el último no tiene "hasta"');
select pg_temp.ok(not public.season_tiers_ok('[{"from":1,"name":"x","icon":"x"},{"from":2,"name":"y","icon":"y"}]'), 'tramos: nada después del abierto');
select pg_temp.ok(not public.season_tiers_ok('[{"from":1,"name":"","icon":"x"}]'), 'tramos: nombre obligatorio');
select pg_temp.ok(not public.season_tiers_ok('[{"from":1,"name":"x","icon":"x","color":"red"}]'), 'tramos: sin claves de más');
select pg_temp.ok(not public.season_tiers_ok('{"from":1}'), 'tramos: tiene que ser una lista');
select pg_temp.ok((select name = 'Top 20' and icon = '🏅' from public.season_tier((select tiers from public.season_config), 15, 20)),
  'el puesto 15 de un top 20 es "Top 20"');
select pg_temp.ok((select name = 'Top 10' from public.season_tier((select tiers from public.season_config), 5, 7)),
  'con un top 7, el puesto 5 sigue en "Top 10"');
select pg_temp.ok(not exists (select 1 from public.season_tier((select tiers from public.season_config), 21, 20)),
  'fuera del top no hay medalla');
select pg_temp.ok(public.season_reset_elo(2540, 10, 2001) = 2055 and public.season_reset_elo(2200, 10, 2001) = 2021
                  and public.season_reset_elo(2010, 10, 2001) = 2002 and public.season_reset_elo(1990, 10, 2001) = 1990,
  'reinicio con 10 %: 2540 → 2055, 2200 → 2021, 2010 → 2002, 1990 igual');
select pg_temp.ok(public.season_reset_elo(2540, 0, 2001) = 2001 and public.season_reset_elo(2540, 100, 2001) = 2540,
  'reinicio con 0 % vuelve al piso y con 100 % no cambia');
select pg_temp.ok(public.season_default_end('2026-10-21 15:00-05', 30) = '2026-11-20 06:00-03',
  'fin por defecto: las 06:00 de Argentina del día de fin');
select pg_temp.ok(public.season_default_end('2026-10-21 05:30-03', 30) = '2026-11-20 06:00-03',
  'fin por defecto: el día se cuenta en la hora de Argentina');

-- El ranking es de todas las fichas: sin los mixes ni el ELO que haya en la base local (vuelven con el rollback).
delete from public.match_player_stats;
delete from public.match_crashes;
delete from public.matches where kind = 'mix';
delete from public.elo_adjustments;
delete from public.player_elo;

-- ---------- datos: admin, un usuario y cuatro fichas (la 1 con un SteamID adicional, el 5) ----------
insert into auth.users (id, email, raw_user_meta_data, encrypted_password) values
  ('aaaaaaaa-2400-4000-8000-0000000000ad', 'admin24@test.local', '{"tag":"Admin24"}', 'x'),
  ('aaaaaaaa-2400-4000-8000-000000000001', 'u1-24@test.local', '{"tag":"Uno24"}', 'x');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-2400-4000-8000-0000000000ad';
insert into public.players(id, nick, steam_id) values
  ('dddddddd-2400-4000-8000-000000000001', 'Alfa24', pg_temp.s(1)),
  ('dddddddd-2400-4000-8000-000000000002', 'Beta24', pg_temp.s(2)),
  ('dddddddd-2400-4000-8000-000000000003', 'Gama24', pg_temp.s(3)),
  ('dddddddd-2400-4000-8000-000000000004', 'Delta24', pg_temp.s(4));
insert into public.player_extra_steam_ids(steam_id, player_id) values (pg_temp.s(5), 'dddddddd-2400-4000-8000-000000000001');

-- Pretemporada: ajustes para llevar a 1 y 2 al nivel 10.
insert into public.elo_config(id) values (1) on conflict (id) do nothing;   -- la base local puede no tenerla
select public.elo_add_adjustment(array[pg_temp.s(1)], 1540, 'prueba 24', now() - interval '20 days');
select public.elo_add_adjustment(array[pg_temp.s(2)], 1200, 'prueba 24', now() - interval '20 days');
select pg_temp.ok(pg_temp.elo(1) = 2540 and pg_temp.elo(2) = 2200, 'pretemporada: 2540 y 2200');

-- ---------- abrir ----------
set local role authenticated;
select pg_temp.como('aaaaaaaa-2400-4000-8000-000000000001');
select pg_temp.ok(pg_temp.error('select public.season_start()') like 'Solo un admin%', 'un usuario común no abre una temporada');
select pg_temp.como('aaaaaaaa-2400-4000-8000-0000000000ad');
select pg_temp.ok(pg_temp.error($q$select public.season_start(null, now() - interval '1 day')$q$) like 'La fecha de fin tiene que ser futura%',
  'la fecha de fin tiene que ser futura');
select public.season_start();
select pg_temp.ok((select number = 1 and name = 'Temporada 1' and status = 'active' and ends_at = public.season_default_end(now(), 30)
                          and top_n = 20 and min_matches = 20 and reset_pct = 10 and created_by = 'aaaaaaaa-2400-4000-8000-0000000000ad'
                     from public.seasons), 'la temporada 1 se abre con los valores por defecto');
select pg_temp.ok(pg_temp.error('select public.season_start()') = 'Ya hay una temporada activa', 'una sola activa');
reset role;

-- La temporada empezó hace 15 días; dos mixes en ella: 1 le gana a 3 y 2 le gana a 3 (con el SteamID adicional de 1, otro más).
update public.seasons set starts_at = now() - interval '15 days' where number = 1;
select pg_temp.mix('eeeeeeee-2400-4000-8000-000000000001', 1, 3, now() - interval '5 days');
select pg_temp.mix('eeeeeeee-2400-4000-8000-000000000002', 2, 3, now() - interval '4 days');
select pg_temp.mix('eeeeeeee-2400-4000-8000-000000000003', 5, 4, now() - interval '3 days');
select public.elo_recompute_all();
select pg_temp.ok(pg_temp.elo(1) > 2540 and pg_temp.elo(2) > 2200 and pg_temp.elo(5) is null, 'los mixes suman ELO (el adicional, a la ficha)');
select pg_temp.ok((select peak_elo = elo from public.player_elo where steam_id = pg_temp.s(1)) and (select peak_elo from public.player_elo where steam_id = pg_temp.s(3)) = 1000,
  'el pico es de la temporada: el de 1 es su ELO actual y el de 3 (que solo perdió) el inicial');

-- ---------- ranking en vivo ----------
select pg_temp.ok((select matches = 2 and wins = 2 and losses = 0 and not eligible and rank is null
                     from public.season_live_standings where player_id = 'dddddddd-2400-4000-8000-000000000001'),
  'mixes de la temporada por ficha (con todos sus SteamID); con 20 de mínimo no entra');

set local role authenticated;
select pg_temp.como('aaaaaaaa-2400-4000-8000-0000000000ad');
select pg_temp.ok(pg_temp.error($q$select public.season_update((select id from public.seasons where number = 1), p_tiers => '[{"from":2,"name":"x","icon":"x"}]')$q$)
                  like 'Los tramos de medallas no son válidos%', 'season_update valida los tramos');
select pg_temp.ok(pg_temp.error($q$select public.season_update((select id from public.seasons where number = 1), p_min_matches => 0)$q$)
                  like 'El mínimo de mixes%', 'season_update valida el mínimo');
select public.season_update((select id from public.seasons where number = 1), p_top_n => 2, p_min_matches => 1);
select pg_temp.ok((select top_n = 2 and min_matches = 1 and reset_pct = 10 and name = 'Temporada 1' from public.seasons where number = 1),
  'season_update cambia solo lo que llega');
reset role;

select pg_temp.ok((select string_agg(nick || ':' || coalesce(rank::text, '-') || ':' || coalesce(tier, '-'), ' ' order by rank nulls last, nick)
                     from public.season_live_standings where nick like '%24')
                  = 'Alfa24:1:Campeón Beta24:2:Subcampeón Delta24:3:- Gama24:4:-',
  'en vivo: puesto por ELO, medalla solo al top 2');
select pg_temp.ok((select elo_after = public.season_reset_elo(elo, 10, 2001) from public.season_live_standings
                    where player_id = 'dddddddd-2400-4000-8000-000000000001'), 'en vivo: ELO si cerrara ahora');

-- ---------- vista previa ----------
set local role authenticated;
select pg_temp.como('aaaaaaaa-2400-4000-8000-000000000001');
select pg_temp.ok(pg_temp.error('select * from public.season_preview(20, 1, 10, 2001)') like 'Solo un admin%', 'un usuario común no ve la vista previa');
select pg_temp.como('aaaaaaaa-2400-4000-8000-0000000000ad');
select pg_temp.ok((select count(*) filter (where tier is not null) = 3 and bool_and(elo_after = 2001) filter (where reset)
                     from public.season_preview(3, 1, 0, 2001) where nick like '%24'),
  'vista previa con top 3 y 0 %: tres medallas y los nivel 10 vuelven a 2001');
select pg_temp.ok((select (s->>'reset')::int >= 2 and (s->>'eligible')::int >= 4 and (s->>'max_drop')::int >= pg_temp.elo(1) - 2001
                     from public.season_preview_summary(3, 1, 0, 2001) s), 'resumen de la vista previa');
select pg_temp.ok(pg_temp.error('select * from public.season_preview(0, 1, 10, 2001)') like 'El top%', 'la vista previa valida los valores');
select pg_temp.ok((select elo from public.player_elo where steam_id = pg_temp.s(1)) > 2540, 'la vista previa no cambia nada');

-- ---------- cerrar ----------
select pg_temp.como('aaaaaaaa-2400-4000-8000-000000000001');
select pg_temp.ok(pg_temp.error($q$select public.season_close((select id from public.seasons where number = 1), 'estoy seguro')$q$) like 'Solo un admin%',
  'un usuario común no termina la temporada');
select pg_temp.como('aaaaaaaa-2400-4000-8000-0000000000ad');
select pg_temp.ok(pg_temp.error($q$select public.season_close((select id from public.seasons where number = 1), 'si')$q$) like 'Para terminar la temporada%',
  'terminar pide "estoy seguro"');
reset role;
create temp table antes as select steam_id, elo from public.player_elo where steam_id in (pg_temp.s(1), pg_temp.s(2), pg_temp.s(3), pg_temp.s(4));
grant all on antes to authenticated;
set local role authenticated;
select pg_temp.como('aaaaaaaa-2400-4000-8000-0000000000ad');
select public.season_close((select id from public.seasons where number = 1), ' Estoy Seguro ');
reset role;

select pg_temp.ok((select status = 'closed' and closed_at = now() and closed_by = 'aaaaaaaa-2400-4000-8000-0000000000ad' from public.seasons where number = 1),
  'la temporada 1 queda cerrada con fecha y quién');
select pg_temp.ok((select status = 'active' and name = 'Temporada 2' and starts_at = now() and ends_at = public.season_default_end(now(), 30)
                          and top_n = 20 and min_matches = 20 from public.seasons where number = 2),
  'se abre la temporada 2 con los valores por defecto (no los cambiados de la 1)');
select pg_temp.ok((select count(*) = 2 from public.player_medals m join public.seasons s on s.id = m.season_id
                    where s.number = 1 and m.player_id in ('dddddddd-2400-4000-8000-000000000001', 'dddddddd-2400-4000-8000-000000000002')),
  'medallas al top 2');
select pg_temp.ok((select title = 'Temporada 1 · #1' and icon = '🏆' and tier = 'Campeón' and rank = 1 from public.player_medals
                    where player_id = 'dddddddd-2400-4000-8000-000000000001'), 'medalla del campeón: "Temporada 1 · #1"');
select pg_temp.ok((select elo = (select elo from antes where steam_id = pg_temp.s(1)) and elo_after = public.season_reset_elo(elo, 10, 2001)
                          and rank = 1 and matches = 2 and tier = 'Campeón'
                     from public.season_standings where player_id = 'dddddddd-2400-4000-8000-000000000001'), 'foto del ranking final');
select pg_temp.ok(pg_temp.elo(1) = public.season_reset_elo((select elo from antes where steam_id = pg_temp.s(1)), 10, 2001)
                  and pg_temp.elo(2) = public.season_reset_elo((select elo from antes where steam_id = pg_temp.s(2)), 10, 2001),
  'los nivel 10 se reinician con el 10 %');
select pg_temp.ok(pg_temp.elo(3) = (select elo from antes where steam_id = pg_temp.s(3)), 'debajo del nivel 10 no cambia');
select pg_temp.ok(not exists (select 1 from public.player_elo where steam_id like '7656119824%' and peak_elo <> elo), 'el pico arranca en el ELO nuevo');
select pg_temp.ok((select champion_nick = 'Alfa24' and medals = 2 and status = 'closed' from public.season_list where number = 1),
  'season_list: campeón y medallas');
select pg_temp.ok((select count(*) = 4 from public.season_standings_list
                    where season_id = (select id from public.seasons where number = 1) and nick like '%24'), 'season_standings_list: la foto');
select pg_temp.ok((select count(*) = 4 and bool_and(matches = 0) from public.season_standings_list
                    where season_id = (select id from public.seasons where number = 2) and nick like '%24'), 'season_standings_list: la activa en vivo');

set local role authenticated;
select pg_temp.como('aaaaaaaa-2400-4000-8000-0000000000ad');
select pg_temp.ok(pg_temp.error($q$select public.season_update((select id from public.seasons where number = 1), p_name => 'x')$q$)
                  like 'Una temporada cerrada no se puede cambiar%', 'una temporada cerrada no se cambia');
select pg_temp.ok(pg_temp.error($q$select public.season_close((select id from public.seasons where number = 1), 'estoy seguro')$q$)
                  like 'Esa temporada ya está cerrada%', 'no se cierra dos veces');
reset role;

-- ---------- recálculo y mix que llega tarde ----------
create temp table cerrado as select steam_id, elo from public.player_elo where steam_id like '7656119824%';
select public.elo_recompute_all();
select pg_temp.ok(not exists (select 1 from cerrado c join public.player_elo e using (steam_id) where e.elo <> c.elo),
  'un recálculo después del cierre da el mismo ELO (el reinicio está en la línea de tiempo)');
update public.season_config set reset_pct = 50;
select public.elo_recompute_all();
select pg_temp.ok(not exists (select 1 from cerrado c join public.player_elo e using (steam_id) where e.elo <> c.elo),
  'cambiar la configuración no cambia el reinicio de una temporada cerrada');
update public.season_config set reset_pct = 10;

-- Un mix del día antes del cierre llega ahora: se recalcula todo y el reinicio queda después.
select pg_temp.mix('eeeeeeee-2400-4000-8000-000000000004', 1, 4, now() - interval '1 day');
select public.elo_apply_match('eeeeeeee-2400-4000-8000-000000000004');
create temp table tarde as select steam_id, elo from public.player_elo where steam_id like '7656119824%';
select pg_temp.ok(pg_temp.elo(1) between 2001 and 2100, 'el mix tardío no queda sumado después del reinicio');
select public.elo_recompute_all();
select pg_temp.ok(not exists (select 1 from tarde t join public.player_elo e using (steam_id) where e.elo <> t.elo),
  'el mix tardío deja el mismo ELO que un recálculo');
select pg_temp.ok((select matches = 2 from public.season_standings where player_id = 'dddddddd-2400-4000-8000-000000000001'),
  'la foto de la temporada cerrada no cambia');

-- ---------- cierre automático (cron) ----------
set local role anon;
select pg_temp.ok(pg_temp.error('select public.season_close_due()') like 'permission denied%', 'anon no llama al cierre automático');
set local role authenticated;
select pg_temp.como('aaaaaaaa-2400-4000-8000-0000000000ad');
select pg_temp.ok(pg_temp.error('select public.season_close_due()') like 'permission denied%', 'ni un admin: solo el cron (service_role)');
set local role service_role;
select pg_temp.ok((select public.season_close_due()->>'reason') = 'not_due', 'antes de la fecha no cierra');
reset role;
insert into public.game_servers(id, name, token_hash) values ('cccccccc-2400-4000-8000-000000000001', 'srv24', 'x');
insert into public.live_matches(uid, server_id, seq, score_a, score_b, payload) values ('vivo24', 'cccccccc-2400-4000-8000-000000000001', 1, 3, 2, '{}');
update public.seasons set starts_at = now() - interval '2 hours', ends_at = now() - interval '1 hour' where number = 2;
set local role service_role;
select pg_temp.ok((select public.season_close_due()->>'reason') = 'live_match', 'con un mix en vivo espera');
reset role;
update public.live_matches set updated_at = now() - interval '11 minutes' where uid = 'vivo24';
set local role service_role;
select pg_temp.ok((select (public.season_close_due()->>'closed')::boolean), 'un mix en vivo sin novedades hace 10 minutos no frena el cierre');
reset role;
select pg_temp.ok((select status = 'closed' and closed_by is null from public.seasons where number = 2), 'la cierra el cron (closed_by null)');
select pg_temp.ok((select status = 'active' from public.seasons where number = 3), 'y abre la temporada 3');
select pg_temp.ok(not exists (select 1 from public.player_medals m join public.seasons s on s.id = m.season_id where s.number = 2),
  'sin nadie con el mínimo no hay medallas');

update public.live_matches set updated_at = now() where uid = 'vivo24';
update public.seasons set starts_at = now() - interval '8 hours', ends_at = now() - interval '7 hours' where number = 3;
set local role service_role;
select pg_temp.ok((select (public.season_close_due()->>'closed')::boolean), 'pasadas 6 horas cierra aunque haya un mix en vivo');
reset role;

-- ---------- configuración ----------
set local role authenticated;
select pg_temp.como('aaaaaaaa-2400-4000-8000-000000000001');
select pg_temp.ok(pg_temp.error($q$select public.set_season_config(30, 20, 20, 10, 2001, '[{"from":1,"name":"x","icon":"x"}]')$q$) like 'Solo un admin%',
  'un usuario común no cambia la configuración');
select pg_temp.como('aaaaaaaa-2400-4000-8000-0000000000ad');
select pg_temp.ok(pg_temp.error($q$select public.set_season_config(0, 20, 20, 10, 2001, '[{"from":1,"name":"x","icon":"x"}]')$q$) like 'La duración%',
  'la duración va de 1 a 365 días');
select public.set_season_config(60, 10, 5, 20, 2001, '[{"from":1,"name":"Top {top}","icon":"⭐"}]');
select pg_temp.ok((select duration_days = 60 and top_n = 10 and min_matches = 5 and reset_pct = 20 and updated_by = 'aaaaaaaa-2400-4000-8000-0000000000ad'
                     from public.season_config), 'set_season_config guarda los valores');
reset role;

rollback;
