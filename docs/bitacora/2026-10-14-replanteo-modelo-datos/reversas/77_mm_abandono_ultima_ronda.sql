-- Inversa del replanteo 77 (irse en la última ronda no es abandono): csstv_link_game vuelve a marcar como abandono a todo
-- el que sigue desconectado al terminar la partida.
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 77: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.csstv_link_game(uuid, text, integer)', array[
  [E'  -- (replanteo 77) Salvo que le haya faltado solo la última ronda: a esos se les borra la marca, sin sanción.\n'
   || E'  for v_left in select user_id from mm_lobby_players where lobby_id = l.id and left_at is not null and not abandoned\n'
   || E'                  and not mm_left_last_round(g.id, player_id) loop\n',
   E'  for v_left in select user_id from mm_lobby_players where lobby_id = l.id and left_at is not null and not abandoned loop\n'],
  [E'    perform mm_penalize(v_left, ''Abandonaste una partida'');\n  end loop;\n'
   || E'  update mm_lobby_players set left_at = null where lobby_id = l.id and left_at is not null and not abandoned;\n',
   E'    perform mm_penalize(v_left, ''Abandonaste una partida'');\n  end loop;\n']
]);

drop function public.mm_left_last_round(uuid, uuid);

commit;
