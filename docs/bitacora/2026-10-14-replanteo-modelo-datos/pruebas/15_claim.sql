-- Pruebas de supabase/replanteo/15_claim.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '{"role":"anon"}'
         else format('{"sub":"%s","role":"authenticated"}', u) end, true) $$;
grant execute on function pg_temp.como(text) to anon, authenticated;
create function pg_temp.s(n int) returns text language sql immutable as $$ select '7656119815' || lpad(n::text, 7, '0') $$;
grant execute on function pg_temp.s(int) to anon, authenticated;
create table pg_temp.t(k text primary key, v text);
grant all on pg_temp.t to anon, authenticated;

-- Admin y cuatro cuentas: U1 sin ficha, U2 con ficha sin SteamID, U3 sin ficha, U4 sin ficha.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-1500-4000-8000-0000000000ad', 'admin15@test.local', '{"tag":"Admin15"}'),
  ('aaaaaaaa-1500-4000-8000-000000000001', 'u1-15@test.local', '{"tag":"Uno15"}'),
  ('aaaaaaaa-1500-4000-8000-000000000002', 'u2-15@test.local', '{"tag":"Dos15"}'),
  ('aaaaaaaa-1500-4000-8000-000000000003', 'u3-15@test.local', '{"tag":"Tres15"}'),
  ('aaaaaaaa-1500-4000-8000-000000000004', 'u4-15@test.local', '{"tag":"Cuatro15"}');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-1500-4000-8000-0000000000ad';
insert into public.players(id, nick, user_id) values ('dddddddd-1500-4000-8000-000000000002', 'x', 'aaaaaaaa-1500-4000-8000-000000000002');
-- Una ficha cargada por un admin, sin cuenta, con el SteamID 30.
insert into public.players(id, nick, steam_id) values ('dddddddd-1500-4000-8000-000000000030', 'Admin cargó', pg_temp.s(30));

-- Dos mixes 16-10 con 10 SteamID nuevos cada uno (1 a 10 y 11 a 20); en los dos gana el bando 1.
insert into public.matches(id, kind, status, map, score1, score2, winner_side, played_at) values
  ('cccccccc-1500-4000-8000-000000000001', 'mix', 'finished', 'de_dust2', 16, 10, 1, now() - interval '2 days'),
  ('cccccccc-1500-4000-8000-000000000002', 'mix', 'finished', 'de_inferno', 16, 10, 1, now() - interval '1 day');
insert into public.match_player_stats(match_id, steam_id, team, nick, rounds, rating)
  select 'cccccccc-1500-4000-8000-000000000001'::uuid, pg_temp.s(i), case when i <= 5 then 1 else 2 end, 'J15n' || i, 26, 1 from generate_series(1, 10) i
  union all
  select 'cccccccc-1500-4000-8000-000000000002'::uuid, pg_temp.s(i), case when i <= 15 then 1 else 2 end, 'J15n' || i, 26, 1 from generate_series(11, 20) i;

set local role authenticated;
select pg_temp.como('aaaaaaaa-1500-4000-8000-0000000000ad');
select public.elo_recompute_all();
insert into pg_temp.t select 'srv', (select token from public.admin_create_server('Server 15'));

-- Código para una cuenta (como esa cuenta).
create function pg_temp.codigo(u text) returns text language plpgsql as $$
declare r record;
begin
  -- Los códigos anteriores pasan a ser de hace más de una hora (el tope de 5 por hora se prueba aparte).
  update public.claim_codes set created_at = created_at - interval '2 hours' where user_id = u::uuid;
  perform pg_temp.como(u);
  select * into r from public.create_claim_code();
  perform pg_temp.como('aaaaaaaa-1500-4000-8000-0000000000ad');
  return r.code;
end $$;
grant execute on function pg_temp.codigo(text) to authenticated;
-- !claim como el plugin (sin sesión, con el token del servidor).
create function pg_temp.claim(steam text, code text) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform pg_temp.como(null);
  r := public.claim_with_code((select v from pg_temp.t where k = 'srv'), steam, code, 'NickJuego');
  perform pg_temp.como('aaaaaaaa-1500-4000-8000-0000000000ad');
  return r;
end $$;
grant execute on function pg_temp.claim(text, text) to authenticated;

-- El flujo corre como superusuario con la sesión simulada (is_admin y auth.uid leen los claims);
-- los permisos se prueban al final con los roles reales.
reset role;
do $$
declare
  u1 constant uuid := 'aaaaaaaa-1500-4000-8000-000000000001';
  u2 constant uuid := 'aaaaaaaa-1500-4000-8000-000000000002';
  u4 constant uuid := 'aaaaaaaa-1500-4000-8000-000000000004';
  c text; r jsonb; f1 uuid; req bigint;
begin
  -- Perfil sin reclamar.
  assert (select last_nick = 'J15n1' and matches = 1 and elo = 1030 and nicks = '{J15n1}' from public.steam_profile_list where steam_id = pg_temp.s(1)), 'perfil sin reclamar';
  assert (select wins = 1 from public.steam_profile_stats where steam_id = pg_temp.s(1)), 'stats sin reclamar';
  assert (select count(*) = 1 from public.steam_profile_matches where steam_id = pg_temp.s(1)), 'historial sin reclamar';
  assert not exists (select 1 from public.steam_profile_list where steam_id = pg_temp.s(30)), 'una ficha no es perfil sin reclamar';

  -- Código: 6 caracteres sin confusos; los anteriores vencen.
  c := pg_temp.codigo(u1::text);
  assert c ~ '^[A-HJKMNP-Z2-9]{6}$', c;
  assert pg_temp.claim(pg_temp.s(1), pg_temp.codigo(u1::text)) ->> 'ok' = 'true', 'cuenta sin ficha + SteamID con historial';
  r := pg_temp.claim(pg_temp.s(1), c);
  assert r ->> 'message' like 'Código inválido o vencido%', format('código anterior: %s', r);

  -- La ficha creada: alias, SteamID principal e historial.
  select id into f1 from public.players where user_id = u1;
  assert (select nick = 'Uno15' and steam_id = pg_temp.s(1) from public.players where id = f1), 'ficha creada';
  assert (select player_id = f1 from public.match_player_stats where steam_id = pg_temp.s(1)), 'historial pasado';
  assert not exists (select 1 from public.steam_profile_list where steam_id = pg_temp.s(1)), 'dejó de ser sin reclamar';
  assert (select ok and result = 'Listo: tu cuenta quedó vinculada' and player_id = f1 from public.claim_log where steam_id = pg_temp.s(1) and ok order by id desc limit 1), 'registro';

  -- El mismo SteamID otra vez; otro SteamID que compartió partida (queda pendiente, pero no se puede aprobar).
  assert pg_temp.claim(pg_temp.s(1), pg_temp.codigo(u1::text)) ->> 'message' = 'Tu cuenta ya está vinculada a este SteamID', 'ya vinculado';
  r := pg_temp.claim(pg_temp.s(2), pg_temp.codigo(u1::text));
  assert (r ->> 'pending')::boolean and r ->> 'message' = 'Pedido enviado: un admin lo tiene que aprobar', format('pedido: %s', r);
  assert pg_temp.claim(pg_temp.s(2), pg_temp.codigo(u1::text)) ->> 'message' = 'Ya pediste este SteamID: falta que lo apruebe un admin', 'ya pedido';
  assert exists (select 1 from public.steam_profile_list where steam_id = pg_temp.s(2)), 'un pedido pendiente sigue sin reclamar';
  assert pg_temp.claim(pg_temp.s(2), pg_temp.codigo(u4::text)) ->> 'message' = 'Ese SteamID tiene un pedido pendiente de otra cuenta', 'reservado';
  select id into req from public.steam_requests where steam_id = pg_temp.s(2);
  begin
    perform public.approve_steam_request(req);
    raise exception 'aprobó un SteamID que compartió partida';
  exception when raise_exception then
    assert sqlerrm like 'Ese SteamID jugó una partida junto a otro SteamID de la ficha%', sqlerrm;
  end;
  perform public.reject_steam_request(req, 'Es otra persona');
  assert (select status = 'rejected' and reason = 'Es otra persona' from public.steam_requests where id = req), 'rechazo';

  -- Otra cuenta con un SteamID ajeno; una ficha de admin sin cuenta pasa a la cuenta.
  assert pg_temp.claim(pg_temp.s(1), pg_temp.codigo(u4::text)) ->> 'message' = 'Ese SteamID pertenece a otra cuenta', 'de otra cuenta';
  assert pg_temp.claim(pg_temp.s(30), pg_temp.codigo(u4::text)) ->> 'ok' = 'true', 'ficha de admin';
  assert (select user_id = u4 from public.players where id = 'dddddddd-1500-4000-8000-000000000030'), 'ficha de admin asignada';
  -- Cuenta con ficha sin SteamID; cuenta sin ficha y SteamID que nunca jugó (ficha vacía).
  assert pg_temp.claim(pg_temp.s(3), pg_temp.codigo(u2::text)) ->> 'ok' = 'true', 'ficha sin SteamID';
  assert (select steam_id = pg_temp.s(3) from public.players where id = 'dddddddd-1500-4000-8000-000000000002'), 'SteamID principal asignado';
  assert pg_temp.claim(pg_temp.s(99), pg_temp.codigo('aaaaaaaa-1500-4000-8000-000000000003')) ->> 'ok' = 'true', 'nunca jugó';
  assert (select steam_id = pg_temp.s(99) and nick = 'Tres15' from public.players where user_id = 'aaaaaaaa-1500-4000-8000-000000000003'), 'ficha vacía';

  -- SteamID adicional sin partidas compartidas: al aprobarlo el ELO se une (un solo ELO por ficha).
  r := pg_temp.claim(pg_temp.s(11), pg_temp.codigo(u1::text));
  assert (r ->> 'pending')::boolean, format('pedido 11: %s', r);
  select id into req from public.steam_requests where steam_id = pg_temp.s(11) and status = 'pending';
  assert (select not shares_match and player_steam_count = 1 from public.admin_steam_requests where id = req), 'vista de solicitudes';
  perform public.approve_steam_request(req);
  assert (select player_id = f1 from public.player_extra_steam_ids where steam_id = pg_temp.s(11)), 'adicional';
  assert (select player_id = f1 from public.match_player_stats where steam_id = pg_temp.s(11)), 'historial del adicional';
  assert not exists (select 1 from public.player_elo where steam_id = pg_temp.s(11)), 'el adicional no tiene ELO propio';
  assert (select matches = 2 and elo > 1030 and elo < 1060 from public.player_elo where steam_id = pg_temp.s(1)), 'ELO unido';
  assert (select elo_matches = 2 from public.player_overview where id = f1), 'la ficha muestra el ELO unido';
  assert public.elo_key(pg_temp.s(11)) = pg_temp.s(1) and public.steam_owner(pg_temp.s(11)) = f1, 'clave y dueño';

  -- Tope configurable.
  perform public.set_claim_config(2);
  assert pg_temp.claim(pg_temp.s(12), pg_temp.codigo(u1::text)) ->> 'message' = 'Llegaste al máximo de SteamID: pedíselo a un admin', 'tope';
  begin
    perform public.set_claim_config(5);
    raise exception 'aceptó un tope de 5';
  exception when raise_exception then null;
  end;
  perform public.set_claim_config(3);

  -- Cambiar el principal y quitar un SteamID (el ELO se recalcula).
  perform public.admin_set_primary_steam(pg_temp.s(11));
  assert (select steam_id = pg_temp.s(11) from public.players where id = f1), 'principal nuevo';
  assert exists (select 1 from public.player_extra_steam_ids where steam_id = pg_temp.s(1) and player_id = f1), 'el viejo pasa a adicional';
  assert (select matches = 2 from public.player_elo where steam_id = pg_temp.s(11)), 'ELO con la clave nueva';
  perform public.admin_remove_steam(pg_temp.s(1));
  assert (select player_id is null from public.match_player_stats where steam_id = pg_temp.s(1)), 'historial liberado';
  assert exists (select 1 from public.steam_profile_list where steam_id = pg_temp.s(1)), 'vuelve a ser sin reclamar';
  assert (select matches = 1 from public.player_elo where steam_id = pg_temp.s(11)) and (select matches = 1 from public.player_elo where steam_id = pg_temp.s(1)), 'ELO separado';

  -- Un SteamID en una sola ficha.
  begin
    insert into public.player_extra_steam_ids(steam_id, player_id) values (pg_temp.s(3), f1);
    raise exception 'un principal como adicional de otra';
  exception when unique_violation then null;
  end;
  begin
    perform public.link_steam_id(pg_temp.s(3), f1);
    raise exception 'el admin vinculó un SteamID ajeno';
  exception when unique_violation then null;
  end;
  -- El admin agrega directo (sin tope de solicitudes), hasta 4.
  perform public.link_steam_id(pg_temp.s(12), f1);
  assert exists (select 1 from public.player_extra_steam_ids where steam_id = pg_temp.s(12) and player_id = f1), 'link del admin agrega';

  -- Vencimiento a los 30 días.
  insert into public.steam_requests(player_id, steam_id, created_at) values (f1, pg_temp.s(50), now() - interval '31 days');
  assert public.steam_requests_expire() >= 1, 'vencimiento';
  assert (select status = 'expired' from public.steam_requests where steam_id = pg_temp.s(50)), 'vencida';

  -- !match manda todos los SteamID; la ingesta usa el dueño de cualquiera.
  assert position('player_steam_all' in pg_get_functiondef('public.csstv_match_lookup(text, text)'::regprocedure)) > 0, '!match';
  assert position('steam_owner(v_s64)' in pg_get_functiondef('public.csstv_ingest(uuid, jsonb)'::regprocedure)) > 0, 'ingesta';
end $$;

-- !match de punta a punta: un torneo con un jugador que tiene dos SteamID. La lista del plantel que recibe
-- el plugin trae los dos (en formato STEAM_0) y no trae un SteamID con pedido pendiente.
insert into public.teams(id, name, tag, kind)
  select ('eeeeeeee-1500-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'M15e' || i, 'M' || i, 'official' from generate_series(1, 4) i;
insert into public.players(id, nick, steam_id)
  select ('dddddddd-1500-4000-8000-0000000' || lpad((i * 10 + j)::text, 5, '0'))::uuid, 'M15e' || i || 'p' || j, pg_temp.s(200 + i * 10 + j)
    from generate_series(1, 4) i, generate_series(1, 5) j;
insert into public.team_members(team_id, player_id, joined_at)
  select ('eeeeeeee-1500-4000-8000-' || lpad(i::text, 12, '0'))::uuid, ('dddddddd-1500-4000-8000-0000000' || lpad((i * 10 + j)::text, 5, '0'))::uuid, now()
    from generate_series(1, 4) i, generate_series(1, 5) j;
insert into public.events(id, name, template, config) values ('ffffffff-1500-4000-8000-000000000001', 'Copa 15', 'groups', '{"groups":1,"advance":1}');
insert into public.tournament_registrations(event_id, team_id)
  select 'ffffffff-1500-4000-8000-000000000001', ('eeeeeeee-1500-4000-8000-' || lpad(i::text, 12, '0'))::uuid from generate_series(1, 4) i;
insert into public.tournament_registration_players(event_id, team_id, player_id)
  select 'ffffffff-1500-4000-8000-000000000001', ('eeeeeeee-1500-4000-8000-' || lpad(i::text, 12, '0'))::uuid, ('dddddddd-1500-4000-8000-0000000' || lpad((i * 10 + j)::text, 5, '0'))::uuid
    from generate_series(1, 4) i, generate_series(1, 5) j;
select pg_temp.como('aaaaaaaa-1500-4000-8000-0000000000ad');
select public.event_generate('ffffffff-1500-4000-8000-000000000001');
select set_config('v34.engine', '', true);

do $$
declare
  p11 constant uuid := 'dddddddd-1500-4000-8000-000000000011';   -- equipo 1, jugador 1
  p12 constant uuid := 'dddddddd-1500-4000-8000-000000000012';   -- equipo 1, jugador 2
  m   record;
  txt text;
  mio text;
begin
  perform pg_temp.como('aaaaaaaa-1500-4000-8000-0000000000ad');
  perform public.link_steam_id(pg_temp.s(500), p11);                  -- adicional aprobado (vínculo del admin)
  insert into public.steam_requests(player_id, steam_id) values (p12, pg_temp.s(501));   -- adicional pendiente
  select id, link_code, case when team1 = 'eeeeeeee-1500-4000-8000-000000000001' then 't1' else 't2' end as lado into m
    from public.matches
   where event_id = 'ffffffff-1500-4000-8000-000000000001' and 'eeeeeeee-1500-4000-8000-000000000001' in (team1, team2)
   order by round, pos limit 1;
  assert m.link_code is not null, 'la partida del torneo no tiene código';

  perform pg_temp.como(null);
  txt := public.csstv_match_lookup((select v from pg_temp.t where k = 'srv'), m.link_code);
  perform pg_temp.como('aaaaaaaa-1500-4000-8000-0000000000ad');
  assert txt like 'ok=1%', txt;
  select substr(l, length(m.lado) + 2) into mio from regexp_split_to_table(txt, E'\n') l where l like m.lado || '=%';
  assert (',' || mio || ',') like '%,' || public.csstv_steam2(pg_temp.s(211)) || ',%', format('falta el principal: %s', mio);
  assert (',' || mio || ',') like '%,' || public.csstv_steam2(pg_temp.s(500)) || ',%', format('falta el adicional: %s', mio);
  assert (',' || mio || ',') not like '%,' || public.csstv_steam2(pg_temp.s(501)) || ',%', format('trae el pendiente: %s', mio);
  assert array_length(string_to_array(mio, ','), 1) = 6, format('el plantel de 5 con un adicional son 6 SteamID: %s', mio);
end $$;

-- Tope de 5 códigos por hora.
do $$
declare i int;
begin
  perform pg_temp.como('aaaaaaaa-1500-4000-8000-000000000003');
  delete from public.claim_codes where user_id = 'aaaaaaaa-1500-4000-8000-000000000003';
  for i in 1 .. 5 loop perform public.create_claim_code(); end loop;
  begin
    perform public.create_claim_code();
    raise exception 'generó 6 códigos en una hora';
  exception when raise_exception then
    assert sqlerrm = 'Generaste 5 códigos en la última hora: esperá un rato', sqlerrm;
  end;
  assert (select count(*) from public.claim_codes where user_id = 'aaaaaaaa-1500-4000-8000-000000000003' and expires_at > now()) = 1, 'solo el último vale';
end $$;

-- Servidor sin licencia, SteamID inválido y demasiados intentos.
do $$
declare r jsonb; i int;
begin
  perform pg_temp.como(null);
  r := public.claim_with_code('token-falso', pg_temp.s(60), 'AAAAAA');
  assert r ->> 'message' = 'Este servidor no tiene una licencia válida de CSSTV', format('%s', r);
  r := public.claim_with_code((select v from pg_temp.t where k = 'srv'), 'STEAM_ID_LAN', 'AAAAAA');
  assert r ->> 'message' = 'Tu SteamID no es válido: no se puede vincular', format('%s', r);
  for i in 1 .. 5 loop
    perform public.claim_with_code((select v from pg_temp.t where k = 'srv'), pg_temp.s(60), 'AAAAAA');
  end loop;
  r := public.claim_with_code((select v from pg_temp.t where k = 'srv'), pg_temp.s(60), 'AAAAAA');
  assert r ->> 'message' = 'Demasiados intentos: esperá unos minutos', format('%s', r);
  perform pg_temp.como('aaaaaaaa-1500-4000-8000-0000000000ad');
end $$;

-- Permisos: un usuario común no aprueba ni ve el registro; un anónimo no genera códigos.
set local role authenticated;
select pg_temp.como('aaaaaaaa-1500-4000-8000-000000000004');
do $$
begin
  begin
    perform public.approve_steam_request(1);
    raise exception 'un usuario común aprobó';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.admin_claim_log) = 0 and (select count(*) from public.admin_steam_requests) = 0, 'vistas de admin';
  assert (select count(*) from public.claim_log) = 0, 'registro';
  assert (select count(*) from public.steam_requests) = 0, 'solicitudes ajenas';
end $$;
reset role;
set local role anon;
select pg_temp.como(null);
do $$
begin
  begin
    perform public.create_claim_code();
    raise exception 'un anónimo generó un código';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.steam_profile_list) >= 1, 'anon lee perfiles sin reclamar';
  assert to_regclass('public.profile_requests') is null, 'reclamos viejos';
  raise notice '15: perfiles sin reclamar, !claim y varios SteamID OK';
end $$;
reset role;

rollback;
