-- Inversa de supabase/replanteo/13_elo_simulacion.sql.
begin;
drop function public.elo_simulate(integer, integer, numeric, integer, integer, integer, integer);
commit;
