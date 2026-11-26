-- Inversa de la 140 (partidas favoritas). Borra todo lo marcado. Antes, la inversa de la 141 (match_search lee la tabla).
begin;
do $$ begin
  if to_regprocedure('public.match_search(jsonb, text, text, integer, integer)') is not null then
    raise exception 'inversa 140: primero la inversa de la 141 (match_search usa match_favorites)';
  end if;
end $$;
drop function if exists public.match_favorite_set(uuid, boolean);
drop table if exists public.match_favorites;
notify pgrst, 'reload schema';
commit;
