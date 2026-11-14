-- 116: ver una sala del matchmaking como admin (bitácora docs/bitacora/2026-11-14-mm-admin-ver-sala, Kyan 2026-11-14).
--
--   mm_admin_lobby(p_lobby): la sala completa, igual que la ve un jugador (mm_lobby_json), para Administración ›
--   Matchmaking › Salas › "Ver sala". Deja el servidor (dirección y contraseña: el admin puede entrar a moderar) y saca
--   lo que es del que mira como jugador (reportes, elogio y el ELO en juego). null si la sala no existe.
-- Necesita la 48 (mm_lobby_json, mm_admin_guard). Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/116_mm_admin_sala.sql.
begin;

create or replace function public.mm_admin_lobby(p_lobby uuid) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
begin
  perform mm_admin_guard();
  return mm_lobby_json(p_lobby, auth.uid()) - 'reported' - 'commended' - 'elo_stake';
end $$;
revoke all on function public.mm_admin_lobby(uuid) from public, anon;
grant execute on function public.mm_admin_lobby(uuid) to authenticated;
comment on function public.mm_admin_lobby(uuid) is 'La sala completa de un lobby del matchmaking para un admin (Salas › Ver sala). Replanteo 116';

commit;
