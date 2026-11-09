-- Inversa del replanteo 98: mm_player_card vuelve a como la dejó la 94 (sin is_me, linked ni country).
-- Solo para volver atrás en una prueba: en producción deja la sala sin capitanes para la web.
begin;

do $$
declare d text := pg_get_functiondef('public.mm_player_card(uuid, uuid, mm_lobby_players)'::regprocedure);
begin
  if position($q$'verified', p.verified, 'is_me'$q$ in d) = 0 then
    raise exception 'inversa 98: mm_player_card no tiene la línea de la 98 (¿se aplicó?)';
  end if;
  execute replace(d, $q$'verified', p.verified, 'is_me'$q$, $q$'verified', p.verified, -- (replanteo 94) 'is_me'$q$);
end $$;

commit;
