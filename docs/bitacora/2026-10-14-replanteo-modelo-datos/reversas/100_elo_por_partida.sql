-- Inversa de la 100: vuelve la fórmula anterior (TrueSkill + bonus, con el mínimo de la 98), base y mínimo de antes.
-- Después, elo_recompute_all() para devolver los mixes al cálculo anterior.

begin;

do $$
declare r record;
begin
  if (select count(*) from public.replanteo100_funciones where nombre <> 'elo_config') <> 4 then
    raise exception 'inversa 100: falta el respaldo de alguna función';
  end if;
  drop function public.elo_set_config(integer, integer, numeric, integer, integer, boolean, integer, integer, numeric, numeric, numeric, numeric, integer, integer);
  for r in select nombre, def from public.replanteo100_funciones where nombre <> 'elo_config' loop
    execute r.def;
  end loop;
  update public.elo_config c
     set base = (f.extra->>'base')::int, min_delta = (f.extra->>'min_delta')::int
    from public.replanteo100_funciones f
   where c.id = 1 and f.nombre = 'elo_config';
end $$;
revoke all on function public.elo_set_config(integer, integer, numeric, integer, integer, boolean, integer, integer) from public;
grant execute on function public.elo_set_config(integer, integer, numeric, integer, integer, boolean, integer, integer) to anon, authenticated, service_role;

drop trigger match_player_stats_elo_clear_extra on public.match_player_stats;
drop function public.tg_mps_elo_clear_extra();
alter table public.match_player_stats drop column elo_mult, drop column elo_scale;
alter table public.elo_config
  drop column mult_win_min, drop column mult_win_max, drop column mult_loss_min, drop column mult_loss_max,
  drop column team_cap, drop column formula_from;
drop table public.replanteo100_funciones;

commit;
