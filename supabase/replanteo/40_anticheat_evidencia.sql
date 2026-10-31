-- Replanteo 40: anticheat FRAG, procesos y capturas (plan docs/bitacora/2026-10-30-anticheat-evidencia).
--   - El agente manda eventos de procesos y capturas solo de una sesión de su equipo.
--   - Lo pendiente de una sesión cerrada se acepta, pero solo si se observó antes de que cerrara (más un margen de 1 minuto).
--   - Todo es idempotente: reintentar no duplica. Nada de esto es público.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.ac_sessions') is null then
    raise exception 'replanteo 40: falta ac_sessions (aplicar antes 39_anticheat.sql)';
  end if;
  if to_regclass('public.ac_screenshots') is not null then
    raise exception 'replanteo 40: ac_screenshots ya existe (¿ya se aplicó?)';
  end if;
end $$;

alter table public.ac_config
  add column capture_min_s integer not null default 180 check (capture_min_s between 30 and 3600),
  add column capture_max_s integer not null default 300 check (capture_max_s between 30 and 3600);
alter table public.ac_config add constraint ac_config_capture_rango check (capture_min_s <= capture_max_s);

create table public.ac_process_events (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.ac_sessions(id) on delete cascade,
  client_id   text not null check (char_length(client_id) between 1 and 64),
  kind        text not null check (kind in ('inventory', 'start', 'end')),
  pid         integer not null,
  name        text not null check (char_length(name) <= 260),
  path        text check (char_length(path) <= 1024),
  sha256      text check (sha256 ~ '^[0-9a-f]{64}$'),
  signature   text check (signature in ('valid', 'unsigned', 'invalid', 'unknown')),
  publisher   text check (char_length(publisher) <= 200),
  note        text check (char_length(note) <= 64),      -- por qué falta un dato; nunca es indicio de trampa
  started_at  timestamptz,
  observed_at timestamptz not null,
  received_at timestamptz not null default now(),
  unique (session_id, client_id)
);
create index ac_process_events_sesion on public.ac_process_events (session_id, observed_at);
create index ac_process_events_sha on public.ac_process_events (sha256) where sha256 is not null;

create table public.ac_capture_requests (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.ac_sessions(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  reason       text not null check (char_length(btrim(reason)) between 3 and 200),
  status       text not null default 'pending' check (status in ('pending', 'done', 'not_foreground', 'failed', 'expired')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index ac_capture_requests_sesion on public.ac_capture_requests (session_id) where status = 'pending';

create table public.ac_screenshots (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.ac_sessions(id) on delete cascade,
  client_id    text not null check (char_length(client_id) between 1 and 64),
  request_id   uuid references public.ac_capture_requests(id) on delete set null,
  kind         text not null check (kind in ('auto', 'manual')),
  method       text not null check (method in ('desktop_duplication', 'bitblt_screen')),
  storage_path text not null unique,
  sha256       text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes   integer not null check (size_bytes between 1 and 5242880),
  width        integer not null check (width between 1 and 16384),
  height       integer not null check (height between 1 and 16384),
  taken_at     timestamptz not null,
  stored_at    timestamptz,                               -- null: registrada, sin confirmar en Storage
  created_at   timestamptz not null default now(),
  unique (session_id, client_id)
);
create index ac_screenshots_sesion on public.ac_screenshots (session_id, taken_at);

revoke all on public.ac_process_events, public.ac_capture_requests, public.ac_screenshots from public, anon, authenticated;
alter table public.ac_process_events enable row level security;
alter table public.ac_capture_requests enable row level security;
alter table public.ac_screenshots enable row level security;

-- Equipo dueño del token de acceso, o error.
create function public.ac_device_of(p_secret text, p_access text) returns uuid
  language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  perform ac_require_api(p_secret);
  select id into v from ac_devices where access_hash = ac_hash(p_access) and access_expires_at > now() and revoked_at is null;
  if v is null then raise exception 'Token de agente inválido' using errcode = '42501'; end if;
  return v;
end $$;

-- ¿Se puede aceptar algo observado en ese momento para esa sesión?
create function public.ac_session_accepts(p_session uuid, p_device uuid, p_at timestamptz) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from ac_sessions s where s.id = p_session and s.device_id = p_device
    and p_at >= s.started_at - interval '1 minute' and p_at <= now() + interval '5 minutes'
    and (s.ended_at is null or p_at <= s.ended_at + interval '1 minute')) $$;

create function public.ac_ingest_processes(p_secret text, p_access text, p_session uuid, p_events jsonb) returns jsonb
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

create function public.ac_screenshot_register(p_secret text, p_access text, p_session uuid, p_client_id text, p_sha256 text, p_size integer,
    p_width integer, p_height integer, p_method text, p_kind text, p_taken timestamptz, p_request uuid default null) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_device uuid := ac_device_of(p_secret, p_access);
  v_id uuid := gen_random_uuid();
  r ac_screenshots%rowtype;
begin
  if not ac_session_accepts(p_session, v_device, p_taken) then raise exception 'La captura no corresponde a una sesión de este equipo'; end if;
  if p_request is not null and not exists (select 1 from ac_capture_requests where id = p_request and session_id = p_session) then
    raise exception 'La solicitud no es de esta sesión';
  end if;
  insert into ac_screenshots (id, session_id, client_id, request_id, kind, method, storage_path, sha256, size_bytes, width, height, taken_at)
    values (v_id, p_session, p_client_id, p_request, p_kind, p_method, p_session::text || '/' || v_id::text || '.jpg', p_sha256, p_size, p_width, p_height, p_taken)
    on conflict (session_id, client_id) do nothing;
  select * into r from ac_screenshots where session_id = p_session and client_id = p_client_id;
  if r.sha256 <> p_sha256 then raise exception 'Ya hay otra captura con ese identificador'; end if;
  return jsonb_build_object('id', r.id, 'storage_path', r.storage_path, 'already_stored', r.stored_at is not null);
end $$;

create function public.ac_screenshot_stored(p_secret text, p_access text, p_id uuid) returns boolean
  language plpgsql security definer set search_path = public as $$
declare
  v_device uuid := ac_device_of(p_secret, p_access);
  r ac_screenshots%rowtype;
begin
  update ac_screenshots s set stored_at = coalesce(s.stored_at, now())
    from ac_sessions x where s.id = p_id and x.id = s.session_id and x.device_id = v_device
    returning s.* into r;
  if r.id is null then return false; end if;
  update ac_capture_requests set status = 'done', resolved_at = now() where id = r.request_id and status = 'pending';
  return true;
end $$;

create function public.ac_capture_result(p_secret text, p_access text, p_request uuid, p_result text) returns boolean
  language plpgsql security definer set search_path = public as $$
declare v_device uuid := ac_device_of(p_secret, p_access);
begin
  if p_result not in ('not_foreground', 'failed') then raise exception 'Resultado inválido'; end if;
  update ac_capture_requests q set status = p_result, resolved_at = now()
    from ac_sessions s where q.id = p_request and q.status = 'pending' and s.id = q.session_id and s.device_id = v_device;
  return found;
end $$;

-- El latido suma la política de capturas y las solicitudes pendientes.
create or replace function public.ac_heartbeat(p_secret text, p_access text, p_ip text, p_version text) returns jsonb
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

-- ---------- admin ----------
create function public.ac_admin_request_capture(p_session uuid, p_reason text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not ac_can_review() then raise exception 'Solo un admin puede pedir capturas' using errcode = '42501'; end if;
  if not exists (select 1 from ac_sessions where id = p_session and status = 'open') then raise exception 'La sesión no está abierta'; end if;
  if exists (select 1 from ac_capture_requests where session_id = p_session and created_at > now() - interval '1 minute') then
    raise exception 'Ya se pidió una captura de esta sesión hace menos de un minuto';
  end if;
  insert into ac_capture_requests (session_id, requested_by, reason) values (p_session, auth.uid(), p_reason) returning id into v;
  insert into ac_admin_actions (actor, action, detail) values (auth.uid(), 'capture_request', jsonb_build_object('session', p_session, 'request', v, 'reason', p_reason));
  return v;
end $$;

-- Cada lectura queda registrada. Son hechos observados, no conclusiones.
create function public.ac_admin_session_evidence(p_session uuid) returns jsonb
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

revoke all on function public.ac_device_of(text, text), public.ac_session_accepts(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.ac_ingest_processes(text, text, uuid, jsonb),
  public.ac_screenshot_register(text, text, uuid, text, text, integer, integer, integer, text, text, timestamptz, uuid),
  public.ac_screenshot_stored(text, text, uuid), public.ac_capture_result(text, text, uuid, text),
  public.ac_admin_request_capture(uuid, text), public.ac_admin_session_evidence(uuid) from public, anon, authenticated;
grant execute on function public.ac_ingest_processes(text, text, uuid, jsonb),
  public.ac_screenshot_register(text, text, uuid, text, text, integer, integer, integer, text, text, timestamptz, uuid),
  public.ac_screenshot_stored(text, text, uuid), public.ac_capture_result(text, text, uuid, text) to anon, authenticated;
grant execute on function public.ac_admin_request_capture(uuid, text), public.ac_admin_session_evidence(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
