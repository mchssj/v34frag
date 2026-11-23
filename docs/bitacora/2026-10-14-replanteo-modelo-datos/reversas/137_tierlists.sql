-- Inversa de la 137: borra las tierlists (con sus tiers, ítems, comentarios, me gusta y denuncias) y saca sus avisos de
-- la categoría friends. Antes, la API y la web tienen que volver a una versión sin tierlists. Se pierden todas las tierlists.
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'reversa 137: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.notification_category(text)', array[
  array[$q$when p_type in ('profile_comment', 'profile_like', 'tierlist_comment', 'tierlist_reply', 'tierlist_like') then 'friends' -- (replanteo 137) tierlists$q$,
        $q$when p_type in ('profile_comment', 'profile_like') then 'friends'$q$]]);

delete from public.notifications where type in ('tierlist_comment', 'tierlist_reply', 'tierlist_like');

drop function public.tierlist_report_resolve(uuid, text), public.tierlist_reports_admin(text, text, text, integer, integer),
  public.tierlist_report(uuid, uuid, text, text), public.tierlist_comment_delete(uuid), public.tierlist_comment_add(uuid, text, uuid),
  public.tierlist_like(uuid, boolean), public.tierlist_copy(uuid), public.tierlist_comments_set(uuid, boolean),
  public.tierlist_feature(uuid, boolean), public.tierlist_delete(uuid), public.tierlist_insert_items(tierlists, uuid, jsonb),
  public.tierlist_save(uuid, jsonb), public.tierlist_create(text, text), public.tierlist_comment_json(tierlist_comments, uuid, boolean),
  public.tierlist_comments_list(uuid, timestamptz), public.tierlist_get(uuid), public.tierlists_of(uuid),
  public.tierlist_item_json(tierlist_items), public.tierlist_author_json(uuid), public.tierlist_check_text(text, text),
  public.tierlist_row(uuid), public.tierlist_me_player(text);

drop table public.tierlist_reports, public.tierlist_likes, public.tierlist_comments, public.tierlist_items,
  public.tierlist_tiers, public.tierlists;

notify pgrst, 'reload schema';

commit;
