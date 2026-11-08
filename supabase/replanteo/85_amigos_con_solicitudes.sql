-- 85: amigos con solicitudes (bitácora docs/bitacora/2026-11-07-amigos-con-solicitudes, Daniel 2026-11-07).
--
--   1. mm_friend_requests: la solicitud de amistad (pendiente, aceptada, rechazada, cancelada o vencida a los 30 días).
--   2. mm_friends guarda las dos filas de cada amistad (A→B y B→A): se es amigo solo después de aceptar.
--   3. mm_add_friend envía la solicitud (o acepta, si la otra persona ya le había enviado una); mm_friend_answer la
--      acepta o la rechaza (en silencio); mm_remove_friend elimina la amistad o cancela la enviada; mm_friendship da el
--      estado con un jugador (el botón del perfil). mm_block borra la amistad y cierra las solicitudes entre los dos.
--   4. Notificaciones friend_request (con Aceptar / Rechazar, llega siempre) y friend_accepted, categoría friends.
--   5. mm_my_profile: el estado de los amigos siempre visible y friend_requests (recibidas y enviadas).
--   6. Datos: los pares mutuos siguen como amigos; las marcas de un solo lado pasan a solicitudes pendientes, con la
--      notificación ya leída (Daniel). Las marcas hacia fichas sin cuenta se borran. Todas quedan en replanteo85_marcas.
-- Es del matchmaking: va en feat/frontend-fase-1 y en feat/mm-claim-en-sala.
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/85_amigos_con_solicitudes.sql.
begin;

do $$
begin
  if to_regclass('public.mm_friends') is null then raise exception 'replanteo 85: falta la 48 (mm_friends)'; end if;
  if to_regclass('public.mm_friend_requests') is not null then raise exception 'replanteo 85: ya se aplicó (mm_friend_requests existe)'; end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 85: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- 1. Solicitudes -----------------------------------------------------------------------------------------------------
create table public.mm_friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  constraint mm_friend_requests_not_self check (from_user <> to_user)
);
comment on table public.mm_friend_requests is 'Solicitudes de amistad (replanteo 85). Una sola pendiente por par; vencen a los 30 días';
create unique index mm_friend_requests_pending on public.mm_friend_requests (from_user, to_user) where status = 'pending';
create index mm_friend_requests_to on public.mm_friend_requests (to_user) where status = 'pending';
alter table public.mm_friend_requests enable row level security;
revoke all on public.mm_friend_requests from anon, authenticated;

-- Marcas de antes de la 85, para la inversa.
create table public.replanteo85_marcas (user_id uuid not null, player_id uuid not null, created_at timestamptz not null,
  primary key (user_id, player_id));
comment on table public.replanteo85_marcas is 'mm_friends antes del replanteo 85 (la inversa las restaura)';
alter table public.replanteo85_marcas enable row level security;
revoke all on public.replanteo85_marcas from anon, authenticated;
insert into replanteo85_marcas select user_id, player_id, created_at from mm_friends;

-- 2. Notificaciones --------------------------------------------------------------------------------------------------
alter table public.notifications drop constraint notifications_category_check;
alter table public.notifications add constraint notifications_category_check
  check (category = any (array['team', 'tournament', 'pcw', 'elo', 'season', 'account', 'news', 'admin', 'mm', 'friends']));

select pg_temp.reemplazar('public.notification_category(text)', array[
  array[$q$    when p_type in ('event_new', 'season_started') then 'news'$q$,
        $q$    when p_type in ('friend_request', 'friend_accepted') then 'friends' -- (replanteo 85)
    when p_type in ('event_new', 'season_started') then 'news'$q$]]);
select pg_temp.reemplazar('public.notification_required(text)', array[
  array[$q$'team_invite', 'team_join_request', 'password_changed'$q$,
        $q$'team_invite', 'team_join_request', 'friend_request', 'password_changed'$q$]]);
select pg_temp.reemplazar('public.notify(uuid[], text, jsonb, text, boolean)', array[
  array[$q$p_type in ('team_invite', 'team_join_request'), auth.uid()$q$,
        $q$p_type in ('team_invite', 'team_join_request', 'friend_request'), auth.uid()$q$]]);

-- 3. Funciones -------------------------------------------------------------------------------------------------------
-- Cierra una solicitud pendiente y la notificación que la acompaña.
create function public.mm_friend_close(p_request uuid, p_status text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  update mm_friend_requests set status = p_status, answered_at = now() where id = p_request and status = 'pending';
  if found then perform notifications_resolve('friend_request:' || p_request, p_status); end if;
end $$;

-- Las pendientes de más de 30 días vencen. Se llama al empezar cada acción de amigos.
create function public.mm_friend_expire() returns void
  language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from mm_friend_requests where status = 'pending' and created_at <= now() - interval '30 days' loop
    perform mm_friend_close(r.id, 'expired');
  end loop;
end $$;

-- Acepta: la amistad (las dos filas), el aviso al que la envió y el socket a los dos.
create function public.mm_friend_accept(p_request uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare v mm_friend_requests%rowtype; v_from_player uuid; v_to_player uuid;
begin
  select * into v from mm_friend_requests where id = p_request and status = 'pending';
  if not found then return; end if;
  v_from_player := (select id from players where user_id = v.from_user);
  v_to_player := (select id from players where user_id = v.to_user);
  perform mm_friend_close(p_request, 'accepted');
  insert into mm_friends (user_id, player_id) values (v.from_user, v_to_player), (v.to_user, v_from_player) on conflict do nothing;
  perform notify(array[v.from_user], 'friend_accepted', jsonb_build_object('player', player_ref(v_to_player)), null, true);
  perform mm_emit('friend.changed', null, array[v.from_user, v.to_user], jsonb_build_object('player_id', v_to_player));
end $$;

create or replace function public.mm_add_friend(p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v_to uuid; v_mine uuid; v_req uuid;
begin
  if me is null then raise exception 'Tienes que iniciar sesión' using errcode = '42501'; end if;
  perform mm_friend_expire();
  select user_id into v_to from players where id = p_player;
  if not found then raise exception 'Ese jugador no existe' using errcode = 'P0002'; end if;
  if v_to = me then raise exception 'No puedes sumarte a ti mismo'; end if;
  if v_to is null then raise exception 'Ese jugador todavía no tiene cuenta en la web'; end if;
  v_mine := (select id from players where user_id = me);
  if v_mine is null then raise exception 'Necesitas tu ficha de jugador para sumar amigos'; end if;
  if exists (select 1 from mm_friends where user_id = me and player_id = p_player) then return; end if;
  if exists (select 1 from mm_blocks where (user_id = me and player_id = p_player) or (user_id = v_to and player_id = v_mine)) then
    raise exception 'No puedes enviarle una solicitud a ese jugador';
  end if;
  -- Ya te había enviado una: quedan amigos.
  select id into v_req from mm_friend_requests where from_user = v_to and to_user = me and status = 'pending';
  if found then perform mm_friend_accept(v_req); return; end if;
  if exists (select 1 from mm_friend_requests where from_user = me and to_user = v_to and status = 'pending') then return; end if;
  -- Rechazada hace menos de 7 días: no se dice que fue un rechazo (es en silencio).
  if exists (select 1 from mm_friend_requests where from_user = me and to_user = v_to and status = 'rejected'
               and answered_at > now() - interval '7 days') then
    raise exception 'Ya le enviaste una solicitud hace poco. Podrás volver a enviarla en unos días';
  end if;
  if (select count(*) from mm_friend_requests where from_user = me and status = 'pending') >= 20 then
    raise exception 'Tienes 20 solicitudes sin responder. Espera a que te respondan o cancela alguna';
  end if;
  insert into mm_friend_requests (from_user, to_user) values (me, v_to) returning id into v_req;
  perform notify(array[v_to], 'friend_request', jsonb_build_object('player', player_ref(v_mine)), 'friend_request:' || v_req);
  perform mm_emit('friend.changed', null, array[me, v_to], jsonb_build_object('player_id', p_player));
end $$;

create function public.mm_friend_answer(p_player uuid, p_accept boolean) returns void
  language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v_from uuid; v_req uuid;
begin
  if me is null then raise exception 'Tienes que iniciar sesión' using errcode = '42501'; end if;
  perform mm_friend_expire();
  v_from := (select user_id from players where id = p_player);
  select id into v_req from mm_friend_requests where from_user = v_from and to_user = me and status = 'pending';
  if not found then raise exception 'Esa solicitud ya no está pendiente' using errcode = 'P0002'; end if;
  if p_accept then
    perform mm_friend_accept(v_req);
  else
    perform mm_friend_close(v_req, 'rejected');
    perform mm_emit('friend.changed', null, array[me, v_from], jsonb_build_object('player_id', p_player));
  end if;
end $$;

create or replace function public.mm_remove_friend(p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v_to uuid; v_mine uuid; v_changed boolean := false; r record;
begin
  if me is null then raise exception 'Tienes que iniciar sesión' using errcode = '42501'; end if;
  v_to := (select user_id from players where id = p_player);
  v_mine := (select id from players where user_id = me);
  delete from mm_friends where (user_id = me and player_id = p_player) or (user_id = v_to and player_id = v_mine);
  v_changed := found;
  for r in select id from mm_friend_requests where from_user = me and to_user = v_to and status = 'pending' loop
    perform mm_friend_close(r.id, 'cancelled');
    v_changed := true;
  end loop;
  if v_changed then perform mm_emit('friend.changed', null, array_remove(array[me, v_to], null), jsonb_build_object('player_id', p_player)); end if;
end $$;

-- El estado con un jugador, para el botón del perfil: self, unavailable, friends, received, sent o none.
create function public.mm_friendship(p_player uuid) returns text
  language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); v_to uuid; v_mine uuid;
begin
  if me is null then raise exception 'Tienes que iniciar sesión' using errcode = '42501'; end if;
  select user_id into v_to from players where id = p_player;
  if not found then raise exception 'Ese jugador no existe' using errcode = 'P0002'; end if;
  if v_to = me then return 'self'; end if;
  v_mine := (select id from players where user_id = me);
  if exists (select 1 from mm_friends where user_id = me and player_id = p_player) then return 'friends'; end if;
  if v_to is null or v_mine is null
     or exists (select 1 from mm_blocks where (user_id = me and player_id = p_player) or (user_id = v_to and player_id = v_mine)) then
    return 'unavailable';
  end if;
  if exists (select 1 from mm_friend_requests where from_user = v_to and to_user = me and status = 'pending'
               and created_at > now() - interval '30 days') then return 'received'; end if;
  if exists (select 1 from mm_friend_requests where from_user = me and to_user = v_to and status = 'pending'
               and created_at > now() - interval '30 days') then return 'sent'; end if;
  return 'none';
end $$;

-- Bloquear corta la amistad y las solicitudes entre los dos.
select pg_temp.reemplazar('public.mm_block(uuid)', array[
  array[$q$  insert into mm_blocks (user_id, player_id) values (auth.uid(), p_player) on conflict do nothing;
$q$, $q$  insert into mm_blocks (user_id, player_id) values (auth.uid(), p_player) on conflict do nothing;
  -- (replanteo 85) Ya no son amigos ni quedan solicitudes entre los dos.
  perform mm_friend_cut(p_player);
$q$]]);

create function public.mm_friend_cut(p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v_to uuid := (select user_id from players where id = p_player); v_mine uuid; r record;
begin
  v_mine := (select id from players where user_id = me);
  delete from mm_friends where (user_id = me and player_id = p_player) or (user_id = v_to and player_id = v_mine);
  for r in select id from mm_friend_requests where status = 'pending'
             and ((from_user = me and to_user = v_to) or (from_user = v_to and to_user = me)) loop
    perform mm_friend_close(r.id, 'cancelled');
  end loop;
  perform mm_emit('friend.changed', null, array_remove(array[me, v_to], null), jsonb_build_object('player_id', p_player));
end $$;

-- 4. Lo que ve el jugador en Jugar -----------------------------------------------------------------------------------
select pg_temp.reemplazar('public.mm_my_profile()', array[
  array[$q$          -- El estado solo se ve si los dos se marcaron.
          'status', case when not exists (select 1 from mm_friends o where o.user_id = p.user_id and o.player_id = v_player.id) then null
                         when exists$q$,
        $q$          -- (replanteo 85) Son amigos los dos: el estado se ve siempre.
          'status', case when exists$q$],
  array[$q$        from mm_friends f join players p on p.id = f.player_id where f.user_id = me),$q$,
        $q$        from mm_friends f join players p on p.id = f.player_id where f.user_id = me),
    -- (replanteo 85) Solicitudes pendientes (las de más de 30 días vencieron).
    'friend_requests', jsonb_build_object(
        'received', (select coalesce(jsonb_agg(jsonb_build_object('player_id', p.id, 'nick', p.nick, 'level', elo_level(mm_player_elo(p.id)),
                       'created_at', r.created_at) order by r.created_at desc), '[]')
                       from mm_friend_requests r join players p on p.user_id = r.from_user
                      where r.to_user = me and r.status = 'pending' and r.created_at > now() - interval '30 days'),
        'sent', (select coalesce(jsonb_agg(jsonb_build_object('player_id', p.id, 'nick', p.nick, 'level', elo_level(mm_player_elo(p.id)),
                   'created_at', r.created_at) order by r.created_at desc), '[]')
                   from mm_friend_requests r join players p on p.user_id = r.to_user
                  where r.from_user = me and r.status = 'pending' and r.created_at > now() - interval '30 days')),$q$]]);

revoke all on function public.mm_friend_close(uuid, text), public.mm_friend_expire(), public.mm_friend_accept(uuid),
  public.mm_friend_cut(uuid) from public, anon, authenticated;
revoke all on function public.mm_friend_answer(uuid, boolean), public.mm_friendship(uuid) from public, anon;
grant execute on function public.mm_friend_answer(uuid, boolean), public.mm_friendship(uuid) to authenticated;

-- 5. Datos de antes --------------------------------------------------------------------------------------------------
-- Marcas de un solo lado: pasan a solicitudes pendientes (con su notificación ya leída) si las dos personas tienen
-- cuenta y ficha y no hay un bloqueo; las demás se borran.
with una as (
  select f.user_id as from_user, p.user_id as to_user, f.player_id
    from mm_friends f join players p on p.id = f.player_id
   where not exists (select 1 from mm_friends o join players yo on yo.user_id = f.user_id
                      where o.user_id = p.user_id and o.player_id = yo.id)
), nuevas as (
  insert into mm_friend_requests (from_user, to_user)
  select u.from_user, u.to_user from una u
   where u.to_user is not null and u.to_user <> u.from_user
     and exists (select 1 from players where user_id = u.from_user)
     and not exists (select 1 from mm_blocks b join players yo on yo.user_id = u.from_user
                      where (b.user_id = u.from_user and b.player_id = u.player_id) or (b.user_id = u.to_user and b.player_id = yo.id))
  returning id, from_user, to_user
)
insert into notifications (user_id, type, category, data, ref, actionable, actor_id, read_at)
select n.to_user, 'friend_request', 'friends',
       jsonb_build_object('player', player_ref((select id from players where user_id = n.from_user))),
       'friend_request:' || n.id, true, n.from_user, now()
  from nuevas n where exists (select 1 from profiles where id = n.to_user);

delete from mm_friends f
 where not exists (select 1 from mm_friends o join players p on p.id = f.player_id join players yo on yo.user_id = f.user_id
                    where o.user_id = p.user_id and o.player_id = yo.id);

notify pgrst, 'reload schema';

commit;
