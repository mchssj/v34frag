-- Replanteo 55: la foto de cada jugador en el matchmaking (bitácora docs/bitacora/2026-11-02-ajustes-primer-mm).
-- mm_player_card solo usaba la foto de la ficha (players.photo_url), que casi nadie tiene: el resto de la web usa la
-- de la ficha o, si no hay, el avatar del perfil (player_overview). Ahora las dos, con mm_player_photo(). Los
-- compañeros del grupo (mm_my_state › party.members) también traen su foto. Va después de la 54.
begin;

create function public.mm_player_photo(p_player uuid) returns text
  language sql stable security definer set search_path = public as $$
  select coalesce(p.photo_url, d.avatar_url) from players p left join profile_details d on d.user_id = p.user_id where p.id = p_player $$;
revoke all on function public.mm_player_photo(uuid) from public, anon, authenticated;
grant execute on function public.mm_player_photo(uuid) to service_role;

drop function if exists pg_temp.reemplazar(regprocedure, text[]);
create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 55: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.mm_player_card(uuid, uuid, mm_lobby_players)'::regprocedure, array[
  [$q$'player_id', p.id, 'nick', p.nick, 'photo_url', p.photo_url,$q$,
   $q$'player_id', p.id, 'nick', p.nick, 'photo_url', mm_player_photo(p.id),$q$]]);

select pg_temp.reemplazar('public.mm_my_state()'::regprocedure, array[
  [$q$'members', (select jsonb_agg(jsonb_build_object('player_id', p.id, 'nick', p.nick, 'level', elo_level(mm_player_elo(p.id)), 'elo', mm_player_elo(p.id),$q$,
   $q$'members', (select jsonb_agg(jsonb_build_object('player_id', p.id, 'nick', p.nick, 'photo_url', mm_player_photo(p.id), 'level', elo_level(mm_player_elo(p.id)), 'elo', mm_player_elo(p.id),$q$]]);

notify pgrst, 'reload schema';

commit;
