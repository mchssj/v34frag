-- Pruebas de supabase/replanteo/23_whois.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.s(n int) returns text language sql immutable as $$ select '7656119823' || lpad(n::text, 7, '0') $$;
create function pg_temp.w(p_steam text, p_query text default null) returns jsonb language sql as $$
  select public.csstv_whois('token-whois-23', p_steam, p_query) $$;
-- Mensaje del error de una sentencia, o null si no falla.
create function pg_temp.error(q text) returns text language plpgsql as $$
begin
  execute q;
  return null;
exception when others then return sqlerrm;
end $$;

-- Servidor con su token; una cuenta con ficha (principal 1, adicional 2) y SteamID sueltos (3, 4) y un bot.
insert into public.game_servers(name, token_hash) values ('Server 23', encode(sha256(convert_to('token-whois-23', 'UTF8')), 'hex'));
insert into auth.users (id, email, raw_user_meta_data) values ('aaaaaaaa-2300-4000-8000-000000000001', 'u1-23@test.local', '{"tag":"Alias23"}');
insert into public.players(id, nick, user_id, steam_id, privacy) values
  ('dddddddd-2300-4000-8000-000000000001', 'Ficha23', 'aaaaaaaa-2300-4000-8000-000000000001', pg_temp.s(1), 'private');
insert into public.player_extra_steam_ids(steam_id, player_id, added_at) values (pg_temp.s(2), 'dddddddd-2300-4000-8000-000000000001', '2026-01-02');
insert into public.matches(id, kind, status, map, score1, score2, winner_side, played_at, cancel_reason) values
  ('cccccccc-2300-4000-8000-000000000001', 'mix', 'finished', 'de_dust2', 16, 10, 1, now() - interval '5 days', null),
  ('cccccccc-2300-4000-8000-000000000002', 'mix', 'finished', 'de_dust2', 16, 10, 1, now() - interval '4 days', null),
  ('cccccccc-2300-4000-8000-000000000003', 'mix', 'cancelled', 'de_dust2', 3, 2, null, now() - interval '3 days', 'admin'),
  ('cccccccc-2300-4000-8000-000000000004', 'mix', 'finished', 'de_dust2', 16, 10, 1, now() - interval '2 days', null);
insert into public.match_player_stats(match_id, steam_id, team, nick, rounds) values
  ('cccccccc-2300-4000-8000-000000000001', pg_temp.s(1), 1, 'viejo23', 26),
  ('cccccccc-2300-4000-8000-000000000002', pg_temp.s(2), 1, 'nuevo23', 26),
  ('cccccccc-2300-4000-8000-000000000003', pg_temp.s(3), 1, 'suelto23a', 5),
  ('cccccccc-2300-4000-8000-000000000003', pg_temp.s(4), 2, 'suelto23b', 5),
  ('cccccccc-2300-4000-8000-000000000003', 'BOT', 2, 'suelto23bot', 5),
  ('cccccccc-2300-4000-8000-000000000004', pg_temp.s(1), 1, 'comun23y', 26),
  ('cccccccc-2300-4000-8000-000000000004', pg_temp.s(4), 2, 'otro23', 26);
insert into public.match_player_stats(match_id, steam_id, team, nick, rounds) values
  ('cccccccc-2300-4000-8000-000000000003', pg_temp.s(2), 1, 'comun23x', 5);

-- ---------- token y formato ----------
select pg_temp.ok(pg_temp.error($q$select public.csstv_whois('token-falso', '76561198230000001')$q$) like 'Token de servidor inválido%',
  'sin token válido no responde');
select pg_temp.ok(public.csstv_steam0(public.csstv_steam64('STEAM_0:1:12345')) = 'STEAM_0:1:12345', 'csstv_steam0 es la inversa de csstv_steam64');
select pg_temp.ok(public.csstv_steam0('BOT') is null, 'csstv_steam0 de algo que no es SteamID64 es null');
select pg_temp.ok((select (r->>'ok')::boolean = false and r->>'message' = 'SteamID inválido' from pg_temp.w('abc') r), 'SteamID inválido');

-- ---------- por SteamID: todos los SteamID de la ficha ----------
select pg_temp.ok((select r @> jsonb_build_object(
    'ok', true, 'multiple', false, 'steam_id', public.csstv_steam0(pg_temp.s(2)), 'steam_count', 2,
    'nicks', 'comun23y, comun23x, nuevo23, viejo23', 'nick_count', 4, 'matches', 4,
    'player_id', 'dddddddd-2300-4000-8000-000000000001', 'player_nick', 'Ficha23', 'alias', 'Alias23')
  from pg_temp.w(public.csstv_steam0(pg_temp.s(2))) r),
  'por STEAM_0 del adicional: nicks y partidas de toda la ficha (privada igual), ficha y alias');
select pg_temp.ok((select r->>'last_played' = to_char((now() - interval '2 days') at time zone 'America/Bogota', 'YYYY-MM-DD') from pg_temp.w(pg_temp.s(1)) r),
  'última partida en fecha de Colombia');
select pg_temp.ok((select r @> '{"ok": true, "nicks": "otro23, suelto23b", "nick_count": 2, "matches": 2, "steam_count": 1}'
                      and r->'player_id' = 'null'::jsonb and r->'alias' = 'null'::jsonb
                     from pg_temp.w(pg_temp.s(4)) r),
  'sin ficha: sus nicks (también de una partida cancelada) y player_id null');
select pg_temp.ok((select r @> '{"ok": true, "nicks": "", "nick_count": 0, "matches": 0}' from pg_temp.w(pg_temp.s(9)) r),
  'un SteamID que nunca jugó');

-- ---------- por texto ----------
select pg_temp.ok((select r @> '{"ok": true, "multiple": false, "player_nick": "Ficha23"}' from pg_temp.w(null, 'VIEJO23') r),
  'por un nick viejo, sin distinguir mayúsculas');
select pg_temp.ok((select r @> '{"ok": true, "player_nick": "Ficha23"}' from pg_temp.w(null, 'alias23') r), 'por el alias de la cuenta');
select pg_temp.ok((select r @> '{"ok": true, "player_nick": "Ficha23"}' from pg_temp.w(null, 'ficha2') r), 'por el nick de la ficha');
select pg_temp.ok((select r @> '{"ok": true, "multiple": false, "player_nick": "Ficha23"}' from pg_temp.w(null, 'comun23') r),
  'dos SteamID de la misma ficha son un solo candidato');
select pg_temp.ok((select r @> '{"ok": true, "multiple": true, "total": 2}'
                      and r->>'candidates' = 'suelto23a (' || public.csstv_steam0(pg_temp.s(3)) || '), otro23 (' || public.csstv_steam0(pg_temp.s(4)) || ')'
                     from pg_temp.w(null, 'suelto23') r),
  'varios: por fecha (y SteamID si empatan), cada uno con su último nick y SteamID, sin el bot');
select pg_temp.ok((select (r->>'ok')::boolean = false and r->>'message' like 'Nadie jugó con un nombre parecido a "nadie23zz"' from pg_temp.w(null, 'nadie23zz') r),
  'nadie parecido');
select pg_temp.ok((select (r->>'ok')::boolean = false from pg_temp.w(null, '%%') r), '% no es un comodín');
select pg_temp.ok((select r->>'message' = 'Escribí entre 2 y 32 caracteres del nombre' from pg_temp.w(null, 'x') r), 'texto muy corto');
select pg_temp.ok((select r->>'message' = 'Escribí entre 2 y 32 caracteres del nombre' from pg_temp.w('', repeat('x', 33)) r), 'texto muy largo (y SteamID vacío)');

-- ---------- permisos ----------
select pg_temp.ok(has_function_privilege('anon', 'public.csstv_whois(text, text, text)', 'execute'), 'el plugin la llama con la anon key');

rollback;
