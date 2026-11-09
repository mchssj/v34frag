-- Inversa del replanteo 90 (jugadores verificados): saca la función y las columnas de la insignia.
-- Va después de la inversa de la 91 (profile_wall lee players.verified).
begin;

drop function public.admin_player_verify(uuid, text, text);
drop trigger players_verified_guard on public.players;
drop function public.tg_players_verified_guard();
alter table public.players drop column verified_by, drop column verified_at, drop column verified_note, drop column verified;

notify pgrst, 'reload schema';

commit;
