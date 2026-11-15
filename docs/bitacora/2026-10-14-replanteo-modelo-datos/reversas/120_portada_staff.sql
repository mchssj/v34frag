-- Inversa de la 120 (el staff quita la portada desde el perfil). Vuelve a la 119.
-- Se pierden las acciones 'cover_remove' de la actividad del soporte. Las portadas quitadas no vuelven.
begin;

drop function public.staff_remove_cover(uuid, text);
delete from public.support_actions where action = 'cover_remove';
alter table public.support_actions drop constraint support_actions_action_check;
alter table public.support_actions add constraint support_actions_action_check
  check (action in ('ban', 'ban_update', 'ban_lift', 'clip_reprocess', 'clip_approve', 'clip_reject',
                    'photo_remove', 'logo_remove', 'comment_delete', 'comment_report', 'penalty_lift'));

notify pgrst, 'reload schema';

commit;
