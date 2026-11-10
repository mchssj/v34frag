-- 105: bajar el tamaño máximo del grupo desarma los grupos que no entran (bitácora docs/bitacora/2026-11-09-mm-grupo-maximo/,
-- Daniel 2026-11-09).
--
-- Antes, mm_set_config solo cambiaba el número: los grupos ya armados seguían, entraban a la cola y jugaban juntos.
-- Ahora:
--   1. mm_party_trim(p_max): cada grupo con más de p_max integrantes y sin nadie en una sala sale de la cola (closed)
--      y se borra, con el aviso party.disbanded a los que estaban. Vence las invitaciones que ya no se pueden aceptar.
--   2. mm_set_config la llama al guardar; mm_tick, en cada vuelta (así agarra a los que salen de una sala).
--   3. mm_join rechaza un grupo más grande que el máximo.
-- Las funciones existentes se cambian con reemplazos de texto, entre marcas "(replanteo 105) ini" y "fin", para no
-- pisar lo de otros replanteos (el 104 también cambia mm_set_config y mm_tick, en otros puntos). Inversa en
-- docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/105_mm_grupo_maximo.sql.

begin;

do $$
begin
  if to_regprocedure('public.mm_party_trim(integer)') is not null
     or position('replanteo 105' in pg_get_functiondef('public.mm_set_config(jsonb)'::regprocedure)) > 0 then
    raise exception 'replanteo 105: ya está aplicado';
  end if;
end $$;

create function public.mm_party_trim(p_max int) returns int
  language plpgsql security definer set search_path = public as $$
declare
  r record;
  u record;
  n int := 0;
  v_users uuid[];
  v_queued boolean;
begin
  for r in select pm.party_id from mm_party_members pm group by pm.party_id having count(*) > p_max loop
    -- Con alguien en una sala no se toca: la sala sigue, y se desarma en la vuelta de mm_tick después de que termine.
    if exists (select 1 from mm_party_members pm where pm.party_id = r.party_id and mm_active_lobby(pm.user_id) is not null) then
      continue;
    end if;
    v_users := array(select pm.user_id from mm_party_members pm where pm.party_id = r.party_id);
    v_queued := exists (select 1 from mm_queue q where q.party_id = r.party_id);
    for u in select q.user_id from mm_queue q where q.party_id = r.party_id loop
      perform mm_queue_remove(u.user_id, 'closed');
    end loop;
    -- Los integrantes, las invitaciones y el chat del grupo se borran en cascada.
    delete from mm_parties where id = r.party_id;
    perform mm_emit('party.disbanded', null, v_users, jsonb_build_object('max', p_max, 'queued', v_queued));
    n := n + 1;
  end loop;
  -- Las invitaciones de un grupo que ya está lleno no se pueden aceptar: se vencen (mm_tick borra el grupo de uno).
  update mm_party_invites i set status = 'expired'
   where i.status = 'pending'
     and (select count(*) from mm_party_members pm where pm.party_id = i.party_id) >= p_max;
  return n;
end $$;

revoke execute on function public.mm_party_trim(int) from public, anon, authenticated;

do $$
declare
  fn text;
  f text;
  ancla text;
  bloque text;
  antes boolean;
begin
  foreach fn in array array['mm_set_config(jsonb)', 'mm_tick()', 'mm_join(text,text)'] loop
    f := pg_get_functiondef(('public.' || fn)::regprocedure);
    if fn = 'mm_set_config(jsonb)' then
      ancla := '  perform mm_emit(''mm.config'', null, null);' || chr(10);
      antes := true;
      bloque := '  -- (replanteo 105) ini: los grupos más grandes que el máximo (fuera de una sala) se desarman' || chr(10) ||
                '  perform mm_party_trim((select max_party_size from mm_config where id = 1));' || chr(10) ||
                '  -- (replanteo 105) fin' || chr(10);
    elsif fn = 'mm_tick()' then
      ancla := '     and (select count(*) from mm_party_members m where m.party_id = p.id) <= 1;' || chr(10);
      antes := false;
      bloque := '  -- (replanteo 105) ini: los grupos más grandes que el máximo se desarman cuando no están en una sala' || chr(10) ||
                '  perform mm_party_trim(c.max_party_size);' || chr(10) ||
                '  -- (replanteo 105) fin' || chr(10);
    else
      ancla := '  if (select count(*) from game_servers s where s.mm_enabled';
      antes := true;
      bloque := '  -- (replanteo 105) ini: un grupo más grande que el máximo no entra' || chr(10) ||
                '  if v_party is not null and (select count(*) from mm_party_members where party_id = v_party) > (select max_party_size from mm_config) then' || chr(10) ||
                '    raise exception ''Tu grupo es más grande que el máximo actual (%): salgan del grupo para buscar'', (select max_party_size from mm_config);' || chr(10) ||
                '  end if;' || chr(10) ||
                '  -- (replanteo 105) fin' || chr(10);
    end if;
    if position(ancla in f) = 0 then
      raise exception 'replanteo 105: % no tiene el fragmento esperado', fn;
    end if;
    if position(ancla in substr(f, position(ancla in f) + 1)) > 0 then
      raise exception 'replanteo 105: el fragmento de % aparece más de una vez', fn;
    end if;
    f := replace(f, ancla, case when antes then bloque || ancla else ancla || bloque end);
    execute f;
  end loop;
end $$;

commit;
