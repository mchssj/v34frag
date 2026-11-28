-- Inversa de supabase/replanteo/159_anticheat_sin_eac.sql. Devuelve ac_heartbeat y ac_bridge_player a la 156 y borra
-- enforce_always, game_eac y game_eac_why. Las marcas ip_family que se crearon quedan.
begin;

create or replace function public.ac_heartbeat(p_secret text, p_access text, p_ip text, p_version text, p_game jsonb default null,
                                    p_ts bigint default null, p_agent_sha text default null, p_hw jsonb default null) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  d   ac_devices%rowtype;
  s   ac_sessions%rowtype;
  c   ac_config%rowtype;
  v_cm  boolean := case when jsonb_typeof(p_game->'clientmod') = 'boolean' then (p_game->>'clientmod')::boolean end;
  v_hl2 boolean := case when jsonb_typeof(p_game->'hl2') = 'boolean' then (p_game->>'hl2')::boolean end;
  v_ports integer[] := case when jsonb_typeof(p_game->'ports') = 'array'
                            then (select array_agg(x.v::integer) from jsonb_array_elements_text(p_game->'ports') as x(v) where x.v ~ '^\d{1,5}$') end;
  v_ok boolean;
begin
  perform ac_require_api(p_secret);
  select * into d from ac_devices where access_hash = ac_hash(p_access) and access_expires_at > now() and revoked_at is null;
  if d.id is null then return null; end if;

  -- Firma: obligatoria con la clave registrada, o pasados 10 minutos de la vinculación.
  if p_ts is null then
    if d.public_key is not null or d.created_at < now() - interval '10 minutes' then
      return jsonb_build_object('error', 'signature_required');
    end if;
  elsif p_ts <= coalesce(d.hb_last_ts, 0) or abs(extract(epoch from now()) - p_ts) > 120 then
    return jsonb_build_object('error', 'stale_signature');
  end if;

  select * into c from ac_config where id = 1;
  v_ok := case when cardinality(c.agent_hashes) = 0 then null when p_agent_sha is null then false else p_agent_sha = any(c.agent_hashes) end;

  update ac_devices
     set last_seen_at = now(), last_ip = p_ip, agent_version = coalesce(p_version, agent_version),
         game_clientmod = v_cm, game_hl2 = v_hl2, game_reported_at = case when p_game is null then null else now() end,
         game_ports = v_ports, agent_sha = coalesce(p_agent_sha, agent_sha), agent_ok = v_ok, hb_last_ts = coalesce(p_ts, hb_last_ts)
   where id = d.id
   returning * into d;

  if ac_heartbeat_machine(d.id, p_hw) then return null; end if;  -- Máquina baneada: el equipo quedó revocado (la 157)

  update ac_sessions set last_contact_at = now() where device_id = d.id and status = 'open' returning * into s;
  if s.id is not null and v_ok is false then
    perform ac_flag(s.id, 'agent_modified', 3::smallint, coalesce(p_agent_sha, 'sin hash'), jsonb_build_object('agent_sha', p_agent_sha, 'version', p_version));
  end if;
  update ac_capture_requests set status = 'expired', resolved_at = now()
   where status = 'pending' and (created_at < now() - interval '5 minutes' or session_id is distinct from s.id)
     and session_id in (select id from ac_sessions where device_id = d.id);
  -- profile y server_name: para la ventana del agente. Sin "id" en profile: el agente lee el id de la sesión por nombre.
  -- La actualización va plana (update_*), porque el agente lee el JSON por nombre de clave.
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
    'config', c.agent_config,
    'update_version', case when c.agent_latest is not null and c.agent_latest->>'version' is distinct from p_version then c.agent_latest->>'version' end,
    'update_url', case when c.agent_latest is not null and c.agent_latest->>'version' is distinct from p_version then c.agent_latest->>'url' end,
    'update_sha256', case when c.agent_latest is not null and c.agent_latest->>'version' is distinct from p_version then c.agent_latest->>'sha256' end,
    'requests', coalesce((select jsonb_agg(q.id) from ac_capture_requests q where q.session_id = s.id and q.status = 'pending'), '[]'::jsonb));
end $$;

create or replace function public.ac_bridge_player(p_token text, p_steam text, p_ip text, p_in_mix boolean default false, p_match_uid text default null,
                                        p_port integer default null) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_server uuid := csstv_auth(p_token);
  pol      ac_server_policy%rowtype;
  c        ac_config%rowtype;
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
  select * into c from ac_config where id = 1;

  v_player := steam_owner(p_steam);
  select user_id into v_user from players where id = v_player;
  if v_user is null then
    v_reason := 'no_profile';
  else
    select * into d from ac_devices where user_id = v_user and revoked_at is null order by last_seen_at desc nulls last limit 1;
    if d.id is null then v_reason := 'no_agent';
    elsif d.last_seen_at is null or d.last_seen_at < now() - interval '90 seconds' then v_reason := 'agent_stale';
    elsif d.last_ip is distinct from p_ip then v_reason := 'ip_mismatch';
    elsif ac_device_machine_banned(d.id) then v_reason := 'machine_banned';
    elsif d.agent_ok is false then v_reason := 'agent_modified';
    elsif c.agent_min_version is not null and (d.agent_version is null or ac_version_lt(d.agent_version, c.agent_min_version)) then v_reason := 'agent_outdated';
    elsif coalesce(d.game_hl2, false) then v_reason := 'hl2_detected';
    elsif d.game_reported_at is null or d.game_reported_at < now() - interval '90 seconds'
          or not coalesce(d.game_clientmod, false) then v_reason := 'game_not_seen';
    else v_reason := 'ok';
    end if;
  end if;

  if v_reason = 'ok' then
    update ac_sessions set status = 'closed', ended_at = now(), end_reason = 'moved'
     where device_id = d.id and status = 'open' and server_id <> v_server;
    insert into ac_sessions (device_id, user_id, player_id, steam_id, server_id, match_uid)
      values (d.id, v_user, v_player, p_steam, v_server, p_match_uid)
      on conflict (steam_id, server_id) where status = 'open'
      do update set device_id = excluded.device_id, last_contact_at = now(),
                    match_uid = coalesce(excluded.match_uid, ac_sessions.match_uid)
      returning id into v_sess;
    -- Indicio leve de otra PC: el puerto que ve el servidor no es ninguno de los del juego. Con NAT puede cambiar.
    if p_port is not null and cardinality(d.game_ports) > 0 and not (p_port = any(d.game_ports)) then
      perform ac_flag(v_sess, 'port_mismatch', 1::smallint, p_port::text, jsonb_build_object('server_port', p_port, 'game_ports', to_jsonb(d.game_ports)));
    end if;
  else
    update ac_sessions set status = 'lost', ended_at = now(), end_reason = v_reason
     where steam_id = p_steam and server_id = v_server and status = 'open';
  end if;

  v_force := pol.enforce_mixes and coalesce(p_in_mix, false)
    and coalesce((select open_until <= now() from ac_config where id = 1), true);
  -- Estos expulsan siempre, en mix o no, y aunque un admin haya abierto los mixes.
  if v_reason in ('hl2_detected', 'agent_modified', 'agent_outdated', 'machine_banned') then v_force := true; end if;
  return jsonb_build_object('protected', true, 'linked', v_reason = 'ok', 'reason', v_reason, 'session_id', v_sess,
    'action', case when v_reason <> 'ok' and v_force then 'kick' else 'allow' end);
end $$;

drop function public.ac_admin_set_server_policy(uuid, text);
drop function public.ac_admin_server_policies(text, text, text, text, integer, integer);
drop function public.ac_server_mode(uuid);
drop function public.ac_server_rule(uuid);
drop function public.ac_same_ip_family(text, text);
alter table public.ac_devices drop column game_eac_why, drop column game_eac;
alter table public.ac_server_policy drop column enforce_always;

notify pgrst, 'reload schema';
commit;
