-- Correcciones de la 48 (matchmaking) encontradas en staging el 2026-11-01.
-- 1. mm_set_config: UPDATE sin WHERE, que pg_safeupdate (cargado para PostgREST) rechaza.
-- 2. mm_set_config: sin penalty_ladder en el cuerpo dejaba la escalera vacía (choca con el check).
-- 3. mm_admin_lists: la rama 'stats' agrupaba mal y, como todo es un solo CASE, rompía todas las listas.
CREATE OR REPLACE FUNCTION public.mm_admin_lists(p_what text, p_arg text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_what in ('reports', 'bans') then
    if not is_moderator() then raise exception 'Solo moderadores y admins' using errcode = '42501'; end if;
  else
    perform mm_admin_guard();
  end if;
  return case p_what
    when 'lobbies' then (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'mode', l.mode, 'status', l.status, 'map', l.map, 'created_at', l.created_at,
        'server', (select name from game_servers where id = l.server_id), 'players', (select count(*) from mm_lobby_players where lobby_id = l.id)) order by l.created_at desc), '[]')
        from mm_lobbies l where l.status not in ('finished', 'cancelled'))
    when 'reports' then (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'lobby_id', r.lobby_id, 'reason', r.reason, 'note', r.note, 'status', r.status, 'created_at', r.created_at,
        'mode', (select mode from mm_lobbies where id = r.lobby_id),
        'reporter', (select nick from players where user_id = r.reporter_id), 'reported', (select nick from players where user_id = r.reported_id), 'reported_user_id', r.reported_id) order by r.created_at desc), '[]')
        from mm_reports r)
    when 'bans' then (select coalesce(jsonb_agg(jsonb_build_object('user_id', b.user_id, 'until', b.until, 'reason', b.reason, 'nick', (select nick from players where user_id = b.user_id)) order by b.until desc), '[]')
        from mm_bans b where b.until > now())
    when 'servers' then (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'address', s.connect_address, 'region', s.region, 'mm_enabled', s.mm_enabled,
        'state', case when st.last_poll_at is null or st.last_poll_at < now() - interval '30 seconds' then 'offline'
                      when exists (select 1 from mm_lobbies l where l.server_id = s.id and l.status = 'live') then 'live'
                      when exists (select 1 from mm_lobbies l where l.server_id = s.id and l.status not in ('finished', 'cancelled')) then 'lobby' else 'free' end,
        'password', (select to_jsonb(p) from mm_server_passwords p where p.server_id = s.id and p.applied_at is not null order by p.applied_at desc limit 1)) order by s.name), '[]')
        from game_servers s left join mm_server_state st on st.server_id = s.id)
    when 'passwords' then (select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc), '[]') from mm_server_passwords p where p.server_id = p_arg::uuid)
    when 'maps' then (select coalesce(jsonb_agg(jsonb_build_object('name', mp.name, 'label', initcap(regexp_replace(mp.name, '^[a-z]+_', '')), 'image_url', mp.image_url, 'in_mm', mm.map is not null) order by mm.position nulls last, mp.position), '[]')
        from map_pool mp left join mm_mode_maps mm on mm.map = mp.name and mm.mode = p_arg where mp.active)
    when 'stats' then (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'mode', d.mode, 'lobbies', d.lobbies, 'played', d.played, 'abandons', d.abandons,
        'cancelled', (select coalesce(jsonb_object_agg(x.r, x.n), '{}') from (select end_reason r, count(*) n from mm_lobbies c where c.status = 'cancelled' and c.mode = d.mode and c.created_at::date = d.day group by 1) x),
        'avg_wait_s', coalesce((select round(extract(epoch from avg(q.left_at - q.joined_at))) from mm_queue_log q where q.outcome = 'matched' and q.mode = d.mode and q.left_at::date = d.day), 0),
        'p90_wait_s', coalesce((select round(percentile_cont(0.9) within group (order by extract(epoch from q.left_at - q.joined_at))) from mm_queue_log q where q.outcome = 'matched' and q.mode = d.mode and q.left_at::date = d.day), 0),
        'avg_elo_diff', coalesce((select round(avg(x.diff)) from (select abs(avg(lp.elo) filter (where lp.team = 1) - avg(lp.elo) filter (where lp.team = 2)) diff
             from mm_lobby_players lp join mm_lobbies c on c.id = lp.lobby_id where c.mode = d.mode and c.created_at::date = d.day group by lp.lobby_id) x), 0)) order by d.day desc), '[]')
        from (select g.day, g.mode, g.lobbies, g.played,
                     (select count(*) from mm_lobby_players lp join mm_lobbies x on x.id = lp.lobby_id where lp.abandoned and x.mode = g.mode and x.created_at::date = g.day) abandons
                from (select l.created_at::date as day, l.mode, count(*) lobbies, count(*) filter (where l.status = 'finished') played
                        from mm_lobbies l where l.created_at > now() - make_interval(days => coalesce(p_arg::int, 7)) group by 1, 2) g) d)
  end;
end $function$;

CREATE OR REPLACE FUNCTION public.mm_set_config(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m jsonb;
begin
  perform mm_admin_guard();
  update mm_config set
    open = coalesce((p->>'open')::boolean, open),
    max_party_size = coalesce((p->>'max_party_size')::int, max_party_size),
    party_max_elo_gap = coalesce((p->>'party_max_elo_gap')::int, party_max_elo_gap),
    accept_seconds = coalesce((p->>'accept_seconds')::int, accept_seconds),
    veto_seconds = coalesce((p->>'veto_seconds')::int, veto_seconds),
    connect_minutes = coalesce((p->>'connect_minutes')::int, connect_minutes),
    server_wait_minutes = coalesce((p->>'server_wait_minutes')::int, server_wait_minutes),
    elo_window_start = coalesce((p->>'elo_window_start')::int, elo_window_start),
    elo_window_step = coalesce((p->>'elo_window_step')::int, elo_window_step),
    elo_window_every_s = coalesce((p->>'elo_window_every_s')::int, elo_window_every_s),
    elo_window_max = coalesce((p->>'elo_window_max')::int, elo_window_max),
    elo_unlimited_after_s = coalesce((p->>'elo_unlimited_after_s')::int, elo_unlimited_after_s),
    penalty_ladder = case when jsonb_typeof(p->'penalty_ladder') = 'array' then array(select jsonb_array_elements_text(p->'penalty_ladder'))::int[] else penalty_ladder end,
    reconnect_minutes = coalesce((p->>'reconnect_minutes')::int, reconnect_minutes),
    require_anticheat = coalesce((p->>'require_anticheat')::boolean, require_anticheat),
    max_blocks = coalesce((p->>'max_blocks')::int, max_blocks),
    blocks_vip_only = coalesce((p->>'blocks_vip_only')::boolean, blocks_vip_only),
    min_mixes = coalesce((p->>'min_mixes')::int, min_mixes),
    min_account_days = coalesce((p->>'min_account_days')::int, min_account_days),
    abandon_extra_elo = coalesce((p->>'abandon_extra_elo')::int, abandon_extra_elo),
    abandon_adjust_pct = coalesce((p->>'abandon_adjust_pct')::int, abandon_adjust_pct),
    abandon_gg_pct = coalesce((p->>'abandon_gg_pct')::int, abandon_gg_pct),
    season_queue_close_minutes = coalesce((p->>'season_queue_close_minutes')::int, season_queue_close_minutes)
  where id = 1;
  for m in select * from jsonb_array_elements(coalesce(p->'modes', '[]')) loop
    update mm_mode_settings set enabled = (m->>'enabled')::boolean, affects_elo = (m->>'affects_elo')::boolean where mode = m->>'mode';
  end loop;
  if not exists (select 1 from mm_mode_settings where enabled) then raise exception 'Tiene que quedar al menos un modo habilitado'; end if;
  -- Los que estaban en la cola de un modo apagado salen.
  perform mm_queue_remove(q.user_id, 'closed') from mm_queue q join mm_mode_settings s on s.mode = q.mode where not s.enabled;
  perform mm_emit('mm.config', null, null);
  return mm_admin_config();
end $function$;
