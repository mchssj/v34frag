-- Inversa de la 142 (desglose de tu ELO). No guarda nada: solo borra la función. Primero, volver la API a la versión anterior.
begin;
drop function if exists public.my_elo_breakdown(integer, integer);
notify pgrst, 'reload schema';
commit;
