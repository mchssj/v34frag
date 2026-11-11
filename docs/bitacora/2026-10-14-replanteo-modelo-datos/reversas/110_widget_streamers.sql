-- Inversa de la 110: borra widget_player. No toca datos.

begin;

drop function if exists public.widget_player(uuid, text, timestamptz);

commit;
