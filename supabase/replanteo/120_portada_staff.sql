-- 120: el staff quita la portada desde el perfil (bitácora docs/bitacora/2026-11-14-portada-calidad-y-staff, aprobado
-- por Daniel el 2026-11-14).
--
--   staff_remove_cover(ficha, motivo): soporte, moderadores y admins (is_support()), como staff_remove_photo (117). Saca
--   la portada de la cuenta de la ficha, avisa al jugador (cover_removed, con el motivo), cierra las denuncias abiertas
--   de esa portada y, si lo hizo un soporte, lo anota en support_actions ('cover_remove'). Devuelve la URL que tenía,
--   para que la API borre el archivo.
-- Se aplica después de la 119. Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/120_portada_staff.sql.
-- Pruebas: docs/bitacora/2026-11-14-portada-calidad-y-staff/pruebas/probar_120.sql (con rollback).
begin;

do $$
begin
  if to_regclass('public.support_actions') is null then raise exception 'replanteo 120: falta la 117'; end if;
  if to_regclass('public.profile_media_reports') is null then raise exception 'replanteo 120: falta la 119'; end if;
  if to_regprocedure('public.staff_remove_cover(uuid, text)') is not null then
    raise exception 'replanteo 120: ya se aplicó (existe staff_remove_cover)';
  end if;
end $$;

alter table public.support_actions drop constraint support_actions_action_check;
alter table public.support_actions add constraint support_actions_action_check
  check (action in ('ban', 'ban_update', 'ban_lift', 'clip_reprocess', 'clip_approve', 'clip_reject',
                    'photo_remove', 'logo_remove', 'comment_delete', 'comment_report', 'penalty_lift',
                    'cover_remove')); -- (replanteo 120) cover_remove

create function public.staff_remove_cover(p_player uuid, p_reason text) returns text
  language plpgsql security definer set search_path = public as $$
declare v_reason text := btrim(coalesce(p_reason, '')); v_user uuid; v_url text;
begin
  if not coalesce(is_support(), false) then raise exception 'Solo soporte, moderadores y admins pueden hacer esto' using errcode = '42501'; end if;
  if char_length(v_reason) not between 3 and 300 then raise exception 'El motivo tiene que tener entre 3 y 300 caracteres'; end if;
  select user_id into v_user from players where id = p_player;
  if not found then raise exception 'No existe esa ficha' using errcode = 'P0002'; end if;
  if v_user is not null then
    select cover_url into v_url from profile_details where user_id = v_user for update;
  end if;
  if v_url is null then raise exception 'No tiene portada' using errcode = 'P0001'; end if;
  update profile_details set cover_url = null, updated_at = now() where user_id = v_user;
  update profile_media_reports set status = 'removed', resolved_by = auth.uid(), resolved_at = now()
   where url = v_url and status = 'open';
  perform notify(array[v_user], 'cover_removed', jsonb_build_object('reason', v_reason));
  perform support_log('cover_remove', jsonb_build_object('player_id', p_player, 'cover_url', v_url), v_reason);
  return v_url;
end $$;
comment on function public.staff_remove_cover(uuid, text) is 'Quitar la portada del perfil de una ficha, con motivo (replanteo 120)';
revoke all on function public.staff_remove_cover(uuid, text) from public, anon;
grant execute on function public.staff_remove_cover(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
