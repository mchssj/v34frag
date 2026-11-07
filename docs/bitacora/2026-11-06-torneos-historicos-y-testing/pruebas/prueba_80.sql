-- Pruebas del replanteo 80. Las arma probar_80.sh: van entre el replanteo y su inversa, dentro de una transacción que
-- se deshace al final (no dejan nada en la base). Cada bloque corre con el rol que dice, con la RLS de verdad.

-- Ids de la prueba, para cualquier rol (la tabla y las funciones se deshacen con el rollback).
create table public.t80 (k text primary key, id uuid);
grant select, insert on public.t80 to anon, authenticated;
create function public.t80(p text) returns uuid language sql stable as $$ select id from public.t80 where k = p $$;
create function public.t80_como(p text) returns void language sql as $$
  select set_config('request.jwt.claims', case when p is null then '' else
         json_build_object('sub', public.t80(p), 'role', 'authenticated')::text end, true) $$;
grant execute on function public.t80(text), public.t80_como(text) to anon, authenticated;

do $$
declare k text; v uuid; i int;
begin
  -- Cuentas: admin, moderador, dos organizadores y dos jugadores (capitanes de los equipos A y B)
  foreach k in array array['admin', 'mod', 'org', 'org2', 'u1', 'u2'] loop
    v := gen_random_uuid();
    insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
      values (v, k || '-' || substr(v::text, 1, 6) || '@prueba80.local', now(), now(), 'authenticated', 'authenticated');
    update profiles set role = case k when 'admin' then 'admin' when 'mod' then 'moderator' when 'org' then 'organizer'
                                      when 'org2' then 'organizer' else 'user' end where id = v;
    insert into t80 values (k, v);
  end loop;
  for i in 1 .. 2 loop
    insert into players (nick, user_id, steam_id) values ('p80_' || i || substr(md5(random()::text), 1, 4), t80('u' || i),
                         (76561197960265728 + floor(random() * 1e9)::bigint)::text) returning id into v;
    insert into t80 values ('pl' || i, v);
  end loop;
  insert into teams (name, tag, kind, captain_id, owner_id)
    values ('Prueba80 A ' || substr(md5(random()::text), 1, 5), 'P7A', 'official', t80('u1'), t80('u1')) returning id into v;
  insert into t80 values ('teamA', v);
  insert into team_members (team_id, player_id, role) values (v, t80('pl1'), 'player');
  insert into teams (name, tag, kind, captain_id, owner_id)
    values ('Prueba80 B ' || substr(md5(random()::text), 1, 5), 'P7B', 'official', t80('u2'), t80('u2')) returning id into v;
  insert into t80 values ('teamB', v);
  insert into team_members (team_id, player_id, role) values (v, t80('pl2'), 'player');
  insert into game_servers (name, token_hash, active) values ('prueba80-' || substr(md5(random()::text), 1, 6), md5(random()::text), true)
    returning id into v;
  insert into t80 values ('srv', v);
  -- Dos mixes de hace 40 días (fuera de los 14 de un torneo normal)
  insert into matches (kind, status, best_of, side1_name, side2_name, server_id, map, score1, score2, played_at)
    values ('mix', 'finished', 1, 'a', 'b', t80('srv'), 'de_dust2', 16, 10, now() - interval '40 days') returning id into v;
  insert into t80 values ('mix1', v);
  insert into matches (kind, status, best_of, side1_name, side2_name, server_id, map, score1, score2, played_at)
    values ('mix', 'finished', 1, 'a', 'b', t80('srv'), 'de_inferno', 9, 16, now() - interval '41 days') returning id into v;
  insert into t80 values ('mix2', v);
  -- u1 recibe las novedades (event_new está apagado por defecto)
  insert into user_preferences (user_id, preferences) values (t80('u1'), '{"notifications": {"news": true}}')
    on conflict (user_id) do update set preferences = excluded.preferences;
  raise notice 'ok: datos de prueba';
end $$;

-- ===== 1. Crear =====
select t80_como('org'); set local role authenticated;
do $$
declare v uuid;
begin
  insert into events (name, starts_on) values ('T80 normal del organizador', current_date + 7) returning id into v;
  insert into t80 values ('evOrg', v);
  assert (select approval from events where id = v) = 'pending', 'el torneo de un organizador nace pendiente';
  begin
    insert into events (name, testing) values ('T80 testing del organizador', true);
    raise exception 'FALLA: un organizador marcó testing';
  exception when insufficient_privilege then null;
  end;
  insert into events (name, historic, starts_on, ends_on, config) values ('T80 histórico del organizador', true, '2025-07-12', '2025-07-20',
    '{"bo": 1, "bo_semi": 1, "bo_final": 1}') returning id into v;
  insert into t80 values ('evHist', v);
  assert (select approval from events where id = v) = 'pending', 'el histórico de un organizador nace pendiente';
  begin
    update events set approval = 'approved' where id = v;
    raise exception 'FALLA: el organizador se aprobó solo';
  exception when raise_exception then if sqlerrm like 'FALLA%' then raise; end if;
  end;
  begin
    insert into events (name, historic) values ('T80 histórico sin fechas', true);
    raise exception 'FALLA: histórico sin fechas';
  exception when raise_exception then if sqlerrm like 'FALLA%' then raise; end if;
  end;
  begin
    update events set historic = true where id = (select t80('evOrg'));
    raise exception 'FALLA: cambió el tipo';
  exception when raise_exception then if sqlerrm like 'FALLA%' then raise; end if;
  end;
  raise notice 'ok: organizador (nace pendiente, sin testing, no se aprueba solo, histórico con fechas, tipo fijo)';
end $$;
reset role;

select t80_como('mod'); set local role authenticated;
do $$
declare v uuid;
begin
  begin
    insert into events (name) values ('T80 normal del moderador');
    raise exception 'FALLA: un moderador creó un torneo normal';
  exception when insufficient_privilege then null;
  end;
  insert into events (name, historic, starts_on, ends_on) values ('T80 histórico del moderador', true, '2025-01-01', '2025-01-02')
    returning id into v;
  insert into t80 values ('evHistMod', v);
  assert (select approval from events where id = v) = 'approved', 'el histórico de un moderador nace aprobado';
  raise notice 'ok: moderador (solo históricos, aprobados)';
end $$;
reset role;

select t80_como('admin'); set local role authenticated;
do $$
declare v uuid;
begin
  insert into events (name, testing, organizer_id) values ('T80 testing', true, (select t80('org'))) returning id into v;
  insert into t80 values ('evTest', v);
  insert into events (name) values ('T80 público') returning id into v;
  insert into t80 values ('evPub', v);
  assert (select approval from events where id = v) = 'approved', 'lo del admin nace aprobado';
  raise notice 'ok: admin (testing y público)';
end $$;
reset role;

-- ===== 2. Avisos al crear =====
do $$
begin
  assert exists (select 1 from notifications where user_id = t80('mod') and type = 'admin_event_review' and data->'event'->>'id' = t80('evOrg')::text),
    'el moderador recibe el torneo por aprobar';
  assert not exists (select 1 from notifications where type = 'event_new' and data->'event'->>'id' in (t80('evOrg')::text, t80('evTest')::text, t80('evHist')::text)),
    'un torneo pendiente, en testing o histórico no se anuncia';
  assert exists (select 1 from notifications where user_id = t80('u1') and type = 'event_new' and data->'event'->>'id' = t80('evPub')::text),
    'el torneo público se anuncia';
  raise notice 'ok: avisos al crear';
end $$;

-- ===== 3. Quién ve qué =====
-- Partida de un torneo en testing (cargada a mano), para la RLS y el ranking
do $$
declare v uuid;
begin
  insert into matches (kind, status, best_of, event_id, team1, team2, winner_side, score1, score2, played_at)
    values ('official', 'finished', 1, t80('evTest'), t80('teamA'), t80('teamB'), 1, 1, 0, now()) returning id into v;
  insert into t80 values ('mTest', v);
end $$;

select t80_como('u1'); set local role authenticated;
do $$
begin
  assert (select count(*) from events where id in (t80('evOrg'), t80('evTest'), t80('evHist'), t80('evPub'), t80('evHistMod'))) = 2, 'el jugador ve solo los públicos';
  assert not exists (select 1 from matches where id = t80('mTest')), 'el jugador no ve la partida de testing';
  assert not exists (select 1 from event_list where id = t80('evTest')), 'event_list respeta la RLS';
  assert event_ref(t80('evTest')) is null, 'event_ref vacío para un torneo que no ve';
  assert not exists (select 1 from team_results where match_id = t80('mTest')), 'team_results respeta la RLS';
  raise notice 'ok: jugador';
end $$;
reset role;

select t80_como(null); set local role anon;
do $$
begin
  assert (select count(*) from events where id in (t80('evOrg'), t80('evTest'), t80('evHist'), t80('evPub'), t80('evHistMod'))) = 2, 'anónimo ve solo los públicos';
  raise notice 'ok: anónimo';
end $$;
reset role;

select t80_como('org'); set local role authenticated;
do $$
begin
  assert exists (select 1 from events where id = t80('evOrg')) and exists (select 1 from events where id = t80('evHist')), 'el organizador ve los suyos pendientes';
  assert not exists (select 1 from events where id = t80('evTest')), 'el organizador no ve un testing, aunque sea suyo';
  assert not can_manage_event(t80('evTest')), 'el organizador no gestiona un testing';
  assert can_manage_event(t80('evHist')), 'el organizador gestiona su histórico pendiente';
  raise notice 'ok: organizador dueño';
end $$;
reset role;

select t80_como('org2'); set local role authenticated;
do $$
begin
  assert not exists (select 1 from events where id = t80('evOrg')), 'otro organizador no ve el pendiente ajeno';
  raise notice 'ok: otro organizador';
end $$;
reset role;

select t80_como('mod'); set local role authenticated;
do $$
begin
  assert (select count(*) from events where id in (t80('evOrg'), t80('evTest'), t80('evHist'), t80('evPub'), t80('evHistMod'))) = 5, 'el moderador ve todos';
  assert exists (select 1 from matches where id = t80('mTest')), 'el moderador ve la partida de testing';
  raise notice 'ok: moderador';
end $$;
reset role;

-- ===== 4. Ranking: testing no suma =====
do $$
begin
  assert coalesce((select official_won from team_standings where team_id = t80('teamA')), 0) = 0, 'la partida de testing no suma';
  assert not match_rankable(t80('mTest')), 'match_rankable de testing';
  raise notice 'ok: testing fuera del ranking';
end $$;

-- ===== 5. Aprobar, rechazar y volver a enviar =====
select t80_como('org'); set local role authenticated;
do $$
begin
  begin
    perform event_review(t80('evOrg'), true);
    raise exception 'FALLA: el organizador aprobó';
  exception when insufficient_privilege then null;
  end;
  begin
    update events set testing = true where id = t80('evOrg');
    raise exception 'FALLA: el organizador cambió testing';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok: el organizador no aprueba ni cambia testing';
end $$;
reset role;

select t80_como('mod'); set local role authenticated;
do $$
begin
  begin
    perform event_review(t80('evOrg'), false, '  ');
    raise exception 'FALLA: rechazo sin motivo';
  exception when raise_exception then if sqlerrm like 'FALLA%' then raise; end if;
  end;
  perform event_review(t80('evOrg'), false, 'Falta el pool de mapas');
  assert (select approval from events where id = t80('evOrg')) = 'rejected';
  raise notice 'ok: rechazo con motivo';
end $$;
reset role;

select t80_como('org'); set local role authenticated;
do $$
begin
  assert exists (select 1 from events where id = t80('evOrg') and approval_note = 'Falta el pool de mapas'), 'el organizador ve el motivo';
  perform event_resubmit(t80('evOrg'));
  assert (select approval from events where id = t80('evOrg')) = 'pending';
  raise notice 'ok: volver a enviar';
end $$;
reset role;

do $$
begin
  assert exists (select 1 from notifications where user_id = t80('org') and type = 'event_reviewed' and not (data->>'approved')::boolean), 'aviso del rechazo';
  assert (select count(*) from notifications where user_id = t80('mod') and type = 'admin_event_review' and data->'event'->>'id' = t80('evOrg')::text) = 2,
    'el reenvío vuelve a avisar';
end $$;

select t80_como('mod'); set local role authenticated;
do $$
begin
  perform event_review(t80('evOrg'), true);
  assert (select approval from events where id = t80('evOrg')) = 'approved';
  raise notice 'ok: aprobado';
end $$;
reset role;

do $$
begin
  assert exists (select 1 from notifications where user_id = t80('u1') and type = 'event_new' and data->'event'->>'id' = t80('evOrg')::text),
    'al aprobarse se anuncia';
  raise notice 'ok: anuncio al aprobar';
end $$;

-- ===== 6. Torneo histórico del organizador =====
select t80_como('u1'); set local role authenticated;
do $$
begin
  begin
    perform event_register(t80('evHist'), t80('teamA'), array[t80('pl1')], '{}');
    raise exception 'FALLA: el capitán inscribió en un histórico';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok: el capitán no inscribe en un histórico';
end $$;
reset role;

select t80_como('org'); set local role authenticated;
do $$
declare v uuid; m1 uuid; m2 uuid; fin uuid;
begin
  perform event_register(t80('evHist'), t80('teamA'), array[t80('pl1')], '{}');   -- 1 jugador en un 5v5: vale
  perform event_register(t80('evHist'), t80('teamB'), '{}', '{}');                -- sin jugadores: vale
  v := event_create_historic_team(t80('evHist'), 'Los Lobos 80', 'LOB');
  insert into t80 values ('teamC', v);
  v := event_create_historic_team(t80('evHist'), 'Team Alfa 80', 'ALF');
  insert into t80 values ('teamD', v);
  assert (select kind from teams where id = t80('teamC')) = 'historic';
  assert exists (select 1 from historic_team_similar('lobos') where team_id = t80('teamC')), 'parecidos';
  perform historic_team_update(t80('teamC'), 'Los Lobos 80 FC', 'lob');
  assert (select name || '/' || tag from teams where id = t80('teamC')) = 'Los Lobos 80 FC/LOB', 'corregir un equipo histórico';
  perform historic_team_set_logo(t80('teamC'), 'https://x/logo.png');
  -- Siembra A, B, C, D: semis A–D y B–C
  update events set seeds = array[t80('teamA'), t80('teamB'), t80('teamC'), t80('teamD')] where id = t80('evHist');
  perform event_generate(t80('evHist'));
  select id into m1 from matches where event_id = t80('evHist') and not coalesce(bye, false) and t80('teamA') in (team1, team2) and round = 1;
  select id into m2 from matches where event_id = t80('evHist') and not coalesce(bye, false) and t80('teamB') in (team1, team2) and round = 1;
  insert into t80 values ('semi1', m1), ('semi2', m2);
  begin
    perform match_start(m1, t80('srv'));
    raise exception 'FALLA: un histórico se inició en el servidor';
  exception when raise_exception then if sqlerrm like 'FALLA%' then raise; end if;
  end;
  -- El mix de hace 40 días aparece como candidato (sin los 14 días ni inscritos)
  assert exists (select 1 from match_game_candidates(m1, p_server => t80('srv')) where game_id = t80('mix1')), 'candidato viejo en un histórico';
  assert (select total from match_game_candidates(m1, p_server => t80('srv')) limit 1) = 2, 'filtro por servidor';
  assert not exists (select 1 from match_game_candidates(m1, p_from => now() - interval '10 days', p_server => t80('srv'))), 'filtro por fecha';
  assert (select total from match_game_candidates(m1, p_map => 'dust', p_server => t80('srv')) limit 1) = 1, 'filtro por mapa';
  -- Semi 1: mix vinculado por el organizador (queda por aprobar). El equipo 1 es el bando 1 del mix (16-10).
  perform match_set_maps(m1, jsonb_build_array(jsonb_build_object('game_id', t80('mix1'),
          'side1', case when (select team1 from matches where id = m1) = t80('teamA') then 1 else 2 end)));
  assert (select parent_approved from matches where id = t80('mix1')) = false, 'el mix del organizador queda por aprobar';
  assert (select winner from matches where id = m1) = t80('teamA'), 'el marcador del mix ya cuenta en la llave';
  -- Semi 2: a mano, con fecha (C le gana a B)
  perform match_set_maps(m2, jsonb_build_array(jsonb_build_object('map', 'de_nuke',
          'r1', case when (select team1 from matches where id = m2) = t80('teamB') then 13 else 16 end,
          'r2', case when (select team1 from matches where id = m2) = t80('teamB') then 16 else 13 end, 'played_at', '2025-07-15')));
  assert (select played_at::date from matches where id = m2) = '2025-07-15', 'la fecha del mapa a mano';
  assert (select winner from matches where id = m2) = t80('teamC');
  -- Final A–C: el organizador vincula el otro mix con A en el bando 2 (A 16, C 9)
  select id into fin from matches where event_id = t80('evHist') and round = 2 and stage = 'ko' and team1 is not null and team2 is not null;
  insert into t80 values ('final', fin);
  perform match_set_maps(fin, jsonb_build_array(jsonb_build_object('game_id', t80('mix2'),
          'side1', case when (select team1 from matches where id = fin) = t80('teamA') then 2 else 1 end)));
  assert (select champion from events where id = t80('evHist')) = t80('teamA'), 'campeón A';
  assert (select status from events where id = t80('evHist')) = 'finished';
  raise notice 'ok: histórico armado por el organizador (equipos históricos, mixes viejos, fecha a mano, campeón)';
end $$;
reset role;

select t80_como('org2'); set local role authenticated;
do $$
begin
  begin
    perform historic_team_update(t80('teamC'), 'Otro nombre', 'OTR');
    raise exception 'FALLA: otro organizador corrigió el equipo histórico';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok: otro organizador no corrige el equipo histórico';
end $$;
reset role;

do $$
begin
  assert exists (select 1 from notifications where user_id = t80('mod') and type = 'admin_game_review'), 'aviso de mix por aprobar';
  assert not exists (select 1 from notifications where user_id in (t80('u1'), t80('u2')) and data->'event'->>'id' = t80('evHist')::text),
    'un histórico no avisa a los jugadores';
  assert coalesce((select official_won from team_standings where team_id = t80('teamA')), 0) = 0, 'pendiente: no suma';
  raise notice 'ok: histórico pendiente sin avisos ni ranking';
end $$;

select t80_como('u1'); set local role authenticated;
do $$
begin
  assert not exists (select 1 from player_titles where event_id = t80('evHist')), 'pendiente: el título no se ve';
end $$;
reset role;

-- El moderador rechaza el mix de la final (queda 16-9 a mano) y aprueba el torneo (aprueba el mix de la semi).
select t80_como('mod'); set local role authenticated;
do $$
begin
  perform match_review_game(t80('mix2'), false);
  assert (select parent_match_id from matches where id = t80('mix2')) is null, 'el mix rechazado se desvincula';
  assert (select maps->0->>'game_id' from matches where id = t80('final')) is null, 'el mapa queda a mano';
  assert (select (maps->0->>'r1')::int + (maps->0->>'r2')::int from matches where id = t80('final')) = 25, 'con el mismo marcador';
  assert (select champion from events where id = t80('evHist')) = t80('teamA'), 'la llave no cambia';
  perform event_review(t80('evHist'), true);
  assert (select parent_approved from matches where id = t80('mix1')), 'aprobar el torneo aprueba sus mixes';
  raise notice 'ok: rechazo del mix y aprobación del torneo';
end $$;
reset role;

do $$
begin
  assert (select official_won from team_standings where team_id = t80('teamA')) = 1, 'suma solo la serie con mix aprobado (la semi)';
  assert (select official_played from team_standings where team_id = t80('teamB')) = 0, 'la serie a mano no suma';
  assert match_rankable(t80('semi1')) and not match_rankable(t80('final')) and not match_rankable(t80('semi2'));
  assert exists (select 1 from notifications where user_id = t80('org') and type = 'game_reviewed' and not (data->>'approved')::boolean), 'aviso del mix rechazado';
  assert not exists (select 1 from notifications where type = 'event_new' and data->'event'->>'id' = t80('evHist')::text), 'el histórico no se anuncia al aprobarse';
  raise notice 'ok: ranking del histórico';
end $$;

select t80_como('u1'); set local role authenticated;
do $$
begin
  assert exists (select 1 from player_titles where event_id = t80('evHist') and player_id = t80('pl1') and result = 'champion'), 'aprobado: el título se ve';
  raise notice 'ok: título en el perfil';
end $$;
reset role;

-- ===== 7. Un histórico del moderador: lo que vincula el staff queda aprobado; W.O. con fecha =====
select t80_como('mod'); set local role authenticated;
do $$
declare m uuid;
begin
  perform event_register(t80('evHistMod'), t80('teamA'), '{}', '{}');
  perform event_register(t80('evHistMod'), t80('teamB'), '{}', '{}');
  perform event_generate(t80('evHistMod'));
  select id into m from matches where event_id = t80('evHistMod') and not coalesce(bye, false) limit 1;
  perform event_set_result(m, null, t80('teamB'));
  assert (select played_at::date from matches where id = m) = '2025-01-01', 'el W.O. de un histórico toma el comienzo';
  perform match_set_played_at(m, '2025-01-02');
  assert (select played_at::date from matches where id = m) = '2025-01-02', 'fecha del W.O.';
  assert not match_rankable(m), 'un W.O. de un histórico no suma';
  raise notice 'ok: histórico del moderador';
end $$;
reset role;

-- ===== 8. Sacar de testing: se anuncia y el organizador vuelve a verlo =====
select t80_como('mod'); set local role authenticated;
update events set testing = false where id = t80('evTest');
reset role;
do $$
begin
  assert exists (select 1 from notifications where user_id = t80('u1') and type = 'event_new' and data->'event'->>'id' = t80('evTest')::text),
    'al sacarlo de testing se anuncia';
  assert match_rankable(t80('mTest')), 'fuera de testing suma';
  raise notice 'ok: sacar de testing';
end $$;
select t80_como('org'); set local role authenticated;
do $$ begin assert can_manage_event(t80('evTest')), 'el organizador lo vuelve a gestionar'; end $$;
reset role;

do $$ begin raise notice 'ok: todas las pruebas del replanteo 80'; end $$;
drop function public.t80_como(text);
drop function public.t80(text);
drop table public.t80;
