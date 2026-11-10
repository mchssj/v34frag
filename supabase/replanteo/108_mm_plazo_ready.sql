-- 108: con todos conectados, la sala no se cancela por el plazo de conexión (bitácora
-- docs/bitacora/2026-11-10-mm-plazo-ready/, Daniel 2026-11-10).
--
-- Antes, mm_tick cancelaba una sala 'connecting' al vencer connect_deadline aunque estuvieran los 10 adentro: la sala
-- recién pasa a 'live' con el !ready (el plugin avisa "live" al arrancar). El 2026-11-10 se canceló la b14ad561 con el
-- último conectado 8 segundos antes del plazo.
-- Ahora, si al vencer el plazo están todos conectados:
--   - Tienen 3 minutos desde que entró el último para el !ready: connect_deadline pasa a esa hora (la sala muestra la
--     cuenta nueva) y se avisa lobby.update.
--   - Si vence eso sin arrancar, la sala se cancela con "Estaban todos, pero la partida no arrancó (faltó el !ready)",
--     sin sanción para nadie (la base no sabe quién no escribió !ready).
-- Con alguien sin conectar, todo sigue como antes (sanción a los que faltan y "No se conectaron todos a tiempo").
-- Reemplazo de texto en mm_tick, entre marcas "(replanteo 108) ini" y "fin". Inversa en
-- docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/108_mm_plazo_ready.sql.

begin;

do $$
declare
  f text;
  ancla text := '    elsif l.status = ''connecting'' then' || chr(10);
  bloque text :=
    '      -- (replanteo 108) ini: con todos conectados, 3 minutos desde el último para el !ready, sin sanción' || chr(10) ||
    '      if l.connect_deadline <= now() and not exists (select 1 from mm_lobby_players where lobby_id = l.id and connected_at is null) then' || chr(10) ||
    '        v_ready := (select max(connected_at) from mm_lobby_players where lobby_id = l.id) + interval ''3 minutes'';' || chr(10) ||
    '        if v_ready > now() then' || chr(10) ||
    '          update mm_lobbies set connect_deadline = v_ready where id = l.id;' || chr(10) ||
    '          perform mm_emit(''lobby.update'', l.id, mm_lobby_users(l.id));' || chr(10) ||
    '        else' || chr(10) ||
    '          perform mm_cancel_lobby(l.id, ''Estaban todos, pero la partida no arrancó (faltó el !ready)'');' || chr(10) ||
    '        end if;' || chr(10) ||
    '        continue;' || chr(10) ||
    '      end if;' || chr(10) ||
    '      -- (replanteo 108) fin' || chr(10);
  decl_ancla text := '  v_summary jsonb;' || chr(10);
  decl text := '  v_ready timestamptz;  -- (replanteo 108)' || chr(10);
begin
  f := pg_get_functiondef('public.mm_tick()'::regprocedure);
  if position('replanteo 108' in f) > 0 then
    raise exception 'replanteo 108: ya está aplicado';
  end if;
  foreach ancla in array array[ancla, decl_ancla] loop
    if position(ancla in f) = 0 then
      raise exception 'replanteo 108: mm_tick no tiene el fragmento esperado: %', ancla;
    end if;
    if position(ancla in substr(f, position(ancla in f) + 1)) > 0 then
      raise exception 'replanteo 108: el fragmento aparece más de una vez: %', ancla;
    end if;
  end loop;
  f := replace(f, '    elsif l.status = ''connecting'' then' || chr(10), '    elsif l.status = ''connecting'' then' || chr(10) || bloque);
  f := replace(f, decl_ancla, decl_ancla || decl);
  execute f;
end $$;

commit;
