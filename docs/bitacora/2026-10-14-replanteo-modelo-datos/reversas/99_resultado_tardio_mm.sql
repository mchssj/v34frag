-- Inversa de la 99: csstv_link_game vuelve a vincular solo partidas madre upcoming/live.

begin;

do $$
declare
  f text;
  ini int;
  fin int;
  marca_ini text := '  -- (replanteo 99) Resultado tardío';
  marca_fin text := '  end if;   -- (replanteo 99)' || chr(10);
begin
  f := pg_get_functiondef('public.csstv_link_game'::regproc);
  ini := position(marca_ini in f);
  fin := position(marca_fin in f);
  if ini = 0 or fin = 0 or fin < ini then
    raise exception 'inversa 99: csstv_link_game no tiene el bloque de la 99';
  end if;
  f := left(f, ini - 1) || substr(f, fin + length(marca_fin));
  if position('replanteo 99' in f) > 0 then raise exception 'inversa 99: quedaron restos'; end if;
  execute f;
end $$;

commit;
