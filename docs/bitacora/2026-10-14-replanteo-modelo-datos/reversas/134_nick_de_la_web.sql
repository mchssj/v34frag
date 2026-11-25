-- Inversa de la 134: borra csstv_web_nick. El reporter (2.10.1 en adelante) deja a cada uno con su nombre y anota un error en el log por cada jugador que entra.
begin;
drop function if exists public.csstv_web_nick(text, text);
commit;
