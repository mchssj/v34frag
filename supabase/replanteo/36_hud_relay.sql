-- Replanteo 36: relay del HUD en el VPS, administrado desde la web (plan docs/bitacora/2026-10-29-hud-relay-vps).
--   1. game_servers: puerto del relay (hud_port, del 27500 al 27519, único), HUD activo (hud_enabled), su clave
--      (hud_key, la genera la base) y el último paquete que recibió el relay (hud_seen_at). Sin SourceTV (tv_port y
--      connect_address) no se puede activar, y si se la sacan se apaga solo.
--   2. hud_streamers: la marca de streamer de una cuenta (como el VIP), con el hash del token de su link de OBS.
--   3. hud_relays: el token del relay (como demo_workers). Se crea con SQL (ejemplo al final).
--   4. hud_sessions: qué streamer tiene el HUD abierto en qué servidor (lo informa el relay).
--   5. Funciones del admin, del streamer y del relay (hud_relay_config), vistas y avisos streamer_granted y
--      streamer_revoked.
-- Necesita la 12 (servidores), la 27 (tv_port) y la 35 (notification_category).
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'game_servers'
                                                              and column_name = 'tv_port')
     or to_regclass('public.admin_server_list') is null or to_regclass('public.notification_sent') is null then
    raise exception 'replanteo 36: faltan la 12, la 27 o la 35';
  end if;
  if to_regclass('public.hud_streamers') is not null then
    raise exception 'replanteo 36: hud_streamers ya existe (¿ya se aplicó?)';
  end if;
end $$;

-- =====================================================================================================
-- 1. HUD de cada servidor
-- =====================================================================================================
alter table public.game_servers
  add column hud_port integer constraint game_servers_hud_port_check check (hud_port between 27500 and 27519),
  add column hud_enabled boolean not null default false,
  add column hud_key text constraint game_servers_hud_key_check check (hud_key ~ '^[A-Za-z0-9]{24}$'),
  add column hud_seen_at timestamptz,
  add constraint game_servers_hud_ready check (not hud_enabled or (hud_port is not null and hud_key is not null));
create unique index game_servers_hud_port on public.game_servers (hud_port) where hud_port is not null;
comment on column public.game_servers.hud_port is 'Puerto UDP del relay del HUD para este servidor (csstv_hud_port). Replanteo 36';
comment on column public.game_servers.hud_key is 'Clave del HUD de este servidor (csstv_hud_key): el relay descarta los paquetes sin ella. Replanteo 36';
comment on column public.game_servers.hud_seen_at is 'Último paquete del HUD que recibió el relay. Replanteo 36';

-- Sin SourceTV no hay HUD: si se borra el puerto de SourceTV o la dirección, el HUD se apaga solo.
create function public.tg_game_servers_hud_off() returns trigger language plpgsql set search_path = public as $$
begin
  if new.hud_enabled and (new.tv_port is null or new.connect_address is null) then new.hud_enabled := false; end if;
  return new;
end $$;
create trigger game_servers_hud_off before update of tv_port, connect_address on public.game_servers
  for each row execute function public.tg_game_servers_hud_off();

create function public.hud_new_key() returns text language sql volatile as $$
  select left(replace(gen_random_uuid()::text, '-', ''), 24) $$;

-- Puerto, interruptor y clave (se genera al poner el puerto). Sin puerto, el HUD queda apagado y sin clave.
create function public.admin_set_server_hud(p_server uuid, p_port integer, p_enabled boolean) returns void
  language plpgsql security definer set search_path = public as $$
declare g game_servers%rowtype; v_other text;
begin
  if not is_admin() then raise exception 'Solo un admin configura el HUD' using errcode = '42501'; end if;
  select * into g from game_servers where id = p_server for update;
  if not found then raise exception 'No existe ese servidor'; end if;
  if p_port is null then
    update game_servers set hud_port = null, hud_enabled = false, hud_key = null where id = p_server;
    return;
  end if;
  if p_port not between 27500 and 27519 then raise exception 'El puerto del HUD tiene que estar entre 27500 y 27519'; end if;
  select name into v_other from game_servers where hud_port = p_port and id <> p_server;
  if v_other is not null then
    raise exception 'El puerto % ya lo usa el servidor %', p_port, v_other using errcode = '23505';
  end if;
  if coalesce(p_enabled, false) and (g.tv_port is null or g.connect_address is null) then
    raise exception 'Para activar el HUD, el servidor necesita su dirección y el puerto de SourceTV';
  end if;
  update game_servers
     set hud_port = p_port, hud_enabled = coalesce(p_enabled, false), hud_key = coalesce(g.hud_key, hud_new_key())
   where id = p_server;
end $$;

-- Clave nueva: hay que copiarla al csstv_hud.cfg de ese servidor.
create function public.admin_regenerate_hud_key(p_server uuid) returns text
  language plpgsql security definer set search_path = public as $$
declare v_key text := hud_new_key();
begin
  if not is_admin() then raise exception 'Solo un admin configura el HUD' using errcode = '42501'; end if;
  update game_servers set hud_key = v_key where id = p_server and hud_port is not null;
  if not found then raise exception 'Ese servidor no tiene puerto del HUD'; end if;
  return v_key;
end $$;

-- =====================================================================================================
-- 2. Streamers
-- =====================================================================================================
create table public.hud_streamers (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  token_hash       text unique,
  token_created_at timestamptz,
  granted_at       timestamptz not null default now(),
  granted_by       uuid references public.profiles(id) on delete set null,
  revoked_at       timestamptz,
  revoked_by       uuid references public.profiles(id) on delete set null
);
comment on table public.hud_streamers is 'Cuentas con permiso para transmitir con el HUD. Quitarlo no borra la fila. Replanteo 36';
alter table public.hud_streamers enable row level security;
revoke all on table public.hud_streamers from anon, authenticated;

-- Avisos de la cuenta: streamer_granted y streamer_revoked.
create or replace function public.notification_category(p_type text) returns text language sql immutable as $$
  select case
    when p_type in ('team_invite', 'team_join_request', 'team_invite_answered', 'team_join_answered', 'team_captain', 'team_removed',
                    'team_member_left', 'team_role_changed', 'team_added', 'team_deleted', 'team_request_answered') then 'team'
    when p_type in ('event_registration', 'event_fixture', 'match_scheduled', 'veto_turn', 'veto_done', 'veto_reset',
                    'match_result', 'event_progress', 'event_cancelled', 'event_lineup', 'match_soon') then 'tournament' -- (replanteo 35) match_soon
    when p_type in ('pcw_accepted', 'pcw_cancelled', 'pcw_result', 'pcw_soon', 'pcw_expired') then 'pcw' -- (replanteo 35) pcw_soon y pcw_expired
    when p_type in ('level_changed', 'mix_review_resolved', 'mix_deleted', 'elo_adjusted', 'clip_ready') then 'elo'
    when p_type in ('season_ranked', 'season_closed', 'medal_granted', 'season_ending') then 'season' -- (replanteo 35) season_ending
    when p_type in ('steam_claimed', 'steam_request_answered', 'alias_changed', 'role_changed', 'password_changed',
                    'vip_granted', 'vip_revoked', 'vip_expiring',
                    'streamer_granted', 'streamer_revoked') then 'account' -- (replanteo 36) streamer_granted y streamer_revoked
    when p_type in ('event_new', 'season_started') then 'news'
    when p_type in ('admin_steam_request', 'admin_team_request', 'admin_mix_review', 'admin_demo_failed', 'admin_season_delayed',
                    'match_no_result') then 'admin' -- (replanteo 35) match_no_result
  end $$;

-- Dar la marca. Si ya la tiene, no cambia nada. Si se la habían quitado, vuelve sin link: tiene que generar uno nuevo.
create function public.admin_grant_streamer(p_user uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin da la marca de streamer' using errcode = '42501'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'No existe ese usuario'; end if;
  if exists (select 1 from hud_streamers where user_id = p_user and revoked_at is null) then return; end if;
  insert into hud_streamers(user_id, granted_by) values (p_user, auth.uid())
  on conflict (user_id) do update
    set granted_at = now(), granted_by = auth.uid(), revoked_at = null, revoked_by = null, token_hash = null, token_created_at = null;
  perform notify(array[p_user], 'streamer_granted', '{}');
end $$;

-- Quitar la marca: el link deja de andar en la próxima consulta del relay (30 s).
create function public.admin_revoke_streamer(p_user uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin quita la marca de streamer' using errcode = '42501'; end if;
  update hud_streamers set revoked_at = now(), revoked_by = auth.uid(), token_hash = null, token_created_at = null
   where user_id = p_user and revoked_at is null;
  if not found then raise exception 'Esa cuenta no es streamer'; end if;
  delete from hud_sessions where user_id = p_user;
  perform notify(array[p_user], 'streamer_revoked', '{}');
end $$;

-- Link nuevo del propio streamer: devuelve el token una sola vez (en la base queda el hash). El anterior deja de andar.
create function public.hud_streamer_new_token() returns text
  language plpgsql security definer set search_path = public as $$
declare v_token text := 'hud_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  update hud_streamers set token_hash = encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), token_created_at = now()
   where user_id = auth.uid() and revoked_at is null;
  if not found then raise exception 'Solo los streamers tienen link del HUD' using errcode = '42501'; end if;
  return v_token;
end $$;

-- La marca: el admin ve todas; cada cuenta, la suya. Sin el hash.
create view public.hud_streamer_list as
select s.user_id, pr.tag as alias, s.granted_at, g.tag as granted_by_alias, s.revoked_at, s.revoked_at is null as active,
       s.token_hash is not null as has_link, s.token_created_at
  from hud_streamers s
  join profiles pr on pr.id = s.user_id
  left join profiles g on g.id = s.granted_by
 where s.user_id = auth.uid() or is_admin();
grant select on public.hud_streamer_list to authenticated;

-- =====================================================================================================
-- 3. Relay y sesiones
-- =====================================================================================================
create table public.hud_relays (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique check (char_length(trim(name)) between 2 and 40),
  token_hash   text not null unique,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz
);
comment on table public.hud_relays is 'Token del relay del HUD (como demo_workers). Replanteo 36';
alter table public.hud_relays enable row level security;
revoke all on table public.hud_relays from anon, authenticated;

create table public.hud_sessions (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  server_id uuid not null references public.game_servers(id) on delete cascade,
  seen_at   timestamptz not null default now(),
  primary key (user_id, server_id)
);
comment on table public.hud_sessions is 'Qué streamer tiene el HUD abierto en qué servidor; vale si seen_at es de hace menos de 1 minuto. Replanteo 36';
alter table public.hud_sessions enable row level security;
revoke all on table public.hud_sessions from anon, authenticated;

-- Lo que llama el relay cada 30 segundos. Recibe qué streamers tienen el HUD abierto (p_sessions:
-- [{user_id, server_id}]) y cuándo llegó el último paquete de cada servidor (p_seen: {server_id: fecha}). Devuelve los
-- servidores con HUD activo y los streamers con link. Error PT401 => HTTP 401.
create function public.hud_relay_config(p_token text, p_sessions jsonb default '[]', p_seen jsonb default '{}') returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_relay uuid;
begin
  select id into v_relay from hud_relays
   where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') and active;
  if v_relay is null then raise exception 'Token del relay inválido o revocado' using errcode = 'PT401'; end if;
  update hud_relays set last_seen_at = now() where id = v_relay;

  if jsonb_typeof(p_seen) = 'object' then
    update game_servers g set hud_seen_at = greatest(g.hud_seen_at, (p_seen ->> g.id::text)::timestamptz)
     where p_seen ? g.id::text;
  end if;
  if jsonb_typeof(p_sessions) = 'array' then
    insert into hud_sessions(user_id, server_id, seen_at)
    select distinct x.user_id, x.server_id, now()
      from jsonb_to_recordset(p_sessions) as x(user_id uuid, server_id uuid)
      join hud_streamers s on s.user_id = x.user_id and s.revoked_at is null
      join game_servers g on g.id = x.server_id and g.active and g.hud_enabled
    on conflict (user_id, server_id) do update set seen_at = excluded.seen_at;
  end if;
  delete from hud_sessions where seen_at < now() - interval '1 day';

  return jsonb_build_object(
    'servers', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'port', g.hud_port, 'key', g.hud_key,
                                          'tv_address', split_part(g.connect_address, ':', 1) || ':' || g.tv_port) order by g.name)
        from game_servers g
       where g.active and g.hud_enabled and g.hud_port is not null and g.hud_key is not null), '[]'),
    'streamers', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', s.user_id, 'alias', p.tag, 'token_hash', s.token_hash) order by p.tag)
        from hud_streamers s join profiles p on p.id = s.user_id
       where s.revoked_at is null and s.token_hash is not null), '[]'));
end $$;

-- =====================================================================================================
-- 4. Vistas del admin
-- =====================================================================================================
-- Quién tiene el HUD abierto en ese servidor (último minuto). security definer: hud_sessions no se lee directo.
create function public.hud_streaming(p_server uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'alias', p.tag) order by p.tag), '[]')
    from hud_sessions h join profiles p on p.id = h.user_id
   where h.server_id = p_server and h.seen_at > now() - interval '1 minute' and is_admin() $$;

-- Como en la 27, con el HUD al final: puerto, interruptor, clave, último paquete y quién lo transmite ahora.
create or replace view public.admin_server_list with (security_invoker = true) as
select g.id, g.name, g.active, g.created_at, g.last_seen_at, g.connect_address, g.panel_server_id,
       g.license_expires_at, g.allowed_ip, g.last_ip, g.plugin_version,
       case when not g.active then 'revoked'
            when g.license_expires_at <= now() then 'expired'
            when g.license_expires_at <= now() + interval '7 days' then 'expiring'
            else 'ok' end as license_state,
       coalesce(g.last_seen_at > now() - interval '35 minutes', false) as online,
       g.panel_server_id is not null as has_panel,
       (select count(*)::int from matches m where m.server_id = g.id) as matches,
       (select max(coalesce(m.played_at, m.starts_at)) from matches m where m.server_id = g.id) as last_match_at,
       search_norm(concat_ws(' ', g.name, g.connect_address, g.allowed_ip, g.last_ip, g.plugin_version, g.region)) as search,
       g.mode, g.region, g.tv_port,
       g.hud_port, g.hud_enabled, g.hud_key, g.hud_seen_at, -- (replanteo 36)
       hud_streaming(g.id) as hud_streaming
  from game_servers g;

-- Como en la 11, con is_streamer al final.
create or replace view public.admin_user_list as
select pr.id, pr.tag as alias, pr.role, pr.tag_changed_at as alias_changed_at, p.id as player_id, p.steam_id,
       p.id is not null as has_player, p.steam_id is not null as has_steam, search_norm(pr.tag) as search,
       exists (select 1 from hud_streamers s where s.user_id = pr.id and s.revoked_at is null) as is_streamer -- (replanteo 36)
  from profiles pr
  left join players p on p.user_id = pr.id
 where is_admin();

-- =====================================================================================================
-- 5. Permisos
-- =====================================================================================================
revoke all on function public.hud_new_key(), public.admin_set_server_hud(uuid, integer, boolean),
  public.admin_regenerate_hud_key(uuid), public.admin_grant_streamer(uuid), public.admin_revoke_streamer(uuid),
  public.hud_streamer_new_token(), public.hud_relay_config(text, jsonb, jsonb), public.hud_streaming(uuid),
  public.tg_game_servers_hud_off() from public, anon, authenticated;
grant execute on function public.admin_set_server_hud(uuid, integer, boolean), public.admin_regenerate_hud_key(uuid),
  public.admin_grant_streamer(uuid), public.admin_revoke_streamer(uuid), public.hud_streamer_new_token(),
  public.hud_streaming(uuid) to authenticated;
grant execute on function public.hud_relay_config(text, jsonb, jsonb) to anon, authenticated;

commit;

-- Token del relay (una vez, con SQL; se guarda en /etc/cmleague/hud.json del VPS):
--   with t as (select 'hudr_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') as token),
--        i as (insert into hud_relays(name, token_hash)
--              select 'vps', encode(sha256(convert_to(token, 'UTF8')), 'hex') from t)
--   select token from t;
