-- Replanteo 159: anticheat sin el EAC de ClientMod y expulsión obligatoria que funcione
-- (plan docs/bitacora/2026-11-27-anticheat-sin-eac). Va después de la 157 (ac_device_machine_banned con máquinas).
--   1. ac_server_policy.enforce_always: con true, se expulsa a quien no cumple desde que entra, también en el calentamiento
--      (no solo con cml_ac_mix 1). #1, #2 y #3 van así: la fila se carga en el despliegue, no acá.
--   2. ac_devices.game_eac y game_eac_why: el agente 0.6.0 informa si el juego se abrió con el EAC de ClientMod.
--      El EAC está prohibido (Daniel, 2026-11-27): motivo eac_on, AC-6 en el Bridge, con las reglas de AC-1.
--   3. ac_bridge_player:
--      - machine_banned (AC-5) se mira antes que todo lo demás y también con el equipo revocado: el latido revoca el equipo de
--        una máquina baneada, y hasta ahora la base respondía no_agent (AC-1, solo en mix).
--      - IP: si el agente llegó por IPv6 y el servidor ve una IPv4 (o al revés), no es ip_mismatch: se deja jugar y queda una
--        marca leve (ip_family). Cloudflare atiende la API también por IPv6 y los servidores de juego son solo IPv4.
--      - La respuesta suma always (enforce_always): el Bridge 1.4.0 la recuerda para expulsar por AC-0 (sin SteamID, sin
--        preguntarle a la base) también fuera de un mix.
begin;

do $$
begin
  if to_regprocedure('public.ac_machine_banned(uuid, uuid)') is null then raise exception 'replanteo 159: falta la 157 (ac_machine_banned)'; end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ac_devices' and column_name = 'game_eac') then
    raise exception 'replanteo 159: ac_devices.game_eac ya existe (¿ya se aplicó?)';
  end if;
end $$;

-- =====================================================================================================
-- 1. Política y estado del EAC
-- =====================================================================================================
alter table public.ac_server_policy add column enforce_always boolean not null default false;
comment on column public.ac_server_policy.enforce_always is
  'true: expulsa a quien no cumple desde que entra, sin esperar a cml_ac_mix 1. Necesita protected. #1, #2 y #3 (Daniel, 2026-11-27)';

alter table public.ac_devices
  add column game_eac     boolean,
  add column game_eac_why text check (game_eac_why in ('parent', 'ini', 'service', 'denied'));
comment on column public.ac_devices.game_eac is 'El juego se abrió con el EAC de ClientMod (prohibido: eac_on, AC-6). null: agente anterior a 0.6.0';

-- IPv4 contra IPv6: true si las dos son de la misma familia.
create function public.ac_same_ip_family(a text, b text) returns boolean language sql immutable as $$
  select (position(':' in coalesce(a, '')) > 0) = (position(':' in coalesce(b, '')) > 0) $$;

-- =====================================================================================================
-- 2. Latido: como en la 156, más game.eac y game.eac_why
-- =====================================================================================================
create or replace function public.ac_heartbeat(p_secret text, p_access text, p_ip text, p_version text, p_game jsonb default null,
                                               p_ts bigint default null, p_agent_sha text default null, p_hw jsonb default null) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  d   ac_devices%rowtype;
  s   ac_sessions%rowtype;
  c   ac_config%rowtype;
  v_cm  boolean := case when jsonb_typeof(p_game->'clientmod') = 'boolean' then (p_game->>'clientmod')::boolean end;
  v_hl2 boolean := case when jsonb_typeof(p_game->'hl2') = 'boolean' then (p_game->>'hl2')::boolean end;
  v_eac boolean := case when jsonb_typeof(p_game->'eac') = 'boolean' then (p_game->>'eac')::boolean end;
  v_eac_why text := case when p_game->>'eac_why' in ('parent', 'ini', 'service', 'denied') then p_game->>'eac_why' end;
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
         game_eac = v_eac, game_eac_why = case when v_eac then v_eac_why end,
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

-- =====================================================================================================
-- 3. Bridge
-- =====================================================================================================
-- Orden de los motivos: machine_banned (con el equipo revocado o no), no_agent, agent_stale, ip_mismatch (misma familia),
-- agent_modified, agent_outdated, hl2_detected, eac_on, game_not_seen y ok.
-- Expulsan siempre: machine_banned, agent_modified, agent_outdated y hl2_detected. El resto, en un mix (enforce_mixes y
-- p_in_mix) o en cualquier momento con enforce_always, salvo que un admin haya abierto los mixes (ac_config.open_until).
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
  v_family boolean := true;
begin
  if not is_steam64(p_steam) then raise exception 'SteamID inválido'; end if;
  select * into pol from ac_server_policy where server_id = v_server;
  if pol.server_id is null or not pol.protected then
    return jsonb_build_object('protected', false, 'always', false, 'action', 'allow');
  end if;
  select * into c from ac_config where id = 1;

  v_player := steam_owner(p_steam);
  select user_id into v_user from players where id = v_player;
  if v_user is null then
    v_reason := 'no_profile';
  elsif exists (select 1 from ac_devices x where x.user_id = v_user and ac_device_machine_banned(x.id)) then
    v_reason := 'machine_banned';
  else
    select * into d from ac_devices where user_id = v_user and revoked_at is null order by last_seen_at desc nulls last limit 1;
    v_family := d.id is null or ac_same_ip_family(d.last_ip, p_ip);
    if d.id is null then v_reason := 'no_agent';
    elsif d.last_seen_at is null or d.last_seen_at < now() - interval '90 seconds' then v_reason := 'agent_stale';
    elsif v_family and d.last_ip is distinct from p_ip then v_reason := 'ip_mismatch';
    elsif d.agent_ok is false then v_reason := 'agent_modified';
    elsif c.agent_min_version is not null and (d.agent_version is null or ac_version_lt(d.agent_version, c.agent_min_version)) then v_reason := 'agent_outdated';
    elsif coalesce(d.game_hl2, false) then v_reason := 'hl2_detected';
    elsif d.game_reported_at is null or d.game_reported_at < now() - interval '90 seconds'
          or not coalesce(d.game_clientmod, false) then v_reason := 'game_not_seen';
    elsif coalesce(d.game_eac, false) then v_reason := 'eac_on';
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
    -- El agente llegó por IPv6 y el juego por IPv4 (o al revés): no se pueden comparar. Queda para revisar.
    if not v_family then
      perform ac_flag(v_sess, 'ip_family', 1::smallint, '', jsonb_build_object('agent_ip', d.last_ip, 'server_ip', p_ip));
    end if;
  else
    update ac_sessions set status = 'lost', ended_at = now(), end_reason = v_reason
     where steam_id = p_steam and server_id = v_server and status = 'open';
  end if;

  v_force := (pol.enforce_always or (pol.enforce_mixes and coalesce(p_in_mix, false)))
    and coalesce((select open_until <= now() from ac_config where id = 1), true);
  if v_reason in ('hl2_detected', 'agent_modified', 'agent_outdated', 'machine_banned') then v_force := true; end if;
  -- always: el Bridge lo recuerda para AC-0, que no le pregunta a la base porque no tiene SteamID.
  return jsonb_build_object('protected', true, 'always', coalesce(pol.enforce_always, false), 'linked', v_reason = 'ok', 'reason', v_reason, 'session_id', v_sess,
    'action', case when v_reason <> 'ok' and v_force then 'kick' else 'allow' end);
end $$;

-- =====================================================================================================
-- 4. Panel: el modo de cada servidor (Administración › Anticheat › Servidores)
-- =====================================================================================================
-- Modos, que se guardan en ac_server_policy:
--   off     protected = false: no abre sesiones ni expulsa (el Bridge recibe allow)
--   always  protected, enforce_always: lo exige desde que el jugador entra. #1, #2 y #3 (Daniel, 2026-11-27)
--   mixes   protected, enforce_mixes: lo exige solo con cml_ac_mix 1 (la partida en vivo). Ya no se elige desde el panel
--           (Daniel, 2026-11-27): quien entra sin el anticheat juega el calentamiento y lo expulsan al arrancar el mix. Se
--           lista si un servidor ya lo tiene (la demo de Kyan, anticheat-demo.mts, o un cambio por SQL)
create function public.ac_server_mode(p ac_server_policy) returns text language sql immutable as $$
  select case when p.server_id is null or not p.protected then 'off' when p.enforce_always then 'always'
              when p.enforce_mixes then 'mixes' else 'off' end $$;

-- Los servidores activos con su modo. Pagina, filtra (nombre y modo) y ordena (name, mode o updated_at).
create function public.ac_admin_server_policies(p_q text default null, p_mode text default null, p_sort text default 'name',
                                                p_order text default 'asc', p_limit integer default 20, p_offset integer default 0) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  v_desc boolean := lower(coalesce(p_order, 'asc')) = 'desc';
  v jsonb;
begin
  if not ac_can_review() then raise exception 'Solo un admin puede ver los servidores del anticheat' using errcode = '42501'; end if;
  with s as (
    select gs.id, gs.name, ac_server_mode(pol) as mode, pol.updated_at
      from game_servers gs
      left join ac_server_policy pol on pol.server_id = gs.id
     where gs.active
       and (p_q is null or gs.name ilike '%' || p_q || '%')
  ), f as (
    select * from s where p_mode is null or s.mode = p_mode
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'items', coalesce((select jsonb_agg(jsonb_build_object('server_id', x.id, 'name', x.name, 'mode', x.mode, 'updated_at', x.updated_at)) from (
      select * from f
       order by case when not v_desc then case p_sort when 'mode' then f.mode when 'updated_at' then f.updated_at::text else f.name end end asc nulls last,
                case when v_desc then case p_sort when 'mode' then f.mode when 'updated_at' then f.updated_at::text else f.name end end desc nulls last,
                f.id
       limit greatest(1, least(coalesce(p_limit, 20), 100)) offset greatest(0, coalesce(p_offset, 0))) x), '[]'::jsonb))
    into v;
  return v;
end $$;

-- Cambia el modo de un servidor (off o always). Queda registrado.
create function public.ac_admin_set_server_policy(p_server uuid, p_mode text) returns jsonb
  language plpgsql security definer set search_path = public as $$
begin
  if not ac_can_review() then raise exception 'Solo un admin puede cambiar los servidores del anticheat' using errcode = '42501'; end if;
  if p_mode is null or p_mode not in ('off', 'always') then raise exception 'Modo inválido: off o always'; end if;
  if not exists (select 1 from game_servers where id = p_server) then raise exception 'No existe ese servidor' using errcode = 'P0002'; end if;
  insert into ac_server_policy (server_id, protected, enforce_mixes, enforce_always, updated_at)
    values (p_server, p_mode <> 'off', false, p_mode = 'always', now())
    on conflict (server_id) do update
      set protected = excluded.protected, enforce_mixes = excluded.enforce_mixes, enforce_always = excluded.enforce_always, updated_at = now();
  insert into ac_admin_actions (actor, action, detail) values (auth.uid(), 'server_policy', jsonb_build_object('server', p_server, 'mode', p_mode));
  return (select jsonb_build_object('server_id', gs.id, 'name', gs.name, 'mode', ac_server_mode(pol), 'updated_at', pol.updated_at)
            from game_servers gs left join ac_server_policy pol on pol.server_id = gs.id where gs.id = p_server);
end $$;

-- =====================================================================================================
-- 5. Permisos (create or replace los mantiene; ac_same_ip_family y ac_server_mode son internas)
-- =====================================================================================================
revoke all on function public.ac_same_ip_family(text, text), public.ac_server_mode(ac_server_policy) from public, anon, authenticated;
revoke all on function public.ac_admin_server_policies(text, text, text, text, integer, integer),
  public.ac_admin_set_server_policy(uuid, text) from public, anon;
grant execute on function public.ac_admin_server_policies(text, text, text, text, integer, integer),
  public.ac_admin_set_server_policy(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;
