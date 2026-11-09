-- Inversa del replanteo 94 (ajustes de los comentarios del perfil y la insignia en las listas):
--   - se borran las denuncias de comentarios (profile_comment_reports) y sus funciones;
--   - se borran comment_blocked_word, profile_social_blocked y profile_social_check;
--   - profile_vote, profile_comment_add, profile_wall y mm_player_card vuelven a como estaban (desde replanteo94_funciones,
--     que se borra al final).
-- Los comentarios borrados al resolver una denuncia quedan borrados.
begin;

do $$
begin
  if to_regclass('public.replanteo94_funciones') is null then
    raise exception 'inversa 94: falta replanteo94_funciones (¿se aplicó la 94?)';
  end if;
end $$;

do $$
declare r record;
begin
  for r in select def from public.replanteo94_funciones loop
    execute r.def;  -- create or replace: los permisos quedan como estaban
  end loop;
end $$;

drop function public.profile_comment_report_resolve(uuid, text);
drop function public.profile_comment_reports_admin(text, text, text, integer, integer);
drop function public.profile_comment_report(uuid, text, text);
drop table public.profile_comment_reports;
drop function public.profile_social_check(uuid, uuid);
drop function public.profile_social_blocked(uuid, uuid);
drop function public.comment_blocked_word(text);
drop table public.replanteo94_funciones;

notify pgrst, 'reload schema';

commit;
