-- Pruebas de supabase/replanteo/35_notificaciones_programadas.sql (correr con la migración aplicada). Todo con rollback.
-- La base local puede tener datos de producción que también vencen: se mira solo a las cuentas de la prueba.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.error(q text) returns text language plpgsql as $$
begin
  execute q;
  return null;
exception when others then return sqlerrm;
end $$;
create function pg_temp.u(n int) returns uuid language sql immutable as $$ select ('aaaaaaaa-3500-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.f(n int) returns uuid language sql immutable as $$ select ('dddddddd-3500-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.s(n int) returns text language sql immutable as $$ select '7656119835' || lpad(n::text, 7, '0') $$;
create function pg_temp.t(n int) returns uuid language sql immutable as $$ select ('bbbbbbbb-3500-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.m(n int) returns uuid language sql immutable as $$ select ('cccccccc-3500-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
-- Cuántas notificaciones de ese tipo tiene la cuenta n.
create function pg_temp.n(u int, t text) returns int language sql as $$
  select count(*)::int from public.notifications where user_id = pg_temp.u(u) and type = t $$;
-- Un mix terminado en la temporada, con el ELO ya calculado: el bando 1 (a) le gana al bando 2 (b).
create function pg_temp.mix(id uuid, a int, b int) returns void language sql as $$
  insert into public.matches(id, kind, status, map, score1, score2, winner_side, played_at)
  values (id, 'mix', 'finished', 'de_dust2', 16, 10, 1, now() - interval '2 days');
  insert into public.match_player_stats(match_id, steam_id, team, nick, rounds, rating, elo_after) values
    (id, pg_temp.s(a), 1, 'n' || a, 26, 1, 1010), (id, pg_temp.s(b), 2, 'n' || b, 26, 1, 990) $$;
grant execute on function pg_temp.ok(boolean, text), pg_temp.error(text) to authenticated;

-- Cuentas: 1 admin, 2 a 7 jugadores con ficha, 8 organizador.
insert into auth.users (id, email, raw_user_meta_data, encrypted_password)
select pg_temp.u(n), format('n35-%s@test.local', n), format('{"tag":"Not35_%s"}', n)::jsonb, 'x' from generate_series(1, 8) n;
update public.profiles set role = 'admin' where id = pg_temp.u(1);
update public.profiles set role = 'organizer' where id = pg_temp.u(8);
insert into public.players(id, nick, steam_id, user_id)
select pg_temp.f(n), 'Not35_' || n, pg_temp.s(n), pg_temp.u(n) from generate_series(2, 7) n;
insert into public.player_elo(steam_id, elo, peak_elo, matches)
select pg_temp.s(n), 1000, 1000, 0 from generate_series(2, 7) n on conflict (steam_id) do nothing;

-- Equipos: A (2 y 3) y B (4) de torneo; las dos de una PCW (5 y 6).
insert into public.teams(id, name, tag, kind, owner_id, captain_id) values
  (pg_temp.t(1), 'Alfa35', 'A35', 'official', pg_temp.u(2), pg_temp.u(2)),
  (pg_temp.t(2), 'Beta35', 'B35', 'official', pg_temp.u(4), pg_temp.u(4)),
  (pg_temp.t(3), 'Pick35a', 'P1', 'pcw', pg_temp.u(5), pg_temp.u(5)),
  (pg_temp.t(4), 'Pick35b', 'P2', 'pcw', pg_temp.u(6), pg_temp.u(6));
insert into public.team_members(team_id, player_id, joined_at) values
  (pg_temp.t(1), pg_temp.f(2), now()), (pg_temp.t(1), pg_temp.f(3), now()), (pg_temp.t(2), pg_temp.f(4), now()),
  (pg_temp.t(3), pg_temp.f(5), now()), (pg_temp.t(4), pg_temp.f(6), now());
insert into public.events(id, name, organizer_id) values ('eeeeeeee-3500-4000-8000-000000000001', 'Copa35', pg_temp.u(8));

-- Partidas: 1 en 30 min, 2 en 2 horas (fuera de la ventana), 3 hace 4 horas sin resultado, 4 hace 8 días sin resultado,
-- 5 hace 4 horas pero terminada, 6 PCW en 45 min.
insert into public.matches(id, kind, status, team1, team2, best_of, event_id, starts_at) values
  (pg_temp.m(1), 'official', 'upcoming', pg_temp.t(1), pg_temp.t(2), 1, 'eeeeeeee-3500-4000-8000-000000000001', now() + interval '30 minutes'),
  (pg_temp.m(2), 'official', 'upcoming', pg_temp.t(1), pg_temp.t(2), 1, 'eeeeeeee-3500-4000-8000-000000000001', now() + interval '2 hours'),
  (pg_temp.m(3), 'official', 'live',     pg_temp.t(1), pg_temp.t(2), 1, 'eeeeeeee-3500-4000-8000-000000000001', now() - interval '4 hours'),
  (pg_temp.m(4), 'official', 'upcoming', pg_temp.t(1), pg_temp.t(2), 1, 'eeeeeeee-3500-4000-8000-000000000001', now() - interval '8 days'),
  (pg_temp.m(5), 'official', 'finished', pg_temp.t(1), pg_temp.t(2), 1, 'eeeeeeee-3500-4000-8000-000000000001', now() - interval '4 hours'),
  (pg_temp.m(6), 'pcw',      'upcoming', pg_temp.t(3), pg_temp.t(4), 1, null, now() + interval '45 minutes');

-- Anuncios de PCW (uno abierto por equipo): el de la cuenta 5 venció hace 1 hora; el de la 6 todavía no llegó.
insert into public.pcw_posts(id, team_id, by_user, best_of, starts_at, status) values
  ('ffffffff-3500-4000-8000-000000000001', pg_temp.t(3), pg_temp.u(5), 3, now() - interval '1 hour', 'open'),
  ('ffffffff-3500-4000-8000-000000000002', pg_temp.t(4), pg_temp.u(6), 1, now() + interval '1 hour', 'open');

-- Temporada que termina en 12 horas, con 4 mixes como mínimo (la mitad: 2). La activa de la base local se cierra adentro
-- de la transacción. Mixes: la ficha 4 juega 4 (entra al ranking), la 2 juega 2 (la mitad), la 3 y la 5 juegan 1.
update public.seasons set status = 'closed', closed_at = now() where status = 'active';
insert into public.seasons(id, number, name, starts_at, ends_at, top_n, min_matches, reset_pct, reset_floor, tiers)
select '99999999-3500-4000-8000-000000000001', (select coalesce(max(number), 0) + 1 from public.seasons), 'Temporada 35',
       now() - interval '10 days', now() + interval '12 hours', 20, 4, 10, 2001, tiers
  from public.season_config;
select pg_temp.mix(pg_temp.m(11), 2, 4), pg_temp.mix(pg_temp.m(12), 2, 4), pg_temp.mix(pg_temp.m(13), 4, 3), pg_temp.mix(pg_temp.m(14), 4, 5);

-- VIP: el 6 vence en 2 días; el 7 también, pero tiene otro período que lo continúa; el 3 es lifetime; el 2 vence en
-- 2 días pero está revocado; el 4 vence en 5 días.
insert into public.vip_memberships(user_id, starts_at, ends_at, source, revoked_at) values
  (pg_temp.u(6), now() - interval '1 month', now() + interval '2 days', 'manual', null),
  (pg_temp.u(7), now() - interval '1 month', now() + interval '2 days', 'manual', null),
  (pg_temp.u(7), now() + interval '2 days', now() + interval '32 days', 'manual', null),
  (pg_temp.u(3), now() - interval '1 month', null, 'manual', null),
  (pg_temp.u(2), now() - interval '1 month', now() + interval '2 days', 'manual', now()),
  (pg_temp.u(4), now() - interval '1 month', now() + interval '5 days', 'manual', null);

-- La cuenta 3 apagó Torneos. Un aviso viejo de la tabla se tiene que borrar.
insert into public.user_preferences(user_id, preferences) values (pg_temp.u(3), '{"notifications":{"tournament":false}}')
  on conflict (user_id) do update set preferences = excluded.preferences;
insert into public.notification_sent(kind, ref, sent_at) values ('match_soon', 'match_soon:viejo35', now() - interval '61 days');
delete from public.notifications where user_id in (select pg_temp.u(n) from generate_series(1, 8) n);

-- =====================================================================================================
-- Permisos
-- =====================================================================================================
set local role authenticated;
select pg_temp.ok(pg_temp.error('select public.notify_due()') like 'permission denied%', 'un usuario no corre notify_due');
select pg_temp.ok(pg_temp.error('select * from public.notification_sent') like 'permission denied%', 'ni lee notification_sent');
reset role;

-- =====================================================================================================
-- Primera corrida
-- =====================================================================================================
create temp table r1 as select public.notify_due() as r;
select pg_temp.ok((select (r ->> 'match_soon')::int >= 1 and (r ->> 'pcw_soon')::int >= 1 from r1), 'devuelve cuántos mandó de cada tipo');

-- Partida en 1 hora.
select pg_temp.ok(pg_temp.n(2, 'match_soon') = 1 and pg_temp.n(4, 'match_soon') = 1, 'partida en 30 min: a los dos equipos');
select pg_temp.ok(pg_temp.n(3, 'match_soon') = 0, 'no a quien apagó Torneos');
select pg_temp.ok((select data -> 'team1' ->> 'name' = 'Alfa35' and data -> 'event' ->> 'name' = 'Copa35'
                     from public.notifications where user_id = pg_temp.u(2) and type = 'match_soon'), 'con los equipos y el torneo');
select pg_temp.ok(not exists (select 1 from public.notification_sent where ref like 'match_soon:' || pg_temp.m(2) || ':%'),
  'la de dentro de 2 horas todavía no');
select pg_temp.ok((select category from public.notifications where user_id = pg_temp.u(2) and type = 'match_soon') = 'tournament',
  'categoría Torneos');

-- PCW en 1 hora.
select pg_temp.ok(pg_temp.n(5, 'pcw_soon') = 1 and pg_temp.n(6, 'pcw_soon') = 1, 'PCW en 45 min: a los dos rosters');
select pg_temp.ok(pg_temp.n(2, 'pcw_soon') = 0, 'no a otros');

-- PCW vencida sin rival.
select pg_temp.ok(pg_temp.n(5, 'pcw_expired') = 1, 'anuncio vencido: a quien lo publicó');
select pg_temp.ok((select data ->> 'post_id' from public.notifications where user_id = pg_temp.u(5) and type = 'pcw_expired')
                  = 'ffffffff-3500-4000-8000-000000000001' and pg_temp.n(6, 'pcw_expired') = 0, 'solo el que ya venció');

-- Temporada por terminar.
select pg_temp.ok(pg_temp.n(4, 'season_ending') = 1 and pg_temp.n(2, 'season_ending') = 1, 'temporada: a quien jugó la mitad de los mixes o más');
select pg_temp.ok(pg_temp.n(3, 'season_ending') = 0 and pg_temp.n(5, 'season_ending') = 0, 'no a quien jugó menos');
select pg_temp.ok((select (data ->> 'matches')::int = 4 and (data ->> 'min_matches')::int = 4 and data ->> 'position' is not null
                          and data -> 'season' ->> 'name' = 'Temporada 35'
                     from public.notifications where user_id = pg_temp.u(4) and type = 'season_ending'), 'el que entra: con su puesto');
select pg_temp.ok((select (data ->> 'matches')::int = 2 and data -> 'position' = 'null'::jsonb
                     from public.notifications where user_id = pg_temp.u(2) and type = 'season_ending'), 'el que no entra: sin puesto');

-- Partida sin resultado.
select pg_temp.ok(pg_temp.n(1, 'match_no_result') = 1 and pg_temp.n(8, 'match_no_result') = 1,
  'partida sin resultado a las 4 horas: al admin y al organizador');
select pg_temp.ok(pg_temp.n(2, 'match_no_result') = 0, 'no a los jugadores');
select pg_temp.ok((select data ->> 'match_id' from public.notifications where user_id = pg_temp.u(8) and type = 'match_no_result')
                  = pg_temp.m(3)::text, 'ni la de hace 8 días ni la terminada');
update public.profiles set role = 'user' where id = pg_temp.u(8);
update public.matches set starts_at = now() - interval '5 hours' where id = pg_temp.m(3);
select public.notify_due();
select pg_temp.ok(pg_temp.n(8, 'match_no_result') = 1, 'si deja de ser organizador, no le llega');
update public.profiles set role = 'organizer' where id = pg_temp.u(8);

-- VIP por vencer.
select pg_temp.ok(pg_temp.n(6, 'vip_expiring') = 1, 'VIP que vence en 2 días: avisa');
select pg_temp.ok(pg_temp.n(7, 'vip_expiring') = 0, 'no si otro período lo continúa');
select pg_temp.ok(pg_temp.n(3, 'vip_expiring') = 0 and pg_temp.n(2, 'vip_expiring') = 0 and pg_temp.n(4, 'vip_expiring') = 0,
  'ni lifetime, ni revocado, ni el que vence en 5 días');

-- Limpieza de la tabla.
select pg_temp.ok(not exists (select 1 from public.notification_sent where ref = 'match_soon:viejo35'), 'se borran los de más de 60 días');

-- =====================================================================================================
-- Sin repetir
-- =====================================================================================================
select public.notify_due();
select pg_temp.ok(pg_temp.n(2, 'match_soon') = 1 and pg_temp.n(5, 'pcw_soon') = 1 and pg_temp.n(5, 'pcw_expired') = 1
                  and pg_temp.n(4, 'season_ending') = 1 and pg_temp.n(1, 'match_no_result') = 2 and pg_temp.n(6, 'vip_expiring') = 1,
  'una segunda corrida no repite nada');

-- Reprogramar avisa de nuevo para la hora nueva.
update public.matches set starts_at = now() + interval '40 minutes' where id = pg_temp.m(1);
select public.notify_due();
select pg_temp.ok(pg_temp.n(2, 'match_soon') = 2, 'reprogramada: avisa otra vez');

-- Prender Torneos después no trae el aviso que ya se mandó.
delete from public.user_preferences where user_id = pg_temp.u(3);
select public.notify_due();
select pg_temp.ok(pg_temp.n(3, 'match_soon') = 0, 'prender la categoría no trae los viejos');

-- La partida de dentro de 2 horas entra cuando le falta menos de 1 hora.
update public.matches set starts_at = now() + interval '50 minutes' where id = pg_temp.m(2);
select public.notify_due();
select pg_temp.ok(pg_temp.n(4, 'match_soon') = 3, 'la otra partida entra a su hora');

rollback;
