-- Replanteo 41: anticheat FRAG, integridad y retención (plan docs/bitacora/2026-10-30-anticheat-integridad).
--   - Cada evidencia lleva una entrada firmada por el equipo, encadenada a la anterior.
--   - La verificación detecta alteraciones posteriores y queda registrada.
--   - Lo probado es que nada cambió desde el envío, NO que el equipo del jugador haya dicho la verdad.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.ac_screenshots') is null then
    raise exception 'replanteo 41: falta ac_screenshots (aplicar antes 40_anticheat_evidencia.sql)';
  end if;
  if to_regclass('public.ac_evidence') is not null then
    raise exception 'replanteo 41: ac_evidence ya existe (¿ya se aplicó?)';
  end if;
end $$;

alter table public.ac_devices add column public_key text check (char_length(public_key) <= 256);
alter table public.ac_sessions add column held boolean not null default false;  -- caso abierto: no vence

create table public.ac_evidence (
  id         bigint generated always as identity primary key,
  session_id uuid not null references public.ac_sessions(id) on delete cascade,
  seq        integer not null check (seq >= 1),
  kind       text not null check (kind in ('processes', 'screenshot')),
  item_sha   text not null check (item_sha ~ '^[0-9a-f]{64}$'),
  prev_hash  text not null check (prev_hash ~ '^[0-9a-f]{64}$'),
  entry      text not null check (char_length(entry) <= 400),   -- lo que firmó el equipo, tal cual
  entry_hash text not null check (entry_hash ~ '^[0-9a-f]{64}$'),
  signature  text not null check (char_length(signature) <= 200),
  raw        text,                                              -- el lote de procesos tal como llegó
  ref_id     uuid,                                              -- la captura
  received_at timestamptz not null default now(),
  unique (session_id, seq)
);

create table public.ac_integrity_logs (
  id         bigint generated always as identity primary key,
  session_id uuid not null references public.ac_sessions(id) on delete cascade,
  result     text not null check (result in ('verified', 'failed', 'incomplete')),
  detail     jsonb not null default '[]',
  checked_by uuid,
  created_at timestamptz not null default now()
);
create index ac_integrity_logs_sesion on public.ac_integrity_logs (session_id, created_at desc);

revoke all on public.ac_evidence, public.ac_integrity_logs from public, anon, authenticated;
alter table public.ac_evidence enable row level security;
alter table public.ac_integrity_logs enable row level security;

-- La clave se fija una sola vez: cambiarla exige volver a vincular.
create function public.ac_device_set_key(p_secret text, p_access text, p_key text) returns boolean
  language plpgsql security definer set search_path = public as $$
declare v uuid := ac_device_of(p_secret, p_access);
begin
  update ac_devices set public_key = p_key where id = v and public_key is null;
  if found then return true; end if;
  return exists (select 1 from ac_devices where id = v and public_key = p_key);
end $$;

create function public.ac_device_key(p_secret text, p_access text) returns text
  language plpgsql stable security definer set search_path = public as $$
declare v uuid := ac_device_of(p_secret, p_access);
begin
  return (select public_key from ac_devices where id = v);
end $$;

-- La firma ya la comprobó la API. Idempotente: un reintento igual no hace nada; otro contenido en el mismo lugar es un error.
create function public.ac_evidence_append(p_secret text, p_access text, p_session uuid, p_seq integer, p_kind text, p_item_sha text,
    p_prev text, p_entry text, p_entry_hash text, p_signature text, p_raw text default null, p_ref uuid default null) returns boolean
  language plpgsql security definer set search_path = public as $$
declare
  v_device uuid := ac_device_of(p_secret, p_access);
  r ac_evidence%rowtype;
begin
  if not exists (select 1 from ac_sessions where id = p_session and device_id = v_device) then
    raise exception 'La sesión no es de este equipo';
  end if;
  insert into ac_evidence (session_id, seq, kind, item_sha, prev_hash, entry, entry_hash, signature, raw, ref_id)
    values (p_session, p_seq, p_kind, p_item_sha, p_prev, p_entry, p_entry_hash, p_signature, p_raw, p_ref)
    on conflict (session_id, seq) do nothing;
  select * into r from ac_evidence where session_id = p_session and seq = p_seq;
  if r.entry_hash <> p_entry_hash then
    insert into ac_integrity_logs (session_id, result, detail)
      values (p_session, 'failed', jsonb_build_array(jsonb_build_object('seq', p_seq, 'problem', 'duplicate_seq')));
    raise exception 'Ya hay otra entrada en esa posición de la cadena';
  end if;
  return true;
end $$;

-- Una firma rechazada también deja rastro.
create function public.ac_integrity_reject(p_secret text, p_access text, p_session uuid, p_problem text) returns void
  language plpgsql security definer set search_path = public as $$
declare v_device uuid := ac_device_of(p_secret, p_access);
begin
  if exists (select 1 from ac_sessions where id = p_session and device_id = v_device) then
    insert into ac_integrity_logs (session_id, result, detail)
      values (p_session, 'failed', jsonb_build_array(jsonb_build_object('problem', left(p_problem, 40))));
  end if;
end $$;

-- ---------- admin ----------
-- Todo lo necesario para verificar en la API, que tiene WebCrypto y acceso a Storage.
create function public.ac_admin_chain(p_session uuid) returns jsonb
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

create function public.ac_admin_record_integrity(p_session uuid, p_result text, p_detail jsonb) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not ac_can_review() then raise exception 'Solo un admin puede verificar' using errcode = '42501'; end if;
  insert into ac_integrity_logs (session_id, result, detail, checked_by) values (p_session, p_result, p_detail, auth.uid());
  insert into ac_admin_actions (actor, action, detail) values (auth.uid(), 'integrity_check', jsonb_build_object('session', p_session, 'result', p_result));
end $$;

create function public.ac_admin_hold(p_session uuid, p_held boolean) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not ac_can_review() then raise exception 'Solo un admin puede cambiar esto' using errcode = '42501'; end if;
  update ac_sessions set held = p_held where id = p_session;
  if not found then raise exception 'No se encontró esa sesión'; end if;
  insert into ac_admin_actions (actor, action, detail) values (auth.uid(), 'hold', jsonb_build_object('session', p_session, 'held', p_held));
end $$;

-- ---------- retención (cron con la clave de servicio) ----------
create function public.ac_retention_due(p_limit integer default 500) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'sessions', coalesce((select jsonb_agg(id) from (
        select s.id from ac_sessions s, ac_config c
         where c.id = 1 and not s.held and s.status <> 'open' and s.started_at < now() - make_interval(days => c.retention_days)
         order by s.started_at limit greatest(p_limit, 1)) x), '[]'::jsonb)) $$;

create function public.ac_retention_paths(p_session uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(storage_path), '[]'::jsonb) from ac_screenshots where session_id = p_session $$;

-- Se llama después de borrar los archivos. Las acciones de admin se conservan.
create function public.ac_retention_delete(p_session uuid) returns boolean
  language plpgsql security definer set search_path = public as $$
begin
  delete from ac_sessions where id = p_session and not held and status <> 'open';
  return found;
end $$;

revoke all on function public.ac_retention_due(integer), public.ac_retention_paths(uuid), public.ac_retention_delete(uuid) from public, anon, authenticated;
grant execute on function public.ac_retention_due(integer), public.ac_retention_paths(uuid), public.ac_retention_delete(uuid) to service_role;

revoke all on function public.ac_device_set_key(text, text, text), public.ac_device_key(text, text),
  public.ac_evidence_append(text, text, uuid, integer, text, text, text, text, text, text, text, uuid), public.ac_integrity_reject(text, text, uuid, text),
  public.ac_admin_chain(uuid), public.ac_admin_record_integrity(uuid, text, jsonb), public.ac_admin_hold(uuid, boolean) from public, anon, authenticated;
grant execute on function public.ac_device_set_key(text, text, text), public.ac_device_key(text, text),
  public.ac_evidence_append(text, text, uuid, integer, text, text, text, text, text, text, text, uuid), public.ac_integrity_reject(text, text, uuid, text) to anon, authenticated;
grant execute on function public.ac_admin_chain(uuid), public.ac_admin_record_integrity(uuid, text, jsonb), public.ac_admin_hold(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
