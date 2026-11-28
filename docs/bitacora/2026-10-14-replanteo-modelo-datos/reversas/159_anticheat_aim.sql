-- Inversa de supabase/replanteo/159_anticheat_aim.sql. Borra las estadÃ­sticas de aim (las marcas que crearon quedan).
begin;
drop function public.ac_aim_report(text, jsonb, text, text);
drop table public.ac_aim_stats;
notify pgrst, 'reload schema';
commit;