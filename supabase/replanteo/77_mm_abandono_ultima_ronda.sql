-- 77: irse en la última ronda no es abandono (bitácora docs/bitacora/2026-11-06-abandono-ultima-ronda, Daniel 2026-11-06).
--
-- Al terminar la partida, quien seguía desconectado quedaba como abandono: sanción y ELO de abandono (derrota completa y
-- el extra), aunque se hubiera ido en la última ronda o en el marcador final. Ahora, si le faltó como mucho la última
-- ronda, solo se le borra la marca de desconectado: sin sanción y con su ELO normal. El abandono a mitad de partida no
-- cambia. Necesita la 48 (matchmaking).
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/77_mm_abandono_ultima_ronda.sql.
begin;

do $$
begin
  if to_regprocedure('public.mm_left_last_round(uuid, uuid)') is not null then
    raise exception 'replanteo 77: mm_left_last_round ya existe (¿ya se aplicó?)';
  end if;
  if to_regprocedure('public.csstv_link_game(uuid, text, integer)') is null then
    raise exception 'replanteo 77: falta la 48 (csstv_link_game)';
  end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 77: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- Le faltó como mucho la última ronda: sus rondas en el juego son al menos el total menos una. El total es el mismo que
-- usa mm_elo_delta (el mayor entre el marcador y las rondas del que más jugó). Sin stats en el juego, no.
create function public.mm_left_last_round(p_game uuid, p_player uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select max(s.rounds) from match_player_stats s where s.match_id = g.id and s.player_id = p_player), -1)
         >= greatest(coalesce(g.score1, 0) + coalesce(g.score2, 0),
                     (select coalesce(max(x.rounds), 0) from match_player_stats x where x.match_id = g.id and x.team in (1, 2))) - 1
    from matches g
   where g.id = p_game $$;
revoke all on function public.mm_left_last_round(uuid, uuid) from public, anon, authenticated;

select pg_temp.reemplazar('public.csstv_link_game(uuid, text, integer)', array[
  [E'  for v_left in select user_id from mm_lobby_players where lobby_id = l.id and left_at is not null and not abandoned loop\n',
   E'  -- (replanteo 77) Salvo que le haya faltado solo la última ronda: a esos se les borra la marca, sin sanción.\n'
   || E'  for v_left in select user_id from mm_lobby_players where lobby_id = l.id and left_at is not null and not abandoned\n'
   || E'                  and not mm_left_last_round(g.id, player_id) loop\n'],
  [E'    perform mm_penalize(v_left, ''Abandonaste una partida'');\n  end loop;\n',
   E'    perform mm_penalize(v_left, ''Abandonaste una partida'');\n  end loop;\n'
   || E'  update mm_lobby_players set left_at = null where lobby_id = l.id and left_at is not null and not abandoned;\n']
]);

commit;
