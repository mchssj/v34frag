-- 87: la página del Equipo (bitácora docs/bitacora/2026-11-07-pagina-equipo, Daniel 2026-11-07).
--
--   1. staff_public(): los admins, los moderadores y los VIP activos (sin los admins ni los que se ocultaron), con su
--      ficha (nick, foto y nivel). Las cuentas sin ficha no salen. Los VIP, por antigüedad.
--   2. vip_list_me() y vip_list_hidden_set(p_hidden): si eres VIP y si te ocultaste de la lista
--      (user_preferences.vip_list_hidden).
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/87_pagina_equipo.sql.
begin;

do $$
begin
  if to_regprocedure('public.staff_public()') is not null then raise exception 'replanteo 87: ya se aplicó (staff_public existe)'; end if;
end $$;

create function public.staff_public() returns jsonb
  language sql stable security definer set search_path = public as $$
  with card as (
    select pr.id as user_id, pr.role, p.id as player_id, p.nick, mm_player_photo(p.id) as photo_url, elo_level(mm_player_elo(p.id)) as level
      from profiles pr join players p on p.user_id = pr.id
  ), vip as (
    select v.user_id, min(v.starts_at) as since from vip_memberships v
     where v.user_id in (select user_id from vip_public) and v.revoked_at is null group by v.user_id
  )
  select jsonb_build_object(
    'admins', (select coalesce(jsonb_agg(jsonb_build_object('player_id', player_id, 'nick', nick, 'photo_url', photo_url, 'level', level)
                 order by lower(nick)), '[]') from card where role = 'admin'),
    'moderators', (select coalesce(jsonb_agg(jsonb_build_object('player_id', player_id, 'nick', nick, 'photo_url', photo_url, 'level', level)
                     order by lower(nick)), '[]') from card where role = 'moderator'),
    -- Sin los admins (Daniel) ni los que se ocultaron.
    'vips', (select coalesce(jsonb_agg(jsonb_build_object('player_id', c.player_id, 'nick', c.nick, 'photo_url', c.photo_url, 'level', c.level,
               'since', v.since) order by v.since, lower(c.nick)), '[]')
               from vip v join card c on c.user_id = v.user_id
              where c.role <> 'admin'
                and not coalesce((select (preferences->>'vip_list_hidden')::boolean from user_preferences where user_id = v.user_id), false)))
$$;
comment on function public.staff_public() is 'La página del Equipo (replanteo 87): admins, moderadores y VIP';

create function public.vip_list_me() returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('vip', is_vip(auth.uid()),
    'hidden', coalesce((select (preferences->>'vip_list_hidden')::boolean from user_preferences where user_id = auth.uid()), false)) $$;

create function public.vip_list_hidden_set(p_hidden boolean) returns void
  language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Tienes que iniciar sesión' using errcode = '42501'; end if;
  insert into user_preferences (user_id, preferences) values (me, jsonb_build_object('vip_list_hidden', p_hidden))
  on conflict (user_id) do update set preferences = user_preferences.preferences || jsonb_build_object('vip_list_hidden', p_hidden),
    updated_at = now();
end $$;

revoke all on function public.staff_public(), public.vip_list_me(), public.vip_list_hidden_set(boolean) from public, anon;
grant execute on function public.staff_public(), public.vip_list_me(), public.vip_list_hidden_set(boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
