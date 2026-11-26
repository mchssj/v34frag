-- 147: banear una ficha sin SteamID (bitácora docs/bitacora/2026-11-25-banear-ficha-sin-steamid/, Daniel 2026-11-25).
--
-- Antes, ban_insert cortaba con "La ficha no tiene SteamID" y bans.steam_id era obligatorio. Desde los replanteos 49 y 52
-- una ficha sin SteamID entra al matchmaking (el SteamID se vincula con !claim en la primera sala), así que no se la
-- podía sacar de la cola con un baneo.
--   1. bans.steam_id opcional; tiene que haber ficha o SteamID (bans_destino).
--   2. ban_active_target(ficha, SteamID): los baneos activos de la ficha o del SteamID. ban_insert la usa para el candado,
--      el permanente y el reemplazo, y acepta la ficha sin SteamID.
--   3. ban_support_count(ficha, SteamID), ban_support_quota y ban_create: los límites del soporte también sin SteamID.
--   4. ban_steams sin el null, y csstv_bans_since: sin filas sin SteamID, y suma los baneos de las fichas que vincularon
--      su SteamID principal después del cursor (antes, solo los secundarios).
-- El matchmaking no cambia: mm_block_reason, mm_user_banned y mm_ban_kick ya miran bans.player_id. ban_list tampoco.
-- No necesita las 139 a 146. Va antes que la API y la web.
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/147_baneo_ficha_sin_steamid.sql.
begin;

do $$
begin
  if to_regprocedure('public.ban_active_target(uuid,text)') is not null then
    raise exception 'replanteo 147: ya se aplicó (ban_active_target existe)';
  end if;
  if to_regprocedure('public.ban_support_count(text)') is null or to_regprocedure('public.is_support()') is null then
    raise exception 'replanteo 147: faltan los replanteos 117 y 121 (ban_support_count, is_support)';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'site_config' and column_name = 'support_ban_window_days') then
    raise exception 'replanteo 147: falta el replanteo 121 (site_config.support_ban_window_days)';
  end if;
end $$;

-- ---------- 1. La tabla ----------
alter table public.bans alter column steam_id drop not null;
-- is_steam64(null) da false: el check de la 31 no deja pasar el null.
alter table public.bans drop constraint bans_steam_id_check;
alter table public.bans add constraint bans_steam_id_check check (steam_id is null or is_steam64(steam_id));
alter table public.bans add constraint bans_destino check (player_id is not null or steam_id is not null);
comment on column public.bans.steam_id is
  'SteamID baneado: el de la ficha al banearla o el SteamID sin ficha. null: ficha sin SteamID (replanteo 147)';

-- ---------- 2. Baneos activos de una ficha o un SteamID ----------
-- Como ban_active_for, pero también por la ficha, que puede no tener SteamID. Primero los permanentes y los más largos.
create function public.ban_active_target(p_player uuid, p_steam text) returns setof public.bans
  language sql stable security definer set search_path = public as $$
  select b.* from bans b
   where b.lifted_at is null and (b.expires_at is null or b.expires_at > now())
     and ((p_steam is not null and (b.steam_id = p_steam or ban_owner(b.player_id, b.steam_id) = steam_owner(p_steam)))
          or (p_player is not null and ban_owner(b.player_id, b.steam_id) = p_player))
   order by b.expires_at desc nulls first, b.created_at desc
$$;

-- Como en la 31, sin el null de una ficha sin SteamID.
create or replace function public.ban_steams(p_player uuid, p_steam text) returns text[]
  language sql stable security definer set search_path = public as $$
  select array_agg(distinct s) from (
    select p_steam as s
    union all
    select x.steam_id from player_steam_all x where x.player_id = ban_owner(p_player, p_steam)
  ) t
  where s is not null -- (replanteo 147)
$$;

-- Como en la 31: la ficha puede no tener SteamID (replanteo 147).
create or replace function public.ban_insert(
  p_player uuid, p_steam text, p_nick text, p_reason text, p_expires timestamptz, p_source text,
  p_by uuid, p_by_steam text, p_by_name text, p_server uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_player uuid; v_steam text; v_nick text; v_id uuid; v_perm uuid;
begin
  if p_player is not null then
    select id, steam_id, nick into v_player, v_steam, v_nick from players where id = p_player;
    if v_player is null then raise exception 'No existe esa ficha'; end if;
    -- Sin SteamID también: el baneo saca de la cola y les llega a los servidores cuando vincule uno (replanteo 147).
  else
    if not coalesce(is_steam64(p_steam), false) then raise exception 'SteamID inválido'; end if;
    v_steam := p_steam;
    v_player := steam_owner(p_steam);
    select nick into v_nick from players where id = v_player;
  end if;
  v_nick := left(coalesce(nullif(btrim(p_nick), ''), v_nick,
    (select s.nick from match_player_stats s join matches m on m.id = s.match_id
      where v_steam is not null and s.steam_id = v_steam and s.nick is not null
      order by coalesce(m.played_at, s.created_at) desc limit 1)), 64);

  -- Uno a la vez por ficha (o por SteamID sin ficha).
  perform pg_advisory_xact_lock(hashtext('ban:' || coalesce(v_player::text, v_steam)));

  select id into v_perm from ban_active_target(v_player, v_steam) where expires_at is null limit 1;
  if v_perm is not null and p_source = 'server' then return v_perm; end if;
  if v_perm is not null and p_source = 'web' and not is_admin() then
    raise exception 'Ya tiene un baneo permanente: solo un admin lo puede cambiar' using errcode = '42501';
  end if;

  insert into bans (player_id, steam_id, nick, reason, expires_at, source, created_by, created_by_steam, created_by_name, server_id)
  values (v_player, v_steam, v_nick, btrim(p_reason), p_expires, p_source, p_by, p_by_steam, left(nullif(btrim(p_by_name), ''), 64), p_server)
  returning id into v_id;

  update bans set lifted_at = now(), lifted_by = p_by, lifted_by_steam = p_by_steam, lifted_by_name = left(nullif(btrim(p_by_name), ''), 64),
                  lift_reason = 'Reemplazado por un baneo nuevo', replaced_by = v_id
   where id in (select a.id from ban_active_target(v_player, v_steam) a where a.id <> v_id);
  return v_id;
end $$;

-- ---------- 3. Los límites del soporte ----------
-- Baneos de soporte de esa persona (su ficha y todos sus SteamID) dentro de la ventana, levantados incluidos. Como la de
-- un parámetro (121), que queda, más la ficha sin SteamID.
create function public.ban_support_count(p_player uuid, p_steam text) returns integer
  language sql stable security definer set search_path = public as $$
  select count(*)::int from bans b
   where b.created_by_role = 'support'
     and b.created_at > now() - make_interval(days => (select support_ban_window_days from site_config where id = 1))
     and ((p_steam is not null and (b.steam_id = p_steam or ban_owner(b.player_id, b.steam_id) = steam_owner(p_steam)))
          or (p_player is not null and ban_owner(b.player_id, b.steam_id) = p_player))
$$;

-- Como en la 121, también para una ficha sin SteamID (replanteo 147).
create or replace function public.ban_support_quota(p_player uuid, p_steam text) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare v_used int := 0; a bans; s site_config;
begin
  if not coalesce(is_support(), false) then raise exception 'Solo soporte, moderadores y admins' using errcode = '42501'; end if;
  if (p_player is null) = (p_steam is null) then raise exception 'Elegí una ficha o un SteamID, uno de los dos'; end if;
  select * into s from site_config where id = 1;
  v_used := ban_support_count(p_player, ban_target_steam(p_player, p_steam));
  select * into a from ban_active_target(p_player, ban_target_steam(p_player, p_steam)) limit 1;
  return jsonb_build_object('used', v_used, 'max', s.support_ban_max_count, 'remaining', greatest(0, s.support_ban_max_count - v_used),
                            'window_days', s.support_ban_window_days, 'max_minutes', s.support_ban_max_minutes,
                            'banned', a.id is not null, 'banned_until', a.expires_at, 'permanent', a.id is not null and a.expires_at is null);
end $$;
comment on function public.ban_support_quota(uuid, text) is
  'Baneos de soporte de la ventana, baneo activo y límites, para el formulario (replanteos 117, 121 y 147)';

-- Como en la 121: los límites del soporte también para una ficha sin SteamID (replanteo 147).
create or replace function public.ban_create(p_player uuid, p_steam text, p_reason text, p_expires timestamptz) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  v_role text := (select role from profiles where id = auth.uid());
  v_expires timestamptz := p_expires;
  v_steam text; v_owner uuid; v_id uuid; a bans; b bans; s site_config;
begin
  if not is_support() then raise exception 'Solo soporte, moderadores y admins pueden banear' using errcode = '42501'; end if;
  if (p_player is null) = (p_steam is null) then raise exception 'Elegí una ficha o un SteamID, uno de los dos'; end if;
  if p_expires is null and not is_admin() then
    raise exception 'Solo un admin puede banear de forma permanente' using errcode = '42501';
  end if;
  if p_expires is not null and p_expires <= now() then raise exception 'El vencimiento tiene que ser futuro'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 200 then raise exception 'El motivo es obligatorio (hasta 200 caracteres)'; end if;

  -- El soporte (replanteos 117 y 121): hasta los minutos de site_config, no a quien ya está baneado y hasta
  -- support_ban_max_count baneos de soporte por jugador en support_ban_window_days días.
  if v_role = 'support' then
    select * into s from site_config where id = 1;
    -- Un minuto de margen por la diferencia de reloj con la API; el baneo nunca pasa del máximo.
    if p_expires > now() + make_interval(mins => s.support_ban_max_minutes + 1) then
      raise exception 'El soporte banea hasta % minutos', s.support_ban_max_minutes using errcode = '42501';
    end if;
    v_expires := least(p_expires, now() + make_interval(mins => s.support_ban_max_minutes));
    v_steam := ban_target_steam(p_player, p_steam);
    v_owner := coalesce(p_player, steam_owner(v_steam));
    -- Bloqueado por ficha (o por SteamID sin ficha): dos soportes a la vez no pasan los dos el límite.
    perform pg_advisory_xact_lock(hashtext('ban_support:' || coalesce(v_owner::text, v_steam)));
    select * into a from ban_active_target(p_player, v_steam) limit 1;
    if a.id is not null then
      raise exception '%', case when a.expires_at is null then 'Ya tiene un baneo permanente'
                                else 'Ya está baneado hasta el ' || to_char(a.expires_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI') end
        using errcode = 'P0001';
    end if;
    if ban_support_count(p_player, v_steam) >= s.support_ban_max_count then
      raise exception 'Ya tiene % baneos de soporte en los últimos % días: pásale el caso a un moderador',
        s.support_ban_max_count, s.support_ban_window_days using errcode = 'P0001';
    end if;
  end if;

  v_id := ban_insert(p_player, p_steam, null, p_reason, v_expires, 'web', auth.uid(), null, null, null);
  update bans set created_by_role = case when v_role in ('support', 'moderator', 'admin') then v_role end where id = v_id
  returning * into b;
  perform support_log('ban', jsonb_build_object('ban_id', v_id, 'player_id', b.player_id, 'steam_id', b.steam_id, 'nick', b.nick,
                                                'expires_at', b.expires_at), b.reason);
  return v_id;
end $$;

-- ---------- 4. Sincronización con los servidores ----------
-- Como en la 31: sin filas sin SteamID, y también los baneos activos cuya ficha vinculó su SteamID principal después del
-- cursor (la ficha sin SteamID que se baneó y después hizo !claim). Replanteo 147.
create or replace function public.csstv_bans_since(p_token text, p_cursor text default null) returns jsonb
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
       where s is not null
         and case when v_cursor is null then b.lifted_at is null and (b.expires_at is null or b.expires_at > now())
                  else b.updated_at > v_cursor
                       or (b.lifted_at is null and (b.expires_at is null or b.expires_at > now())
                           and (exists (select 1 from player_extra_steam_ids x
                                         where x.player_id = ban_owner(b.player_id, b.steam_id) and x.added_at > v_cursor)
                                or exists (select 1 from players x
                                            where x.id = ban_owner(b.player_id, b.steam_id) and x.steam_added_at > v_cursor)))
             end
    ) t;
  return jsonb_build_object('ok', true, 'cursor', now() - interval '1 minute', 'items', v_items);
end $$;

-- ---------- 5. Permisos ----------
-- Solo los usa la base, como ban_active_for (118).
revoke all on function public.ban_active_target(uuid, text) from public, anon, authenticated;
revoke all on function public.ban_support_count(uuid, text) from public, anon, authenticated;

commit;
