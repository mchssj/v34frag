-- 115: la última sala terminada sale aparte de mm_my_live (bitácora docs/bitacora/2026-11-13-pool-de-conexiones/,
-- Daniel 2026-11-13).
--
-- mm_my_live (GET /api/v1/mm/state/live y la respuesta de las acciones del matchmaking) armaba en cada llamada
-- `last_lobby`: la última sala terminada del jugador, con las 10 tarjetas (mm_player_card). Era dos tercios del tiempo
-- de la base y, en las horas pico, dejaba a PostgREST sin conexiones libres (PGRST003). Ahora devuelve solo
-- `last_lobby_ref` ({id, rev}) y la web pide la sala con mm_my_last_lobby() cuando cambia `rev`.
-- mm_my_state (p_full) no cambia: su `lobby` sigue trayendo la terminada en la última hora.
-- Inversa en docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/115_mm_ultima_sala_aparte.sql.

begin;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'mm_my_last_lobby' and pronamespace = 'public'::regnamespace) then
    raise exception 'replanteo 115: ya se aplicó (mm_my_last_lobby existe)';
  end if;
  if not exists (select 1 from pg_proc where proname = 'mm_my_live' and pronamespace = 'public'::regnamespace
                  and pg_get_functiondef(oid) like '%''last_lobby'', mm_lobby_json(v_last, me)%') then
    raise exception 'replanteo 115: mm_my_live no es la esperada (falta la 66 o ya cambió)';
  end if;
end $$;

-- Lo que todavía puede cambiar en una sala terminada, para quien la mira. Si cambia, la web la vuelve a pedir.
create function public.mm_lobby_rev(p_lobby uuid, p_viewer uuid) returns text
  language sql stable security definer set search_path = public as $$
  select md5(concat_ws('|', l.status, l.end_reason, l.match_id, l.winner_team, m.score1, m.score2,
      (select g.id from matches g where g.parent_match_id = l.match_id limit 1),
      (select string_agg(r.reported_id::text, ',' order by r.reported_id) from mm_reports r where r.lobby_id = l.id and r.reporter_id = p_viewer),
      (select c.player_id from mm_commends c where c.lobby_id = l.id and c.user_id = p_viewer)))
    from mm_lobbies l left join matches m on m.id = l.match_id
   where l.id = p_lobby
$$;
revoke all on function public.mm_lobby_rev(uuid, uuid) from public, anon, authenticated;

-- La última sala terminada de quien llama, como venía en `last_lobby` (sin las estadísticas). null si no jugó.
create function public.mm_my_last_lobby() returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  return mm_lobby_json((select l.id from mm_lobby_players lp join mm_lobbies l on l.id = lp.lobby_id
     where lp.user_id = me and l.status = 'finished' order by l.ended_at desc limit 1), me) #- '{match,stats}';
end $$;
revoke all on function public.mm_my_last_lobby() from public, anon;
grant execute on function public.mm_my_last_lobby() to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mm_my_live(p_full boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  c mm_config%rowtype;
  q mm_queue%rowtype;
  v_party uuid;
  v_lobby uuid;
  v_ban record;
  v_season_end timestamptz;
  v_lobby_json jsonb;
  v_last uuid;
begin
  if me is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  select * into c from mm_config;
  select * into q from mm_queue where user_id = me;
  select party_id into v_party from mm_party_members where user_id = me;
  -- Sala abierta, o la que terminó en la última hora: el resumen sigue a la vista.
  -- (replanteo 60) `lobby` es la sala abierta; la última terminada va en `last_lobby_ref` (la pestaña "Tu última partida").
  -- Con p_full (mm_my_state, la web ya desplegada) `lobby` sigue como antes: la abierta o la terminada en la última hora.
  v_lobby := mm_active_lobby(me);
  v_last := (select l.id from mm_lobby_players lp join mm_lobbies l on l.id = lp.lobby_id
     where lp.user_id = me and l.status = 'finished' order by l.ended_at desc limit 1);
  if p_full and v_lobby is null then
    v_lobby := (select id from mm_lobbies where id = v_last and ended_at > now() - interval '1 hour');
  end if;
  select until, reason into v_ban from mm_bans where user_id = me and until > now() order by until desc limit 1;
  select ends_at into v_season_end from seasons where status = 'active' and ends_at < now() + interval '1 hour' limit 1;
  v_lobby_json := mm_lobby_json(v_lobby, me);
  if not p_full then v_lobby_json := v_lobby_json #- '{match,stats}'; end if;
  return jsonb_build_object(
    'open', c.open,
    'queue_size', (select count(*) from mm_queue),
    'active_players', (select count(distinct x.user_id) from (select user_id from mm_queue union all select lp.user_id from mm_lobby_players lp join mm_lobbies l on l.id = lp.lobby_id where l.status not in ('finished', 'cancelled')) x),
    'live_matches', (select count(*) from mm_lobbies where status = 'live'),
    'queue', case when q.user_id is not null then jsonb_build_object('mode', q.mode, 'region', q.region, 'joined_at', q.joined_at,
        'position', (select count(*) + 1 from mm_queue o where o.mode = q.mode and o.joined_at < q.joined_at),
        'elo_window', mm_elo_window(extract(epoch from now() - q.joined_at)),
        'eta_s', (select round(extract(epoch from avg(left_at - joined_at))) from mm_queue_log where mode = q.mode and outcome = 'matched' and left_at > now() - interval '7 days')) end,
    'lobby', v_lobby_json,
    -- (replanteo 115) Solo la referencia: la sala se pide aparte (mm_my_last_lobby) cuando cambia rev.
    'last_lobby_ref', case when v_last is not null then jsonb_build_object('id', v_last, 'rev', mm_lobby_rev(v_last, me)) end,
    'party', case when v_party is not null then jsonb_build_object('id', v_party, 'max_size', c.max_party_size,
        'members', (select jsonb_agg(jsonb_build_object('player_id', p.id, 'nick', p.nick, 'photo_url', mm_player_photo(p.id), 'level', elo_level(mm_player_elo(p.id)), 'elo', mm_player_elo(p.id),
                       'is_me', pm.user_id = me, 'is_leader', pm.user_id = pa.leader_id) order by pm.joined_at)
                      from mm_party_members pm join players p on p.user_id = pm.user_id join mm_parties pa on pa.id = pm.party_id where pm.party_id = v_party),
        'pending', (select jsonb_build_object('to_nick', p.nick, 'expires_at', i.expires_at) from mm_party_invites i join players p on p.user_id = i.to_user
                     where i.party_id = v_party and i.status = 'pending' and i.expires_at > now() limit 1)) end,
    'invites', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'expires_at', i.expires_at,
          'from', jsonb_build_object('player_id', p.id, 'nick', p.nick, 'level', elo_level(mm_player_elo(p.id)), 'elo', mm_player_elo(p.id)))), '[]')
        from mm_party_invites i join players p on p.user_id = i.from_user where i.to_user = me and i.status = 'pending' and i.expires_at > now()),
    'queue_dropped_at', (select l.left_at from mm_queue_log l where l.user_id = me and not exists (select 1 from mm_queue where user_id = me)
        and l.id = (select max(id) from mm_queue_log where user_id = me) and l.outcome = 'disconnected' and l.left_at > now() - interval '10 minutes'),
    'penalty', (select jsonb_build_object('until', until, 'level', level) from mm_penalties where user_id = me and until > now()),
    'queue_activity', jsonb_build_object(
        'modes', (select coalesce(jsonb_agg(jsonb_build_object('mode', s.mode, 'searching', n.c, 'missing', g.players_per_team * 2 - n.c % (g.players_per_team * 2)) order by s.position), '[]')
                    from mm_mode_settings s join game_modes g on g.code = s.mode cross join lateral (select count(*)::int c from mm_queue q2 where q2.mode = s.mode) n where s.enabled),
        'levels', jsonb_build_array(
          jsonb_build_object('label', 'Nivel 1 a 3', 'count', (select count(*) from mm_queue where elo_level(elo) between 1 and 3)),
          jsonb_build_object('label', 'Nivel 4 a 7', 'count', (select count(*) from mm_queue where elo_level(elo) between 4 and 7)),
          jsonb_build_object('label', 'Nivel 8 a 10', 'count', (select count(*) from mm_queue where elo_level(elo) >= 8))),
        'players', (select coalesce(jsonb_agg(jsonb_build_object('player_id', x.id, 'nick', x.nick, 'level', elo_level(x.elo), 'mode', x.mode) order by x.joined_at), '[]')
                      from (select p.id, p.nick, q3.elo, q3.mode, q3.joined_at from mm_queue q3 join players p on p.id = q3.player_id order by q3.joined_at limit 50) x)),
    'anticheat', jsonb_build_object('required', c.require_anticheat, 'status', case
        when exists (select 1 from ac_devices d where d.user_id = me and d.revoked_at is null and d.last_seen_at > now() - interval '90 seconds') then 'ok'
        when exists (select 1 from ac_devices d where d.user_id = me and d.revoked_at is null) then 'stale' else 'no_agent' end),
    'ban', case when v_ban.until is not null then jsonb_build_object('until', v_ban.until, 'reason', v_ban.reason) end,
    'servers', jsonb_build_object(
        'total', (select count(*) from game_servers where mm_enabled and active),
        'free', (select count(*) from game_servers s where server_is_free(s.id, 'mm'))),
    'season', case when v_season_end is not null then jsonb_build_object('ends_at', v_season_end,
        'queue_closes_at', v_season_end - make_interval(mins => c.season_queue_close_minutes)) end,
    'block_reason', mm_block_reason(me));
end $function$;

commit;
