-- Inversa del replanteo 55: mm_player_card y mm_my_state como antes (solo la foto de la ficha) y sin mm_player_photo.
begin;

drop function if exists pg_temp.reemplazar(regprocedure, text[]);
create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 55: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.mm_player_card(uuid, uuid, mm_lobby_players)'::regprocedure, array[
  [$q$'player_id', p.id, 'nick', p.nick, 'photo_url', mm_player_photo(p.id),$q$,
   $q$'player_id', p.id, 'nick', p.nick, 'photo_url', p.photo_url,$q$]]);

select pg_temp.reemplazar('public.mm_my_state()'::regprocedure, array[
  [$q$'members', (select jsonb_agg(jsonb_build_object('player_id', p.id, 'nick', p.nick, 'photo_url', mm_player_photo(p.id), 'level', elo_level(mm_player_elo(p.id)), 'elo', mm_player_elo(p.id),$q$,
   $q$'members', (select jsonb_agg(jsonb_build_object('player_id', p.id, 'nick', p.nick, 'level', elo_level(mm_player_elo(p.id)), 'elo', mm_player_elo(p.id),$q$]]);

drop function public.mm_player_photo(uuid);

notify pgrst, 'reload schema';

commit;
