-- Inversa del replanteo 85 (amigos con solicitudes). Vuelve a las marcas de un solo lado:
--   - las marcas de antes de la 85 (replanteo85_marcas) y cada solicitud pendiente pasan a ser marcas; las amistades
--     aceptadas después de la 85 quedan como dos marcas (mutuas, como antes);
--   - se borran las notificaciones friend_request y friend_accepted, la tabla de solicitudes y las funciones nuevas;
--   - mm_add_friend, mm_remove_friend, mm_block, mm_my_profile y las funciones de notificaciones vuelven a como estaban.
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 85: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

insert into mm_friends (user_id, player_id, created_at) select user_id, player_id, created_at from replanteo85_marcas
  where exists (select 1 from players where id = player_id) and exists (select 1 from auth.users where id = user_id)
  on conflict do nothing;
insert into mm_friends (user_id, player_id, created_at)
  select r.from_user, p.id, r.created_at from mm_friend_requests r join players p on p.user_id = r.to_user where r.status = 'pending'
  on conflict do nothing;

delete from notifications where type in ('friend_request', 'friend_accepted');

select pg_temp.reemplazar('public.mm_my_profile()', array[
  array[$q$          -- (replanteo 85) Son amigos los dos: el estado se ve siempre.
          'status', case when exists$q$,
        $q$          -- El estado solo se ve si los dos se marcaron.
          'status', case when not exists (select 1 from mm_friends o where o.user_id = p.user_id and o.player_id = v_player.id) then null
                         when exists$q$],
  array[$q$
    -- (replanteo 85) Solicitudes pendientes (las de más de 30 días vencieron).
    'friend_requests', jsonb_build_object(
        'received', (select coalesce(jsonb_agg(jsonb_build_object('player_id', p.id, 'nick', p.nick, 'level', elo_level(mm_player_elo(p.id)),
                       'created_at', r.created_at) order by r.created_at desc), '[]')
                       from mm_friend_requests r join players p on p.user_id = r.from_user
                      where r.to_user = me and r.status = 'pending' and r.created_at > now() - interval '30 days'),
        'sent', (select coalesce(jsonb_agg(jsonb_build_object('player_id', p.id, 'nick', p.nick, 'level', elo_level(mm_player_elo(p.id)),
                   'created_at', r.created_at) order by r.created_at desc), '[]')
                   from mm_friend_requests r join players p on p.user_id = r.to_user
                  where r.from_user = me and r.status = 'pending' and r.created_at > now() - interval '30 days')),$q$, '']]);

select pg_temp.reemplazar('public.mm_block(uuid)', array[
  array[$q$  -- (replanteo 85) Ya no son amigos ni quedan solicitudes entre los dos.
  perform mm_friend_cut(p_player);
$q$, '']]);

create or replace function public.mm_add_friend(p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if (select user_id from players where id = p_player) = auth.uid() then raise exception 'No te podés sumar a vos mismo'; end if;
  insert into mm_friends (user_id, player_id) values (auth.uid(), p_player) on conflict do nothing;
  -- (replanteo 71) la otra persona ve el cambio sin recargar
  if found then perform mm_emit('friend.changed', null, mm_friend_users(p_player), jsonb_build_object('player_id', p_player)); end if;
end $$;

create or replace function public.mm_remove_friend(p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  delete from mm_friends where user_id = auth.uid() and player_id = p_player;
  if found then perform mm_emit('friend.changed', null, mm_friend_users(p_player), jsonb_build_object('player_id', p_player)); end if;
end $$;

drop function public.mm_friend_answer(uuid, boolean);
drop function public.mm_friendship(uuid);
drop function public.mm_friend_cut(uuid);
drop function public.mm_friend_accept(uuid);
drop function public.mm_friend_expire();
drop function public.mm_friend_close(uuid, text);

select pg_temp.reemplazar('public.notify(uuid[], text, jsonb, text, boolean)', array[
  array[$q$p_type in ('team_invite', 'team_join_request', 'friend_request'), auth.uid()$q$,
        $q$p_type in ('team_invite', 'team_join_request'), auth.uid()$q$]]);
select pg_temp.reemplazar('public.notification_required(text)', array[
  array[$q$'team_invite', 'team_join_request', 'friend_request', 'password_changed'$q$,
        $q$'team_invite', 'team_join_request', 'password_changed'$q$]]);
select pg_temp.reemplazar('public.notification_category(text)', array[
  array[$q$    when p_type in ('friend_request', 'friend_accepted') then 'friends' -- (replanteo 85)
$q$, '']]);

alter table public.notifications drop constraint notifications_category_check;
alter table public.notifications add constraint notifications_category_check
  check (category = any (array['team', 'tournament', 'pcw', 'elo', 'season', 'account', 'news', 'admin', 'mm']));

drop table public.mm_friend_requests;
drop table public.replanteo85_marcas;

notify pgrst, 'reload schema';

commit;
