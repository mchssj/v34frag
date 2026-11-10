-- Pruebas de la 109. Las corre probar_109.sh: replanteo, pruebas e inversa en una transacción que se deshace.
\set ON_ERROR_STOP 1
begin;
create temp table antes as select p.oid::regprocedure::text fn, pg_get_functiondef(p.oid) def from pg_proc p
  where p.oid in ('public.mm_set_config(jsonb)'::regprocedure, 'public.csstv_mm_poll(text,text,text)'::regprocedure,
                  'public.csstv_mm_report(text,uuid,text,text)'::regprocedure);
\i :r109

create function pg_temp.campo(poll text, k text) returns text language sql as $$
  select substring(poll from '(?:^|\n)' || k || '=([^\n]*)') $$;

do $$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 10));
  p uuid[] := '{}';
  st text[] := '{}';
  srv uuid; v_match uuid; v_lobby uuid; v_player uuid; v_admin uuid;
  tok text := 'tok109-' || substr(md5(random()::text), 1, 12);
  i int;
begin
  -- 1. Valor por defecto: 90.
  if (select replace_min_away_s from mm_config) <> 90 then raise exception 'FALLA 1: el valor por defecto no es 90'; end if;
  raise notice 'ok 1: replace_min_away_s = 90 por defecto';

  update mm_config set replace_enabled = true, replace_min_rounds_left = 4, reconnect_minutes = 3 where id = 1;
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select z, z || '@prueba109.local', now(), now() - interval '30 days', 'authenticated', 'authenticated' from unnest(u) z;
  for i in 1 .. 10 loop
    st := st || (76561197960265728 + floor(random() * 1e9)::bigint)::text;
    insert into players (nick, user_id, steam_id) values ('r109_' || i, u[i], st[i]) returning id into v_player;
    p := p || v_player;
  end loop;
  insert into game_servers (name, token_hash, active, mm_enabled)
    values ('reemplazo109-' || substr(md5(random()::text), 1, 6), encode(sha256(convert_to(tok, 'UTF8')), 'hex'), true, true) returning id into srv;
  insert into matches (kind, status, best_of, side1_name, side2_name, server_id) values ('mm', 'live', 1, 'team_a', 'team_b', srv)
    returning id into v_match;
  insert into mm_lobbies (mode, status, match_id, server_id, map, password)
    values ('5v5', 'live', v_match, srv, 'de_dust2', 'pw109') returning id into v_lobby;
  insert into mm_lobby_players (lobby_id, user_id, player_id, team, elo, joined_at, accepted_at, connected_at)
    select v_lobby, u[n], p[n], case when n <= 5 then 1 else 2 end, 1000, now(), now(), now() from generate_series(1, 10) n;
  insert into live_matches (uid, server_id, seq, map, score_a, score_b, max_rounds, payload, started_at)
    values ('live109-' || srv, srv, 1, 'de_dust2', 3, 2, 30, '{}', now());

  -- 2. El 6 se fue hace 30 s: no está en away y el voto no lo da por abandonado.
  update mm_lobby_players set left_at = now() - interval '30 seconds' where lobby_id = v_lobby and user_id = u[6];
  if pg_temp.campo(csstv_mm_poll(tok, '2.10.0'), 'away') <> '' then
    raise exception 'FALLA 2a: away = %', pg_temp.campo(csstv_mm_poll(tok, '2.10.0'), 'away');
  end if;
  if csstv_mm_report(tok, v_lobby, 'callreplace', csstv_steam2(st[6])) then raise exception 'FALLA 2b: callreplace antes de 90 s'; end if;
  if (select abandoned from mm_lobby_players where lobby_id = v_lobby and user_id = u[6]) then raise exception 'FALLA 2c: quedó abandonado'; end if;
  raise notice 'ok 2: a los 30 s no aparece ni se puede reemplazar';

  -- 3. Se fue hace 95 s: aparece en away y el voto lo da por abandonado, con el reemplazo abierto.
  update mm_lobby_players set left_at = now() - interval '95 seconds' where lobby_id = v_lobby and user_id = u[6];
  if pg_temp.campo(csstv_mm_poll(tok, '2.10.0'), 'away') <> csstv_steam2(st[6]) || '|2|' || (select left(nick, 24) from players where id = p[6]) then
    raise exception 'FALLA 3a: away = %', pg_temp.campo(csstv_mm_poll(tok, '2.10.0'), 'away');
  end if;
  if not csstv_mm_report(tok, v_lobby, 'callreplace', csstv_steam2(st[6])) then raise exception 'FALLA 3b: callreplace a los 95 s'; end if;
  if not (select abandoned from mm_lobby_players where lobby_id = v_lobby and user_id = u[6])
     or not exists (select 1 from mm_replacements where lobby_id = v_lobby and replaced_user_id = u[6] and source = 'vote') then
    raise exception 'FALLA 3c: no quedó abandonado con su reemplazo';
  end if;
  raise notice 'ok 3: a los 95 s aparece y el voto lo reemplaza';

  -- 4. Un admin lo pone en 0 con mm_set_config: el 1 (equipo 1), que se fue recién, ya aparece. Fuera de rango falla.
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    values (gen_random_uuid(), 'admin@prueba109.local', now(), now(), 'authenticated', 'authenticated') returning id into v_admin;
  update profiles set role = 'admin' where id = v_admin;
  if not found then raise exception 'PREPARACIÓN: el admin no tiene perfil'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform mm_set_config('{"replace_min_away_s": 0}');
  if (select replace_min_away_s from mm_config) <> 0 then raise exception 'FALLA 4a: mm_set_config no lo guardó'; end if;
  begin
    perform mm_set_config('{"replace_min_away_s": 601}');
    raise exception 'FALLA 4b: aceptó 601';
  exception when check_violation then null;
  end;
  perform set_config('request.jwt.claims', '', true);
  update mm_lobby_players set left_at = now() where lobby_id = v_lobby and user_id = u[1];
  if pg_temp.campo(csstv_mm_poll(tok, '2.10.0'), 'away') <> csstv_steam2(st[1]) || '|1|' || (select left(nick, 24) from players where id = p[1]) then
    raise exception 'FALLA 4c: away = %', pg_temp.campo(csstv_mm_poll(tok, '2.10.0'), 'away');
  end if;
  raise notice 'ok 4: mm_set_config lo cambia (0 a 600) y se usa al instante';
end $$;

-- 5. La inversa deja las tres funciones como antes y saca la columna.
\i :rev109
do $$
begin
  if exists (select 1 from antes a where a.def <> pg_get_functiondef(a.fn::regprocedure)) then
    raise exception 'FALLA 5a: la inversa no deja igual: %', (select string_agg(fn, ', ') from antes a where a.def <> pg_get_functiondef(a.fn::regprocedure));
  end if;
  if exists (select 1 from information_schema.columns where table_name = 'mm_config' and column_name = 'replace_min_away_s') then
    raise exception 'FALLA 5b: quedó la columna';
  end if;
  raise notice 'ok 5: la inversa deja todo igual';
end $$;
rollback;
