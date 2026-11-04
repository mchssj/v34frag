-- Replanteo 62: la imagen del MVP no se podía guardar en staging (2026-11-02, código de seguimiento fe373ca6-…).
-- mm_admin_set_mvp_image (replanteo 54) hacía un UPDATE de mm_config sin WHERE, que pg_safeupdate (cargado para
-- PostgREST) rechaza. Es el mismo error que tuvo mm_set_config el 2026-11-01. La base local no carga pg_safeupdate.
-- Se aplica después de la 54. NO aplicar en producción antes del corte (ver README.md).
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'replanteo 62: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.mm_admin_set_mvp_image(text)', array[
  ['select mvp_image_url into v_old from mm_config for update;', 'select mvp_image_url into v_old from mm_config where id = 1 for update;'],
  ['update mm_config set mvp_image_url = nullif(trim(p_url), '''');', 'update mm_config set mvp_image_url = nullif(trim(p_url), '''') where id = 1;']
]);

commit;
