-- 86: visitas a tu perfil (bitácora docs/bitacora/2026-11-07-visitas-al-perfil, Daniel 2026-11-07).
--
--   1. profile_visits: quién visitó qué perfil, una fila por visitante, perfil y día (Bogotá). Se guardan 30 días.
--   2. profile_visit(p_player): la registra (con sesión y ficha; no las propias ni las de fichas sin cuenta). Un VIP
--      con "navegar sin dejar rastro" prendido visita oculto hasta 15 perfiles distintos por semana (lunes a domingo,
--      Bogotá); desde el 16 se ve. Las ocultas no se muestran ni suman.
--   3. my_profile_visits(): el número de visitantes del perfil propio (30 y 7 días) y, solo si es VIP, quiénes son y el
--      estado del modo oculto. Sin VIP no sale nada de quién visitó.
--   4. profile_incognito_set(p_on): prende (solo VIP) o apaga el modo oculto (user_preferences.profile_incognito).
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/86_visitas_al_perfil.sql.
begin;

do $$
begin
  if to_regclass('public.profile_visits') is not null then raise exception 'replanteo 86: ya se aplicó (profile_visits existe)'; end if;
end $$;

create table public.profile_visits (
  player_id uuid not null references public.players(id) on delete cascade,
  visitor uuid not null references auth.users(id) on delete cascade,
  day date not null,
  visited_at timestamptz not null default now(),
  hidden boolean not null default false,
  primary key (player_id, visitor, day)
);
comment on table public.profile_visits is 'Visitas a los perfiles públicos (replanteo 86): una por visitante, perfil y día de Bogotá. 30 días';
create index profile_visits_visitor on public.profile_visits (visitor, day) where hidden;
alter table public.profile_visits enable row level security;
revoke all on public.profile_visits from anon, authenticated;

-- El día y el lunes de la semana, en Bogotá.
create function public.bogota_today() returns date language sql stable as $$ select (now() at time zone 'America/Bogota')::date $$;
create function public.bogota_week_start() returns date language sql stable as $$ select date_trunc('week', now() at time zone 'America/Bogota')::date $$;

create function public.profile_visit(p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_owner uuid;
  v_hidden boolean := false;
  v_week date := bogota_week_start();
begin
  if me is null then return; end if;
  select user_id into v_owner from players where id = p_player;
  if v_owner is null or v_owner = me then return; end if;
  if not exists (select 1 from players where user_id = me) then return; end if;
  -- Navegar sin dejar rastro: VIP, prendido y con cupo (o ya oculto en este perfil esta semana).
  if is_vip(me) and coalesce((select (preferences->>'profile_incognito')::boolean from user_preferences where user_id = me), false) then
    v_hidden := exists (select 1 from profile_visits where visitor = me and player_id = p_player and hidden and day >= v_week)
             or (select count(distinct player_id) from profile_visits where visitor = me and hidden and day >= v_week) < 15;
  end if;
  insert into profile_visits (player_id, visitor, day, visited_at, hidden) values (p_player, me, bogota_today(), now(), v_hidden)
  on conflict (player_id, visitor, day) do update
    set visited_at = now(), hidden = profile_visits.hidden and excluded.hidden;
  delete from profile_visits where player_id = p_player and day < bogota_today() - 30;
end $$;

create function public.my_profile_visits() returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_player uuid;
  v_vip boolean;
  v_today date := bogota_today();
  v_week date := bogota_week_start();
begin
  if me is null then raise exception 'Tienes que iniciar sesión' using errcode = '42501'; end if;
  v_player := (select id from players where user_id = me);
  v_vip := is_vip(me);
  return jsonb_build_object(
    'vip', v_vip,
    'total', (select count(distinct visitor) from profile_visits where player_id = v_player and not hidden and day > v_today - 30),
    'week', (select count(distinct visitor) from profile_visits where player_id = v_player and not hidden and day > v_today - 7),
    -- Solo VIP: quiénes. Sin VIP no sale nada de quién visitó.
    'items', case when v_vip then (
        select coalesce(jsonb_agg(jsonb_build_object('player_id', p.id, 'nick', p.nick, 'photo_url', mm_player_photo(p.id),
                 'level', elo_level(mm_player_elo(p.id)), 'visited_at', x.at) order by x.at desc), '[]')
          from (select visitor, max(visited_at) at from profile_visits
                 where player_id = v_player and not hidden and day > v_today - 30
                 group by visitor order by max(visited_at) desc limit 100) x
          join players p on p.user_id = x.visitor) end,
    'incognito', case when v_vip then jsonb_build_object(
        'enabled', coalesce((select (preferences->>'profile_incognito')::boolean from user_preferences where user_id = me), false),
        'used', (select count(distinct player_id) from profile_visits where visitor = me and hidden and day >= v_week),
        'limit', 15,
        'resets_at', ((v_week + 7)::timestamp at time zone 'America/Bogota')) end);
end $$;

create function public.profile_incognito_set(p_on boolean) returns void
  language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Tienes que iniciar sesión' using errcode = '42501'; end if;
  if p_on and not is_vip(me) then raise exception 'Navegar sin dejar rastro es exclusivo para VIP' using errcode = '42501'; end if;
  insert into user_preferences (user_id, preferences) values (me, jsonb_build_object('profile_incognito', p_on))
  on conflict (user_id) do update set preferences = user_preferences.preferences || jsonb_build_object('profile_incognito', p_on),
    updated_at = now();
end $$;

revoke all on function public.profile_visit(uuid), public.my_profile_visits(), public.profile_incognito_set(boolean),
  public.bogota_today(), public.bogota_week_start() from public, anon;
grant execute on function public.profile_visit(uuid), public.my_profile_visits(), public.profile_incognito_set(boolean)
  to authenticated;

notify pgrst, 'reload schema';

commit;
