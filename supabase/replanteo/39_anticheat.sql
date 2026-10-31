-- Replanteo 39: anticheat FRAG, etapa 1 (plan docs/bitacora/2026-10-30-anticheat-backend).
--   - El agente se vincula a la cuenta con un código que el jugador aprueba en la web.
--   - El Bridge pregunta por cada jugador con el token del servidor y recibe allow o kick.
--   - Las funciones del agente piden un secreto que solo tiene la API: la anon key es pública y la IP la informa la API.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regprocedure('public.steam_owner(text)') is null or to_regprocedure('public.is_steam64(text)') is null then
    raise exception 'replanteo 39: falta steam_owner o is_steam64 (aplicar antes 15_claim.sql)';
  end if;
  if to_regclass('public.ac_config') is not null then
    raise exception 'replanteo 39: ac_config ya existe (¿ya se aplicó?)';
  end if;
end $$;

-- =====================================================================================================
-- 1. Tablas
-- =====================================================================================================
create table public.ac_config (
  id              smallint primary key default 1 check (id = 1),
  api_secret_hash text,                                   -- sha256 de AC_API_SECRET de la API; sin él, el agente no funciona
  retention_days  integer not null default 30 check (retention_days between 1 and 365),
  open_until      timestamptz,                            -- un admin abrió los mixes: hasta acá no se expulsa
  updated_at      timestamptz not null default now()
);
insert into public.ac_config(id) values (1);

create table public.ac_server_policy (
  server_id     uuid primary key references public.game_servers(id) on delete cascade,
  protected     boolean not null default false,           -- abre sesiones anticheat
  enforce_mixes boolean not null default false,           -- expulsa de los mixes a quien no tiene agente
  updated_at    timestamptz not null default now()
);
comment on table public.ac_server_policy is 'Un servidor sin fila no está protegido: así se deja afuera a RBK';

create table public.ac_devices (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 64),
  agent_version     text check (char_length(agent_version) <= 32),
  access_hash       text not null,
  access_expires_at timestamptz not null,
  refresh_hash      text not null,
  last_seen_at      timestamptz,
  last_ip           text,
  revoked_at        timestamptz,
  created_at        timestamptz not null default now()
);
create unique index ac_devices_access on public.ac_devices (access_hash);
create unique index ac_devices_refresh on public.ac_devices (refresh_hash);
create index ac_devices_user on public.ac_devices (user_id);

create table public.ac_link_requests (
  id               uuid primary key default gen_random_uuid(),
  device_code_hash text not null unique,
  user_code        text not null unique,
  device_name      text not null check (char_length(device_name) between 1 and 64),
  agent_version    text check (char_length(agent_version) <= 32),
  expires_at       timestamptz not null,
  approved_by      uuid references auth.users(id) on delete cascade,
  approved_at      timestamptz,
  claimed_at       timestamptz,
  created_at       timestamptz not null default now()
);

create table public.ac_sessions (
  id              uuid primary key default gen_random_uuid(),
  device_id       uuid not null references public.ac_devices(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  player_id       uuid not null references public.players(id) on delete cascade,
  steam_id        text not null check (is_steam64(steam_id)),
  server_id       uuid not null references public.game_servers(id) on delete cascade,
  match_uid       text check (char_length(match_uid) <= 64),   -- null hasta que empieza la partida
  status          text not null default 'open' check (status in ('open', 'closed', 'lost')),
  started_at      timestamptz not null default now(),
  last_contact_at timestamptz not null default now(),
  ended_at        timestamptz,
  end_reason      text check (char_length(end_reason) <= 32)
);
create unique index ac_sessions_una_abierta on public.ac_sessions (steam_id, server_id) where status = 'open';
create index ac_sessions_player on public.ac_sessions (player_id, started_at desc);
create index ac_sessions_device on public.ac_sessions (device_id) where status = 'open';
create index ac_sessions_match on public.ac_sessions (match_uid);
create index ac_sessions_fecha on public.ac_sessions (started_at desc);

create table public.ac_admin_actions (
  id         bigint generated always as identity primary key,
  actor      uuid,
  action     text not null check (char_length(action) <= 40),
  detail     jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index ac_admin_actions_fecha on public.ac_admin_actions (created_at desc);

-- Sin privilegios por defecto: se abre solo lo de abajo.
revoke all on public.ac_config, public.ac_server_policy, public.ac_devices, public.ac_link_requests, public.ac_sessions, public.ac_admin_actions
  from public, anon, authenticated;
alter table public.ac_config enable row level security;
alter table public.ac_server_policy enable row level security;
alter table public.ac_devices enable row level security;
alter table public.ac_link_requests enable row level security;
alter table public.ac_sessions enable row level security;
alter table public.ac_admin_actions enable row level security;

-- =====================================================================================================
-- 2. Permisos
-- =====================================================================================================
-- Ver evidencia es más delicado que moderar: solo admins.
create function public.ac_can_review() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(is_admin(), false) $$;

-- Cada uno ve sus equipos y sus sesiones. Nunca los hashes.
grant select (id, user_id, name, agent_version, last_seen_at, revoked_at, created_at) on public.ac_devices to authenticated;
create policy "ac_devices: los propios" on public.ac_devices for select to authenticated using (user_id = auth.uid());

grant select on public.ac_sessions to authenticated;
create policy "ac_sessions: las propias o quien revisa" on public.ac_sessions for select to authenticated
  using (user_id = auth.uid() or ac_can_review());

-- Evidencias: privado, y nadie sube hasta la etapa de capturas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('ac-evidence', 'ac-evidence', false, 5242880, array['image/jpeg']);
create policy "ac-evidence: solo quien revisa" on storage.objects for select to authenticated
  using (bucket_id = 'ac-evidence' and public.ac_can_review());

-- =====================================================================================================
-- 3. Auxiliares internas
-- =====================================================================================================
create function public.ac_hash(p text) returns text language sql immutable set search_path = public as $$
  select encode(sha256(convert_to(coalesce(p, ''), 'UTF8')), 'hex') $$;

create function public.ac_token(p_prefix text) returns text language sql volatile set search_path = public as $$
  select p_prefix || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') $$;

-- Sin 0, O, 1 ni I, para dictarlo o copiarlo sin errores.
create function public.ac_user_code() returns text language sql volatile set search_path = public as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + get_byte(u, i) % 32, 1), '')
    from (select uuid_send(gen_random_uuid()) as u) x, generate_series(0, 7) i $$;

create function public.ac_require_api(p_secret text) returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from ac_config where api_secret_hash is not null and api_secret_hash = ac_hash(p_secret)) then
    raise exception 'Solo la API puede llamar a esta función' using errcode = '42501';
  end if;
end $$;

-- =====================================================================================================
-- 4. Vinculación del agente
-- =====================================================================================================
create function public.ac_link_start(p_secret text, p_device_name text, p_version text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_device text := ac_token('fragd_');
  v_user   text;
begin
  perform ac_require_api(p_secret);
  delete from ac_link_requests where expires_at < now() - interval '1 day';
  loop
    v_user := ac_user_code();
    exit when not exists (select 1 from ac_link_requests where user_code = v_user);
  end loop;
  insert into ac_link_requests (device_code_hash, user_code, device_name, agent_version, expires_at)
    values (ac_hash(v_device), v_user, p_device_name, p_version, now() + interval '10 minutes');
  return jsonb_build_object('device_code', v_device, 'user_code', v_user, 'expires_in', 600);
end $$;

-- La aprueba el jugador con su sesión de la web. Necesita una ficha con SteamID: sin eso no hay cómo reconocerlo en el servidor.
create function public.ac_link_approve(p_user_code text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  r ac_link_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Hay que iniciar sesión' using errcode = '42501'; end if;
  if not exists (select 1 from players where user_id = auth.uid() and steam_id is not null) then
    raise exception 'Primero vincula tu SteamID a tu perfil';
  end if;
  select * into r from ac_link_requests where user_code = upper(trim(coalesce(p_user_code, ''))) for update;
  if r.id is null or r.expires_at <= now() or r.claimed_at is not null then
    raise exception 'El código no existe o venció';
  end if;
  if r.approved_by is not null and r.approved_by <> auth.uid() then
    raise exception 'El código no existe o venció';
  end if;
  update ac_link_requests set approved_by = auth.uid(), approved_at = coalesce(approved_at, now()) where id = r.id;
  return jsonb_build_object('device_name', r.device_name);
end $$;

-- Devuelve los tokens una sola vez.
create function public.ac_link_claim(p_secret text, p_device_code text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  r         ac_link_requests%rowtype;
  v_access  text := ac_token('fraga_');
  v_refresh text := ac_token('fragr_');
  v_id      uuid;
begin
  perform ac_require_api(p_secret);
  select * into r from ac_link_requests where device_code_hash = ac_hash(p_device_code) for update;
  if r.id is null or r.claimed_at is not null or r.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  if r.approved_by is null then return jsonb_build_object('status', 'pending'); end if;
  insert into ac_devices (user_id, name, agent_version, access_hash, access_expires_at, refresh_hash)
    values (r.approved_by, r.device_name, r.agent_version, ac_hash(v_access), now() + interval '15 minutes', ac_hash(v_refresh))
    returning id into v_id;
  update ac_link_requests set claimed_at = now() where id = r.id;
  return jsonb_build_object('status', 'approved', 'device_id', v_id, 'access_token', v_access, 'refresh_token', v_refresh, 'expires_in', 900);
end $$;

-- El token de renovación rota: uno viejo deja de valer.
create function public.ac_token_refresh(p_secret text, p_refresh text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_access  text := ac_token('fraga_');
  v_refresh text := ac_token('fragr_');
  v_id      uuid;
begin
  perform ac_require_api(p_secret);
  update ac_devices
     set access_hash = ac_hash(v_access), access_expires_at = now() + interval '15 minutes', refresh_hash = ac_hash(v_refresh)
   where refresh_hash = ac_hash(p_refresh) and revoked_at is null
   returning id into v_id;
  if v_id is null then return null; end if;
  return jsonb_build_object('access_token', v_access, 'refresh_token', v_refresh, 'expires_in', 900);
end $$;

-- =====================================================================================================
-- 5. Latido del agente
-- =====================================================================================================
-- Devuelve la sesión abierta: el agente solo recopila mientras exista.
create function public.ac_heartbeat(p_secret text, p_access text, p_ip text, p_version text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  d ac_devices%rowtype;
  s ac_sessions%rowtype;
begin
  perform ac_require_api(p_secret);
  update ac_devices
     set last_seen_at = now(), last_ip = p_ip, agent_version = coalesce(p_version, agent_version)
   where access_hash = ac_hash(p_access) and access_expires_at > now() and revoked_at is null
   returning * into d;
  if d.id is null then return null; end if;
  update ac_sessions set last_contact_at = now() where device_id = d.id and status = 'open' returning * into s;
  return jsonb_build_object('session', case when s.id is null then null
    else jsonb_build_object('id', s.id, 'server_id', s.server_id, 'match_uid', s.match_uid, 'started_at', s.started_at) end);
end $$;

-- Desvincular desde la aplicación: el token deja de valer y se cierra la sesión.
create function public.ac_agent_unlink(p_secret text, p_access text) returns boolean
  language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform ac_require_api(p_secret);
  update ac_devices set revoked_at = now()
   where access_hash = ac_hash(p_access) and access_expires_at > now() and revoked_at is null
   returning id into v_id;
  if v_id is null then return false; end if;
  update ac_sessions set status = 'closed', ended_at = now(), end_reason = 'revoked' where device_id = v_id and status = 'open';
  return true;
end $$;

-- =====================================================================================================
-- 6. Bridge (con el token del servidor)
-- =====================================================================================================
-- Se llama al entrar el jugador, al empezar un mix y cada tanto. p_in_mix: si está en un mix, se puede expulsar.
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
  return jsonb_build_object('protected', true, 'linked', v_reason = 'ok', 'reason', v_reason, 'session_id', v_sess,
    'action', case when v_reason <> 'ok' and v_force then 'kick' else 'allow' end);
end $$;

create function public.ac_bridge_end(p_token text, p_steam text, p_reason text default 'disconnect') returns boolean
  language plpgsql security definer set search_path = public as $$
declare
  v_server uuid := csstv_auth(p_token);
begin
  update ac_sessions set status = 'closed', ended_at = now(), end_reason = left(coalesce(p_reason, 'disconnect'), 32)
   where steam_id = p_steam and server_id = v_server and status = 'open';
  return found;
end $$;

-- =====================================================================================================
-- 7. Jugador, público y admin
-- =====================================================================================================
create function public.ac_device_revoke(p_device uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select user_id into v_owner from ac_devices where id = p_device;
  if v_owner is null or (v_owner is distinct from auth.uid() and not ac_can_review()) then
    raise exception 'No puedes desvincular ese equipo' using errcode = '42501';
  end if;
  update ac_devices set revoked_at = coalesce(revoked_at, now()) where id = p_device;
  update ac_sessions set status = 'closed', ended_at = now(), end_reason = 'revoked' where device_id = p_device and status = 'open';
  if v_owner is distinct from auth.uid() then
    insert into ac_admin_actions (actor, action, detail) values (auth.uid(), 'device_revoke', jsonb_build_object('device', p_device));
  end if;
end $$;

-- Lo único público: hechos, sin SteamID, IP ni equipo.
create function public.ac_public_status(p_player uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'agent_linked', exists (select 1 from players p join ac_devices d on d.user_id = p.user_id where p.id = p_player and d.revoked_at is null),
    'sessions_30d', (select count(*) from ac_sessions where player_id = p_player and started_at > now() - interval '30 days'),
    'last_session_at', (select max(started_at) from ac_sessions where player_id = p_player)) $$;

-- Cada lectura queda registrada.
create function public.ac_admin_sessions(p_status text default null, p_limit integer default 50, p_offset integer default 0) returns jsonb
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

-- Si el servicio tuvo problemas, un admin abre los mixes por un rato. 0 los vuelve a cerrar.
create function public.ac_set_open(p_minutes integer) returns timestamptz
  language plpgsql security definer set search_path = public as $$
declare v timestamptz;
begin
  if not ac_can_review() then raise exception 'Solo un admin puede abrir los mixes' using errcode = '42501'; end if;
  if p_minutes is null or p_minutes not between 0 and 720 then raise exception 'Los minutos van de 0 a 720'; end if;
  v := case when p_minutes = 0 then null else now() + make_interval(mins => p_minutes) end;
  update ac_config set open_until = v, updated_at = now() where id = 1;
  insert into ac_admin_actions (actor, action, detail) values (auth.uid(), 'open_mixes', jsonb_build_object('minutes', p_minutes));
  return v;
end $$;

-- =====================================================================================================
-- 8. Quién ejecuta qué
-- =====================================================================================================
revoke all on function public.ac_hash(text), public.ac_token(text), public.ac_user_code(), public.ac_require_api(text),
  public.ac_can_review() from public, anon, authenticated;
grant execute on function public.ac_can_review() to authenticated;

revoke all on function public.ac_link_start(text, text, text), public.ac_link_claim(text, text), public.ac_token_refresh(text, text),
  public.ac_agent_unlink(text, text), public.ac_heartbeat(text, text, text, text), public.ac_bridge_player(text, text, text, boolean, text), public.ac_bridge_end(text, text, text),
  public.ac_link_approve(text), public.ac_device_revoke(uuid), public.ac_public_status(uuid),
  public.ac_admin_sessions(text, integer, integer), public.ac_set_open(integer) from public, anon, authenticated;

grant execute on function public.ac_link_start(text, text, text), public.ac_link_claim(text, text), public.ac_token_refresh(text, text),
  public.ac_agent_unlink(text, text), public.ac_heartbeat(text, text, text, text), public.ac_bridge_player(text, text, text, boolean, text), public.ac_bridge_end(text, text, text),
  public.ac_public_status(uuid) to anon, authenticated;
grant execute on function public.ac_link_approve(text), public.ac_device_revoke(uuid),
  public.ac_admin_sessions(text, integer, integer), public.ac_set_open(integer) to authenticated;

notify pgrst, 'reload schema';

commit;
