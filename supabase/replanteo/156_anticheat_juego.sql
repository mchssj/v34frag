-- Replanteo 156: el anticheat ve el juego (plan docs/bitacora/2026-11-27-anticheat-ver-el-juego). Va después de la 47.
--   1. El latido del agente (0.4.0) informa si hay CMLauncher.exe y si hay hl2.exe: ac_devices guarda el último estado.
--   2. ac_bridge_player, con el agente bien:
--      - hl2.exe abierto → hl2_detected, y expulsa siempre en un servidor protegido (Kyan, 2026-11-26).
--      - sin CMLauncher.exe, o sin informe del juego en 90 s → game_not_seen, y expulsa como sin agente (en mix).
--   3. ac_process_events acepta kind = 'module': las DLL cargadas en CMLauncher.exe.
--   4. El latido devuelve el perfil (nick, foto y fecha de alta) y el nombre del servidor de la sesión, para la ventana nueva
--      del agente (plan docs/bitacora/2026-11-27-anticheat-ventana-nueva).
-- Era la 155 en kyan/ac: se renumeró al llevarla a main el 2026-11-28, porque main usó la 155 (la sala oculta).
begin;

do $$
begin
  if to_regclass('public.ac_process_events') is null then
    raise exception 'replanteo 156: falta ac_process_events (aplicar antes 46_anticheat_evidencia.sql)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ac_devices' and column_name = 'game_reported_at') then
    raise exception 'replanteo 156: ac_devices.game_reported_at ya existe (¿ya se aplicó?)';
  end if;
end $$;

-- =====================================================================================================
-- 1. Estado del juego en el equipo
-- =====================================================================================================
alter table public.ac_devices
  add column game_clientmod   boolean,
  add column game_hl2         boolean,
  add column game_reported_at timestamptz;
comment on column public.ac_devices.game_clientmod is 'Último latido: hay un CMLauncher.exe abierto. null: agente sin este dato (anterior a 0.4.0)';
comment on column public.ac_devices.game_hl2 is 'Último latido: hay un hl2.exe abierto. El Bridge expulsa';

alter table public.ac_process_events drop constraint ac_process_events_kind_check;
alter table public.ac_process_events add constraint ac_process_events_kind_check check (kind in ('inventory', 'start', 'end', 'module'));
comment on column public.ac_process_events.kind is 'inventory, start y end: programas de la PC. module: DLL cargada en CMLauncher.exe (pid = el del juego)';

-- =====================================================================================================
-- 2. Latido con el juego
-- =====================================================================================================
-- Como en la 46, más p_game: {"clientmod": bool, "hl2": bool}. Sin p_game (agente viejo) el estado queda en null.
drop function public.ac_heartbeat(text, text, text, text);
create function public.ac_heartbeat(p_secret text, p_access text, p_ip text, p_version text, p_game jsonb default null) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  d ac_devices%rowtype;
  s ac_sessions%rowtype;
  c ac_config%rowtype;
  v_cm  boolean := case when jsonb_typeof(p_game->'clientmod') = 'boolean' then (p_game->>'clientmod')::boolean end;
  v_hl2 boolean := case when jsonb_typeof(p_game->'hl2') = 'boolean' then (p_game->>'hl2')::boolean end;
begin
  perform ac_require_api(p_secret);
  update ac_devices
     set last_seen_at = now(), last_ip = p_ip, agent_version = coalesce(p_version, agent_version),
         game_clientmod = v_cm, game_hl2 = v_hl2, game_reported_at = case when p_game is null then null else now() end
   where access_hash = ac_hash(p_access) and access_expires_at > now() and revoked_at is null
   returning * into d;
  if d.id is null then return null; end if;
  update ac_sessions set last_contact_at = now() where device_id = d.id and status = 'open' returning * into s;
  select * into c from ac_config where id = 1;
  update ac_capture_requests set status = 'expired', resolved_at = now()
   where status = 'pending' and (created_at < now() - interval '5 minutes' or session_id is distinct from s.id)
     and session_id in (select id from ac_sessions where device_id = d.id);
  -- profile y server_name: para la ventana del agente (plan docs/bitacora/2026-11-27-anticheat-ventana-nueva). Sin "id" en
  -- profile: el agente lee el id de la sesión por nombre.
  return jsonb_build_object(
    'session', case when s.id is null then null
      else jsonb_build_object('id', s.id, 'server_id', s.server_id, 'match_uid', s.match_uid, 'started_at', s.started_at,
                              'server_name', (select gs.name from game_servers gs where gs.id = s.server_id)) end,
    'profile', (select jsonb_build_object('nick', p.nick, 'avatar_url', coalesce(p.photo_url, pd.avatar_url), 'member_since', u.created_at)
                  from auth.users u
                  left join players p on p.user_id = u.id
                  left join profile_details pd on pd.user_id = u.id
                 where u.id = d.user_id
                 limit 1),
    'capture_min_s', c.capture_min_s, 'capture_max_s', c.capture_max_s,
    'requests', coalesce((select jsonb_agg(q.id) from ac_capture_requests q where q.session_id = s.id and q.status = 'pending'), '[]'::jsonb));
end $$;

-- =====================================================================================================
-- 3. Bridge
-- =====================================================================================================
-- Como en la 45, más dos motivos con el agente bien: hl2_detected (expulsa siempre) y game_not_seen (como sin agente).
create or replace function public.ac_bridge_player(p_token text, p_steam text, p_ip text, p_in_mix boolean default false, p_match_uid text default null) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_server uuid := csstv_auth(p_token);
  pol      ac_server_policy%rowtype;
  v_player uuid;
  v_user   uuid;
  d        ac_devices%rowtype;
  v_reason text;
  v_sess   uuid;
  v_force  boolean;
begin
  if not is_steam64(p_steam) then raise exception 'SteamID inválido'; end if;
  select * into pol from ac_server_policy where server_id = v_server;
  if pol.server_id is null or not pol.protected then
    return jsonb_build_object('protected', false, 'action', 'allow');
  end if;

  v_player := steam_owner(p_steam);
  select user_id into v_user from players where id = v_player;
  if v_user is null then
    v_reason := 'no_profile';
  else
    select * into d from ac_devices where user_id = v_user and revoked_at is null order by last_seen_at desc nulls last limit 1;
    if d.id is null then v_reason := 'no_agent';
    elsif d.last_seen_at is null or d.last_seen_at < now() - interval '90 seconds' then v_reason := 'agent_stale';
    elsif d.last_ip is distinct from p_ip then v_reason := 'ip_mismatch';
    elsif coalesce(d.game_hl2, false) then v_reason := 'hl2_detected';                                          -- (replanteo 156)
    elsif d.game_reported_at is null or d.game_reported_at < now() - interval '90 seconds'
          or not coalesce(d.game_clientmod, false) then v_reason := 'game_not_seen';                            -- (replanteo 156)
    else v_reason := 'ok';
    end if;
  end if;

  if v_reason = 'ok' then
    -- Un equipo está en un solo servidor.
    update ac_sessions set status = 'closed', ended_at = now(), end_reason = 'moved'
     where device_id = d.id and status = 'open' and server_id <> v_server;
    insert into ac_sessions (device_id, user_id, player_id, steam_id, server_id, match_uid)
      values (d.id, v_user, v_player, p_steam, v_server, p_match_uid)
      on conflict (steam_id, server_id) where status = 'open'
      do update set device_id = excluded.device_id, last_contact_at = now(),
                    match_uid = coalesce(excluded.match_uid, ac_sessions.match_uid)
      returning id into v_sess;
  else
    update ac_sessions set status = 'lost', ended_at = now(), end_reason = v_reason
     where steam_id = p_steam and server_id = v_server and status = 'open';
  end if;

  v_force := pol.enforce_mixes and coalesce(p_in_mix, false)
    and coalesce((select open_until <= now() from ac_config where id = 1), true);
  -- hl2.exe expulsa siempre, en mix o no, y aunque un admin haya abierto los mixes (replanteo 156).
  if v_reason = 'hl2_detected' then v_force := true; end if;
  return jsonb_build_object('protected', true, 'linked', v_reason = 'ok', 'reason', v_reason, 'session_id', v_sess,
    'action', case when v_reason <> 'ok' and v_force then 'kick' else 'allow' end);
end $$;

-- =====================================================================================================
-- 4. Permisos
-- =====================================================================================================
revoke all on function public.ac_heartbeat(text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.ac_heartbeat(text, text, text, text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
