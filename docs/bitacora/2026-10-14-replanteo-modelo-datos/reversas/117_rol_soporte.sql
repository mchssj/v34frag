-- Inversa de la 117 (rol Soporte). Vuelve a la 116.
-- Las cuentas con el rol 'support' quedan como 'user', y en team_audit sus acciones quedan como 'moderator'.
-- Se pierden support_actions, bans.created_by_role, match_clips.video_reprocessed_by y las notificaciones avatar_removed.
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'inversa 117: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

-- Las funciones como en la 116.

select pg_temp.reemplazar('public.clip_review_ok(uuid)', array[
  [$a$if auth.uid() is not null and not is_support() then -- (replanteo 117: también soporte y moderadores)
    raise exception 'Solo soporte, moderadores y admins pueden aprobar un clip' using errcode = '42501';$a$,
   $b$if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede aprobar un clip' using errcode = '42501';$b$],
  [$a$
  perform support_log('clip_approve', jsonb_build_object('clip_id', c.id, 'match_id', c.match_id, 'nick', c.player_name)); -- (replanteo 117)$a$,
   $b$$b$]]);

select pg_temp.reemplazar('public.clip_reject(uuid, text)', array[
  [$a$if auth.uid() is not null and not is_support() then -- (replanteo 117: también soporte y moderadores)
    raise exception 'Solo soporte, moderadores y admins pueden rechazar un clip' using errcode = '42501';$a$,
   $b$if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede rechazar un clip' using errcode = '42501';$b$],
  [$a$
  perform support_log('clip_reject', jsonb_build_object('clip_id', c.id, 'match_id', c.match_id, 'nick', c.player_name), p_reason); -- (replanteo 117)$a$,
   $b$$b$]]);

CREATE OR REPLACE FUNCTION public.set_user_role(p_user uuid, p_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_admin() then raise exception 'Solo un administrador puede cambiar roles' using errcode = '42501'; end if;
  if p_role not in ('user', 'organizer', 'moderator') then raise exception 'El rol tiene que ser user, organizer o moderator'; end if; -- (replanteo 31)
  if (select role from profiles where id = p_user) = 'admin' then raise exception 'El rol de un admin se cambia en la base'; end if;
  update profiles set role = p_role where id = p_user;
  if not found then raise exception 'No existe ese usuario'; end if;
end $function$;

CREATE OR REPLACE FUNCTION public.ban_create(p_player uuid, p_steam text, p_reason text, p_expires timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_moderator() then raise exception 'Solo moderadores y admins pueden banear' using errcode = '42501'; end if;
  if (p_player is null) = (p_steam is null) then raise exception 'Elegí una ficha o un SteamID, uno de los dos'; end if;
  if p_expires is null and not is_admin() then
    raise exception 'Solo un admin puede banear de forma permanente' using errcode = '42501';
  end if;
  if p_expires is not null and p_expires <= now() then raise exception 'El vencimiento tiene que ser futuro'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 200 then raise exception 'El motivo es obligatorio (hasta 200 caracteres)'; end if;
  return ban_insert(p_player, p_steam, null, p_reason, p_expires, 'web', auth.uid(), null, null, null);
end $function$;

CREATE OR REPLACE FUNCTION public.ban_update(p_id uuid, p_reason text, p_expires timestamp with time zone, p_permanent boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare b bans;
begin
  if not is_moderator() then raise exception 'Solo moderadores y admins pueden cambiar baneos' using errcode = '42501'; end if;
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
  update bans set reason = coalesce(btrim(p_reason), reason),
                  expires_at = case when p_permanent then null else coalesce(p_expires, expires_at) end,
                  updated_by = auth.uid()
   where id = p_id;
end $function$;

CREATE OR REPLACE FUNCTION public.ban_lift(p_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare b bans;
begin
  if not is_moderator() then raise exception 'Solo moderadores y admins pueden levantar baneos' using errcode = '42501'; end if;
  select * into b from bans where id = p_id for update;
  if b.id is null then raise exception 'No existe ese baneo'; end if;
  if b.lifted_at is not null or b.expires_at <= now() then raise exception 'Ese baneo ya no está activo'; end if;
  if b.expires_at is null and not is_admin() then
    raise exception 'Solo un admin puede levantar un baneo permanente' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 200 then raise exception 'El motivo es obligatorio (hasta 200 caracteres)'; end if;
  update bans set lifted_at = now(), lifted_by = auth.uid(), lift_reason = btrim(p_reason) where id = p_id;
end $function$;

CREATE OR REPLACE FUNCTION public.mm_admin_lift_penalty(p_user uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_log bigint;
begin
  if not is_moderator() then raise exception 'Solo moderadores y admins' using errcode = '42501'; end if;
  if char_length(v_reason) not between 3 and 300 then raise exception 'El motivo tiene que tener entre 3 y 300 caracteres'; end if;
  -- Bloqueada: si a la vez le cae otra falta, una de las dos espera a la otra.
  perform 1 from mm_penalties where user_id = p_user and until > now() for update;
  if not found then raise exception 'No tiene una sanción vigente' using errcode = 'P0002'; end if;
  -- Como si esa falta no hubiera pasado: sin espera y un nivel menos (Daniel, 2026-11-02).
  update mm_penalties set until = now(), level = greatest(0, level - 1) where user_id = p_user;
  select id into v_log from mm_penalty_log where user_id = p_user and lifted_at is null order by created_at desc, id desc limit 1;
  update mm_penalty_log set lifted_at = now(), lifted_by = auth.uid(), lift_reason = v_reason where id = v_log;
  perform mm_emit('penalty.lifted', null, array[p_user]);
end $function$;

CREATE OR REPLACE FUNCTION public.mm_admin_lists(p_what text, p_arg text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_what = 'reports' and not is_admin() then raise exception 'Solo un admin ve los reportes' using errcode = '42501'; end if;
  if p_what in ('reports', 'bans', 'penalties') then
    if not is_moderator() then raise exception 'Solo moderadores y admins' using errcode = '42501'; end if;
  else
    perform mm_admin_guard();
  end if;
  return case p_what
    when 'lobbies' then (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'mode', l.mode, 'status', l.status, 'map', l.map, 'created_at', l.created_at,
        'server', (select name from game_servers where id = l.server_id), 'players', (select count(*) from mm_lobby_players where lobby_id = l.id)) order by l.created_at desc), '[]')
        from mm_lobbies l where l.status not in ('finished', 'cancelled'))
    when 'reports' then (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'lobby_id', r.lobby_id, 'reason', r.reason, 'note', r.note, 'message', r.message, 'status', r.status, 'created_at', r.created_at,
        'mode', (select mode from mm_lobbies where id = r.lobby_id),
        'reporter', (select nick from players where user_id = r.reporter_id), 'reported', (select nick from players where user_id = r.reported_id), 'reported_user_id', r.reported_id) order by r.created_at desc), '[]')
        from mm_reports r)
    when 'bans' then (select coalesce(jsonb_agg(jsonb_build_object('user_id', b.user_id, 'until', b.until, 'reason', b.reason, 'nick', (select nick from players where user_id = b.user_id)) order by b.until desc), '[]')
        from mm_bans b where b.until > now())
    when 'penalties' then (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.user_id, 'player_id', pl.id, 'nick', pl.nick,
        'level', p.level, 'max_level', (select cardinality(penalty_ladder) from mm_config limit 1),
        'reason', lg.reason, 'since', lg.created_at, 'until', p.until) order by p.until), '[]')
        from mm_penalties p left join players pl on pl.user_id = p.user_id
        left join lateral (select reason, created_at from mm_penalty_log where user_id = p.user_id order by created_at desc, id desc limit 1) lg on true
        where p.until > now())
    when 'servers' then (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'address', s.connect_address, 'region', s.region, 'mm_enabled', s.mm_enabled, 'official_enabled', s.official_enabled, 'pcw_enabled', s.pcw_enabled,
        'state', case when st.last_poll_at is null or st.last_poll_at < now() - interval '30 seconds' then 'offline'
                      when exists (select 1 from mm_lobbies l where l.server_id = s.id and l.status = 'live') then 'live'
                      when exists (select 1 from mm_lobbies l where l.server_id = s.id and l.status not in ('finished', 'cancelled')) then 'lobby'
                      when exists (select 1 from match_bookings b where b.server_id = s.id and b.status not in ('finished', 'abandoned', 'cancelled')) then 'booking' else 'free' end,
        'password', (select to_jsonb(p) from mm_server_passwords p where p.server_id = s.id and p.applied_at is not null order by p.applied_at desc limit 1)) order by s.name), '[]')
        from game_servers s left join mm_server_state st on st.server_id = s.id)
    when 'passwords' then (select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc), '[]') from mm_server_passwords p where p.server_id = p_arg::uuid)
    when 'maps' then (select coalesce(jsonb_agg(jsonb_build_object('name', mp.name, 'label', initcap(regexp_replace(mp.name, '^[a-z]+_', '')), 'image_url', mp.image_url, 'in_mm', mm.map is not null) order by mm.position nulls last, mp.position), '[]')
        from map_pool mp left join mm_mode_maps mm on mm.map = mp.name and mm.mode = p_arg where mp.active)
    when 'stats' then (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'mode', d.mode, 'lobbies', d.lobbies, 'played', d.played, 'abandons', d.abandons,
        'cancelled', (select coalesce(jsonb_object_agg(x.r, x.n), '{}') from (select end_reason r, count(*) n from mm_lobbies c where c.status = 'cancelled' and c.mode = d.mode and c.created_at::date = d.day group by 1) x),
        'avg_wait_s', coalesce((select round(extract(epoch from avg(q.left_at - q.joined_at))) from mm_queue_log q where q.outcome = 'matched' and q.mode = d.mode and q.left_at::date = d.day), 0),
        'p90_wait_s', coalesce((select round(percentile_cont(0.9) within group (order by extract(epoch from q.left_at - q.joined_at))) from mm_queue_log q where q.outcome = 'matched' and q.mode = d.mode and q.left_at::date = d.day), 0),
        'avg_elo_diff', coalesce((select round(avg(x.diff)) from (select abs(avg(lp.elo) filter (where lp.team = 1) - avg(lp.elo) filter (where lp.team = 2)) diff
             from mm_lobby_players lp join mm_lobbies c on c.id = lp.lobby_id where c.mode = d.mode and c.created_at::date = d.day group by lp.lobby_id) x), 0)) order by d.day desc), '[]')
        -- Agrupa primero y cuenta los abandonos afuera: una subconsulta no puede usar l.created_at sin agrupar,
        -- y como todo es un solo CASE, el error rompía también las demás listas.
        from (select g.day, g.mode, g.lobbies, g.played,
                     (select count(*) from mm_lobby_players lp join mm_lobbies x on x.id = lp.lobby_id where lp.abandoned and x.mode = g.mode and x.created_at::date = g.day) abandons
                from (select l.created_at::date as day, l.mode, count(*) lobbies, count(*) filter (where l.status = 'finished') played
                        from mm_lobbies l where l.created_at > now() - make_interval(days => coalesce(p_arg::int, 7)) group by 1, 2) g) d)
  end;
end $function$;

CREATE OR REPLACE FUNCTION public.profile_comment_delete(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.profile_comment_reports_admin(p_status text DEFAULT 'open'::text, p_reason text DEFAULT NULL::text, p_order text DEFAULT 'desc'::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.profile_comment_report_resolve(p_report uuid, p_action text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.team_staff_remove_logo(p_team uuid, p_reason text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t teams;
begin
  t := team_staff_begin(p_team, p_reason, false);
  if t.logo_url is null then raise exception 'El equipo no tiene logo'; end if;
  update teams set logo_url = null where id = p_team;
  perform team_staff_end(t, 'logo_removed');
  return t.logo_url;
end $function$;

CREATE OR REPLACE FUNCTION public.staff_public()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.clip_reprocess(p_clip uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c match_clips; v_demo text; v_key text;
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede reprocesar un clip' using errcode = '42501';
  end if;
  select * into c from match_clips where id = p_clip for update;
  if c.id is null then raise exception 'Esa jugada no existe' using errcode = 'P0002'; end if;
  if not exists (select 1 from match_clip_list l where l.id = p_clip) then
    raise exception 'Esa jugada no está entre los clips del mix';
  end if;
  select demo_status into v_demo from matches where id = c.match_id;
  if v_demo is distinct from 'uploaded' then
    raise exception 'La demo de ese mix ya no está: no se puede volver a grabar';
  end if;
  if c.video_status is null then raise exception 'Esa jugada todavía no se grabó: ya está en la cola'; end if;
  if c.video_status = 'processing' then raise exception 'Esa jugada se está grabando ahora: espera a que termine'; end if;

  v_key := case when c.video_r2_deleted_at is null then c.video_key end;
  if v_key is not null or c.video_drive_id is not null then
    insert into clip_video_trash(video_key, video_drive_id) values (v_key, c.video_drive_id);
  end if;
  update match_clips
     set video_status = null, video_key = null, video_bytes = null, video_seconds = null, video_drive_id = null,
         video_attempts = 0, video_error = null, video_claimed_at = null, video_rendered_at = null, video_r2_deleted_at = null,
         video_review = 'pending', video_reprocessed_at = now(), video_reprocess_count = video_reprocess_count + 1,
         video_reviewed_at = null, video_reviewed_by = null, discord_posted_at = null
   where id = p_clip;
  return 'pending';
end $function$;

delete from public.notifications where type = 'avatar_removed';
select pg_temp.reemplazar('public.notification_category(text)', array[
  [$a$'streamer_granted', 'streamer_revoked', 'avatar_removed') then 'account' -- (replanteo 117) avatar_removed$a$,
   $b$'streamer_granted', 'streamer_revoked') then 'account'$b$]]);

drop function public.staff_remove_photo(uuid, text);
drop function public.ban_support_quota(uuid, text);
drop function public.ban_support_count(text);
drop function public.ban_target_steam(uuid, text);
drop function public.support_actions_list(uuid, text, timestamptz, timestamptz, text, integer, integer);
drop function public.support_log(text, jsonb, text);
drop table public.support_actions;

alter table public.match_clips drop column video_reprocessed_by;
alter table public.bans drop column created_by_role;

update public.team_audit set actor_role = 'moderator' where actor_role = 'support';
alter table public.team_audit drop constraint team_audit_actor_role_check;
alter table public.team_audit add constraint team_audit_actor_role_check
  check (actor_role in ('team', 'moderator', 'admin', 'system'));

update public.profiles set role = 'user' where role = 'support';
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'organizer', 'moderator', 'admin'));
drop function public.is_support();

notify pgrst, 'reload schema';

commit;
