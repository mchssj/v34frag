-- Inversa del replanteo 65: borra manual_valores(). La API sigue con los valores por defecto de su catálogo.
begin;
drop function if exists public.manual_valores();
commit;
