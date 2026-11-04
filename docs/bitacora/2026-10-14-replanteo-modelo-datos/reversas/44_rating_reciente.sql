-- Inversa de supabase/replanteo/44_rating_reciente.sql.
begin;
drop function if exists public.player_recent_rating(uuid[], integer);
commit;
