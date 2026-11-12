-- Inversa del replanteo 92 (repetición 2D y mapa de calor). Borra las kills con posición y las rutas de los .trk
-- (los archivos en R2 quedan: se borran con su regla de vencimiento o a mano).
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'inversa 92: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.csstv_after_ingest(uuid, jsonb, text)', array[
  array[$q$
  -- Kills con posición para el mapa de calor (replanteo 92)
  perform csstv_kills_save(p_match, p);$q$, '']]);

drop function public.player_heatmap(uuid, text, text, integer);
drop function public.track_mark(text, text, text);
drop function public.csstv_kills_save(uuid, jsonb);
alter table public.matches drop column track_key;
drop table public.match_kills;

commit;
