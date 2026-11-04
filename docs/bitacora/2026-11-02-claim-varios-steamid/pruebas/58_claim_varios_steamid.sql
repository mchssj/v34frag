-- Pruebas del replanteo 58 (!claim de un SteamID nuevo al instante y plantel del matchmaking con todos los SteamID).
-- Se corren con correr_local.sh, dentro de una transacción que se deshace al final: no dejan nada en la base.

create or replace function pg_temp.como(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '' else json_build_object('sub', u, 'role', 'authenticated')::text end, true) $$;
create or replace function pg_temp.codigo(u uuid) returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.como(u);
  select code into v from create_claim_code();
  perform pg_temp.como(null);
  return v;
end $$;

do $$
declare
  u uuid := gen_random_uuid();
  u_adm uuid := gen_random_uuid();
  p uuid;
  srv uuid;
  tok text := 'tok58-' || substr(md5(random()::text), 1, 12);
  s1 text := (76561197960265728 + floor(random() * 1e9)::bigint)::text;
  s2 text := (76561197960265728 + floor(random() * 1e9)::bigint)::text;
  s3 text := (76561197960265728 + floor(random() * 1e9)::bigint)::text;
  v_lobby uuid; v_match uuid;
  r jsonb;
  v_poll text;
  ok int := 0;
begin
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select x, x || '@prueba.local', now(), now() - interval '30 days', 'authenticated', 'authenticated' from unnest(array[u, u_adm]) x;
  update profiles set role = 'admin' where id = u_adm;
  insert into players (nick, user_id, steam_id) values ('c58' || substr(md5(random()::text), 1, 8), u, s1) returning id into p;
  insert into game_servers (name, token_hash, active, mm_enabled)
    values ('claim58-' || substr(md5(random()::text), 1, 6), encode(sha256(convert_to(tok, 'UTF8')), 'hex'), true, true) returning id into srv;
  update claim_config set max_steam_ids = 2 where id = 1;

  -- 1. Segundo SteamID: se suma al instante, sin pedido pendiente, con aviso a los admins.
  r := claim_with_code(tok, csstv_steam2(s2), pg_temp.codigo(u), 'otraPC');
  if (r->>'ok')::boolean is distinct from true or (r->>'pending')::boolean or r->>'message' <> 'Listo: sumamos este SteamID a tu ficha' then
    raise exception 'FALLA 1a: %', r;
  end if;
  if not exists (select 1 from player_extra_steam_ids where player_id = p and steam_id = s2) then raise exception 'FALLA 1b: no se sumó'; end if;
  if exists (select 1 from steam_requests where steam_id = s2 and status = 'pending') then raise exception 'FALLA 1c: quedó un pedido pendiente'; end if;
  if not exists (select 1 from notifications where user_id = u_adm and type = 'admin_steam_linked' and data->>'steam_id' = s2) then
    raise exception 'FALLA 1d: no se avisó a los admins';
  end if;
  if notification_category('admin_steam_linked') <> 'admin' then raise exception 'FALLA 1e: categoría'; end if;
  if not exists (select 1 from notifications where user_id = u and type = 'steam_claimed') then raise exception 'FALLA 1f: no se avisó a la cuenta'; end if;
  ok := ok + 6;

  -- 2. Con el máximo (2), el tercero sigue siendo cosa del admin.
  r := claim_with_code(tok, csstv_steam2(s3), pg_temp.codigo(u), 'terceraPC');
  if (r->>'ok')::boolean or r->>'message' not like 'Llegaste al máximo%' then raise exception 'FALLA 2: %', r; end if;
  ok := ok + 1;

  -- 3. El plantel de una sala del matchmaking trae los dos SteamID, y "connected" reconoce el nuevo.
  insert into matches (kind, status, best_of, side1_name, side2_name, server_id) values ('mm', 'upcoming', 1, 'team_a', 'team_b', srv)
    returning id into v_match;
  insert into mm_lobbies (mode, status, match_id, server_id, map, password, connect_deadline)
    values ('5v5', 'connecting', v_match, srv, 'de_dust2', 'pw5858', now() + interval '5 minutes') returning id into v_lobby;
  insert into mm_lobby_players (lobby_id, user_id, player_id, team, elo, joined_at, accepted_at) values (v_lobby, u, p, 1, 1000, now(), now());
  v_poll := csstv_mm_poll(tok, '2.9.1');
  if position(csstv_steam2(s1) in v_poll) = 0 or position(csstv_steam2(s2) in v_poll) = 0 then raise exception 'FALLA 3a: el plantel no trae los dos: %', v_poll; end if;
  if v_poll !~ E'(^|\n)unlinked=0(\n|$)' then raise exception 'FALLA 3b: unlinked: %', v_poll; end if;
  if not csstv_mm_report(tok, v_lobby, 'connected', csstv_steam2(s2)) then raise exception 'FALLA 3c: connected no reconoce el SteamID nuevo'; end if;
  if (select connected_at from mm_lobby_players where lobby_id = v_lobby and user_id = u) is null then raise exception 'FALLA 3d: no quedó conectado'; end if;
  ok := ok + 4;

  raise notice 'OK: % comprobaciones del replanteo 58', ok;
end $$;
