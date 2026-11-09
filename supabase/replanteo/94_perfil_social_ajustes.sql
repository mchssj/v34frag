-- 94: ajustes de los comentarios del perfil y la insignia en las listas (bitácora docs/bitacora/2026-11-09-perfil-social-ajustes,
-- Daniel 2026-11-09, sobre la lista de Kyan).
--
--   1. comment_blocked_word(texto): las palabras de Administración › Palabras bloqueadas, palabra por palabra (no en el
--      texto entero sin espacios, como los nicks: en un comentario eso da falsos positivos).
--   2. profile_social_blocked(cuenta, perfil): 'banned' (baneo activo por su ficha o por cualquiera de sus SteamID) o
--      'blocked' (el dueño del perfil lo bloqueó en el matchmaking). Con eso no comenta ni vota.
--   3. profile_comment_add y profile_vote: lo de arriba (42501) y el filtro de palabras (P0001).
--   4. profile_wall: can_vote y can_comment lo tienen en cuenta, restriction dice por qué ('banned', 'blocked' o null) y
--      cada comentario suma can_report.
--   5. Denunciar un comentario: profile_comment_reports, profile_comment_report, profile_comment_reports_admin (moderadores
--      y admins; paginada, filtrada y ordenada) y profile_comment_report_resolve (descartar o borrar el comentario).
--   6. verified en mm_player_card (la sala y el grupo) y en los amigos de mm_my_profile.
-- Necesita la 91. Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/94_perfil_social_ajustes.sql.
begin;

do $$
begin
  if to_regclass('public.profile_comments') is null then raise exception 'replanteo 94: falta la 91 (profile_comments)'; end if;
  if to_regclass('public.profile_comment_reports') is not null then raise exception 'replanteo 94: ya se aplicó (profile_comment_reports existe)'; end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'replanteo 94: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

-- Las funciones que cambian, como estaban: la inversa las vuelve a crear desde acá.
create table public.replanteo94_funciones as
select p.oid::regprocedure::text as fn, pg_get_functiondef(p.oid) as def
  from pg_proc p
 where p.oid in ('public.profile_vote(uuid, smallint)'::regprocedure, 'public.profile_comment_add(uuid, text)'::regprocedure,
                 'public.profile_wall(uuid, timestamp with time zone)'::regprocedure,
                 'public.mm_player_card(uuid, uuid, mm_lobby_players)'::regprocedure, 'public.mm_my_profile()'::regprocedure);
comment on table public.replanteo94_funciones is 'Respaldo del replanteo 94 para su inversa; se puede borrar cuando ya no se vaya a volver atrás';
alter table public.replanteo94_funciones enable row level security;
revoke all on public.replanteo94_funciones from anon, authenticated;

-- ---------- 1. Palabras bloqueadas en un comentario ----------

/**
 * La primera palabra bloqueada del texto, o null. Cada palabra se normaliza como los nicks (name_norm: minúsculas, sin
 * tildes ni números ni signos) y cuenta si es la bloqueada o empieza con ella con hasta 2 letras más (plurales).
 */
create function public.comment_blocked_word(p text) returns text
  language sql stable security definer set search_path = public as $$
  select b.word
    from regexp_split_to_table(coalesce(p, ''), '\s+') t(w)
    join blocked_words b on name_norm(t.w) like b.word || '%' and char_length(name_norm(t.w)) <= char_length(b.word) + 2
   order by char_length(b.word) desc, b.word
   limit 1 $$;

-- ---------- 2. Quién no comenta ni vota ----------

/** 'banned', 'blocked' o null: por qué esa cuenta no puede comentar ni votar en ese perfil. */
create function public.profile_social_blocked(p_user uuid, p_player uuid) returns text
  language sql stable security definer set search_path = public as $$
  select case
    when p_user is null then null
    when exists (select 1 from bans b join players p on p.id = b.player_id
                  where p.user_id = p_user and b.lifted_at is null and (b.expires_at is null or b.expires_at > now()))
      or exists (select 1 from players p join player_steam_all s on s.player_id = p.id
                  cross join lateral ban_active_for(s.steam_id) x
                  where p.user_id = p_user) then 'banned'
    when exists (select 1 from mm_blocks k join players o on o.id = p_player join players me on me.user_id = p_user
                  where k.user_id = o.user_id and k.player_id = me.id) then 'blocked'
  end $$;

/** Corta con un 42501 si la cuenta no puede comentar ni votar en ese perfil. */
create function public.profile_social_check(p_user uuid, p_player uuid) returns void
  language plpgsql stable security definer set search_path = public as $$
begin
  case profile_social_blocked(p_user, p_player)
    when 'banned' then raise exception 'Con un baneo activo no puedes comentar ni votar perfiles' using errcode = '42501';
    when 'blocked' then raise exception 'El dueño de este perfil te bloqueó: no puedes comentar ni votar acá' using errcode = '42501';
    else null;
  end case;
end $$;

-- ---------- 3. Comentar y votar ----------

select pg_temp.reemplazar('public.profile_vote(uuid, smallint)', array[
  array[$a$  if v_owner = me then raise exception 'No puedes votar tu propio perfil' using errcode = 'P0001'; end if;$a$,
        $b$  if v_owner = me then raise exception 'No puedes votar tu propio perfil' using errcode = 'P0001'; end if;
  perform profile_social_check(me, p_player); -- (replanteo 94) baneados y bloqueados$b$]]);

select pg_temp.reemplazar('public.profile_comment_add(uuid, text)', array[
  array[$a$  if v_owner is null or not profile_comments_open(p_player) then raise exception 'Este perfil no acepta comentarios' using errcode = '42501'; end if;$a$,
        $b$  if v_owner is null or not profile_comments_open(p_player) then raise exception 'Este perfil no acepta comentarios' using errcode = '42501'; end if;
  perform profile_social_check(me, p_player); -- (replanteo 94) baneados y bloqueados$b$],
  array[$a$  if char_length(v_body) > 280 then raise exception 'El comentario tiene más de 280 caracteres' using errcode = 'P0001'; end if;$a$,
        $b$  if char_length(v_body) > 280 then raise exception 'El comentario tiene más de 280 caracteres' using errcode = 'P0001'; end if;
  -- (replanteo 94) las palabras de Administración › Palabras bloqueadas
  if comment_blocked_word(v_body) is not null then
    raise exception 'El comentario tiene una palabra que no está permitida (%)', comment_blocked_word(v_body) using errcode = 'P0001';
  end if;$b$]]);

select pg_temp.reemplazar('public.profile_wall(uuid, timestamp with time zone)', array[
  array[$a$    'can_vote', v_signed and v_owner is not null and v_owner <> me,$a$,
        $b$    'can_vote', v_signed and v_owner is not null and v_owner <> me and profile_social_blocked(me, p_player) is null,$b$],
  array[$a$    'can_comment', v_open and v_signed,$a$,
        $b$    'can_comment', v_open and v_signed and profile_social_blocked(me, p_player) is null,
    'restriction', profile_social_blocked(me, p_player),$b$],
  array[$a$                 'mine', c.author = me,$a$,
        $b$                 'mine', c.author = me,
                 'can_report', me is not null and c.author <> me,$b$]]);

-- ---------- 4. Denunciar un comentario ----------

create table public.profile_comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.profile_comments(id) on delete cascade,
  reporter uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('toxic', 'spam', 'harassment', 'other')),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'dismissed', 'removed')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  unique (comment_id, reporter)
);
comment on table public.profile_comment_reports is 'Denuncias de comentarios del perfil (replanteo 94): las revisan moderadores y admins';
create index profile_comment_reports_status on public.profile_comment_reports (status, created_at desc);
create index profile_comment_reports_reporter on public.profile_comment_reports (reporter, created_at desc);
alter table public.profile_comment_reports enable row level security;
revoke all on public.profile_comment_reports from anon, authenticated;

/** Denuncia un comentario ajeno: una vez por cuenta y comentario, 20 por día (Bogotá). */
create function public.profile_comment_report(p_comment uuid, p_reason text, p_note text default null) returns uuid
  language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c profile_comments%rowtype; v_note text := nullif(btrim(coalesce(p_note, '')), ''); v_id uuid;
begin
  if me is null then raise exception 'Tienes que iniciar sesión' using errcode = '42501'; end if;
  select * into c from profile_comments where id = p_comment and deleted_at is null;
  if c.id is null then raise exception 'Ese comentario no existe' using errcode = 'P0002'; end if;
  if c.author = me then raise exception 'No puedes denunciar tu propio comentario' using errcode = 'P0001'; end if;
  if p_reason is null or p_reason not in ('toxic', 'spam', 'harassment', 'other') then
    raise exception 'El motivo es toxic, spam, harassment u other' using errcode = 'P0001';
  end if;
  if char_length(v_note) > 300 then raise exception 'La nota tiene más de 300 caracteres' using errcode = 'P0001'; end if;
  if exists (select 1 from profile_comment_reports where comment_id = p_comment and reporter = me) then
    raise exception 'Ya denunciaste ese comentario' using errcode = 'P0001';
  end if;
  if (select count(*) from profile_comment_reports where reporter = me
        and (created_at at time zone 'America/Bogota')::date = (now() at time zone 'America/Bogota')::date) >= 20 then
    raise exception 'Llegaste al tope de 20 denuncias por día' using errcode = 'P0001';
  end if;
  insert into profile_comment_reports (comment_id, reporter, reason, note) values (p_comment, me, p_reason, v_note) returning id into v_id;
  return v_id;
end $$;

/**
 * Las denuncias, para moderadores y admins. p_status: 'open' (por revisar), 'resolved' (descartadas o borradas) o null
 * (todas). p_reason: un motivo o null. p_order: 'asc' (las más viejas primero) o 'desc'. Paginada con p_limit y p_offset.
 */
create function public.profile_comment_reports_admin(p_status text default 'open', p_reason text default null,
                                                     p_order text default 'desc', p_limit integer default 20, p_offset integer default 0)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(is_moderator(), false) then raise exception 'Solo moderadores y admins' using errcode = '42501'; end if;
  if p_status is not null and p_status not in ('open', 'resolved') then raise exception 'El estado es open o resolved' using errcode = 'P0001'; end if;
  if p_order not in ('asc', 'desc') then raise exception 'El orden es asc o desc' using errcode = 'P0001'; end if;
  return (
    with f as (
      select r.* from profile_comment_reports r
       where (p_status is null or (p_status = 'open' and r.status = 'open') or (p_status = 'resolved' and r.status <> 'open'))
         and (p_reason is null or r.reason = p_reason)),
    pg as (
      select row_number() over (order by case when p_order = 'asc' then r.created_at end asc,
                                         case when p_order = 'desc' then r.created_at end desc, r.id) as n,
             jsonb_build_object(
               'id', r.id, 'reason', r.reason, 'note', r.note, 'created_at', r.created_at, 'status', r.status,
               'resolved_at', r.resolved_at, 'resolved_by', (select player_ref(p.id) from players p where p.user_id = r.resolved_by),
               'reporter', (select player_ref(p.id) from players p where p.user_id = r.reporter),
               'reports', (select count(*) from profile_comment_reports o where o.comment_id = r.comment_id),
               'comment', jsonb_build_object('id', c.id, 'body', c.body, 'created_at', c.created_at, 'deleted_at', c.deleted_at,
                                             'author', (select player_ref(p.id) from players p where p.user_id = c.author)),
               'profile', player_ref(c.player_id)) as j
        from f r join profile_comments c on c.id = r.comment_id
       order by n
       limit least(greatest(coalesce(p_limit, 20), 1), 100) offset greatest(coalesce(p_offset, 0), 0))
    select jsonb_build_object('total', (select count(*) from f),
                              'items', coalesce((select jsonb_agg(j order by n) from pg), '[]'::jsonb)));
end $$;

/** Moderador o admin: 'dismiss' descarta o 'delete' borra el comentario. Cierra todas las denuncias abiertas de ese comentario. */
create function public.profile_comment_report_resolve(p_report uuid, p_action text) returns void
  language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r profile_comment_reports%rowtype;
begin
  if not coalesce(is_moderator(), false) then raise exception 'Solo moderadores y admins' using errcode = '42501'; end if;
  if p_action is null or p_action not in ('dismiss', 'delete') then raise exception 'La acción es dismiss o delete' using errcode = 'P0001'; end if;
  select * into r from profile_comment_reports where id = p_report for update;
  if r.id is null then raise exception 'Esa denuncia no existe' using errcode = 'P0002'; end if;
  if r.status <> 'open' then raise exception 'Esa denuncia ya se resolvió' using errcode = 'P0001'; end if;
  if p_action = 'delete' then
    update profile_comments set deleted_at = now(), deleted_by = me where id = r.comment_id and deleted_at is null;
  end if;
  update profile_comment_reports set status = case when p_action = 'delete' then 'removed' else 'dismissed' end,
         resolved_by = me, resolved_at = now()
   where comment_id = r.comment_id and status = 'open';
end $$;

-- ---------- 5. La insignia en la ficha del matchmaking ----------

select pg_temp.reemplazar('public.mm_player_card(uuid, uuid, mm_lobby_players)', array[
  array[$a$    'vip', coalesce(is_vip(p.user_id), false),$a$,
        $b$    'vip', coalesce(is_vip(p.user_id), false), 'verified', p.verified, -- (replanteo 94)$b$]]);

-- Y en la lista de amigos de Jugar, que no usa mm_player_card.
select pg_temp.reemplazar('public.mm_my_profile()', array[
  array[$a$'nick', p.nick, 'level', elo_level(mm_player_elo(p.id)),
          -- (replanteo 85) Son amigos los dos: el estado se ve siempre.$a$,
        $b$'nick', p.nick, 'level', elo_level(mm_player_elo(p.id)), 'verified', p.verified, -- (replanteo 94)
          -- (replanteo 85) Son amigos los dos: el estado se ve siempre.$b$]]);

-- ---------- Permisos ----------

revoke all on function public.comment_blocked_word(text), public.profile_social_blocked(uuid, uuid), public.profile_social_check(uuid, uuid),
  public.profile_comment_report(uuid, text, text), public.profile_comment_reports_admin(text, text, text, integer, integer),
  public.profile_comment_report_resolve(uuid, text) from public, anon, authenticated;
grant execute on function public.profile_comment_report(uuid, text, text), public.profile_comment_reports_admin(text, text, text, integer, integer),
  public.profile_comment_report_resolve(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;
