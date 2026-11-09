-- 91: comentarios y "me gusta / no me gusta" en los perfiles (bitácora docs/bitacora/2026-11-09-comentarios-perfil,
-- Kyan 2026-11-09).
--
--   1. profile_votes: un voto por cuenta y perfil, +1 (me gusta) o -1 (no me gusta). Se cambia o se saca.
--   2. profile_comments: hasta 280 caracteres. Se borran sin perderse (deleted_at y quién): el autor, el dueño del
--      perfil y los moderadores o admins.
--   3. user_preferences.preferences->'profile_comments': el dueño cierra los comentarios de su perfil (por defecto,
--      abiertos). Cerrados, no se ven ni se pueden dejar; los votos siguen.
--   4. Para votar o comentar hace falta sesión y ficha de jugador. No se vota el perfil propio; sí se comenta.
--      Tope: 30 segundos entre comentarios y 30 por día (Bogotá) por cuenta. Las fichas sin cuenta no tienen muro.
--   5. profile_wall(p_player, p_before): los votos, el propio y los comentarios (20 por página), también sin sesión.
--   6. Notificaciones al dueño, en la categoría `friends` (Amigos; la misma preferencia):
--      profile_comment por cada comentario de otro, y profile_like la primera vez que cada cuenta le da me gusta
--      (sacarlo y volver a darlo no avisa de nuevo). El "no me gusta" no avisa.
-- Necesita la 90 (players.verified).
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/91_comentarios_y_votos_perfil.sql.
begin;

do $$
begin
  if to_regclass('public.profile_comments') is not null then raise exception 'replanteo 91: ya se aplicó (profile_comments existe)'; end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'replanteo 91: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.notification_category(text)', array[
  array[$q$    when p_type in ('event_new', 'season_started') then 'news'$q$,
        $q$    when p_type in ('profile_comment', 'profile_like') then 'friends' -- (replanteo 91)
    when p_type in ('event_new', 'season_started') then 'news'$q$]]);

create table public.profile_votes (
  player_id uuid not null references public.players(id) on delete cascade,
  voter uuid not null references auth.users(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  voted_at timestamptz not null default now(),
  primary key (player_id, voter)
);
comment on table public.profile_votes is 'Me gusta (+1) y no me gusta (-1) en los perfiles (replanteo 91): uno por cuenta y perfil';

create table public.profile_comments (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  author uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);
comment on table public.profile_comments is 'Comentarios en los perfiles (replanteo 91). Los borrados quedan con deleted_at';
create index profile_comments_wall on public.profile_comments (player_id, created_at desc) where deleted_at is null;
create index profile_comments_author on public.profile_comments (author, created_at desc);

alter table public.profile_votes enable row level security;
alter table public.profile_comments enable row level security;
revoke all on public.profile_votes, public.profile_comments from anon, authenticated;

/** Si el dueño del perfil deja los comentarios abiertos. */
create function public.profile_comments_open(p_player uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select (u.preferences->>'profile_comments')::boolean
                     from players p join user_preferences u on u.user_id = p.user_id where p.id = p_player), true)
$$;

create function public.profile_wall(p_player uuid, p_before timestamptz default null) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_owner uuid;
  v_mod boolean := me is not null and coalesce(is_admin() or is_moderator(), false);
  v_open boolean;
  v_signed boolean;
begin
  select user_id into v_owner from players where id = p_player;
  if not found then raise exception 'Ese jugador no existe' using errcode = 'P0002'; end if;
  v_open := v_owner is not null and profile_comments_open(p_player);
  v_signed := me is not null and exists (select 1 from players where user_id = me);
  return jsonb_build_object(
    'likes', (select count(*) from profile_votes where player_id = p_player and value = 1),
    'dislikes', (select count(*) from profile_votes where player_id = p_player and value = -1),
    'my_vote', (select value from profile_votes where player_id = p_player and voter = me),
    'can_vote', v_signed and v_owner is not null and v_owner <> me,
    'is_owner', me is not null and v_owner is not null and v_owner = me,
    'comments_open', v_open,
    'can_comment', v_open and v_signed,
    'total', case when v_open then (select count(*) from profile_comments where player_id = p_player and deleted_at is null) else 0 end,
    'items', case when v_open then (
      select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]') from (
        select c.created_at, jsonb_build_object(
                 'id', c.id, 'body', c.body, 'created_at', c.created_at,
                 'author', jsonb_build_object('player_id', a.id, 'nick', a.nick, 'photo_url', mm_player_photo(a.id),
                                              'level', elo_level(mm_player_elo(a.id)), 'verified', a.verified),
                 'mine', c.author = me,
                 'can_delete', me is not null and (c.author = me or v_owner = me or v_mod)) j
          from profile_comments c join players a on a.user_id = c.author
         where c.player_id = p_player and c.deleted_at is null and (p_before is null or c.created_at < p_before)
         order by c.created_at desc limit 20) x) else '[]'::jsonb end);
end $$;

create function public.profile_vote(p_player uuid, p_value smallint) returns void
  language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v_owner uuid;
begin
  if me is null then raise exception 'Tienes que iniciar sesión' using errcode = '42501'; end if;
  if not exists (select 1 from players where user_id = me) then raise exception 'Necesitas tu ficha de jugador para votar' using errcode = '42501'; end if;
  select user_id into v_owner from players where id = p_player;
  if not found then raise exception 'Ese jugador no existe' using errcode = 'P0002'; end if;
  if v_owner is null then raise exception 'Ese perfil no tiene cuenta' using errcode = 'P0001'; end if;
  if v_owner = me then raise exception 'No puedes votar tu propio perfil' using errcode = 'P0001'; end if;
  if p_value is null or p_value = 0 then
    delete from profile_votes where player_id = p_player and voter = me;
  elsif p_value in (-1, 1) then
    insert into profile_votes (player_id, voter, value) values (p_player, me, p_value)
    on conflict (player_id, voter) do update set value = excluded.value, voted_at = now();
    -- Una vez por cuenta y perfil: el ref queda aunque el dueño borre el aviso, y no se repite al sacarlo y volver.
    if p_value = 1 and not exists (select 1 from notifications where ref = 'profile_like:' || p_player || ':' || me) then
      perform notify(array[v_owner], 'profile_like',
        jsonb_build_object('player', player_ref((select id from players where user_id = me)), 'profile', player_ref(p_player)),
        'profile_like:' || p_player || ':' || me);
    end if;
  else
    raise exception 'El voto es 1, -1 o 0' using errcode = 'P0001';
  end if;
end $$;

create function public.profile_comment_add(p_player uuid, p_body text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v_owner uuid; v_body text := btrim(coalesce(p_body, '')); v_id uuid;
begin
  if me is null then raise exception 'Tienes que iniciar sesión' using errcode = '42501'; end if;
  if not exists (select 1 from players where user_id = me) then raise exception 'Necesitas tu ficha de jugador para comentar' using errcode = '42501'; end if;
  select user_id into v_owner from players where id = p_player;
  if not found then raise exception 'Ese jugador no existe' using errcode = 'P0002'; end if;
  if v_owner is null or not profile_comments_open(p_player) then raise exception 'Este perfil no acepta comentarios' using errcode = '42501'; end if;
  if char_length(v_body) = 0 then raise exception 'El comentario está vacío' using errcode = 'P0001'; end if;
  if char_length(v_body) > 280 then raise exception 'El comentario tiene más de 280 caracteres' using errcode = 'P0001'; end if;
  if exists (select 1 from profile_comments where author = me and created_at > now() - interval '30 seconds') then
    raise exception 'Espera unos segundos antes de comentar de nuevo' using errcode = 'P0001';
  end if;
  if (select count(*) from profile_comments where author = me
        and (created_at at time zone 'America/Bogota')::date = (now() at time zone 'America/Bogota')::date) >= 30 then
    raise exception 'Llegaste al tope de 30 comentarios por día' using errcode = 'P0001';
  end if;
  insert into profile_comments (player_id, author, body) values (p_player, me, v_body) returning id into v_id;
  -- Al dueño (notify no avisa al que comenta su propio perfil).
  perform notify(array[v_owner], 'profile_comment',
    jsonb_build_object('player', player_ref((select id from players where user_id = me)), 'profile', player_ref(p_player),
                       'comment', left(v_body, 100)),
    'profile_comment:' || v_id);
  return v_id;
end $$;

create function public.profile_comment_delete(p_id uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c profile_comments%rowtype; v_owner uuid;
begin
  if me is null then raise exception 'Tienes que iniciar sesión' using errcode = '42501'; end if;
  select * into c from profile_comments where id = p_id and deleted_at is null;
  if c.id is null then raise exception 'Ese comentario no existe' using errcode = 'P0002'; end if;
  select user_id into v_owner from players where id = c.player_id;
  if not (c.author = me or v_owner = me or coalesce(is_admin() or is_moderator(), false)) then
    raise exception 'No puedes borrar ese comentario' using errcode = '42501';
  end if;
  update profile_comments set deleted_at = now(), deleted_by = me where id = p_id;
end $$;

create function public.profile_comments_set(p_open boolean) returns void
  language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Tienes que iniciar sesión' using errcode = '42501'; end if;
  insert into user_preferences (user_id, preferences) values (me, jsonb_build_object('profile_comments', p_open))
  on conflict (user_id) do update set preferences = user_preferences.preferences || jsonb_build_object('profile_comments', p_open),
    updated_at = now();
end $$;

revoke all on function public.profile_comments_open(uuid), public.profile_wall(uuid, timestamptz),
  public.profile_vote(uuid, smallint), public.profile_comment_add(uuid, text), public.profile_comment_delete(uuid),
  public.profile_comments_set(boolean) from public, anon;
grant execute on function public.profile_wall(uuid, timestamptz) to anon, authenticated;
grant execute on function public.profile_vote(uuid, smallint), public.profile_comment_add(uuid, text),
  public.profile_comment_delete(uuid), public.profile_comments_set(boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
