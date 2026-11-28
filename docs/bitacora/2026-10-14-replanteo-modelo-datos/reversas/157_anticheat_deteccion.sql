-- Inversa de supabase/replanteo/157_anticheat_deteccion.sql. Vuelve el latido y el Bridge a la 156, y borra marcas, firmas,
-- la configuraciÃ³n remota y los eventos nuevos. Antes: la inversa de la 158 y la de la 159, y volver la API a la versiÃ³n anterior.
-- Las capturas ya borradas por vencimiento no vuelven.
begin;

do $$
begin
  if to_regclass('public.ac_flags') is null then raise exception 'inversa 157: no existe ac_flags (Â¿no se aplicÃ³ la 157?)'; end if;
  if to_regclass('public.ac_machines') is not null then raise exception 'inversa 157: primero la inversa de la 158'; end if;
  if to_regclass('public.ac_aim_stats') is not null then raise exception 'inversa 157: primero la inversa de la 159'; end if;
end $$;

drop function public.ac_admin_flags(boolean, integer, integer, integer);
drop function public.ac_admin_flag_review(bigint, text);
drop function public.ac_admin_hash_search(text);
drop function public.ac_admin_signatures();
drop function public.ac_admin_signature_add(text, text, text[], text, text);
drop function public.ac_admin_signature_remove(uuid);
drop function public.ac_admin_agent_config();
drop function public.ac_admin_set_agent_config(jsonb);
drop function public.ac_screenshot_retention_due(integer);
drop function public.ac_screenshot_purged(uuid[]);

drop function public.ac_bridge_player(text, text, text, boolean, text, integer);
create function public.ac_bridge_player(p_token text, p_steam text, p_ip text, p_in_mix boolean default false, p_match_uid text default null) returns jsonb
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
revoke all on function public.ac_bridge_player(text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.ac_bridge_player(text, text, text, boolean, text) to anon, authenticated;

drop function public.ac_heartbeat(text, text, text, text, jsonb, bigint, text, jsonb);
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
revoke all on function public.ac_heartbeat(text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.ac_heartbeat(text, text, text, text, jsonb) to anon, authenticated;

drop function public.ac_heartbeat_machine(uuid, jsonb);
drop function public.ac_device_machine_banned(uuid);
drop function public.ac_version_lt(text, text);

create or replace function public.ac_admin_sessions(p_status text default null, p_limit integer default 50, p_offset integer default 0) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not ac_can_review() then raise exception 'Solo un admin puede ver las sesiones' using errcode = '42501'; end if;
  insert into ac_admin_actions (actor, action, detail) values (auth.uid(), 'sessions_read', jsonb_build_object('status', p_status, 'offset', p_offset));
  select coalesce(jsonb_agg(x), '[]') into v from (
    select s.id, s.player_id, p.nick, s.steam_id, s.server_id, g.name as server_name, s.match_uid, s.status,
           s.started_at, s.last_contact_at, s.ended_at, s.end_reason
      from ac_sessions s
      join players p on p.id = s.player_id
      join game_servers g on g.id = s.server_id
     where p_status is null or s.status = p_status
     order by s.started_at desc
     limit least(greatest(coalesce(p_limit, 50), 1), 100) offset greatest(coalesce(p_offset, 0), 0)) x;
  return v;
end $$;

create or replace function public.ac_admin_session_evidence(p_session uuid) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not ac_can_review() then raise exception 'Solo un admin puede ver la evidencia' using errcode = '42501'; end if;
  if not exists (select 1 from ac_sessions where id = p_session) then return null; end if;
  insert into ac_admin_actions (actor, action, detail) values (auth.uid(), 'evidence_read', jsonb_build_object('session', p_session));
  select jsonb_build_object(
    'screenshots', coalesce((select jsonb_agg(to_jsonb(x) order by x.taken_at) from (
        select id, kind, method, storage_path, sha256, size_bytes, width, height, taken_at, stored_at, request_id from ac_screenshots where session_id = p_session) x), '[]'::jsonb),
    'processes', coalesce((select jsonb_agg(to_jsonb(x) order by x.observed_at) from (
        select kind, pid, name, path, sha256, signature, publisher, note, started_at, observed_at from ac_process_events where session_id = p_session order by observed_at limit 5000) x), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from (
        select id, reason, status, created_at, resolved_at from ac_capture_requests where session_id = p_session) x), '[]'::jsonb)) into v;
  return v;
end $$;

create or replace function public.ac_admin_chain(p_session uuid) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
begin
  if not ac_can_review() then raise exception 'Solo un admin puede verificar' using errcode = '42501'; end if;
  if not exists (select 1 from ac_sessions where id = p_session) then return null; end if;
  return jsonb_build_object(
    'public_key', (select d.public_key from ac_sessions s join ac_devices d on d.id = s.device_id where s.id = p_session),
    'entries', coalesce((select jsonb_agg(to_jsonb(e) order by e.seq) from (select seq, kind, item_sha, prev_hash, entry, entry_hash, signature, raw, ref_id from ac_evidence where session_id = p_session) e), '[]'::jsonb),
    'screenshots', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'sha256', sha256, 'storage_path', storage_path, 'stored', stored_at is not null)) from ac_screenshots where session_id = p_session), '[]'::jsonb),
    'processes', coalesce((select jsonb_agg(jsonb_build_object('client_id', client_id, 'name', name, 'path', path, 'sha256', sha256)) from ac_process_events where session_id = p_session), '[]'::jsonb));
end $$;

drop trigger ac_flag_event on public.ac_process_events;
drop function public.ac_flag_event();
drop function public.ac_flag(uuid, text, smallint, text, jsonb, bigint);
drop table public.ac_flags;
drop table public.ac_signatures;

create or replace function public.ac_ingest_processes(p_secret text, p_access text, p_session uuid, p_events jsonb) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_device uuid := ac_device_of(p_secret, p_access);
  e jsonb;
  v_ok integer := 0;
  v_skip integer := 0;
  v_at timestamptz;
begin
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 500 then raise exception 'Lote inválido: hasta 500 eventos'; end if;
  for e in select * from jsonb_array_elements(p_events) loop
    v_at := (e->>'observed_at')::timestamptz;
    if not ac_session_accepts(p_session, v_device, v_at) then v_skip := v_skip + 1; continue; end if;
    insert into ac_process_events (session_id, client_id, kind, pid, name, path, sha256, signature, publisher, note, started_at, observed_at)
      values (p_session, e->>'client_id', e->>'kind', (e->>'pid')::integer, e->>'name', e->>'path', e->>'sha256', e->>'signature',
              e->>'publisher', e->>'note', (e->>'started_at')::timestamptz, v_at)
      on conflict (session_id, client_id) do nothing;
    v_ok := v_ok + 1;
  end loop;
  return jsonb_build_object('accepted', v_ok, 'rejected', v_skip);
end $$;

delete from public.ac_process_events where kind in ('handle', 'overlay', 'driver', 'game_file');
alter table public.ac_process_events drop column detail;
alter table public.ac_process_events drop constraint ac_process_events_kind_check;
alter table public.ac_process_events add constraint ac_process_events_kind_check check (kind in ('inventory', 'start', 'end', 'module'));

alter table public.ac_devices drop column agent_sha, drop column agent_ok, drop column game_ports, drop column hb_last_ts;
alter table public.ac_screenshots drop column purged_at;
alter table public.ac_config drop column agent_config, drop column agent_latest, drop column agent_min_version, drop column agent_hashes,
  drop column screenshot_retention_days;
alter table public.ac_config alter column capture_min_s set default 180, alter column capture_max_s set default 300;
update public.ac_config set capture_min_s = 180, capture_max_s = 300 where id = 1;

notify pgrst, 'reload schema';

commit;