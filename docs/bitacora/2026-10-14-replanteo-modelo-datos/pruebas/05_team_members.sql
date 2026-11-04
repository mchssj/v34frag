-- Pruebas de supabase/replanteo/05_team_members.sql (correr con la migración aplicada). Todo con rollback.
begin;

-- Dos usuarios con jugador vinculado y un tercer jugador sin cuenta.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000051', 'capi05@test.local'),
  ('aaaaaaaa-0000-4000-8000-000000000052', 'rival05@test.local');
insert into public.players (id, nick, user_id) values
  ('dddddddd-0000-4000-8000-000000000051', 'Capi05', 'aaaaaaaa-0000-4000-8000-000000000051'),
  ('dddddddd-0000-4000-8000-000000000052', 'Rival05', 'aaaaaaaa-0000-4000-8000-000000000052'),
  ('dddddddd-0000-4000-8000-000000000053', 'Suelto05', null);

do $$
begin
  assert to_regclass('public.team_members') is not null, 'falta team_members';
  assert not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'teams' and column_name = 'members'),
    'teams.members sigue existiendo';
  assert not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and prosrc ~* '\mmembers\M'),
    'hay funciones que usan teams.members';

  -- Un jugador activo una sola vez por equipo; puede volver después de irse.
  insert into public.teams (id, name, kind) values ('eeeeeeee-0000-4000-8000-000000000051', 'Equipo 05', 'official');
  insert into public.team_members (team_id, player_id, joined_at) values ('eeeeeeee-0000-4000-8000-000000000051', 'dddddddd-0000-4000-8000-000000000053', now() - interval '10 days');
  begin
    insert into public.team_members (team_id, player_id) values ('eeeeeeee-0000-4000-8000-000000000051', 'dddddddd-0000-4000-8000-000000000053');
    assert false, 'un jugador quedó activo dos veces en el mismo equipo';
  exception when unique_violation then null;
  end;
  update public.team_members set left_at = now() where player_id = 'dddddddd-0000-4000-8000-000000000053';
  insert into public.team_members (team_id, player_id, joined_at) values ('eeeeeeee-0000-4000-8000-000000000051', 'dddddddd-0000-4000-8000-000000000053', now());
  begin
    insert into public.team_members (team_id, player_id, joined_at, left_at)
      values ('eeeeeeee-0000-4000-8000-000000000051', 'dddddddd-0000-4000-8000-000000000051', now(), now() - interval '1 day');
    assert false, 'se aceptó una baja anterior al alta';
  exception when check_violation then null;
  end;
  begin
    insert into public.team_members (team_id, player_id, role) values ('eeeeeeee-0000-4000-8000-000000000051', 'dddddddd-0000-4000-8000-000000000051', 'dt');
    assert false, 'se aceptó un rol inválido';
  exception when check_violation then null;
  end;
end $$;

-- PCW: publicar arma el roster en team_members; aceptar con un jugador repetido falla.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000051","role":"authenticated"}', true);
select public.create_pcw_post('Los Capis', 1, 'dust2', now() + interval '1 day', null,
                              array['dddddddd-0000-4000-8000-000000000051'::uuid, 'dddddddd-0000-4000-8000-000000000053'::uuid], array['InvitadoX']);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000052","role":"authenticated"}', true);
do $$
declare post uuid := (select id from public.pcw_posts where by_user = 'aaaaaaaa-0000-4000-8000-000000000051' and status = 'open');
        t uuid := (select team_id from public.pcw_posts where by_user = 'aaaaaaaa-0000-4000-8000-000000000051' and status = 'open');
        mid uuid;
begin
  assert (select count(*) from public.team_members where team_id = t and left_at is null) = 2, 'el roster de la PCW no está en team_members';
  assert (select guests from public.teams where id = t) = array['InvitadoX'], 'se perdieron los invitados de la PCW';
  begin
    perform public.accept_pcw(post, 'Rivales', array['dddddddd-0000-4000-8000-000000000053'::uuid], '{}');
    assert false, 'se aceptó una PCW con un jugador en los dos rosters';
  exception when others then
    assert sqlerrm like 'Hay jugadores que están en los dos rosters%', sqlerrm;
  end;
  mid := public.accept_pcw(post, 'Rivales', array['dddddddd-0000-4000-8000-000000000052'::uuid], '{}');
  assert (select kind from public.matches where id = mid) = 'pcw', 'no se creó la partida PCW';
end $$;

-- Capitán: solo puede pasarle la capitanía a alguien del plantel actual.
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000051","role":"authenticated"}', true);
do $$
declare t uuid := (select team_id from public.pcw_posts where by_user = 'aaaaaaaa-0000-4000-8000-000000000051');
begin
  begin
    perform public.set_team_captain(t, 'aaaaaaaa-0000-4000-8000-000000000052');
    assert false, 'se pasó la capitanía a alguien de otro equipo';
  exception when others then
    assert sqlerrm like 'El nuevo capitán tiene que ser%', sqlerrm;
  end;
end $$;
reset role;

-- Reporte de resultado: la alineación tiene que salir del plantel actual (validate_report).
do $$
declare t uuid := (select team_id from public.pcw_posts where by_user = 'aaaaaaaa-0000-4000-8000-000000000051');
        mid uuid := (select match_id from public.pcw_posts where by_user = 'aaaaaaaa-0000-4000-8000-000000000051');
begin
  insert into public.result_reports (match_id, team_id, by_user, maps, lineup)
    values (mid, t, 'aaaaaaaa-0000-4000-8000-000000000051', '[{"map":"dust2","r1":16,"r2":10}]', array['dddddddd-0000-4000-8000-000000000051'::uuid]);
  begin
    update public.result_reports set lineup = array['dddddddd-0000-4000-8000-000000000052'::uuid] where match_id = mid and team_id = t;
    assert false, 'se aceptó una alineación con un jugador de otro equipo';
  exception when others then
    assert sqlerrm like 'La alineación solo puede tener jugadores del plantel%', sqlerrm;
  end;
  raise notice 'replanteo 05: ok';
end $$;

rollback;
