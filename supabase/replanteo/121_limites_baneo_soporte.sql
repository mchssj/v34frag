-- 121: límites configurables para los baneos del soporte (bitácora docs/bitacora/2026-11-14-limites-baneo-soporte,
-- aprobado por Daniel el 2026-11-14).
--
--   1. site_config suma support_ban_max_minutes (120), support_ban_max_count (3) y support_ban_window_days (7), con
--      quién y cuándo los cambió por última vez. Los rangos: minutos de 1 a 1440, baneos de 1 a 20 y días de 1 a 90.
--   2. site_ban_limits(): los lee el soporte, los moderadores y los admins. site_admin_set_ban_limits(): solo un admin.
--   3. ban_support_count, ban_support_quota, ban_create y ban_update leen esos valores en lugar de los 120 minutos,
--      los 3 baneos y los 7 días fijos de la 117. ban_support_quota suma max_minutes y window_days.
--      Bajar el tope no cambia los baneos que ya están puestos: vale para los nuevos y para los cambios.
-- Se aplica después de la 120 (la 118 y la 119 son permisos y tienda; la 120, la portada). Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/121_limites_baneo_soporte.sql.
-- Pruebas: docs/bitacora/2026-11-14-limites-baneo-soporte/pruebas/probar_121.sql (con rollback).
begin;

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'site_config' and column_name = 'support_ban_max_minutes') then
    raise exception '121 ya aplicada';
  end if;
  if not exists (select 1 from pg_proc where proname = 'ban_support_quota') then
    raise exception 'Falta la 117 (rol Soporte)';
  end if;
end $$;

-- ---------- 1. Los valores ----------

alter table public.site_config
  add column support_ban_max_minutes int not null default 120 check (support_ban_max_minutes between 1 and 1440),
  add column support_ban_max_count int not null default 3 check (support_ban_max_count between 1 and 20),
  add column support_ban_window_days int not null default 7 check (support_ban_window_days between 1 and 90),
  add column ban_limits_updated_at timestamptz,
  add column ban_limits_updated_by uuid references auth.users (id) on delete set null;
comment on column public.site_config.support_ban_max_minutes is 'Minutos máximos de un baneo del soporte, desde que se pone (replanteo 121)';
comment on column public.site_config.support_ban_max_count is 'Baneos de soporte por jugador dentro de la ventana (replanteo 121)';
comment on column public.site_config.support_ban_window_days is 'Días de la ventana del límite de baneos de soporte (replanteo 121)';

-- ---------- 2. Leer y guardar ----------

create function public.site_ban_limits() returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare s site_config;
begin
  if not coalesce(is_support(), false) then raise exception 'Solo soporte, moderadores y admins' using errcode = '42501'; end if;
  select * into s from site_config where id = 1;
  return jsonb_build_object('max_minutes', s.support_ban_max_minutes, 'max_bans', s.support_ban_max_count,
                            'window_days', s.support_ban_window_days, 'updated_at', s.ban_limits_updated_at,
                            'updated_by', s.ban_limits_updated_by,
                            'updated_by_nick', (select coalesce(p.nick, pr.tag) from profiles pr
                                                  left join players p on p.user_id = pr.id
                                                 where pr.id = s.ban_limits_updated_by limit 1));
end $$;
comment on function public.site_ban_limits() is 'Límites de los baneos del soporte (replanteo 121)';

create function public.site_admin_set_ban_limits(p_max_minutes int, p_max_bans int, p_window_days int) returns jsonb
  language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(is_admin(), false) then raise exception 'Solo un admin cambia los límites del soporte' using errcode = '42501'; end if;
  if p_max_minutes is null or p_max_minutes not between 1 and 1440 then raise exception 'Los minutos van de 1 a 1440'; end if;
  if p_max_bans is null or p_max_bans not between 1 and 20 then raise exception 'Los baneos van de 1 a 20'; end if;
  if p_window_days is null or p_window_days not between 1 and 90 then raise exception 'Los días van de 1 a 90'; end if;
  update site_config set support_ban_max_minutes = p_max_minutes, support_ban_max_count = p_max_bans,
                         support_ban_window_days = p_window_days, ban_limits_updated_at = now(), ban_limits_updated_by = auth.uid()
   where id = 1;
  return site_ban_limits();
end $$;
comment on function public.site_admin_set_ban_limits(int, int, int) is 'Guarda los límites de los baneos del soporte; solo un admin (replanteo 121)';

-- ---------- 3. Los baneos ----------

-- Baneos de soporte de esa persona (todos sus SteamID y su ficha) dentro de la ventana, levantados incluidos.
create or replace function public.ban_support_count(p_steam text) returns integer
  language sql stable security definer set search_path = public as $$
  select count(*)::int from bans b
   where b.created_by_role = 'support'
     and b.created_at > now() - make_interval(days => (select support_ban_window_days from site_config where id = 1))
     and (b.steam_id = p_steam or ban_owner(b.player_id, b.steam_id) = steam_owner(p_steam))
$$;

-- Para el formulario del soporte: cuántos le quedan en la ventana, si ya está baneado y los límites que valen.
create or replace function public.ban_support_quota(p_player uuid, p_steam text) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare v_steam text; v_used int := 0; a bans; s site_config;
begin
  if not coalesce(is_support(), false) then raise exception 'Solo soporte, moderadores y admins' using errcode = '42501'; end if;
  if (p_player is null) = (p_steam is null) then raise exception 'Elegí una ficha o un SteamID, uno de los dos'; end if;
  select * into s from site_config where id = 1;
  v_steam := ban_target_steam(p_player, p_steam);
  if v_steam is not null then
    v_used := ban_support_count(v_steam);
    select * into a from ban_active_for(v_steam) limit 1;
  end if;
  return jsonb_build_object('used', v_used, 'max', s.support_ban_max_count, 'remaining', greatest(0, s.support_ban_max_count - v_used),
                            'window_days', s.support_ban_window_days, 'max_minutes', s.support_ban_max_minutes,
                            'banned', a.id is not null, 'banned_until', a.expires_at, 'permanent', a.id is not null and a.expires_at is null);
end $$;
comment on function public.ban_support_quota(uuid, text) is 'Baneos de soporte de la ventana, baneo activo y límites, para el formulario (replanteos 117 y 121)';

create or replace function public.ban_create(p_player uuid, p_steam text, p_reason text, p_expires timestamptz) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  v_role text := (select role from profiles where id = auth.uid());
  v_expires timestamptz := p_expires;
  v_steam text; v_id uuid; a bans; b bans; s site_config;
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
    if v_steam is not null then
      -- Bloqueado por SteamID: dos soportes a la vez no pasan los dos el límite.
      perform pg_advisory_xact_lock(hashtext('ban_support:' || coalesce(steam_owner(v_steam)::text, v_steam)));
      select * into a from ban_active_for(v_steam) limit 1;
      if a.id is not null then
        raise exception '%', case when a.expires_at is null then 'Ya tiene un baneo permanente'
                                  else 'Ya está baneado hasta el ' || to_char(a.expires_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI') end
          using errcode = 'P0001';
      end if;
      if ban_support_count(v_steam) >= s.support_ban_max_count then
        raise exception 'Ya tiene % baneos de soporte en los últimos % días: pásale el caso a un moderador',
          s.support_ban_max_count, s.support_ban_window_days using errcode = 'P0001';
      end if;
    end if;
  end if;

  v_id := ban_insert(p_player, p_steam, null, p_reason, v_expires, 'web', auth.uid(), null, null, null);
  update bans set created_by_role = case when v_role in ('support', 'moderator', 'admin') then v_role end where id = v_id
  returning * into b;
  perform support_log('ban', jsonb_build_object('ban_id', v_id, 'player_id', b.player_id, 'steam_id', b.steam_id, 'nick', b.nick,
                                                'expires_at', b.expires_at), b.reason);
  return v_id;
end $$;

create or replace function public.ban_update(p_id uuid, p_reason text, p_expires timestamptz, p_permanent boolean default false) returns void
  language plpgsql security definer set search_path = public as $$
declare b bans; v_support boolean := not coalesce(is_moderator(), false); v_expires timestamptz := p_expires; v_max int;
begin
  if not is_support() then raise exception 'Solo soporte, moderadores y admins pueden cambiar baneos' using errcode = '42501'; end if;
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
  -- El soporte (replanteos 117 y 121): solo los suyos y hasta los minutos de site_config desde que lo puso.
  if v_support then
    if b.created_by is distinct from auth.uid() then
      raise exception 'Solo puedes cambiar los baneos que pusiste tú' using errcode = '42501';
    end if;
    if p_expires is not null then
      v_max := (select support_ban_max_minutes from site_config where id = 1);
      if p_expires > b.created_at + make_interval(mins => v_max + 1) then
        raise exception 'El soporte banea hasta % minutos desde que lo puso', v_max using errcode = '42501';
      end if;
      v_expires := least(p_expires, b.created_at + make_interval(mins => v_max));
    end if;
  end if;
  update bans set reason = coalesce(btrim(p_reason), reason),
                  expires_at = case when p_permanent then null else coalesce(v_expires, expires_at) end,
                  updated_by = auth.uid()
   where id = p_id
  returning * into b;
  perform support_log('ban_update', jsonb_build_object('ban_id', b.id, 'player_id', b.player_id, 'steam_id', b.steam_id, 'nick', b.nick,
                                                       'expires_at', b.expires_at), b.reason);
end $$;

-- ---------- Permisos ----------

revoke all on function public.site_ban_limits(), public.site_admin_set_ban_limits(int, int, int) from public, anon;
grant execute on function public.site_ban_limits(), public.site_admin_set_ban_limits(int, int, int) to authenticated;
-- create or replace conserva los permisos de ban_support_count, ban_support_quota, ban_create y ban_update.

notify pgrst, 'reload schema';

commit;
