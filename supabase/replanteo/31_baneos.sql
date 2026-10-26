-- Replanteo 31: baneos de los servidores gestionados desde la web (plan docs/bitacora/2026-10-25-baneos-web).
--   1. Rol moderator en profiles.role e is_moderator() (moderador o admin). set_user_role acepta moderator.
--   2. Tabla bans: la lista única de baneos de todos los servidores. Se banea la ficha si el SteamID tiene una (vale
--      para todos sus SteamID, también los que sume después) o el SteamID solo. Un baneo no se borra: se levanta.
--      Activo = sin levantar y sin vencer. Uno nuevo levanta los activos que reemplaza (replaced_by).
--   3. Desde la web (moderador o admin): ban_create, ban_update y ban_lift. Permanente solo un admin; un moderador
--      cambia o levanta cualquier baneo que no sea permanente.
--   4. Para el plugin, con el token del servidor: csstv_ban_check (al conectarse), csstv_bans_since (sincronización),
--      csstv_ban_add y csstv_ban_lift (!ban y !unban del juego).
--   5. Vista pública ban_list.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'map_pool' and column_name = 'image_url') then
    raise exception 'replanteo 31: falta map_pool.image_url (aplicar antes 30_mapas_temporadas.sql)';
  end if;
  if to_regclass('public.bans') is not null then
    raise exception 'replanteo 31: bans ya existe (¿ya se aplicó?)';
  end if;
  if exists (select 1 from public.profiles where role not in ('user', 'organizer', 'admin')) then
    raise exception 'replanteo 31: hay roles desconocidos en profiles.role';
  end if;
end $$;

-- =====================================================================================================
-- 1. Rol de moderador
-- =====================================================================================================
-- Todos los roles juegan. El admin además organiza (is_organizer) y modera (is_moderator).
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'organizer', 'moderator', 'admin'));

create function public.is_moderator() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('moderator', 'admin'))
$$;

-- Como en la 10, con moderator.
create or replace function public.set_user_role(p_user uuid, p_role text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede cambiar roles' using errcode = '42501'; end if;
  if p_role not in ('user', 'organizer', 'moderator') then raise exception 'El rol tiene que ser user, organizer o moderator'; end if; -- (replanteo 31)
  if (select role from profiles where id = p_user) = 'admin' then raise exception 'El rol de un admin se cambia en la base'; end if;
  update profiles set role = p_role where id = p_user;
  if not found then raise exception 'No existe ese usuario'; end if;
end $$;

-- =====================================================================================================
-- 2. Tabla bans
-- =====================================================================================================
create table public.bans (
  id               uuid primary key default gen_random_uuid(),
  player_id        uuid references public.players(id) on delete set null,
  steam_id         text not null check (is_steam64(steam_id)),
  nick             text check (char_length(nick) <= 64),
  reason           text not null check (char_length(btrim(reason)) between 1 and 200),
  expires_at       timestamptz,
  source           text not null check (source in ('web', 'server', 'import')),
  created_by       uuid references public.profiles(id) on delete set null,
  created_by_steam text check (created_by_steam is null or is_steam64(created_by_steam)),
  created_by_name  text check (char_length(created_by_name) <= 64),
  server_id        uuid references public.game_servers(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles(id) on delete set null,
  lifted_at        timestamptz,
  lifted_by        uuid references public.profiles(id) on delete set null,
  lifted_by_steam  text check (lifted_by_steam is null or is_steam64(lifted_by_steam)),
  lifted_by_name   text check (char_length(lifted_by_name) <= 64),
  lift_reason      text check (char_length(lift_reason) <= 200),
  replaced_by      uuid references public.bans(id) on delete set null,
  constraint bans_expira check (expires_at is null or expires_at > created_at),
  constraint bans_levantado check (
    lifted_at is not null or (lifted_by is null and lifted_by_steam is null and lifted_by_name is null and lift_reason is null and replaced_by is null))
);
create index bans_steam on public.bans (steam_id);
create index bans_player on public.bans (player_id);
create index bans_updated on public.bans (updated_at);
comment on table public.bans is 'Baneos de todos los servidores (replanteo 31). Activo: lifted_at null y expires_at null o futuro';
-- Solo se lee por ban_list y se escribe por las funciones.
alter table public.bans enable row level security;
revoke all on public.bans from anon, authenticated;

create function public.bans_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger bans_touch before update on public.bans for each row execute function public.bans_touch();

-- Ficha a la que se aplica un baneo: la guardada o, si se baneó un SteamID sin ficha, la que lo tenga hoy.
create function public.ban_owner(p_player uuid, p_steam text) returns uuid
  language sql stable set search_path = public as $$ select coalesce(p_player, steam_owner(p_steam)) $$;

-- Baneos activos que alcanzan a un SteamID: los suyos y los de su ficha. Primero los permanentes y los más largos.
create function public.ban_active_for(p_steam text) returns setof public.bans
  language sql stable security definer set search_path = public as $$
  select b.* from bans b
   where b.lifted_at is null and (b.expires_at is null or b.expires_at > now())
     and (b.steam_id = p_steam or ban_owner(b.player_id, b.steam_id) = steam_owner(p_steam))
   order by b.expires_at desc nulls first, b.created_at desc
$$;

-- SteamID a los que se aplica un baneo: el baneado y todos los de su ficha.
create function public.ban_steams(p_player uuid, p_steam text) returns text[]
  language sql stable security definer set search_path = public as $$
  select array_agg(distinct s) from (
    select p_steam as s
    union all
    select x.steam_id from player_steam_all x where x.player_id = ban_owner(p_player, p_steam)
  ) t
$$;

-- Crea un baneo y levanta los activos que reemplaza. Interna: la llaman ban_create, csstv_ban_add y la importación.
-- p_player o p_steam (SteamID64). Un baneo de la web hecho por un moderador no puede reemplazar a uno permanente;
-- uno del juego que encuentra uno permanente lo deja y devuelve su id.
create function public.ban_insert(
  p_player uuid, p_steam text, p_nick text, p_reason text, p_expires timestamptz, p_source text,
  p_by uuid, p_by_steam text, p_by_name text, p_server uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_player uuid; v_steam text; v_nick text; v_id uuid; v_perm uuid;
begin
  if p_player is not null then
    select id, steam_id, nick into v_player, v_steam, v_nick from players where id = p_player;
    if v_player is null then raise exception 'No existe esa ficha'; end if;
    if v_steam is null then raise exception 'La ficha no tiene SteamID: no se puede banear en los servidores'; end if;
  else
    if not coalesce(is_steam64(p_steam), false) then raise exception 'SteamID inválido'; end if;
    v_steam := p_steam;
    v_player := steam_owner(p_steam);
    select nick into v_nick from players where id = v_player;
  end if;
  v_nick := left(coalesce(nullif(btrim(p_nick), ''), v_nick,
    (select s.nick from match_player_stats s join matches m on m.id = s.match_id
      where s.steam_id = v_steam and s.nick is not null order by coalesce(m.played_at, s.created_at) desc limit 1)), 64);

  -- Uno a la vez por ficha (o por SteamID sin ficha).
  perform pg_advisory_xact_lock(hashtext('ban:' || coalesce(v_player::text, v_steam)));

  select id into v_perm from ban_active_for(v_steam) where expires_at is null limit 1;
  if v_perm is not null and p_source = 'server' then return v_perm; end if;
  if v_perm is not null and p_source = 'web' and not is_admin() then
    raise exception 'Ya tiene un baneo permanente: solo un admin lo puede cambiar' using errcode = '42501';
  end if;

  insert into bans (player_id, steam_id, nick, reason, expires_at, source, created_by, created_by_steam, created_by_name, server_id)
  values (v_player, v_steam, v_nick, btrim(p_reason), p_expires, p_source, p_by, p_by_steam, left(nullif(btrim(p_by_name), ''), 64), p_server)
  returning id into v_id;

  update bans set lifted_at = now(), lifted_by = p_by, lifted_by_steam = p_by_steam, lifted_by_name = left(nullif(btrim(p_by_name), ''), 64),
                  lift_reason = 'Reemplazado por un baneo nuevo', replaced_by = v_id
   where id in (select a.id from ban_active_for(v_steam) a where a.id <> v_id);
  return v_id;
end $$;

-- =====================================================================================================
-- 3. Desde la web
-- =====================================================================================================
-- Banear una ficha o un SteamID sin ficha. p_expires null = permanente (solo admin).
create function public.ban_create(p_player uuid, p_steam text, p_reason text, p_expires timestamptz) returns uuid
  language plpgsql security definer set search_path = public as $$
begin
  if not is_moderator() then raise exception 'Solo moderadores y admins pueden banear' using errcode = '42501'; end if;
  if (p_player is null) = (p_steam is null) then raise exception 'Elegí una ficha o un SteamID, uno de los dos'; end if;
  if p_expires is null and not is_admin() then
    raise exception 'Solo un admin puede banear de forma permanente' using errcode = '42501';
  end if;
  if p_expires is not null and p_expires <= now() then raise exception 'El vencimiento tiene que ser futuro'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 200 then raise exception 'El motivo es obligatorio (hasta 200 caracteres)'; end if;
  return ban_insert(p_player, p_steam, null, p_reason, p_expires, 'web', auth.uid(), null, null, null);
end $$;

-- Cambiar el motivo o el vencimiento de un baneo activo. p_permanent: sin vencimiento (solo admin).
create function public.ban_update(p_id uuid, p_reason text, p_expires timestamptz, p_permanent boolean default false) returns void
  language plpgsql security definer set search_path = public as $$
declare b bans;
begin
  if not is_moderator() then raise exception 'Solo moderadores y admins pueden cambiar baneos' using errcode = '42501'; end if;
  select * into b from bans where id = p_id for update;
  if b.id is null then raise exception 'No existe ese baneo'; end if;
  if b.lifted_at is not null or b.expires_at <= now() then raise exception 'Solo se cambia un baneo activo'; end if;
  if b.expires_at is null and not is_admin() then
    raise exception 'Solo un admin puede cambiar un baneo permanente' using errcode = '42501';
  end if;
  if coalesce(p_permanent, false) and not is_admin() then
    raise exception 'Solo un admin puede banear de forma permanente' using errcode = '42501';
  end if;
  if coalesce(p_permanent, false) and p_expires is not null then raise exception 'Elegí un vencimiento o permanente, no los dos'; end if;
  if p_expires is not null and p_expires <= now() then raise exception 'El vencimiento tiene que ser futuro'; end if;
  if p_reason is not null and char_length(btrim(p_reason)) not between 1 and 200 then
    raise exception 'El motivo es obligatorio (hasta 200 caracteres)';
  end if;
  if p_reason is null and p_expires is null and not coalesce(p_permanent, false) then raise exception 'No hay nada que cambiar'; end if;
  update bans set reason = coalesce(btrim(p_reason), reason),
                  expires_at = case when p_permanent then null else coalesce(p_expires, expires_at) end,
                  updated_by = auth.uid()
   where id = p_id;
end $$;

-- Levantar un baneo activo, con motivo.
create function public.ban_lift(p_id uuid, p_reason text) returns void
  language plpgsql security definer set search_path = public as $$
declare b bans;
begin
  if not is_moderator() then raise exception 'Solo moderadores y admins pueden levantar baneos' using errcode = '42501'; end if;
  select * into b from bans where id = p_id for update;
  if b.id is null then raise exception 'No existe ese baneo'; end if;
  if b.lifted_at is not null or b.expires_at <= now() then raise exception 'Ese baneo ya no está activo'; end if;
  if b.expires_at is null and not is_admin() then
    raise exception 'Solo un admin puede levantar un baneo permanente' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 200 then raise exception 'El motivo es obligatorio (hasta 200 caracteres)'; end if;
  update bans set lifted_at = now(), lifted_by = auth.uid(), lift_reason = btrim(p_reason) where id = p_id;
end $$;

revoke all on function public.is_moderator() from public;
grant execute on function public.is_moderator() to anon, authenticated;
-- ban_owner queda para todos: la usa la vista pública.
revoke all on function public.ban_active_for(text), public.ban_steams(uuid, text),
  public.ban_insert(uuid, text, text, text, timestamptz, text, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.ban_create(uuid, text, text, timestamptz), public.ban_update(uuid, text, timestamptz, boolean),
  public.ban_lift(uuid, text) from public, anon;
grant execute on function public.ban_create(uuid, text, text, timestamptz), public.ban_update(uuid, text, timestamptz, boolean),
  public.ban_lift(uuid, text) to authenticated;

-- =====================================================================================================
-- 4. Para el plugin (token del servidor, como csstv_whois). Responden 200 con {"ok": ...}
-- =====================================================================================================
-- Vencimiento para el plugin: segundos Unix, 0 = permanente.
create function public.ban_unix(p_expires timestamptz) returns bigint language sql immutable as $$
  select coalesce(extract(epoch from p_expires)::bigint, 0) $$;

-- Al conectarse alguien: si el SteamID (o su ficha) tiene un baneo activo.
create function public.csstv_ban_check(p_token text, p_steam text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare s64 text; b bans;
begin
  perform csstv_auth(p_token);
  s64 := csstv_steam64(p_steam);
  if s64 is null then return jsonb_build_object('ok', false, 'message', 'SteamID inválido'); end if;
  select * into b from ban_active_for(s64) limit 1;
  if b.id is null then return jsonb_build_object('ok', true, 'banned', false); end if;
  return jsonb_build_object('ok', true, 'banned', true, 'ban_id', b.id, 'reason', b.reason,
    'expires', ban_unix(b.expires_at), 'expires_at', b.expires_at);
end $$;

-- Sincronización: los baneos creados, cambiados o levantados después de p_cursor, uno por SteamID alcanzado (todos los
-- de la ficha). Sin cursor, todos los activos. También los baneos activos cuya ficha sumó un SteamID después del cursor.
-- Devuelve el próximo cursor con un minuto de margen, así que una fila puede repetirse: aplicarla dos veces da lo mismo.
-- Un baneo que vence no cambia: el plugin usa `expires`. Un levantado trae active = false y el plugin borra por ban_id.
create function public.csstv_bans_since(p_token text, p_cursor text default null) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_cursor timestamptz; v_items jsonb;
begin
  perform csstv_auth(p_token);
  begin
    v_cursor := nullif(btrim(coalesce(p_cursor, '')), '')::timestamptz;
  exception when others then
    return jsonb_build_object('ok', false, 'message', 'Cursor inválido');
  end;
  select coalesce(jsonb_agg(jsonb_build_object(
           'ban_id', t.id, 'steam', csstv_steam0(t.s), 'steam64', t.s, 'active', t.active,
           'reason', t.reason, 'expires', ban_unix(t.expires_at)) order by t.updated_at, t.s), '[]')
    into v_items
    from (
      select b.id, b.reason, b.expires_at, b.updated_at, s,
             b.lifted_at is null and (b.expires_at is null or b.expires_at > now()) as active
        from bans b, unnest(ban_steams(b.player_id, b.steam_id)) s
       where case when v_cursor is null then b.lifted_at is null and (b.expires_at is null or b.expires_at > now())
                  else b.updated_at > v_cursor
                       or (b.lifted_at is null and (b.expires_at is null or b.expires_at > now())
                           and exists (select 1 from player_extra_steam_ids x
                                        where x.player_id = ban_owner(b.player_id, b.steam_id) and x.added_at > v_cursor))
             end
    ) t;
  return jsonb_build_object('ok', true, 'cursor', now() - interval '1 minute', 'items', v_items);
end $$;

-- !ban del juego (también sm_addban). p_minutes 0 = permanente. El admin puede ser la consola (sin SteamID).
create function public.csstv_ban_add(
  p_token text, p_steam text, p_nick text, p_admin_steam text, p_admin_name text, p_minutes int, p_reason text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_server uuid; s64 text; v_id uuid;
begin
  v_server := csstv_auth(p_token);
  s64 := csstv_steam64(p_steam);
  if s64 is null then return jsonb_build_object('ok', false, 'message', 'SteamID inválido'); end if;
  if p_minutes is null or p_minutes < 0 then return jsonb_build_object('ok', false, 'message', 'Duración inválida'); end if;
  v_id := ban_insert(null, s64, p_nick,
    left(coalesce(nullif(btrim(p_reason), ''), 'Sin motivo (baneado en el servidor)'), 200),
    case when p_minutes = 0 then null else now() + p_minutes * interval '1 minute' end,
    'server', null, csstv_steam64(p_admin_steam), p_admin_name, v_server);
  return jsonb_build_object('ok', true, 'ban_id', v_id);
end $$;

-- !unban del juego: levanta los baneos activos que alcanzan a ese SteamID (también los de la web).
create function public.csstv_ban_lift(p_token text, p_steam text, p_admin_steam text, p_admin_name text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_server uuid; s64 text; n int;
begin
  v_server := csstv_auth(p_token);
  s64 := csstv_steam64(p_steam);
  if s64 is null then return jsonb_build_object('ok', false, 'message', 'SteamID inválido'); end if;
  update bans set lifted_at = now(), lifted_by_steam = csstv_steam64(p_admin_steam),
                  lifted_by_name = left(nullif(btrim(p_admin_name), ''), 64),
                  lift_reason = left('Levantado en el servidor ' || (select name from game_servers where id = v_server), 200)
   where id in (select a.id from ban_active_for(s64) a);
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'lifted', n);
end $$;

revoke all on function public.ban_unix(timestamptz) from public, anon, authenticated;
revoke all on function public.csstv_ban_check(text, text), public.csstv_bans_since(text, text),
  public.csstv_ban_add(text, text, text, text, text, int, text), public.csstv_ban_lift(text, text, text, text) from public;
grant execute on function public.csstv_ban_check(text, text), public.csstv_bans_since(text, text),
  public.csstv_ban_add(text, text, text, text, text, int, text), public.csstv_ban_lift(text, text, text, text)
  to anon, authenticated, service_role;

-- =====================================================================================================
-- 5. Vista pública
-- =====================================================================================================
-- player_id: la ficha alcanzada (también si se baneó un SteamID que después sumó una ficha). steam_id es público solo
-- sin ficha (como los perfiles sin reclamar); la API lo muestra a moderadores y admins. `search` no incluye el SteamID
-- de una ficha; `search_all`, sí (para moderadores y admins).
create view public.ban_list as
select b.id, o.player_id, coalesce(p.nick, b.nick) as nick, b.steam_id, b.reason, b.created_at, b.expires_at,
       b.expires_at is null as permanent,
       case when b.lifted_at is not null then 'lifted'
            when b.expires_at is not null and b.expires_at <= now() then 'expired'
            else 'active' end as status,
       b.source, b.server_id, g.name as server_name,
       b.created_by, pc.tag as created_by_alias, b.created_by_name,
       b.updated_at, b.lifted_at, b.lift_reason, b.lifted_by, pl.tag as lifted_by_alias, b.lifted_by_name, b.replaced_by,
       search_norm(concat_ws(' ', coalesce(p.nick, b.nick), b.reason, case when o.player_id is null then b.steam_id end)) as search,
       search_norm(concat_ws(' ', coalesce(p.nick, b.nick), b.reason, b.steam_id)) as search_all
  from bans b
  cross join lateral (select ban_owner(b.player_id, b.steam_id) as player_id) o
  left join players p on p.id = o.player_id
  left join game_servers g on g.id = b.server_id
  left join profiles pc on pc.id = b.created_by
  left join profiles pl on pl.id = b.lifted_by;
comment on view public.ban_list is 'Baneos de todos los servidores, públicos (replanteo 31)';
grant select on public.ban_list to anon, authenticated;

commit;
