-- Inversa del replanteo 54: sin la imagen del MVP. El archivo que quede en el bucket photos (carpeta mm/) se borra a mano.
begin;

drop function if exists pg_temp.reemplazar(regprocedure, text[]);
create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 54: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.mm_lobby_json(uuid, uuid)'::regprocedure, array[
  [$q$'end_reason', l.end_reason, 'region', srv.region, 'mvp_image_url', (select mvp_image_url from mm_config),$q$,
   $q$'end_reason', l.end_reason, 'region', srv.region,$q$]]);

drop function public.mm_mvp_image();
drop function public.mm_admin_set_mvp_image(text);
alter table public.mm_config drop column mvp_image_url;

notify pgrst, 'reload schema';

commit;
