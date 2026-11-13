-- Inversa de la 113: borra csstv_web_nick. El reporter 2.12.0 deja a cada uno con su nombre de Steam (la base responde 404).
begin;
drop function if exists public.csstv_web_nick(text, text);
commit;
