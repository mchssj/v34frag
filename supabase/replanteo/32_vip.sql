-- Replanteo 32: avisos del VIP (plan docs/bitacora/2026-10-28-vip-fase-0).
-- La tabla, is_vip(), dar y quitar y las vistas están en producción desde la migración
-- supabase/migrations/20261028120000_vip.sql. Esta suma los avisos, que necesitan las notificaciones de la 28:
--   1. vip_granted y vip_revoked en la categoría account.
--   2. admin_vip_grant y admin_vip_revoke, como en la migración, avisan a la cuenta.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.bans') is null then
    raise exception 'replanteo 32: falta bans (aplicar antes 31_baneos.sql)';
  end if;
  if to_regclass('public.vip_memberships') is null then
    raise exception 'replanteo 32: falta vip_memberships (aplicar antes supabase/migrations/20261028120000_vip.sql)';
  end if;
  if public.notification_category('vip_granted') is not null then
    raise exception 'replanteo 32: vip_granted ya es un aviso (¿ya se aplicó?)';
  end if;
end $$;

-- =====================================================================================================
-- 1. Categoría
-- =====================================================================================================
create or replace function public.notification_category(p_type text) returns text language sql immutable as $$
  select case
    when p_type in ('team_invite', 'team_join_request', 'team_invite_answered', 'team_join_answered', 'team_captain', 'team_removed',
                    'team_member_left', 'team_role_changed', 'team_added', 'team_deleted', 'team_request_answered') then 'team'
    when p_type in ('event_registration', 'event_fixture', 'match_scheduled', 'veto_turn', 'veto_done', 'veto_reset',
                    'match_result', 'event_progress', 'event_cancelled') then 'tournament'
    when p_type in ('pcw_accepted', 'pcw_cancelled', 'pcw_result') then 'pcw'
    when p_type in ('level_changed', 'mix_review_resolved', 'mix_deleted', 'elo_adjusted', 'clip_ready') then 'elo'
    when p_type in ('season_ranked', 'season_closed', 'medal_granted') then 'season'
    when p_type in ('steam_claimed', 'steam_request_answered', 'alias_changed', 'role_changed', 'password_changed',
                    'vip_granted', 'vip_revoked') then 'account' -- (replanteo 32)
    when p_type in ('event_new', 'season_started') then 'news'
    when p_type in ('admin_steam_request', 'admin_team_request', 'admin_mix_review', 'admin_demo_failed', 'admin_season_delayed') then 'admin'
  end $$;

-- =====================================================================================================
-- 2. Dar y quitar con aviso
-- =====================================================================================================
-- Como en la migración 20261028120000_vip.sql, con el aviso al final.
-- Dar o extender el VIP. Una sola forma: p_months (1, 3, 6 o 12), p_until (fecha de fin) o p_lifetime.
-- Si tiene un VIP vigente (o uno futuro), el período nuevo empieza donde termina el último; si no, ahora.
-- Devuelve el id del período.
create or replace function public.admin_vip_grant(p_user uuid, p_months int default null, p_until timestamptz default null,
                                                  p_lifetime boolean default false, p_note text default null) returns uuid
  language plpgsql security definer set search_path = public as $$
declare v_life boolean := coalesce(p_lifetime, false); v_start timestamptz; v_end timestamptz; v_id uuid;
begin
  if not is_admin() then raise exception 'Solo un administrador puede dar VIP' using errcode = '42501'; end if;
  if (p_months is not null)::int + (p_until is not null)::int + v_life::int <> 1 then
    raise exception 'Elegí una duración: meses, una fecha o lifetime';
  end if;
  if p_months is not null and p_months not in (1, 3, 6, 12) then raise exception 'Los meses tienen que ser 1, 3, 6 o 12'; end if;
  if char_length(p_note) > 200 then raise exception 'La nota puede tener hasta 200 caracteres'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'No existe ese usuario'; end if;

  perform pg_advisory_xact_lock(hashtext('vip:' || p_user::text));

  if exists (select 1 from vip_memberships where user_id = p_user and revoked_at is null and ends_at is null) then
    raise exception 'Ya es VIP lifetime';
  end if;
  select greatest(now(), coalesce(max(ends_at), now())) into v_start
    from vip_memberships where user_id = p_user and revoked_at is null and ends_at > now();

  if v_life then
    v_start := now();
    v_end := null;
  elsif p_months is not null then
    v_end := v_start + make_interval(months => p_months);
  else
    if p_until <= v_start then
      raise exception 'La fecha tiene que ser posterior al %', to_char(v_start at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI');
    end if;
    v_end := p_until;
  end if;

  insert into vip_memberships (user_id, starts_at, ends_at, source, note, granted_by)
  values (p_user, v_start, v_end, 'manual', nullif(btrim(p_note), ''), auth.uid())
  returning id into v_id;

  perform notify(array[p_user], 'vip_granted', jsonb_build_object('until', v_end, 'lifetime', v_life)); -- (replanteo 32)
  return v_id;
end $$;

-- Quitar el VIP: revoca los períodos vigentes y los futuros, también un lifetime. Devuelve cuántos revocó.
create or replace function public.admin_vip_revoke(p_user uuid, p_reason text) returns int
  language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_admin() then raise exception 'Solo un administrador puede quitar VIP' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 200 then
    raise exception 'El motivo es obligatorio (hasta 200 caracteres)';
  end if;
  perform pg_advisory_xact_lock(hashtext('vip:' || p_user::text));
  update vip_memberships set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = btrim(p_reason)
   where user_id = p_user and revoked_at is null and (ends_at is null or ends_at > now());
  get diagnostics n = row_count;
  if n = 0 then raise exception 'No tiene VIP vigente'; end if;
  perform notify(array[p_user], 'vip_revoked', jsonb_build_object('reason', btrim(p_reason))); -- (replanteo 32)
  return n;
end $$;

commit;
