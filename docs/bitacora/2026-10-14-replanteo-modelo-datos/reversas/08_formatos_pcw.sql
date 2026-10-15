-- Inversa de supabase/replanteo/08_formatos_pcw.sql.
-- Saca la configuración de formatos de PCW: create_pcw_post vuelve a aceptar BO1, BO3 y BO5 sin restricción.
begin;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $f$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 08: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $f$;

select pg_temp.reemplazar('public.create_pcw_post(text, integer, text, timestamp with time zone, text, uuid[], text[])', array[
  [E'if p_best_of not in (1, 3, 5) then raise exception ''El formato tiene que ser BO1, BO3 o BO5''; end if;\n  -- (replanteo 08) solo los formatos que habilitó el admin\n  if not exists (select 1 from pcw_config c where c.id = 1 and p_best_of = any(c.best_of)) then\n    raise exception ''El formato BO% no está habilitado para las PCW'', p_best_of;\n  end if;',
   'if p_best_of not in (1, 3, 5) then raise exception ''El formato tiene que ser BO1, BO3 o BO5''; end if;']
]);

drop function public.set_pcw_formats(int[]);
drop table public.pcw_config;

commit;
