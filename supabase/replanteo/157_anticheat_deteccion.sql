-- Replanteo 157: detección, marcas, firmas, latido firmado, configuración remota y capturas a 7 días
-- (plan docs/bitacora/2026-11-27-anticheat-deteccion). Va después de la 156.
--   1. Eventos nuevos del agente 0.5.0: handle (procesos con permiso sobre la memoria del juego), overlay, driver y game_file,
--      con detail jsonb.
--   2. ac_signatures: hashes o nombres de trampas (bad) y de programas conocidos (good). Quedan en la base: nunca viajan al agente.
--   3. ac_flags: marcas para el staff, creadas solas por un trigger sobre ac_process_events, por el latido y por el Bridge.
--   4. ac_config: configuración remota del agente, última versión, versión mínima, hashes permitidos del .exe, capturas cada
--      30-35 s (Kyan, 2026-11-27) y las capturas se borran a los 7 días (salvo una sesión conservada).
--   5. El latido: firmado (p_ts), con puertos del juego y hash del agente. Devuelve la configuración y la actualización.
--   6. El Bridge: p_port, y los motivos agent_modified y agent_outdated (AC-4) y machine_banned (AC-5, la 158).
--   7. Funciones del panel: marcas, revisión, buscar hash, firmas y configuración.
-- Nada de esto se le muestra al jugador (Kyan, 2026-11-27).
begin;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ac_devices' and column_name = 'game_reported_at') then
    raise exception 'replanteo 157: falta la 156 (ac_devices.game_reported_at)';
  end if;
  if to_regclass('public.ac_flags') is not null then
    raise exception 'replanteo 157: ac_flags ya existe (¿ya se aplicó?)';
  end if;
end $$;

-- =====================================================================================================
-- 1. Eventos nuevos
-- =====================================================================================================
alter table public.ac_process_events drop constraint ac_process_events_kind_check;
alter table public.ac_process_events add constraint ac_process_events_kind_check
  check (kind in ('inventory', 'start', 'end', 'module', 'handle', 'overlay', 'driver', 'game_file'));
alter table public.ac_process_events add column detail jsonb check (detail is null or (jsonb_typeof(detail) = 'object' and pg_column_size(detail) <= 2048));
comment on column public.ac_process_events.kind is
  'inventory, start y end: programas de la PC. module: DLL en el juego. handle: proceso con permiso sobre la memoria del juego. overlay: ventana transparente encima del juego. driver. game_file: archivo de la carpeta del juego';

-- Como en la 46, con detail.
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
    insert into ac_process_events (session_id, client_id, kind, pid, name, path, sha256, signature, publisher, note, started_at, observed_at, detail)
      values (p_session, e->>'client_id', e->>'kind', (e->>'pid')::integer, e->>'name', e->>'path', e->>'sha256', e->>'signature',
              e->>'publisher', e->>'note', (e->>'started_at')::timestamptz, v_at,
              case when jsonb_typeof(e->'detail') = 'object' then e->'detail' end)
      on conflict (session_id, client_id) do nothing;
    v_ok := v_ok + 1;
  end loop;
  return jsonb_build_object('accepted', v_ok, 'rejected', v_skip);
end $$;

-- =====================================================================================================
-- 2. Firmas
-- =====================================================================================================
create table public.ac_signatures (
  id         uuid primary key default gen_random_uuid(),
  sha256     text check (sha256 ~ '^[0-9a-f]{64}$'),
  name       text check (name = lower(name) and char_length(name) between 1 and 260),  -- nombre del archivo, en minúsculas
  kinds      text[],                                                                    -- null: cualquier tipo de evento
  verdict    text not null check (verdict in ('bad', 'good')),
  label      text not null check (char_length(btrim(label)) between 1 and 120),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ac_signatures_algo check (sha256 is not null or name is not null)
);
create index ac_signatures_sha on public.ac_signatures (sha256) where sha256 is not null;
create index ac_signatures_name on public.ac_signatures (name) where name is not null;
comment on table public.ac_signatures is 'bad: trampa conocida (marca grave). good: conocido y limpio (no marca por firma ausente, overlay ni handle). game_file good: hash bueno de un archivo del juego';
alter table public.ac_signatures enable row level security;
revoke all on public.ac_signatures from public, anon, authenticated;

-- =====================================================================================================
-- 3. Marcas
-- =====================================================================================================
create table public.ac_flags (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.ac_sessions(id) on delete cascade,
  rule        text not null check (char_length(rule) <= 40),
  severity    smallint not null check (severity between 1 and 3),   -- 1 leve, 2 revisar, 3 grave
  dedupe      text not null default '' check (char_length(dedupe) <= 300),
  detail      jsonb not null default '{}',
  event_id    bigint references public.ac_process_events(id) on delete set null,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text check (char_length(review_note) <= 300),
  unique (session_id, rule, dedupe)
);
create index ac_flags_abiertas on public.ac_flags (severity desc, created_at desc) where reviewed_at is null;
create index ac_flags_sesion on public.ac_flags (session_id);
comment on table public.ac_flags is 'Marcas para revisar. Son hechos observados, no conclusiones: la decisión es de una persona';
alter table public.ac_flags enable row level security;
revoke all on public.ac_flags from public, anon, authenticated;

create function public.ac_flag(p_session uuid, p_rule text, p_severity smallint, p_dedupe text, p_detail jsonb, p_event bigint default null) returns void
  language sql security definer set search_path = public as $$
  insert into ac_flags (session_id, rule, severity, dedupe, detail, event_id)
  values (p_session, p_rule, p_severity, left(coalesce(p_dedupe, ''), 300), coalesce(p_detail, '{}'), p_event)
  on conflict (session_id, rule, dedupe) do nothing $$;

-- Las reglas, por cada evento que llega.
create function public.ac_flag_event() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_name text := lower(new.name);
  v_good boolean;
  v_bad  ac_signatures%rowtype;
  v_info jsonb := jsonb_build_object('kind', new.kind, 'name', new.name, 'path', new.path, 'sha256', new.sha256, 'signature', new.signature,
                                     'publisher', new.publisher, 'detail', new.detail);
  v_parent boolean := coalesce((new.detail->>'parent')::boolean, false);
begin
  -- Trampa conocida, por hash o por nombre.
  select * into v_bad from ac_signatures s
   where s.verdict = 'bad' and (s.kinds is null or new.kind = any(s.kinds))
     and ((s.sha256 is not null and s.sha256 = new.sha256) or (s.sha256 is null and s.name = v_name))
   limit 1;
  if v_bad.id is not null then
    perform ac_flag(new.session_id, case when v_bad.sha256 is not null then 'signature' else 'signature_name' end, 3::smallint,
                    coalesce(new.sha256, v_name), v_info || jsonb_build_object('label', v_bad.label), new.id);
    return new;
  end if;

  v_good := exists (select 1 from ac_signatures s
                     where s.verdict = 'good' and (s.kinds is null or new.kind = any(s.kinds))
                       and ((s.sha256 is not null and s.sha256 = new.sha256) or (s.sha256 is null and s.name = v_name)));
  if v_good then return new; end if;

  if new.kind = 'module' and new.signature in ('unsigned', 'invalid') then
    perform ac_flag(new.session_id, 'module_unsigned', (case when new.signature = 'invalid' then 3 else 2 end)::smallint, coalesce(new.sha256, v_name), v_info, new.id);
  elsif new.kind = 'handle' then
    perform ac_flag(new.session_id, case when v_parent then 'handle_parent' else 'handle_to_game' end,
                    (case when v_parent then 1 when coalesce(new.signature, 'unknown') <> 'valid' then 3 else 2 end)::smallint,
                    coalesce(new.sha256, v_name) || ':' || coalesce(new.detail->>'access', ''), v_info, new.id);
  elsif new.kind = 'overlay' then
    perform ac_flag(new.session_id, 'overlay', (case when coalesce(new.signature, 'unknown') <> 'valid' then 2 else 1 end)::smallint,
                    coalesce(new.sha256, v_name) || ':' || coalesce(new.detail->>'class', ''), v_info, new.id);
  elsif new.kind = 'driver' and new.signature in ('unsigned', 'invalid') then
    perform ac_flag(new.session_id, 'driver_unsigned', (case when new.signature = 'invalid' then 3 else 2 end)::smallint, coalesce(new.sha256, v_name), v_info, new.id);
  elsif new.kind = 'game_file' and new.sha256 is not null
        and exists (select 1 from ac_signatures s where s.verdict = 'good' and s.name = v_name and 'game_file' = any(s.kinds) and s.sha256 is not null) then
    -- Hay hashes buenos cargados para ese archivo y este no es ninguno.
    perform ac_flag(new.session_id, 'game_file_unknown', 2::smallint, v_name || ':' || new.sha256, v_info, new.id);
  end if;
  return new;
end $$;
create trigger ac_flag_event after insert on public.ac_process_events for each row execute function public.ac_flag_event();

-- =====================================================================================================
-- 4. Configuración del agente y capturas
-- =====================================================================================================
alter table public.ac_config
  add column agent_config jsonb not null default
    '{"handles": true, "overlays": true, "drivers": true, "game_files": true, "handles_every": 10, "overlays_every": 5, "modules_every": 5}'
    check (jsonb_typeof(agent_config) = 'object'),
  add column agent_latest jsonb check (agent_latest is null or (agent_latest ? 'version' and agent_latest ? 'url' and agent_latest ? 'sha256')),
  add column agent_min_version text check (agent_min_version ~ '^\d+\.\d+\.\d+$'),
  add column agent_hashes text[] not null default '{}',  -- vacío: no se controla el hash del .exe
  add column screenshot_retention_days integer not null default 7 check (screenshot_retention_days between 1 and 365);
comment on column public.ac_config.agent_latest is '{"version":"0.5.1","url":"https://cmleague.lat/…/CMLeagueAC.exe","sha256":"…"}: el agente se actualiza solo fuera de una sesión';
comment on column public.ac_config.screenshot_retention_days is 'Las capturas se borran a los N días (Kyan, 2026-11-27: 7), salvo una sesión conservada. El resto de la evidencia, a retention_days';

-- Una captura cada 30 a 35 s (Kyan, 2026-11-27), al azar dentro del rango.
alter table public.ac_config alter column capture_min_s set default 30, alter column capture_max_s set default 35;
update public.ac_config set capture_min_s = 30, capture_max_s = 35 where id = 1;

alter table public.ac_screenshots add column purged_at timestamptz;
comment on column public.ac_screenshots.purged_at is 'El archivo se borró por vencimiento (screenshot_retention_days). La fila queda para la cadena de integridad';

alter table public.ac_devices
  add column agent_sha  text check (agent_sha ~ '^[0-9a-f]{64}$'),
  add column agent_ok   boolean,            -- false: el hash del .exe no está en agent_hashes
  add column game_ports integer[],
  add column hb_last_ts bigint;             -- último ts firmado: uno igual o anterior se rechaza

-- 'a' < 'b', con versiones x.y.z.
create function public.ac_version_lt(a text, b text) returns boolean language sql immutable as $$
  select case when a !~ '^\d+\.\d+\.\d+$' or b !~ '^\d+\.\d+\.\d+$' then false
              else string_to_array(a, '.')::int[] < string_to_array(b, '.')::int[] end $$;

-- Lugar para el ban por máquina (la 158 la reemplaza). Devuelve true si el equipo quedó bloqueado.
create function public.ac_heartbeat_machine(p_device uuid, p_hw jsonb) returns boolean language sql stable as $$ select false $$;
create function public.ac_device_machine_banned(p_device uuid) returns boolean language sql stable as $$ select false $$;

-- =====================================================================================================
-- 5. Latido
-- =====================================================================================================
-- p_ts: el unix del latido firmado (la API ya comprobó la firma con la clave del equipo). null: sin firma, que solo vale mientras
-- el equipo no registró su clave y en los primeros 10 minutos. p_game: {clientmod, hl2, ports}. p_hw: identificadores (la 158).
drop function public.ac_heartbeat(text, text, text, text, jsonb);
create function public.ac_heartbeat(p_secret text, p_access text, p_ip text, p_version text, p_game jsonb default null,
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

  if ac_heartbeat_machine(d.id, p_hw) then return null; end if;  -- Máquina baneada: el equipo quedó revocado (la 158)

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

-- =====================================================================================================
-- 6. Bridge
-- =====================================================================================================
-- Como en la 156, más p_port (el puerto que ve el servidor) y tres motivos que expulsan siempre:
-- agent_modified y agent_outdated (AC-4) y machine_banned (AC-5, la 158).
drop function public.ac_bridge_player(text, text, text, boolean, text);
create function public.ac_bridge_player(p_token text, p_steam text, p_ip text, p_in_mix boolean default false, p_match_uid text default null,
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

-- =====================================================================================================
-- 7. Panel
-- =====================================================================================================
-- Como en la 45, con las marcas abiertas y la más grave.
create or replace function public.ac_admin_sessions(p_status text default null, p_limit integer default 50, p_offset integer default 0) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not ac_can_review() then raise exception 'Solo un admin puede ver las sesiones' using errcode = '42501'; end if;
  insert into ac_admin_actions (actor, action, detail) values (auth.uid(), 'sessions_read', jsonb_build_object('status', p_status, 'offset', p_offset));
  select coalesce(jsonb_agg(x), '[]') into v from (
    select s.id, s.player_id, p.nick, s.steam_id, s.server_id, g.name as server_name, s.match_uid, s.status,
           s.started_at, s.last_contact_at, s.ended_at, s.end_reason,
           (select count(*) from ac_flags f where f.session_id = s.id and f.reviewed_at is null) as open_flags,
           (select max(f.severity) from ac_flags f where f.session_id = s.id and f.reviewed_at is null) as max_severity
      from ac_sessions s
      join players p on p.id = s.player_id
      join game_servers g on g.id = s.server_id
     where p_status is null or s.status = p_status
     order by s.started_at desc
     limit least(greatest(coalesce(p_limit, 50), 1), 100) offset greatest(coalesce(p_offset, 0), 0)) x;
  return v;
end $$;

-- Como en la 46, con detail en los eventos, las marcas de la sesión y si la captura ya venció.
create or replace function public.ac_admin_session_evidence(p_session uuid) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not ac_can_review() then raise exception 'Solo un admin puede ver la evidencia' using errcode = '42501'; end if;
  if not exists (select 1 from ac_sessions where id = p_session) then return null; end if;
  insert into ac_admin_actions (actor, action, detail) values (auth.uid(), 'evidence_read', jsonb_build_object('session', p_session));
  select jsonb_build_object(
    'screenshots', coalesce((select jsonb_agg(to_jsonb(x) order by x.taken_at) from (
        select id, kind, method, storage_path, sha256, size_bytes, width, height, taken_at, stored_at, request_id, purged_at
          from ac_screenshots where session_id = p_session) x), '[]'::jsonb),
    'processes', coalesce((select jsonb_agg(to_jsonb(x) order by x.observed_at) from (
        select kind, pid, name, path, sha256, signature, publisher, note, started_at, observed_at, detail
          from ac_process_events where session_id = p_session order by observed_at limit 5000) x), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from (
        select id, reason, status, created_at, resolved_at from ac_capture_requests where session_id = p_session) x), '[]'::jsonb),
    'flags', coalesce((select jsonb_agg(to_jsonb(x) order by x.severity desc, x.created_at) from (
        select id, rule, severity, detail, created_at, reviewed_at, review_note from ac_flags where session_id = p_session) x), '[]'::jsonb)) into v;
  return v;
end $$;

-- Las marcas de todas las sesiones, las más graves primero.
create function public.ac_admin_flags(p_open boolean default true, p_min_severity integer default 1, p_limit integer default 50, p_offset integer default 0) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not ac_can_review() then raise exception 'Solo un admin puede ver las marcas' using errcode = '42501'; end if;
  insert into ac_admin_actions (actor, action, detail) values (auth.uid(), 'flags_read', jsonb_build_object('open', p_open, 'offset', p_offset));
  select coalesce(jsonb_agg(x), '[]') into v from (
    select f.id, f.session_id, f.rule, f.severity, f.detail, f.created_at, f.reviewed_at, f.review_note,
           s.player_id, p.nick, s.steam_id, g.name as server_name, s.started_at, s.status
      from ac_flags f
      join ac_sessions s on s.id = f.session_id
      join players p on p.id = s.player_id
      join game_servers g on g.id = s.server_id
     where (not coalesce(p_open, true) or f.reviewed_at is null) and f.severity >= coalesce(p_min_severity, 1)
     order by f.reviewed_at is null desc, f.severity desc, f.created_at desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)) x;
  return v;
end $$;

create function public.ac_admin_flag_review(p_flag bigint, p_note text default null) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not ac_can_review() then raise exception 'Solo un admin puede revisar marcas' using errcode = '42501'; end if;
  update ac_flags set reviewed_at = now(), reviewed_by = auth.uid(), review_note = left(nullif(btrim(p_note), ''), 300)
   where id = p_flag and reviewed_at is null;
  if not found then raise exception 'No existe esa marca o ya está revisada'; end if;
  insert into ac_admin_actions (actor, action, detail) values (auth.uid(), 'flag_review', jsonb_build_object('flag', p_flag));
end $$;

-- Dónde apareció un hash: qué jugadores, en qué sesiones y como qué.
create function public.ac_admin_hash_search(p_sha256 text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not ac_can_review() then raise exception 'Solo un admin puede buscar hashes' using errcode = '42501'; end if;
  if p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'El hash tiene que ser un SHA-256 en minúsculas'; end if;
  insert into ac_admin_actions (actor, action, detail) values (auth.uid(), 'hash_search', jsonb_build_object('sha256', p_sha256));
  select jsonb_build_object(
    'players', (select count(distinct s.player_id) from ac_process_events e join ac_sessions s on s.id = e.session_id where e.sha256 = p_sha256),
    'items', coalesce((select jsonb_agg(x) from (
        select s.player_id, p.nick, s.steam_id, e.session_id, e.kind, e.name, e.path, min(e.observed_at) as first_seen, count(*) as times
          from ac_process_events e
          join ac_sessions s on s.id = e.session_id
          join players p on p.id = s.player_id
         where e.sha256 = p_sha256
         group by s.player_id, p.nick, s.steam_id, e.session_id, e.kind, e.name, e.path
         order by min(e.observed_at) desc
         limit 200) x), '[]'::jsonb),
    'signature', (select to_jsonb(g) from ac_signatures g where g.sha256 = p_sha256 limit 1)) into v;
  return v;
end $$;

create function public.ac_admin_signatures() returns jsonb
  language plpgsql security definer set search_path = public as $$
begin
  if not ac_can_review() then raise exception 'Solo un admin puede ver las firmas' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc) from ac_signatures s), '[]'::jsonb);
end $$;

create function public.ac_admin_signature_add(p_sha256 text, p_name text, p_kinds text[], p_verdict text, p_label text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not ac_can_review() then raise exception 'Solo un admin puede cargar firmas' using errcode = '42501'; end if;
  if p_kinds is not null and not (p_kinds <@ array['inventory', 'start', 'end', 'module', 'handle', 'overlay', 'driver', 'game_file']) then
    raise exception 'Tipo de evento desconocido';
  end if;
  insert into ac_signatures (sha256, name, kinds, verdict, label, created_by)
  values (nullif(lower(btrim(p_sha256)), ''), nullif(lower(btrim(p_name)), ''), p_kinds, p_verdict, btrim(p_label), auth.uid())
  returning id into v;
  insert into ac_admin_actions (actor, action, detail) values (auth.uid(), 'signature_add', jsonb_build_object('id', v, 'verdict', p_verdict));
  return v;
end $$;

create function public.ac_admin_signature_remove(p_id uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not ac_can_review() then raise exception 'Solo un admin puede borrar firmas' using errcode = '42501'; end if;
  delete from ac_signatures where id = p_id;
  if not found then raise exception 'No existe esa firma'; end if;
  insert into ac_admin_actions (actor, action, detail) values (auth.uid(), 'signature_remove', jsonb_build_object('id', p_id));
end $$;

create function public.ac_admin_agent_config() returns jsonb
  language plpgsql security definer set search_path = public as $$
begin
  if not ac_can_review() then raise exception 'Solo un admin puede ver la configuración' using errcode = '42501'; end if;
  return (select jsonb_build_object('agent_config', agent_config, 'agent_latest', agent_latest, 'agent_min_version', agent_min_version,
                                    'agent_hashes', to_jsonb(agent_hashes), 'capture_min_s', capture_min_s, 'capture_max_s', capture_max_s,
                                    'screenshot_retention_days', screenshot_retention_days, 'retention_days', retention_days)
            from ac_config where id = 1);
end $$;

-- Cambia solo las claves que vienen. Queda registrado.
create function public.ac_admin_set_agent_config(p jsonb) returns jsonb
  language plpgsql security definer set search_path = public as $$
begin
  if not ac_can_review() then raise exception 'Solo un admin puede cambiar la configuración' using errcode = '42501'; end if;
  update ac_config set
    agent_config = case when p ? 'agent_config' then p->'agent_config' else agent_config end,
    agent_latest = case when p ? 'agent_latest' then nullif(p->'agent_latest', 'null'::jsonb) else agent_latest end,
    agent_min_version = case when p ? 'agent_min_version' then nullif(p->>'agent_min_version', '') else agent_min_version end,
    agent_hashes = case when p ? 'agent_hashes' then coalesce((select array_agg(lower(x.v)) from jsonb_array_elements_text(p->'agent_hashes') as x(v)), '{}') else agent_hashes end,
    capture_min_s = coalesce((p->>'capture_min_s')::integer, capture_min_s),
    capture_max_s = coalesce((p->>'capture_max_s')::integer, capture_max_s),
    screenshot_retention_days = coalesce((p->>'screenshot_retention_days')::integer, screenshot_retention_days),
    retention_days = coalesce((p->>'retention_days')::integer, retention_days),
    updated_at = now()
   where id = 1;
  insert into ac_admin_actions (actor, action, detail) values (auth.uid(), 'agent_config', p);
  return ac_admin_agent_config();
end $$;

-- =====================================================================================================
-- 8. Capturas a 7 días (cron con la clave de servicio)
-- =====================================================================================================
create function public.ac_screenshot_retention_due(p_limit integer default 500) returns jsonb
  language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'storage_path', x.storage_path)), '[]'::jsonb) from (
    select sc.id, sc.storage_path
      from ac_screenshots sc
      join ac_sessions s on s.id = sc.session_id
      cross join ac_config c
     where c.id = 1 and not s.held and sc.stored_at is not null and sc.purged_at is null
       and sc.taken_at < now() - make_interval(days => c.screenshot_retention_days)
     order by sc.taken_at limit greatest(p_limit, 1)) x $$;

-- Como en la 47, con purged por captura: la verificación no cuenta como falla un archivo borrado por vencimiento.
create or replace function public.ac_admin_chain(p_session uuid) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
begin
  if not ac_can_review() then raise exception 'Solo un admin puede verificar' using errcode = '42501'; end if;
  if not exists (select 1 from ac_sessions where id = p_session) then return null; end if;
  return jsonb_build_object(
    'public_key', (select d.public_key from ac_sessions s join ac_devices d on d.id = s.device_id where s.id = p_session),
    'entries', coalesce((select jsonb_agg(to_jsonb(e) order by e.seq) from (select seq, kind, item_sha, prev_hash, entry, entry_hash, signature, raw, ref_id from ac_evidence where session_id = p_session) e), '[]'::jsonb),
    'screenshots', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'sha256', sha256, 'storage_path', storage_path, 'stored', stored_at is not null,
                                                                 'purged', purged_at is not null)) from ac_screenshots where session_id = p_session), '[]'::jsonb),
    'processes', coalesce((select jsonb_agg(jsonb_build_object('client_id', client_id, 'name', name, 'path', path, 'sha256', sha256)) from ac_process_events where session_id = p_session), '[]'::jsonb));
end $$;

-- Se llama después de borrar los archivos.
create function public.ac_screenshot_purged(p_ids uuid[]) returns integer
  language sql security definer set search_path = public as $$
  with u as (update ac_screenshots set purged_at = now() where id = any(p_ids) and purged_at is null returning 1) select count(*)::integer from u $$;

-- =====================================================================================================
-- 9. Permisos
-- =====================================================================================================
revoke all on function public.ac_flag(uuid, text, smallint, text, jsonb, bigint), public.ac_flag_event(),
  public.ac_heartbeat_machine(uuid, jsonb), public.ac_device_machine_banned(uuid) from public, anon, authenticated;
revoke all on function public.ac_heartbeat(text, text, text, text, jsonb, bigint, text, jsonb),
  public.ac_bridge_player(text, text, text, boolean, text, integer) from public, anon, authenticated;
grant execute on function public.ac_heartbeat(text, text, text, text, jsonb, bigint, text, jsonb),
  public.ac_bridge_player(text, text, text, boolean, text, integer) to anon, authenticated;
revoke all on function public.ac_admin_flags(boolean, integer, integer, integer), public.ac_admin_flag_review(bigint, text),
  public.ac_admin_hash_search(text), public.ac_admin_signatures(), public.ac_admin_signature_add(text, text, text[], text, text),
  public.ac_admin_signature_remove(uuid), public.ac_admin_agent_config(), public.ac_admin_set_agent_config(jsonb) from public, anon;
grant execute on function public.ac_admin_flags(boolean, integer, integer, integer), public.ac_admin_flag_review(bigint, text),
  public.ac_admin_hash_search(text), public.ac_admin_signatures(), public.ac_admin_signature_add(text, text, text[], text, text),
  public.ac_admin_signature_remove(uuid), public.ac_admin_agent_config(), public.ac_admin_set_agent_config(jsonb) to authenticated;
revoke all on function public.ac_screenshot_retention_due(integer), public.ac_screenshot_purged(uuid[]) from public, anon, authenticated;
grant execute on function public.ac_screenshot_retention_due(integer), public.ac_screenshot_purged(uuid[]) to service_role;

notify pgrst, 'reload schema';

commit;
