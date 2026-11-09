-- Inversa del replanteo 91 (comentarios y votos en los perfiles): borra los comentarios, los votos, las funciones y la
-- preferencia de comentarios cerrados.
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'inversa 91: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

delete from notifications where type in ('profile_comment', 'profile_like');
select pg_temp.reemplazar('public.notification_category(text)', array[
  array[$q$    when p_type in ('profile_comment', 'profile_like') then 'friends' -- (replanteo 91)
$q$, '']]);

drop function public.profile_comments_set(boolean);
drop function public.profile_comment_delete(uuid);
drop function public.profile_comment_add(uuid, text);
drop function public.profile_vote(uuid, smallint);
drop function public.profile_wall(uuid, timestamptz);
drop function public.profile_comments_open(uuid);
drop table public.profile_comments;
drop table public.profile_votes;
update user_preferences set preferences = preferences - 'profile_comments' where preferences ? 'profile_comments';

notify pgrst, 'reload schema';

commit;
