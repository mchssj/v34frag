-- 117: rol Soporte (bitácora docs/bitacora/2026-11-13-rol-soporte, aprobado por Daniel el 2026-11-13).
--
--   1. profiles.role acepta 'support' y set_user_role lo da (solo un admin). is_support(): soporte, moderador o admin.
--      is_moderator() NO cambia: la usan torneos, equipos, PCW… y el soporte no entra ahí.
--   2. support_actions: cada acción del soporte (quién, qué, a quién, motivo y cuándo). support_log() la escribe solo
--      cuando quien actúa tiene el rol 'support'. support_actions_list() la muestra a moderadores y admins.
--   3. Baneos: bans.created_by_role. ban_create, ban_update y ban_lift con is_support(). Para el soporte: de 1 a 120
--      minutos, no a quien ya está baneado, hasta 3 baneos de soporte por jugador en 7 días, y solo cambia o levanta
--      los suyos sin pasar de 120 minutos desde que lo puso. ban_support_quota() para el formulario.
--   4. Sanciones de la cola: mm_admin_lift_penalty y mm_admin_lists('penalties') con is_support(). Las exclusiones
--      (mm_admin_unban, mm_admin_lists('bans')) y los reportes siguen como estaban.
--   5. Comentarios: profile_comment_delete, profile_comment_reports_admin y profile_comment_report_resolve con is_support().
--   6. Logo de un equipo: team_staff_remove_logo acepta al soporte (con motivo). team_audit.actor_role acepta 'support'.
--   7. Foto de perfil: staff_remove_photo(ficha, motivo) borra la foto de la ficha y la de la cuenta, y le avisa al
--      jugador (notificación avatar_removed, de la categoría account).
--   8. Clips: clip_reprocess, clip_review_ok (publicar) y clip_reject con is_support(), y match_clips.video_reprocessed_by.
--      La cola Para revisar es del soporte también (Daniel, 2026-11-14). Recuperar un rechazado sigue siendo del admin.
--   9. staff_public() suma 'supports' (Quiénes somos).
-- Se aplica después de la 116. Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/117_rol_soporte.sql.
-- Pruebas: docs/bitacora/2026-11-13-rol-soporte/pruebas/probar_117.sql (con rollback).
begin;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'support_actions') then
    raise exception 'replanteo 117: support_actions ya existe (¿ya se aplicó?)';
  end if;
  if exists (select 1 from profiles where role not in ('user', 'organizer', 'moderator', 'admin')) then
    raise exception 'replanteo 117: hay roles desconocidos en profiles.role';
  end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    -- Sin \r: con el archivo en CRLF (autocrlf), los textos de varias líneas no coincidirían con la función.
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'replanteo 117: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

-- ---------- 1. El rol ----------

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('user', 'organizer', 'support', 'moderator', 'admin'));

create function public.is_support() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('support', 'moderator', 'admin'))
$$;
comment on function public.is_support() is 'Soporte, moderador o admin (replanteo 117)';

select pg_temp.reemplazar('public.set_user_role(uuid, text)', array[
  [$a$if p_role not in ('user', 'organizer', 'moderator') then raise exception 'El rol tiene que ser user, organizer o moderator'; end if; -- (replanteo 31)$a$,
   $b$if p_role not in ('user', 'organizer', 'support', 'moderator') then raise exception 'El rol tiene que ser user, organizer, support o moderator'; end if; -- (replanteo 31; support, 117)$b$]]);

-- ---------- 2. Registro del soporte ----------

create table public.support_actions (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action in ('ban', 'ban_update', 'ban_lift', 'clip_reprocess', 'clip_approve', 'clip_reject',
                                             'photo_remove', 'logo_remove', 'comment_delete', 'comment_report', 'penalty_lift')),
  target     jsonb not null default '{}',
  reason     text check (char_length(reason) <= 300),
  created_at timestamptz not null default now()
);
create index support_actions_created on public.support_actions (created_at desc);
create index support_actions_actor on public.support_actions (actor_id, created_at desc);
alter table public.support_actions enable row level security;
-- Sin políticas: se lee con support_actions_list().
comment on table public.support_actions is 'Cada acción del rol Soporte, para moderadores y admins (replanteo 117)';

-- Anota la acción solo si quien la hace es soporte (lo de moderadores y admins ya queda en cada tabla).
create function public.support_log(p_action text, p_target jsonb, p_reason text default null) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from profiles where id = auth.uid() and role = 'support') then
    insert into support_actions(actor_id, action, target, reason)
    values (auth.uid(), p_action, coalesce(p_target, '{}'), left(nullif(btrim(coalesce(p_reason, '')), ''), 300));
  end if;
end $$;

create function public.support_actions_list(p_actor uuid default null, p_action text default null,
                                            p_from timestamptz default null, p_to timestamptz default null,
                                            p_order text default 'desc', p_limit integer default 20, p_offset integer default 0)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(is_moderator(), false) then raise exception 'Solo moderadores y admins' using errcode = '42501'; end if;
  if p_order not in ('asc', 'desc') then raise exception 'El orden es asc o desc' using errcode = 'P0001'; end if;
  return (
    with f as (
      select a.* from support_actions a
       where (p_actor is null or a.actor_id = p_actor)
         and (p_action is null or a.action = p_action)
         and (p_from is null or a.created_at >= p_from)
         and (p_to is null or a.created_at < p_to)),
    pg as (
      select row_number() over (order by case when p_order = 'asc' then a.created_at end asc,
                                         case when p_order = 'desc' then a.created_at end desc, a.id) as n,
             jsonb_build_object(
               'id', a.id, 'action', a.action, 'target', a.target, 'reason', a.reason, 'created_at', a.created_at,
               'actor', (select player_ref(p.id) from players p where p.user_id = a.actor_id),
               'player', case when a.target ? 'player_id' then player_ref((a.target->>'player_id')::uuid) end,
               'team', case when a.target ? 'team_id' then team_ref((a.target->>'team_id')::uuid) end) as j
        from f a
       order by n
       limit least(greatest(coalesce(p_limit, 20), 1), 100) offset greatest(coalesce(p_offset, 0), 0))
    select jsonb_build_object('total', (select count(*) from f),
                              'items', coalesce((select jsonb_agg(j order by n) from pg), '[]'::jsonb)));
end $$;
comment on function public.support_actions_list(uuid, text, timestamptz, timestamptz, text, integer, integer)
  is 'Baneos › Actividad del soporte: paginada, con filtros y orden (replanteo 117)';

-- ---------- 3. Baneos ----------

alter table public.bans add column created_by_role text check (created_by_role in ('support', 'moderator', 'admin'));
comment on column public.bans.created_by_role is
  'Rol de quien lo puso desde la web, en ese momento (replanteo 117). null en los del juego, los importados y los de antes';

-- Baneos de soporte de esa persona (todos sus SteamID y su ficha) en los últimos 7 días, levantados incluidos.
create function public.ban_support_count(p_steam text) returns integer
  language sql stable security definer set search_path = public as $$
  select count(*)::int from bans b
   where b.created_by_role = 'support' and b.created_at > now() - interval '7 days'
     and (b.steam_id = p_steam or ban_owner(b.player_id, b.steam_id) = steam_owner(p_steam))
$$;

-- El SteamID con el que se banea: el de la ficha o el que se pegó.
create function public.ban_target_steam(p_player uuid, p_steam text) returns text
  language sql stable security definer set search_path = public as $$
  select case when p_player is not null then (select steam_id from players where id = p_player) else p_steam end
$$;

-- Para el formulario del soporte: cuántos le quedan esta semana y si ya está baneado.
create function public.ban_support_quota(p_player uuid, p_steam text) returns jsonb
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

create or replace function public.ban_lift(p_id uuid, p_reason text) returns void
  language plpgsql security definer set search_path = public as $$
declare b bans;
begin
  if not is_support() then raise exception 'Solo soporte, moderadores y admins pueden levantar baneos' using errcode = '42501'; end if;
  select * into b from bans where id = p_id for update;
  if b.id is null then raise exception 'No existe ese baneo'; end if;
  if b.lifted_at is not null or b.expires_at <= now() then raise exception 'Ese baneo ya no está activo'; end if;
  if b.expires_at is null and not is_admin() then
    raise exception 'Solo un admin puede levantar un baneo permanente' using errcode = '42501';
  end if;
  -- El soporte (replanteo 117): solo los suyos.
  if not coalesce(is_moderator(), false) and b.created_by is distinct from auth.uid() then
    raise exception 'Solo puedes levantar los baneos que pusiste tú' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 200 then raise exception 'El motivo es obligatorio (hasta 200 caracteres)'; end if;
  update bans set lifted_at = now(), lifted_by = auth.uid(), lift_reason = btrim(p_reason) where id = p_id;
  perform support_log('ban_lift', jsonb_build_object('ban_id', b.id, 'player_id', b.player_id, 'steam_id', b.steam_id, 'nick', b.nick),
                      btrim(p_reason));
end $$;

-- ---------- 4. Sanciones de la cola ----------

select pg_temp.reemplazar('public.mm_admin_lift_penalty(uuid, text)', array[
  [$a$if not is_moderator() then raise exception 'Solo moderadores y admins' using errcode = '42501'; end if;$a$,
   $b$if not is_support() then raise exception 'Solo soporte, moderadores y admins' using errcode = '42501'; end if; -- (replanteo 117)$b$],
  [$a$perform mm_emit('penalty.lifted', null, array[p_user]);$a$,
   $b$perform mm_emit('penalty.lifted', null, array[p_user]);
  perform support_log('penalty_lift', jsonb_build_object('user_id', p_user, 'player_id', (select id from players where user_id = p_user)), v_reason); -- (replanteo 117)$b$]]);

select pg_temp.reemplazar('public.mm_admin_lists(text, text)', array[
  [$a$if p_what in ('reports', 'bans', 'penalties') then$a$,
   $b$if p_what = 'penalties' then -- (replanteo 117: también el soporte)
    if not is_support() then raise exception 'Solo soporte, moderadores y admins' using errcode = '42501'; end if;
  elsif p_what in ('reports', 'bans') then$b$]]);

-- ---------- 5. Comentarios ----------

select pg_temp.reemplazar('public.profile_comment_delete(uuid)', array[
  [$a$if not (c.author = me or v_owner = me or coalesce(is_admin() or is_moderator(), false)) then$a$,
   $b$if not (c.author = me or v_owner = me or coalesce(is_support(), false)) then -- (replanteo 117: también el soporte)$b$],
  [$a$update profile_comments set deleted_at = now(), deleted_by = me where id = p_id;$a$,
   $b$update profile_comments set deleted_at = now(), deleted_by = me where id = p_id;
  if c.author is distinct from me and v_owner is distinct from me then
    perform support_log('comment_delete', jsonb_build_object('comment_id', c.id, 'player_id', c.player_id,
                        'author_player_id', (select id from players where user_id = c.author), 'body', left(c.body, 300)));
  end if;$b$]]);

select pg_temp.reemplazar('public.profile_comment_reports_admin(text, text, text, integer, integer)', array[
  [$a$if not coalesce(is_moderator(), false) then raise exception 'Solo moderadores y admins' using errcode = '42501'; end if;$a$,
   $b$if not coalesce(is_support(), false) then raise exception 'Solo soporte, moderadores y admins' using errcode = '42501'; end if; -- (replanteo 117)$b$]]);

select pg_temp.reemplazar('public.profile_comment_report_resolve(uuid, text)', array[
  [$a$if not coalesce(is_moderator(), false) then raise exception 'Solo moderadores y admins' using errcode = '42501'; end if;$a$,
   $b$if not coalesce(is_support(), false) then raise exception 'Solo soporte, moderadores y admins' using errcode = '42501'; end if; -- (replanteo 117)$b$],
  [$a$resolved_by = me, resolved_at = now()
   where comment_id = r.comment_id and status = 'open';$a$,
   $b$resolved_by = me, resolved_at = now()
   where comment_id = r.comment_id and status = 'open';
  perform support_log('comment_report', jsonb_build_object('report_id', r.id, 'comment_id', r.comment_id, 'decision', p_action,
                      'player_id', (select player_id from profile_comments where id = r.comment_id),
                      'body', (select left(body, 300) from profile_comments where id = r.comment_id)));$b$]]);

-- ---------- 6. Logo de un equipo ----------

alter table public.team_audit drop constraint team_audit_actor_role_check;
alter table public.team_audit add constraint team_audit_actor_role_check
  check (actor_role in ('team', 'support', 'moderator', 'admin', 'system'));

-- El moderador y el admin pasan por team_staff_begin, como siempre. El soporte solo puede esto, y con motivo.
create or replace function public.team_staff_remove_logo(p_team uuid, p_reason text default null) returns text
  language plpgsql security definer set search_path = public as $$
declare t teams; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if coalesce(is_moderator(), false) then
    t := team_staff_begin(p_team, p_reason, false);
  else
    if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
    if not coalesce(is_support(), false) then raise exception 'Solo soporte, moderadores y admins pueden hacer esto' using errcode = '42501'; end if;
    if char_length(coalesce(v_reason, '')) not between 3 and 300 then raise exception 'El motivo tiene que tener entre 3 y 300 caracteres'; end if;
    select * into t from teams where id = p_team and kind = 'official' for update;
    if not found or t.dissolved_at is not null then raise exception 'No existe ese equipo' using errcode = 'P0002'; end if;
    perform set_config('v34.audit_reason', v_reason, true);
    perform set_config('v34.staff_role', 'support', true);
  end if;
  if t.logo_url is null then raise exception 'El equipo no tiene logo'; end if;
  update teams set logo_url = null where id = p_team;
  perform team_staff_end(t, 'logo_removed');
  perform support_log('logo_remove', jsonb_build_object('team_id', t.id, 'logo_url', t.logo_url), v_reason);
  return t.logo_url;
end $$;

-- ---------- 7. Foto de perfil ----------

select pg_temp.reemplazar('public.notification_category(text)', array[
  [$a$'streamer_granted', 'streamer_revoked') then 'account'$a$,
   $b$'streamer_granted', 'streamer_revoked', 'avatar_removed') then 'account' -- (replanteo 117) avatar_removed$b$]]);

-- Quita la foto de la ficha y la de la cuenta. Devuelve las dos URLs, para que la API borre los archivos.
create function public.staff_remove_photo(p_player uuid, p_reason text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_reason text := btrim(coalesce(p_reason, '')); p players; v_avatar text;
begin
  if not coalesce(is_support(), false) then raise exception 'Solo soporte, moderadores y admins pueden hacer esto' using errcode = '42501'; end if;
  if char_length(v_reason) not between 3 and 300 then raise exception 'El motivo tiene que tener entre 3 y 300 caracteres'; end if;
  select * into p from players where id = p_player for update;
  if p.id is null then raise exception 'No existe esa ficha' using errcode = 'P0002'; end if;
  if p.user_id is not null then
    select avatar_url into v_avatar from profile_details where user_id = p.user_id for update;
  end if;
  if p.photo_url is null and v_avatar is null then raise exception 'No tiene foto de perfil' using errcode = 'P0001'; end if;
  update players set photo_url = null where id = p.id and photo_url is not null;
  if v_avatar is not null then
    update profile_details set avatar_url = null where user_id = p.user_id;
  end if;
  perform notify(array[p.user_id], 'avatar_removed', jsonb_build_object('reason', v_reason));
  perform support_log('photo_remove', jsonb_build_object('player_id', p.id, 'photo_url', p.photo_url, 'avatar_url', v_avatar), v_reason);
  return jsonb_build_object('photo_url', p.photo_url, 'avatar_url', v_avatar);
end $$;
comment on function public.staff_remove_photo(uuid, text) is 'Quitar la foto de perfil de una ficha, con motivo (replanteo 117)';

-- ---------- 8. Clips ----------

alter table public.match_clips add column video_reprocessed_by uuid references public.profiles(id) on delete set null;
comment on column public.match_clips.video_reprocessed_by is 'Quién lo reprocesó la última vez (replanteo 117)';

select pg_temp.reemplazar('public.clip_reprocess(uuid)', array[
  [$a$if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede reprocesar un clip' using errcode = '42501';$a$,
   $b$if auth.uid() is not null and not is_support() then -- (replanteo 117: también soporte y moderadores)
    raise exception 'Solo soporte, moderadores y admins pueden reprocesar un clip' using errcode = '42501';$b$],
  [$a$video_reprocessed_at = now(),$a$,
   $b$video_reprocessed_at = now(), video_reprocessed_by = auth.uid(),$b$],
  [$a$  return 'pending';$a$,
   $b$  perform support_log('clip_reprocess', jsonb_build_object('clip_id', c.id, 'match_id', c.match_id)); -- (replanteo 117)
  return 'pending';$b$]]);

-- Para revisar (Daniel, 2026-11-14): el soporte también publica en Discord y rechaza.
select pg_temp.reemplazar('public.clip_review_ok(uuid)', array[
  [$a$if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede aprobar un clip' using errcode = '42501';$a$,
   $b$if auth.uid() is not null and not is_support() then -- (replanteo 117: también soporte y moderadores)
    raise exception 'Solo soporte, moderadores y admins pueden aprobar un clip' using errcode = '42501';$b$],
  [$a$update match_clips set video_review = 'approved', video_reviewed_at = now(), video_reviewed_by = auth.uid() where id = p_clip;$a$,
   $b$update match_clips set video_review = 'approved', video_reviewed_at = now(), video_reviewed_by = auth.uid() where id = p_clip;
  perform support_log('clip_approve', jsonb_build_object('clip_id', c.id, 'match_id', c.match_id, 'nick', c.player_name)); -- (replanteo 117)$b$]]);

select pg_temp.reemplazar('public.clip_reject(uuid, text)', array[
  [$a$if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede rechazar un clip' using errcode = '42501';$a$,
   $b$if auth.uid() is not null and not is_support() then -- (replanteo 117: también soporte y moderadores)
    raise exception 'Solo soporte, moderadores y admins pueden rechazar un clip' using errcode = '42501';$b$],
  [$a$delete from player_featured_clips where clip_id = p_clip;$a$,
   $b$delete from player_featured_clips where clip_id = p_clip;
  perform support_log('clip_reject', jsonb_build_object('clip_id', c.id, 'match_id', c.match_id, 'nick', c.player_name), p_reason); -- (replanteo 117)$b$]]);

-- ---------- 9. Quiénes somos ----------

select pg_temp.reemplazar('public.staff_public()', array[
  [$a$order by lower(nick)), '[]') from card where role = 'moderator'),$a$,
   $b$order by lower(nick)), '[]') from card where role = 'moderator'),
    'supports', (select coalesce(jsonb_agg(jsonb_build_object('player_id', player_id, 'nick', nick, 'photo_url', photo_url, 'level', level)
                   order by lower(nick)), '[]') from card where role = 'support'), -- (replanteo 117)$b$]]);

-- ---------- Permisos ----------

revoke all on function public.is_support() from public;
grant execute on function public.is_support() to anon, authenticated;
revoke all on function public.support_log(text, jsonb, text), public.ban_support_count(text), public.ban_target_steam(uuid, text)
  from public, anon, authenticated;
revoke all on function public.support_actions_list(uuid, text, timestamptz, timestamptz, text, integer, integer),
  public.ban_support_quota(uuid, text), public.staff_remove_photo(uuid, text) from public, anon;
grant execute on function public.support_actions_list(uuid, text, timestamptz, timestamptz, text, integer, integer),
  public.ban_support_quota(uuid, text), public.staff_remove_photo(uuid, text) to authenticated;
-- create or replace conserva los permisos de ban_create, ban_update, ban_lift y team_staff_remove_logo.
revoke all on table public.support_actions from anon, authenticated;

notify pgrst, 'reload schema';

commit;
