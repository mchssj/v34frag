-- Inversa del replanteo 128 (estadísticas de la temporada). Borra las fotos (season_recaps y season_summaries) y las
-- funciones, y saca el armado del recap de season_close_run.
begin;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 128: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.season_close_run(uuid, uuid)', array[
  [chr(10) || '  perform season_recap_build(s.id);   -- recap y resumen (replanteo 128)', '']]);

drop function public.season_summary_live(uuid);
drop function public.season_recap_live(uuid, uuid);
drop function public.season_recap_build(uuid);
drop function public.season_summary_compute(uuid, timestamptz);
drop function public.season_recap_compute(uuid, timestamptz);
drop function public.season_final_rows(uuid, timestamptz);
drop function public.season_player_totals(timestamptz, timestamptz);
drop function public.season_mix_rows(timestamptz, timestamptz);
drop table public.season_summaries;
drop table public.season_recaps;

notify pgrst, 'reload schema';

commit;
