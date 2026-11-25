-- Inversa de la 141 (buscador avanzado y tarjeta). Borra las búsquedas guardadas. Primero, volver la API a la versión anterior.
begin;
drop function if exists public.saved_search_save(text, text, jsonb);
drop function if exists public.saved_search_delete(uuid);
drop table if exists public.saved_searches;
drop function if exists public.player_card(uuid, timestamptz);
drop function if exists public.match_search(jsonb, text, text, integer, integer);
drop view if exists public.season_standings_search;
drop view if exists public.player_ranking_search;
drop view if exists public.player_filters;
notify pgrst, 'reload schema';
commit;
