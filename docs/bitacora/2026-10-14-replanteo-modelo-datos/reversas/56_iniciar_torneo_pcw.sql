-- Inversa del replanteo 56 (iniciar partidas de torneo y PCW): deja el matchmaking como en la 55.
-- Borra las reservas y las sanciones de PCW. Avisar antes: una serie en curso deja de tener servidor reservado.
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 56: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- Funciones de antes, sin las reservas.
select pg_temp.reemplazar('public.mm_tick()', array[
  [E'\n' || '  -- (replanteo 56) el mismo candado que "Iniciar" y la fila de PCW: nadie más elige servidor mientras corre.' || E'\n' ||
   '  perform server_alloc_lock();', ''],
  ['  -- (replanteo 56) reservas de torneos y PCW: plazos, fila y servidores caídos.' || E'\n' ||
   '  perform booking_tick();' || E'\n\n', '']
]);
select pg_temp.reemplazar('public.veto_act(uuid, text, text)', array[
  [E'\n' || '    perform booking_after_veto(p_match);   -- (replanteo 56) reloj del veto y reserva', '']
]);
select pg_temp.reemplazar('public.csstv_mm_report(text, uuid, text, text)', array[
  ['  -- (replanteo 56) una reserva de torneo o PCW' || E'\n' ||
   '  if exists (select 1 from match_bookings where id = p_lobby) then' || E'\n' ||
   '    return booking_report(v_server, p_lobby, p_event, p_data);' || E'\n' ||
   '  end if;' || E'\n', '']
]);
select pg_temp.reemplazar('public.csstv_match_lookup(text, text)', array[
  [E'
' || '  v_srv  uuid;   -- (replanteo 56)', ''],
  ['    v_srv := csstv_auth(p_token);', '    perform csstv_auth(p_token);'],
  [E'
' || '  -- (replanteo 56) reservada desde la web para otro servidor' || E'
' ||
   '  if exists (select 1 from match_bookings b where b.match_id = m.id and b.server_id is distinct from v_srv' || E'
' ||
   '               and b.status not in (''finished'', ''abandoned'', ''cancelled'')) then' || E'
' ||
   '    return ''ok=0'' || linea || ''error=Esa partida está reservada desde la web para otro servidor'';' || E'
' ||
   '  end if;', '']
]);
select pg_temp.reemplazar('public.csstv_mm_password(text, text, text, text, uuid)', array[
  ['(select id from mm_lobbies where id = p_lobby)', 'p_lobby']
]);
select pg_temp.reemplazar('public.mm_admin_lists(text, text)', array[
  ['''mm_enabled'', s.mm_enabled, ''official_enabled'', s.official_enabled, ''pcw_enabled'', s.pcw_enabled,', '''mm_enabled'', s.mm_enabled,'],
  ['then ''lobby''' || E'\n' ||
   '                      when exists (select 1 from match_bookings b where b.server_id = s.id and b.status not in (''finished'', ''abandoned'', ''cancelled'')) then ''booking'' else ''free'' end,',
   'then ''lobby'' else ''free'' end,']
]);

create or replace function public.mm_free_server(p_regions text[]) returns uuid
  language sql stable as $$
  select s.id from game_servers s join mm_server_state st on st.server_id = s.id
   where s.mm_enabled and s.active and (s.license_expires_at is null or s.license_expires_at > now())
     and st.last_poll_at > now() - interval '30 seconds'
     and (st.unavailable_until is null or st.unavailable_until < now())
     and not exists (select 1 from mm_lobbies l where l.server_id = s.id and l.status not in ('finished', 'cancelled'))
   order by (select count(*) from unnest(p_regions) r where r = s.region) desc,
            (select max(l.ended_at) from mm_lobbies l where l.server_id = s.id) nulls first
   limit 1 $$;

create or replace function public.notification_category(p_type text) returns text language sql immutable as $$
  select case
    when p_type in ('team_invite', 'team_join_request', 'team_invite_answered', 'team_join_answered', 'team_captain', 'team_removed',
                    'team_member_left', 'team_role_changed', 'team_added', 'team_deleted', 'team_request_answered',
                    'team_dissolved') then 'team' -- (replanteo 39) team_dissolved
    when p_type in ('event_registration', 'event_fixture', 'match_scheduled', 'veto_turn', 'veto_done', 'veto_reset',
                    'match_result', 'event_progress', 'event_cancelled', 'event_lineup', 'match_soon') then 'tournament' -- (replanteo 35) match_soon
    when p_type in ('pcw_accepted', 'pcw_cancelled', 'pcw_result', 'pcw_soon', 'pcw_expired') then 'pcw' -- (replanteo 35) pcw_soon y pcw_expired
    when p_type in ('level_changed', 'mix_review_resolved', 'mix_deleted', 'elo_adjusted', 'clip_ready') then 'elo'
    when p_type in ('season_ranked', 'season_closed', 'medal_granted', 'season_ending') then 'season' -- (replanteo 35) season_ending
    when p_type in ('steam_claimed', 'steam_request_answered', 'alias_changed', 'role_changed', 'password_changed',
                    'vip_granted', 'vip_revoked', 'vip_expiring',
                    'streamer_granted', 'streamer_revoked') then 'account' -- (replanteo 36) streamer_granted y streamer_revoked
    when p_type in ('event_new', 'season_started') then 'news'
    when p_type in ('admin_steam_request', 'admin_team_request', 'admin_mix_review', 'admin_demo_failed', 'admin_season_delayed',
                    'match_no_result') then 'admin' -- (replanteo 35) match_no_result
  end $$;

-- El poll de dos parámetros, como en la 49.
drop function public.csstv_mm_poll(text, text, text);
create function public.csstv_mm_poll(p_token text, p_version text default null) returns text
  language plpgsql security definer set search_path = public as $$
declare
  v_server uuid;
  l mm_lobbies%rowtype;
  m matches%rowtype;
  pw mm_server_passwords%rowtype;
  linea text := E'\n';
begin
  begin
    v_server := csstv_auth(p_token);
  exception when others then
    return 'ok=0' || linea || 'error=' || sqlerrm;
  end;
  insert into mm_server_state (server_id, last_poll_at, plugin_version) values (v_server, now(), p_version)
    on conflict (server_id) do update set last_poll_at = now(), plugin_version = coalesce(excluded.plugin_version, mm_server_state.plugin_version);
  select * into l from mm_lobbies where server_id = v_server and status in ('assigned', 'connecting', 'live') order by created_at desc limit 1;
  if l.id is null then
    -- Rotación pedida por un admin, pendiente de aplicar.
    select * into pw from mm_server_passwords where server_id = v_server and kind = 'idle' and applied_at is null order by created_at desc limit 1;
    return concat_ws(linea, 'ok=1', 'lobby=', case when pw.id is not null then 'idle_id=' || pw.id end, case when pw.id is not null then 'idle_password=' || pw.password end);
  end if;
  select * into m from matches where id = l.match_id;
  return concat_ws(linea, 'ok=1', 'lobby=' || l.id, 'status=' || l.status, 'map=' || l.map, 'password=' || l.password, 'code=' || m.link_code,
    'team1=' || translate(m.side1_name, E'\r\n', '  '), 'team2=' || translate(m.side2_name, E'\r\n', '  '),
    't1=' || coalesce((select string_agg(csstv_steam2(p.steam_id), ',') from mm_lobby_players lp join players p on p.id = lp.player_id where lp.lobby_id = l.id and lp.team = 1), ''),
    't2=' || coalesce((select string_agg(csstv_steam2(p.steam_id), ',') from mm_lobby_players lp join players p on p.id = lp.player_id where lp.lobby_id = l.id and lp.team = 2), ''),
    -- Todos los de cada equipo, con o sin SteamID: el plugin no arranca hasta que estén todos (replanteo 49).
    'n1=' || (select count(*) from mm_lobby_players where lobby_id = l.id and team = 1),
    'n2=' || (select count(*) from mm_lobby_players where lobby_id = l.id and team = 2),
    'unlinked=' || (select count(*) from mm_lobby_players lp join players p on p.id = lp.player_id where lp.lobby_id = l.id and p.steam_id is null),
    'connect_seconds=' || coalesce(extract(epoch from greatest(l.connect_deadline - now(), interval '0'))::int, (select connect_minutes * 60 from mm_config)),
    'abandons=' || (select count(*) filter (where team = 1 and abandoned) || ',' || count(*) filter (where team = 2 and abandoned) from mm_lobby_players where lobby_id = l.id),
    case when l.forfeit_team is not null then 'forfeit=' || l.forfeit_team end);
end $$;
revoke all on function public.csstv_mm_poll(text, text) from public;
grant execute on function public.csstv_mm_poll(text, text) to anon, authenticated, service_role;

-- Lo nuevo.
drop trigger matches_booking on public.matches;
drop trigger matches_pcw_ban_guard on public.matches;
drop trigger pcw_posts_ban_guard on public.pcw_posts;
drop function public.booking_tick(), public.booking_report(uuid, uuid, text, text), public.booking_poll_text(uuid), public.booking_on_match(),
  public.admin_pcw_bans(boolean, text, text, text, integer, integer), public.pcw_ban_lift(uuid), public.server_set_flags(uuid, boolean, boolean, boolean), public.servers_free(text), public.match_booking(uuid),
  public.match_can_connect(uuid), public.match_booking_release(uuid), public.match_booking_action(uuid, text, integer, integer),
  public.pcw_ready(uuid, boolean), public.match_my_side(uuid), public.match_start(uuid, uuid, integer), public.booking_abandon(uuid, int, text),
  public.pcw_ban_side(uuid, int), public.matches_pcw_ban_guard(), public.pcw_posts_ban_guard(), public.pcw_ban_check(uuid),
  public.team_pcw_ban_until(uuid), public.pcw_ban_until(uuid), public.veto_auto(uuid), public.booking_after_veto(uuid),
  public.booking_enqueue(uuid, boolean), public.booking_assign(uuid), public.booking_start_wait(uuid, interval), public.booking_map(uuid),
  public.booking_close(uuid, text, text), public.booking_title(uuid), public.booking_emit(uuid), public.booking_users(uuid),
  public.match_side_users(uuid, int), public.match_veto_done(uuid), public.match_series_maps(uuid), public.server_free(text, text[]),
  public.server_is_free(uuid, text), public.server_busy(uuid), public.server_alloc_lock();
drop table public.pcw_bans, public.match_bookings;
alter table public.events drop column veto_turn_seconds;
alter table public.game_servers drop column official_enabled, drop column pcw_enabled;

notify pgrst, 'reload schema';

commit;
