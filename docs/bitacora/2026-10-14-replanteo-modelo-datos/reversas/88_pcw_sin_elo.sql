-- Inversa del replanteo 88 (las PCW no dan ELO).
-- Saca el trigger y deja elo_apply_match y elo_recompute_all como estaban. Si hay mapas de PCW terminados, recalcula
-- todo el ELO para que vuelvan a contar.
begin;

drop trigger matches_elo_pcw_link on public.matches;
drop function public.elo_pcw_link();

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 88: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.elo_apply_match(uuid)', array[
  [E'  -- (replanteo 88) los mapas de una PCW no dan ELO\n' ||
   E'  if exists (select 1 from matches g join matches p on p.id = g.parent_match_id where g.id = p_match and p.kind = ''pcw'') then return; end if;\n',
   '']
]);

select pg_temp.reemplazar('public.elo_recompute_all()', array[
  [' and current_setting(''v34.elo_pcw_link'', true) is distinct from ''on'' then -- (replanteo 88)', ' then']
]);

do $$
begin
  if exists (select 1 from matches g join matches p on p.id = g.parent_match_id
              where p.kind = 'pcw' and g.kind = 'mix' and g.status = 'finished') then
    perform elo_recompute_all();
  end if;
end $$;

commit;
