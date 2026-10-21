-- Inversa de supabase/replanteo/25_ajustes_elo_admin.sql: deja los ajustes de ELO como después de la 24.
-- Los ajustes "fijar" quedan como un ajuste de sumar o restar (su delta). Vuelven recalcular y simular desde la web.
begin;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'elo_adjustments' and column_name = 'set_elo') then
    raise exception 'inversa 25: elo_adjustments no tiene set_elo (¿no se aplicó la 25?)';
  end if;
end $$;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 25: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

drop view public.admin_elo_adjustment_list;
drop view public.player_elo_adjustment_list;
drop function public.elo_adjust_players(uuid[], integer, integer, text);

select pg_temp.reemplazar('public.elo_recompute_all()', array[
  [E'      perform elo_apply_adjustment_row(ev.aid); -- (replanteo 25) suma o fija\n',
   E'      perform elo_apply_adjustment(ev.steam_id, ev.delta);\n']
]);
select pg_temp.reemplazar('public.elo_set_config(integer, integer, numeric, integer, integer, boolean, integer, integer)', array[
  [E'  -- (replanteo 25) recalcular ya no está en la web\n' ||
   E'  if p_recompute and auth.uid() is not null then\n' ||
   E'    raise exception ''Recalcular el ELO ya no está disponible desde la web'';\n' ||
   E'  end if;\n',
   '']
]);
grant execute on function public.elo_recompute_all() to authenticated;
grant execute on function public.elo_simulate(integer, integer, numeric, integer, integer, integer, integer) to authenticated;

-- La de 20261015210000_elo_ajustes.sql.
create or replace function public.elo_remove_adjustment(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare a record;
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede ajustar el ELO' using errcode = '42501';
  end if;
  delete from elo_adjustments where id = p_id returning steam_id, delta into a;
  if not found then
    raise exception 'No existe el ajuste %', p_id using errcode = 'P0002';
  end if;
  perform elo_apply_adjustment(a.steam_id, -a.delta);
end $$;

drop function public.elo_apply_adjustment_row(bigint);
drop function public.elo_apply_set(text, integer);
alter table public.elo_adjustments drop column set_elo;

commit;
