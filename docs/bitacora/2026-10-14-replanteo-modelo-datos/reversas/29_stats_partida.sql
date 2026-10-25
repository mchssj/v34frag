-- Inversa de supabase/replanteo/29_stats_partida.sql: borra las vistas de clutches.
-- Las columnas que la 29 sumó al final de live_match_players y player_stats quedan: create or replace no deja
-- sacarlas, y borrar esas vistas obligaría a recrear las que dependen de ellas (mix_list, player_overview…).
-- No molestan: nadie las lee sin la API nueva.
begin;

drop view public.match_clutch_data;
drop view public.player_clutches;
drop view public.match_clutches;

commit;
