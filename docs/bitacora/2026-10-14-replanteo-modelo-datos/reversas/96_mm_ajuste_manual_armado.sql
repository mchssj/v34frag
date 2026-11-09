-- Inversa del replanteo 96 (ajuste manual del armado). Borra los ajustes y su historial: si hace falta, respaldarlos antes
-- (select * from mm_balance_overrides; select * from mm_balance_override_log;).
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'inversa 96: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.mm_tick()', array[
  [E'\n' || '  -- (replanteo 96) el historial de los ajustes manuales del armado se guarda un año' || E'\n' ||
   '  delete from mm_balance_override_log where at < now() - interval ''1 year'';', '']
]);

-- mm_balance_elos como la dejó el replanteo 73
create or replace function public.mm_balance_elos(p_players uuid[], p_elos integer[]) returns integer[]
  language sql stable security definer set search_path = public as $$
  select case when not c.balance_rating then null else array(
    select e.elo + case
             when r.rating is null or r.maps + c.balance_rating_prior_maps = 0 then 0
             else greatest(-c.balance_rating_cap, least(c.balance_rating_cap, round(c.balance_rating_weight *
                    ((r.maps * r.rating + c.balance_rating_prior_maps) / (r.maps + c.balance_rating_prior_maps) - 1))))::int
           end
      from unnest(p_players, p_elos) with ordinality e(player_id, elo, o)
      left join player_recent_rating(p_players, c.balance_rating_days) r on r.player_id = e.player_id
     order by e.o) end
    from mm_config c
$$;
revoke all on function public.mm_balance_elos(uuid[], integer[]) from public, anon, authenticated;
comment on function public.mm_balance_elos(uuid[], integer[]) is
  'ELO de armado de cada ficha, en el mismo orden: ELO + peso × (rating corregido − 1,00), con tope. Null con balance_rating apagado. Replanteo 73';

drop view public.mm_balance_overrides_active;
drop function public.mm_balance_override_clear(uuid, text, text);
drop function public.mm_balance_override_set(uuid, integer, text, text, integer);
drop table public.mm_balance_overrides;   -- se lleva el trigger
drop function public.tg_mm_balance_override_log();
drop table public.mm_balance_override_log;

commit;
