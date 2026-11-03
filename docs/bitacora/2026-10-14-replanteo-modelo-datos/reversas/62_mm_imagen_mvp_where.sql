-- Inversa del replanteo 62: vuelve a mm_admin_set_mvp_image sin WHERE (como en la 54). Con pg_safeupdate falla otra vez.
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'inversa 62: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.mm_admin_set_mvp_image(text)', array[
  ['select mvp_image_url into v_old from mm_config where id = 1 for update;', 'select mvp_image_url into v_old from mm_config for update;'],
  ['update mm_config set mvp_image_url = nullif(trim(p_url), '''') where id = 1;', 'update mm_config set mvp_image_url = nullif(trim(p_url), '''');']
]);

commit;
