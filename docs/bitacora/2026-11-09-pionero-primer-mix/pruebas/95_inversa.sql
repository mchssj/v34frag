-- Inversa del replanteo 95: las tres funciones como en la 79 y sin medal_exclusions.
-- No quita las Pionero ya dadas: si hace falta, borrarlas aparte (player_medals con la definición pionero y source = 'auto').
begin;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 95: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.medal_metric_values(text,text,jsonb,uuid[])', array[
  ['where m.status = ''finished'' and m.kind = ''mix'' order by coalesce(m.played_at, m.starts_at), m.id limit 1 /* (replanteo 95) */',
   'where m.status = ''finished'' order by coalesce(m.played_at, m.starts_at), m.id limit 1']]);

select pg_temp.reemplazar('public.medals_award(uuid[],uuid[])', array[
  ['where v.value is not null and v.value >= d.target
       and not exists (select 1 from medal_exclusions x where x.player_id = v.player_id and x.definition_id = d.id) /* (replanteo 95) */',
   'where v.value is not null and v.value >= d.target']]);

select pg_temp.reemplazar('public.medal_progress(uuid)', array[
  ['select d.id, case when exists (select 1 from medal_exclusions x where x.player_id = p_player and x.definition_id = d.id) then 0 /* (replanteo 95) */
               else coalesce((select v.value from medal_metric_values(d.metric, d.aggregation, d.filters, array[p_player]) v), 0) end',
   'select d.id, coalesce((select v.value from medal_metric_values(d.metric, d.aggregation, d.filters, array[p_player]) v), 0)']]);

drop table public.medal_exclusions;

commit;
