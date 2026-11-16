-- 125: el que abandonó y ya fue reemplazado puede volver a buscar partida (bitácora
-- docs/bitacora/2026-11-16-reemplazado-puede-buscar/, Daniel 2026-11-16).
--
-- mm_active_lobby contaba cualquier fila del jugador en una sala sin terminar, también la del que abandonó y ya tiene
-- reemplazo (replaced_by). La web le mostraba esa sala en "Jugar" y la cola no lo dejaba entrar hasta que terminara la
-- partida (pasó con nachinn el 2026-11-16). Ahora no cuentan las filas con replaced_by: su sanción y su ELO siguen igual.
-- El que abandonó sin reemplazo sigue atado a la sala, como antes.
-- Inversa en docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/125_mm_reemplazado_puede_buscar.sql.

begin;

do $$
begin
  if pg_get_functiondef('public.mm_active_lobby(uuid)'::regprocedure) like '%replaced_by%' then
    raise exception 'replanteo 125: ya se aplicó (mm_active_lobby ya mira replaced_by)';
  end if;
end $$;

create or replace function public.mm_active_lobby(p_user uuid) returns uuid
  language sql stable as $$
  select l.id from mm_lobby_players lp join mm_lobbies l on l.id = lp.lobby_id
   where lp.user_id = p_user and lp.replaced_by is null and l.status not in ('finished', 'cancelled')
   order by l.created_at desc limit 1 $$;
comment on function public.mm_active_lobby(uuid) is 'La sala abierta del jugador; sin las que abandonó y ya tienen reemplazo (replanteo 125)';

notify pgrst, 'reload schema';

commit;
