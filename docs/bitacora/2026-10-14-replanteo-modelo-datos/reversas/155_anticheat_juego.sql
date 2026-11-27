-- Inversa de supabase/replanteo/155_anticheat_juego.sql. Vuelve el latido y el Bridge a la 46 y la 45, y borra los módulos.
-- Antes, volver la API a la versión que llama a ac_heartbeat sin p_game.
begin;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ac_devices' and column_name = 'game_reported_at') then
    raise exception 'inversa 155: no existe ac_devices.game_reported_at (¿no se aplicó la 155?)';
  end if;
end $$;

delete from public.ac_process_events where kind = 'module';
alter table public.ac_process_events drop constraint ac_process_events_kind_check;
alter table public.ac_process_events add constraint ac_process_events_kind_check check (kind in ('inventory', 'start', 'end'));
comment on column public.ac_process_events.kind is null;

drop function public.ac_heartbeat(text, text, text, text, jsonb);
create function public.ac_heartbeat(p_secret text, p_access text, p_ip text, p_version text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  d ac_devices%rowtype;
  s ac_sessions%rowtype;
  c ac_config%rowtype;
begin
  perform ac_require_api(p_secret);
  update ac_devices
     set last_seen_at = now(), last_ip = p_ip, agent_version = coalesce(p_version, agent_version)
   where access_hash = ac_hash(p_access) and access_expires_at > now() and revoked_at is null
   returning * into d;
  if d.id is null then return null; end if;
  update ac_sessions set last_contact_at = now() where device_id = d.id and status = 'open' returning * into s;
  select * into c from ac_config where id = 1;
  update ac_capture_requests set status = 'expired', resolved_at = now()
   where status = 'pending' and (created_at < now() - interval '5 minutes' or session_id is distinct from s.id)
     and session_id in (select id from ac_sessions where device_id = d.id);
  return jsonb_build_object(
    'session', case when s.id is null then null
      else jsonb_build_object('id', s.id, 'server_id', s.server_id, 'match_uid', s.match_uid, 'started_at', s.started_at) end,
    'capture_min_s', c.capture_min_s, 'capture_max_s', c.capture_max_s,
    'requests', coalesce((select jsonb_agg(q.id) from ac_capture_requests q where q.session_id = s.id and q.status = 'pending'), '[]'::jsonb));
end $$;
revoke all on function public.ac_heartbeat(text, text, text, text) from public, anon, authenticated;
grant execute on function public.ac_heartbeat(text, text, text, text) to anon, authenticated;

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
  else
    update ac_sessions set status = 'lost', ended_at = now(), end_reason = v_reason
     where steam_id = p_steam and server_id = v_server and status = 'open';
  end if;

  v_force := pol.enforce_mixes and coalesce(p_in_mix, false)
    and coalesce((select open_until <= now() from ac_config where id = 1), true);
  return jsonb_build_object('protected', true, 'linked', v_reason = 'ok', 'reason', v_reason, 'session_id', v_sess,
    'action', case when v_reason <> 'ok' and v_force then 'kick' else 'allow' end);
end $$;

alter table public.ac_devices drop column game_clientmod, drop column game_hl2, drop column game_reported_at;

notify pgrst, 'reload schema';

commit;
