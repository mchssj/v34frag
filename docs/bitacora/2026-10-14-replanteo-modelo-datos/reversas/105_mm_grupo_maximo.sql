-- Inversa de la 105: mm_set_config, mm_tick y mm_join sin los bloques de la 105, y sin mm_party_trim.
-- Los grupos que se desarmaron no vuelven.

begin;

do $$
declare
  fn text;
  f text;
  ini int;
  fin int;
  marca_ini text := '  -- (replanteo 105) ini';
  marca_fin text := '  -- (replanteo 105) fin' || chr(10);
begin
  foreach fn in array array['mm_set_config(jsonb)', 'mm_tick()', 'mm_join(text,text)'] loop
    f := pg_get_functiondef(('public.' || fn)::regprocedure);
    ini := position(marca_ini in f);
    fin := position(marca_fin in f);
    if ini = 0 or fin = 0 or fin < ini then
      raise exception 'inversa 105: % no tiene el bloque de la 105', fn;
    end if;
    f := left(f, ini - 1) || substr(f, fin + length(marca_fin));
    if position('replanteo 105' in f) > 0 then raise exception 'inversa 105: quedaron restos en %', fn; end if;
    execute f;
  end loop;
end $$;

drop function public.mm_party_trim(int);

commit;
