-- 101: la ficha de la sala vuelve a decir quién soy (bitácora docs/bitacora/2026-11-09-sala-sin-is-me, Daniel 2026-11-09).
--
-- La 94 agregó 'verified' a mm_player_card con un comentario "-- (replanteo 94)" en medio de la línea: el resto
-- ('is_me', 'linked' y 'country') quedó comentado. Sin is_me, en la sala nadie era capitán para la web (no se podía
-- vetar) ni tenía equipo (dos chats generales); sin linked, no aparecía el aviso del !claim.
-- Necesita la 94. Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/101_mm_ficha_is_me.sql.
begin;

do $$
begin
  if position($q$'verified', p.verified, -- (replanteo 94) 'is_me'$q$
              in pg_get_functiondef('public.mm_player_card(uuid, uuid, mm_lobby_players)'::regprocedure)) = 0 then
    raise exception 'replanteo 101: mm_player_card no tiene la línea cortada de la 94 (¿ya se aplicó?)';
  end if;
end $$;

do $$
declare d text := pg_get_functiondef('public.mm_player_card(uuid, uuid, mm_lobby_players)'::regprocedure);
begin
  execute replace(d, $q$'verified', p.verified, -- (replanteo 94) 'is_me'$q$,
                     $q$'verified', p.verified, 'is_me'$q$);  -- create or replace: los permisos quedan
end $$;

commit;
