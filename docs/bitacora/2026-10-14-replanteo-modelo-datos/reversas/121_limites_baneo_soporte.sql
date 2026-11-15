-- Inversa de la 121 (límites configurables para los baneos del soporte). Vuelve a la 117:
-- las funciones de los baneos con los 120 minutos, los 3 baneos y los 7 días fijos, sin site_ban_limits ni
-- site_admin_set_ban_limits, y sin las columnas de site_config (se pierden los valores que haya puesto un admin).
begin;

drop function public.site_admin_set_ban_limits(int, int, int);
drop function public.site_ban_limits();

-- Las funciones como en la 117.

create or replace function public.ban_support_count(p_steam text) returns integer
  language sql stable security definer set search_path = public as $$
  select count(*)::int from bans b
   where b.created_by_role = 'support' and b.created_at > now() - interval '7 days'
     and (b.steam_id = p_steam or ban_owner(b.player_id, b.steam_id) = steam_owner(p_steam))
$$;

create or replace function public.ban_support_quota(p_player uuid, p_steam text) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare v_steam text; v_used int; a bans;
begin
  if not coalesce(is_support(), false) then raise exception 'Solo soporte, moderadores y admins' using errcode = '42501'; end if;
  if (p_player is null) = (p_steam is null) then raise exception 'Elegí una ficha o un SteamID, uno de los dos'; end if;
  v_steam := ban_target_steam(p_player, p_steam);
  if v_steam is null then
    return jsonb_build_object('used', 0, 'max', 3, 'remaining', 3, 'banned', false, 'banned_until', null, 'permanent', false);
  end if;
  v_used := ban_support_count(v_steam);
  select * into a from ban_active_for(v_steam) limit 1;
  return jsonb_build_object('used', v_used, 'max', 3, 'remaining', greatest(0, 3 - v_used),
                            'banned', a.id is not null, 'banned_until', a.expires_at, 'permanent', a.id is not null and a.expires_at is null);
end $$;
comment on function public.ban_support_quota(uuid, text) is 'Baneos de soporte de la semana y baneo activo, para el formulario (replanteo 117)';

create or replace function public.ban_create(p_player uuid, p_steam text, p_reason text, p_expires timestamptz) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  v_role text := (select role from profiles where id = auth.uid());
  v_expires timestamptz := p_expires;
  v_steam text; v_id uuid; a bans; b bans;
begin
  if not is_support() then raise exception 'Solo soporte, moderadores y admins pueden banear' using errcode = '42501'; end if;
  if (p_player is null) = (p_steam is null) then raise exception 'Elegí una ficha o un SteamID, uno de los dos'; end if;
  if p_expires is null and not is_admin() then
    raise exception 'Solo un admin puede banear de forma permanente' using errcode = '42501';
  end if;
  if p_expires is not null and p_expires <= now() then raise exception 'El vencimiento tiene que ser futuro'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 200 then raise exception 'El motivo es obligatorio (hasta 200 caracteres)'; end if;

  -- El soporte (replanteo 117): de 1 a 120 minutos, no a quien ya está baneado y hasta 3 por jugador en 7 días.
  if v_role = 'support' then
    -- Un minuto de margen por la diferencia de reloj con la API; el baneo nunca pasa de 120 minutos.
    if p_expires > now() + interval '121 minutes' then
      raise exception 'El soporte banea hasta 120 minutos' using errcode = '42501';
    end if;
    v_expires := least(p_expires, now() + interval '120 minutes');
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
      if ban_support_count(v_steam) >= 3 then
        raise exception 'Ya tiene 3 baneos de soporte en los últimos 7 días: pásale el caso a un moderador' using errcode = 'P0001';
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
declare b bans; v_support boolean := not coalesce(is_moderator(), false); v_expires timestamptz := p_expires;
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
  -- El soporte (replanteo 117): solo los suyos y hasta 120 minutos desde que lo puso.
  if v_support then
    if b.created_by is distinct from auth.uid() then
      raise exception 'Solo puedes cambiar los baneos que pusiste tú' using errcode = '42501';
    end if;
    if p_expires is not null then
      if p_expires > b.created_at + interval '121 minutes' then
        raise exception 'El soporte banea hasta 120 minutos desde que lo puso' using errcode = '42501';
      end if;
      v_expires := least(p_expires, b.created_at + interval '120 minutes');
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

alter table public.site_config
  drop column support_ban_max_minutes,
  drop column support_ban_max_count,
  drop column support_ban_window_days,
  drop column ban_limits_updated_at,
  drop column ban_limits_updated_by;

notify pgrst, 'reload schema';

commit;
