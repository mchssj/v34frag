-- 99: el resultado tardío cierra la sala del matchmaking (bitácora docs/bitacora/2026-11-09-resultado-tardio-mm/, Daniel 2026-11-09).
--
-- Si la web no cierra la sala en 5 minutos, el plugin la cancela con "El resultado de la partida no llegó a la web"
-- aunque el resultado siga reintentándose. Cuando entra, csstv_link_game no encontraba la partida madre (solo
-- upcoming/live) y el mix quedaba suelto. Ahora, si no hay partida madre abierta con ese código, también vincula
-- una del matchmaking cancelada por ese motivo, del mismo servidor y hace menos de 24 horas. El resto de
-- csstv_link_game no cambia: cierra la sala como terminada, con ganador.

begin;

do $$
declare
  f text;
  frag text := '  if par.id is null or par.kind <> ''mm'' then return csstv_link_game_base(p_game, p_code, p_side_a); end if;';
begin
  f := pg_get_functiondef('public.csstv_link_game'::regproc);
  if position(frag in f) = 0 then
    raise exception 'replanteo 99: csstv_link_game no tiene el fragmento esperado';
  end if;
  f := replace(f, frag,
    '  -- (replanteo 99) Resultado tardío: la sala se canceló porque el resultado no llegó a tiempo (abort del plugin).' || chr(10) ||
    '  if par.id is null then' || chr(10) ||
    '    select m.* into par from matches m join mm_lobbies x on x.match_id = m.id' || chr(10) ||
    '     where m.link_code = upper(trim(coalesce(p_code, ''''))) and m.kind = ''mm'' and m.status = ''cancelled''' || chr(10) ||
    '       and x.status = ''cancelled'' and x.end_reason = ''El resultado de la partida no llegó a la web''' || chr(10) ||
    '       and x.ended_at > now() - interval ''24 hours''' || chr(10) ||
    '       and x.server_id is not distinct from (select server_id from matches where id = p_game)' || chr(10) ||
    '     order by x.ended_at desc limit 1' || chr(10) ||
    '       for update of m;' || chr(10) ||
    '  end if;   -- (replanteo 99)' || chr(10) ||
    frag);
  execute f;
end $$;

commit;
