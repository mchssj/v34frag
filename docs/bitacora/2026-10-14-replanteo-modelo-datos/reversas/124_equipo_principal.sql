-- Inversa del replanteo 124: sin equipo principal. Las listas vuelven a ordenar solo por fecha de ingreso.
begin;

do $$
declare v text; d text;
begin
  foreach v in array array['public.player_overview', 'public.season_standings_list'] loop
    d := pg_get_viewdef(v::regclass, true);
    if position('team_primary_order' in d) = 0 then
      raise exception 'inversa 124: % no usa team_primary_order', v;
    end if;
    d := regexp_replace(d, 'ORDER BY \(*team_primary_order\(tm\.player_id, tm\.team_id\)\)*, ', 'ORDER BY ', 'g');
    execute format('create or replace view %s with (security_invoker = true) as %s', v, d);
  end loop;
end $$;

drop function public.set_my_primary_team(uuid);
drop function public.team_primary_order(uuid, uuid);
drop trigger team_members_primary_clear on public.team_members;
drop function public.tg_team_members_primary_clear();
alter table public.players drop column primary_team_id;

notify pgrst, 'reload schema';
commit;
