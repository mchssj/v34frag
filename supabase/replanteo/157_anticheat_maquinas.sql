-- Replanteo 157: ban por máquina (planes docs/bitacora/2026-11-26-ban-por-maquina, en main, y 2026-11-27-anticheat-deteccion).
-- Va después de la 156.
--   1. ac_machines y ac_machine_ids: cada máquina, con los HMAC de sus identificadores (la API los calcula con AC_HWID_SALT;
--      la base nunca ve los valores).
--   2. Misma máquina por puntos: SMBIOS 3, placa 2, MachineGuid 2, un disco 2, una MAC 1, CPU 0,5 y GPU 0,5. Desde 4 es la
--      misma; de 2 a 4 es parecida, y solo marca.
--   3. ac_machine_bans (un admin), ac_machine_exceptions (PC compartida) y ac_blocked_attempts (cada intento de una máquina baneada).
--   4. Una máquina baneada: no recibe código de vinculación; la cuenta que aprueba su código o late desde ella queda baneada por
--      evasión (bans.source = 'evasion', bans.evades); el Bridge expulsa siempre (machine_banned, AC-5). Kyan, 2026-11-26.
-- Al jugador no se le dice nada de esto: solo el código AC-5.
begin;

do $$
begin
  if to_regclass('public.ac_flags') is null then raise exception 'replanteo 157: falta la 156 (ac_flags)'; end if;
  if to_regclass('public.ac_machines') is not null then raise exception 'replanteo 157: ac_machines ya existe (¿ya se aplicó?)'; end if;
end $$;

-- =====================================================================================================
-- 1. Tablas
-- =====================================================================================================
create table public.ac_machines (
  id            uuid primary key default gen_random_uuid(),
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create table public.ac_machine_ids (
  machine_id    uuid not null references public.ac_machines(id) on delete cascade,
  kind          text not null check (kind in ('smbios', 'board', 'machine_guid', 'disk', 'mac', 'cpu', 'gpu')),
  hash          text not null check (hash ~ '^[0-9a-f]{64}$'),
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  primary key (kind, hash)
);
create index ac_machine_ids_machine on public.ac_machine_ids (machine_id);

create table public.ac_machine_bans (
  id          uuid primary key default gen_random_uuid(),
  machine_id  uuid not null references public.ac_machines(id) on delete cascade,
  ban_id      uuid references public.bans(id) on delete set null,   -- el baneo de la cuenta que lo originó, si había
  reason      text not null check (char_length(btrim(reason)) between 3 and 200),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  lifted_at   timestamptz,
  lifted_by   uuid references auth.users(id) on delete set null,
  lift_reason text check (char_length(lift_reason) <= 200)
);
create unique index ac_machine_bans_activo on public.ac_machine_bans (machine_id) where lifted_at is null;

create table public.ac_machine_exceptions (
  machine_id uuid not null references public.ac_machines(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  note       text check (char_length(note) <= 200),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (machine_id, user_id)
);

create table public.ac_blocked_attempts (
  id         bigint generated always as identity primary key,
  machine_id uuid not null references public.ac_machines(id) on delete cascade,
  stage      text not null check (stage in ('link_start', 'approve', 'heartbeat')),
  ip         text check (char_length(ip) <= 64),
  user_id    uuid references auth.users(id) on delete set null,
  steam_id   text,
  score      numeric(4, 1),
  created_at timestamptz not null default now()
);
create index ac_blocked_attempts_machine on public.ac_blocked_attempts (machine_id, created_at desc);

alter table public.ac_devices add column machine_id uuid references public.ac_machines(id) on delete set null;
alter table public.ac_link_requests add column machine_id uuid references public.ac_machines(id) on delete set null;
create index ac_devices_machine on public.ac_devices (machine_id) where machine_id is not null;

-- Evasión: un baneo automático, ligado al baneo original (si lo hay).
alter table public.bans drop constraint bans_source_check;
alter table public.bans add constraint bans_source_check check (source in ('web', 'server', 'import', 'evasion'));
alter table public.bans add column evades uuid references public.bans(id) on delete set null;
comment on column public.bans.evades is 'source = evasion: el baneo que se intentó evadir (replanteo 157)';

revoke all on public.ac_machines, public.ac_machine_ids, public.ac_machine_bans, public.ac_machine_exceptions, public.ac_blocked_attempts
  from public, anon, authenticated;
alter table public.ac_machines enable row level security;
alter table public.ac_machine_ids enable row level security;
alter table public.ac_machine_bans enable row level security;
alter table public.ac_machine_exceptions enable row level security;
alter table public.ac_blocked_attempts enable row level security;

-- =====================================================================================================
-- 2. Resolver una máquina
-- =====================================================================================================
-- p_hw: {"smbios": h, "board": h, "machine_guid": h, "disks": [h], "macs": [h], "cpu": h, "gpu": h}, ya con HMAC.
create function public.ac_hw_list(p_hw jsonb) returns table (kind text, hash text) language sql immutable as $$
  select k, h from (
    select 'smbios' as k, p_hw->>'smbios' as h union all
    select 'board', p_hw->>'board' union all
    select 'machine_guid', p_hw->>'machine_guid' union all
    select 'cpu', p_hw->>'cpu' union all
    select 'gpu', p_hw->>'gpu' union all
    select 'disk', x.v from jsonb_array_elements_text(case when jsonb_typeof(p_hw->'disks') = 'array' then p_hw->'disks' else '[]' end) as x(v) union all
    select 'mac', x.v from jsonb_array_elements_text(case when jsonb_typeof(p_hw->'macs') = 'array' then p_hw->'macs' else '[]' end) as x(v)
  ) t where h ~ '^[0-9a-f]{64}$' $$;

create function public.ac_hw_weight(p_kind text) returns numeric language sql immutable as $$
  select case p_kind when 'smbios' then 3 when 'board' then 2 when 'machine_guid' then 2 when 'disk' then 2 when 'mac' then 1 else 0.5 end $$;

create function public.ac_machine_banned(p_machine uuid, p_user uuid default null) returns boolean language sql stable security definer set search_path = public as $$
  select p_machine is not null
     and exists (select 1 from ac_machine_bans b where b.machine_id = p_machine and b.lifted_at is null)
     and not exists (select 1 from ac_machine_exceptions e where e.machine_id = p_machine and e.user_id = p_user) $$;

-- Devuelve {machine_id, score, banned, weak_of, weak_score}. Crea la máquina si no se parece lo suficiente a ninguna.
create function public.ac_machine_resolve(p_hw jsonb) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_best  uuid;
  v_score numeric := 0;
  v_weak  uuid;
  v_wscore numeric := 0;
  v_id    uuid;
begin
  if p_hw is null or not exists (select 1 from ac_hw_list(p_hw)) then return null; end if;
  -- Puntos por máquina: cada tipo cuenta una vez, aunque coincidan dos discos.
  with m as (
    select i.machine_id, sum(ac_hw_weight(i.kind)) as score
      from (select distinct i.machine_id, i.kind from ac_machine_ids i join ac_hw_list(p_hw) h on h.kind = i.kind and h.hash = i.hash) i
     group by i.machine_id
  )
  select machine_id, score into v_best, v_score from m order by score desc limit 1;

  if v_best is not null and v_score >= 4 then
    v_id := v_best;
  else
    if v_best is not null and v_score >= 2 then v_weak := v_best; v_wscore := v_score; end if;
    insert into ac_machines default values returning id into v_id;
  end if;
  update ac_machines set last_seen_at = now() where id = v_id;
  -- Un identificador pertenece a la primera máquina que lo tuvo.
  insert into ac_machine_ids (machine_id, kind, hash) select v_id, kind, hash from ac_hw_list(p_hw)
    on conflict (kind, hash) do update set last_seen_at = now() where ac_machine_ids.machine_id = excluded.machine_id;
  return jsonb_build_object('machine_id', v_id, 'score', case when v_id = v_best then v_score else null end,
                            'banned', exists (select 1 from ac_machine_bans b where b.machine_id = v_id and b.lifted_at is null),
                            'weak_of', v_weak, 'weak_score', case when v_weak is not null then v_wscore end);
end $$;

-- Banea por evasión la ficha de una cuenta (todas sus SteamID, por ban_insert). Devuelve el id del baneo, o null si no tiene ficha.
create function public.ac_evasion_ban(p_user uuid, p_machine uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  v_player uuid;
  v_ban    uuid;
  v_orig   uuid;
begin
  select id into v_player from players where user_id = p_user and steam_id is not null limit 1;
  if v_player is null then return null; end if;
  if exists (select 1 from bans b where b.player_id = v_player and b.source = 'evasion' and b.lifted_at is null) then return null; end if;
  select ban_id into v_orig from ac_machine_bans where machine_id = p_machine and lifted_at is null;
  v_ban := ban_insert(v_player, null, null, 'Evasión de baneo', null, 'evasion', null, null, 'CMLeague Anticheat', null);
  update bans set evades = v_orig where id = v_ban;
  return v_ban;
end $$;

-- =====================================================================================================
-- 3. Vinculación
-- =====================================================================================================
-- Como en la 45, con los identificadores: una máquina baneada no recibe código ({blocked: true}) y queda el intento.
drop function public.ac_link_start(text, text, text);
create function public.ac_link_start(p_secret text, p_device_name text, p_version text, p_hw jsonb default null, p_ip text default null) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_device text := ac_token('fragd_');
  v_user   text;
  m        jsonb;
  v_machine uuid;
begin
  perform ac_require_api(p_secret);
  m := ac_machine_resolve(p_hw);
  v_machine := (m->>'machine_id')::uuid;
  if coalesce((m->>'banned')::boolean, false) then
    insert into ac_blocked_attempts (machine_id, stage, ip, score) values (v_machine, 'link_start', left(p_ip, 64), (m->>'score')::numeric);
    return jsonb_build_object('blocked', true);
  end if;
  delete from ac_link_requests where expires_at < now() - interval '1 day';
  loop
    v_user := ac_user_code();
    exit when not exists (select 1 from ac_link_requests where user_code = v_user);
  end loop;
  insert into ac_link_requests (device_code_hash, user_code, device_name, agent_version, expires_at, machine_id)
    values (ac_hash(v_device), v_user, p_device_name, p_version, now() + interval '10 minutes', v_machine);
  return jsonb_build_object('device_code', v_device, 'user_code', v_user, 'expires_in', 600);
end $$;

-- Como en la 45. Si el código es de una máquina baneada (y la cuenta no tiene excepción), la cuenta queda baneada por evasión
-- y no se vincula ({blocked: true}: la API responde 403 con AC-5).
create or replace function public.ac_link_approve(p_user_code text) returns jsonb
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
  if ac_machine_banned(r.machine_id, auth.uid()) then
    insert into ac_blocked_attempts (machine_id, stage, user_id, steam_id)
      values (r.machine_id, 'approve', auth.uid(), (select steam_id from players where user_id = auth.uid() and steam_id is not null limit 1));
    perform ac_evasion_ban(auth.uid(), r.machine_id);
    delete from ac_link_requests where id = r.id;
    return jsonb_build_object('blocked', true);
  end if;
  update ac_link_requests set approved_by = auth.uid(), approved_at = coalesce(approved_at, now()) where id = r.id;
  return jsonb_build_object('device_name', r.device_name);
end $$;

-- Como en la 45, con la máquina en el equipo.
create or replace function public.ac_link_claim(p_secret text, p_device_code text) returns jsonb
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
  insert into ac_devices (user_id, name, agent_version, access_hash, access_expires_at, refresh_hash, machine_id)
    values (r.approved_by, r.device_name, r.agent_version, ac_hash(v_access), now() + interval '15 minutes', ac_hash(v_refresh), r.machine_id)
    returning id into v_id;
  update ac_link_requests set claimed_at = now() where id = r.id;
  return jsonb_build_object('status', 'approved', 'device_id', v_id, 'access_token', v_access, 'refresh_token', v_refresh, 'expires_in', 900);
end $$;

-- =====================================================================================================
-- 4. Latido y Bridge (reemplazan los lugares que dejó la 156)
-- =====================================================================================================
-- true: la máquina está baneada; la cuenta quedó baneada por evasión y el equipo revocado.
create or replace function public.ac_heartbeat_machine(p_device uuid, p_hw jsonb) returns boolean
  language plpgsql security definer set search_path = public as $$
declare
  d ac_devices%rowtype;
  m jsonb;
  v_machine uuid;
  v_sess uuid;
begin
  select * into d from ac_devices where id = p_device;
  if p_hw is not null then
    m := ac_machine_resolve(p_hw);
    v_machine := (m->>'machine_id')::uuid;
    if v_machine is not null and v_machine is distinct from d.machine_id then
      update ac_devices set machine_id = v_machine where id = p_device;
    end if;
  else
    v_machine := d.machine_id;
  end if;
  if ac_machine_banned(v_machine, d.user_id) then
    insert into ac_blocked_attempts (machine_id, stage, user_id, steam_id)
      values (v_machine, 'heartbeat', d.user_id, (select steam_id from players where user_id = d.user_id and steam_id is not null limit 1));
    perform ac_evasion_ban(d.user_id, v_machine);
    update ac_devices set revoked_at = now() where id = p_device and revoked_at is null;
    update ac_sessions set status = 'closed', ended_at = now(), end_reason = 'machine_banned' where device_id = p_device and status = 'open';
    return true;
  end if;
  -- Parecida a una máquina baneada, pero no lo suficiente: solo una marca para revisar.
  if m is not null and (m->>'weak_of') is not null
     and exists (select 1 from ac_machine_bans b where b.machine_id = (m->>'weak_of')::uuid and b.lifted_at is null) then
    select id into v_sess from ac_sessions where device_id = p_device and status = 'open' limit 1;
    if v_sess is not null then
      perform ac_flag(v_sess, 'machine_weak_match', 2::smallint, m->>'weak_of', jsonb_build_object('score', m->'weak_score'));
    end if;
  end if;
  return false;
end $$;

create or replace function public.ac_device_machine_banned(p_device uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select ac_machine_banned(d.machine_id, d.user_id) from ac_devices d where d.id = p_device), false) $$;

-- =====================================================================================================
-- 5. Panel
-- =====================================================================================================
create function public.ac_session_machine(p_session uuid) returns uuid language sql stable security definer set search_path = public as $$
  select d.machine_id from ac_sessions s join ac_devices d on d.id = s.device_id where s.id = p_session $$;

create function public.ac_admin_machine_accounts(p_session uuid) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_machine uuid;
begin
  if not ac_can_review() then raise exception 'Solo un admin puede ver la máquina' using errcode = '42501'; end if;
  if not exists (select 1 from ac_sessions where id = p_session) then return null; end if;
  v_machine := ac_session_machine(p_session);
  insert into ac_admin_actions (actor, action, detail) values (auth.uid(), 'machine_read', jsonb_build_object('session', p_session, 'machine', v_machine));
  return jsonb_build_object(
    'machine_id', v_machine,
    'banned', coalesce(exists (select 1 from ac_machine_bans b where b.machine_id = v_machine and b.lifted_at is null), false),
    'bans', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'reason', b.reason, 'created_at', b.created_at, 'lifted_at', b.lifted_at) order by b.created_at desc)
                        from ac_machine_bans b where b.machine_id = v_machine), '[]'::jsonb),
    'accounts', coalesce((select jsonb_agg(x order by x.last_seen_at desc) from (
        select d.user_id, max(p.nick) as nick, max(p.steam_id) as steam_id, max(d.last_seen_at) as last_seen_at,
               bool_or(exists (select 1 from bans b where b.player_id = p.id and b.source = 'evasion' and b.lifted_at is null)) as evasion
          from ac_devices d left join players p on p.user_id = d.user_id
         where d.machine_id = v_machine
         group by d.user_id) x), '[]'::jsonb),
    'attempts', coalesce((select jsonb_agg(jsonb_build_object('stage', a.stage, 'ip', a.ip, 'steam_id', a.steam_id, 'created_at', a.created_at) order by a.created_at desc)
                            from (select * from ac_blocked_attempts where machine_id = v_machine order by created_at desc limit 20) a), '[]'::jsonb),
    'exceptions', coalesce((select jsonb_agg(jsonb_build_object('user_id', e.user_id, 'nick', (select nick from players where user_id = e.user_id limit 1),
                                                                'note', e.note, 'created_at', e.created_at))
                              from ac_machine_exceptions e where e.machine_id = v_machine), '[]'::jsonb));
end $$;

-- Banea la máquina de la sesión, ligada al baneo activo de esa cuenta si lo tiene. Los equipos de otras cuentas en esa máquina
-- quedan baneados por evasión en su próximo latido.
create function public.ac_admin_ban_machine(p_session uuid, p_reason text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_machine uuid;
  v_steam text;
  v_id uuid;
begin
  if not ac_can_review() then raise exception 'Solo un admin puede banear una máquina' using errcode = '42501'; end if;
  if not exists (select 1 from ac_sessions where id = p_session) then return null; end if;
  v_machine := ac_session_machine(p_session);
  if v_machine is null then raise exception 'El agente de esta sesión no informó la máquina'; end if;
  if exists (select 1 from ac_machine_bans where machine_id = v_machine and lifted_at is null) then raise exception 'Esa máquina ya está baneada'; end if;
  select steam_id into v_steam from ac_sessions where id = p_session;
  insert into ac_machine_bans (machine_id, ban_id, reason, created_by)
    values (v_machine, (select id from ban_active_for(v_steam) limit 1), btrim(p_reason), auth.uid())
    returning id into v_id;
  insert into ac_admin_actions (actor, action, detail) values (auth.uid(), 'machine_ban', jsonb_build_object('session', p_session, 'machine', v_machine, 'ban', v_id));
  return jsonb_build_object('id', v_id);
end $$;

create function public.ac_admin_lift_machine(p_ban uuid, p_reason text default null) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not ac_can_review() then raise exception 'Solo un admin puede levantar el ban de una máquina' using errcode = '42501'; end if;
  update ac_machine_bans set lifted_at = now(), lifted_by = auth.uid(), lift_reason = left(nullif(btrim(p_reason), ''), 200)
   where id = p_ban and lifted_at is null;
  if not found then raise exception 'No existe ese ban o ya está levantado'; end if;
  insert into ac_admin_actions (actor, action, detail) values (auth.uid(), 'machine_lift', jsonb_build_object('ban', p_ban));
end $$;

create function public.ac_admin_machine_exception(p_session uuid, p_user uuid, p_note text default null) returns void
  language plpgsql security definer set search_path = public as $$
declare v_machine uuid;
begin
  if not ac_can_review() then raise exception 'Solo un admin puede poner una excepción' using errcode = '42501'; end if;
  v_machine := ac_session_machine(p_session);
  if v_machine is null then raise exception 'El agente de esta sesión no informó la máquina'; end if;
  insert into ac_machine_exceptions (machine_id, user_id, note, created_by) values (v_machine, p_user, left(nullif(btrim(p_note), ''), 200), auth.uid())
    on conflict (machine_id, user_id) do update set note = excluded.note;
  insert into ac_admin_actions (actor, action, detail) values (auth.uid(), 'machine_exception', jsonb_build_object('machine', v_machine, 'user', p_user));
end $$;

-- =====================================================================================================
-- 6. Permisos
-- =====================================================================================================
revoke all on function public.ac_hw_list(jsonb), public.ac_hw_weight(text), public.ac_machine_banned(uuid, uuid), public.ac_machine_resolve(jsonb),
  public.ac_evasion_ban(uuid, uuid), public.ac_session_machine(uuid) from public, anon, authenticated;
revoke all on function public.ac_link_start(text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.ac_link_start(text, text, text, jsonb, text) to anon, authenticated;
revoke all on function public.ac_admin_machine_accounts(uuid), public.ac_admin_ban_machine(uuid, text), public.ac_admin_lift_machine(uuid, text),
  public.ac_admin_machine_exception(uuid, uuid, text) from public, anon;
grant execute on function public.ac_admin_machine_accounts(uuid), public.ac_admin_ban_machine(uuid, text), public.ac_admin_lift_machine(uuid, text),
  public.ac_admin_machine_exception(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;
