-- Inversa de supabase/replanteo/34_elo_por_ficha.sql: sumar o quitar un SteamID vuelve a recalcular el ELO de todos.
-- El ELO que ya se recalculó por ficha queda como está (un elo_recompute_all lo deja exacto).
begin;

do $$
begin
  if to_regprocedure('public.elo_recompute_player(text, text[])') is null then
    raise exception 'inversa 34: no existe elo_recompute_player (¿no se aplicó la 34?)';
  end if;
end $$;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 34: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.approve_steam_request(bigint)', array[
  ['    perform steam_detach_elo(r.steam_id); -- (replanteo 34) solo esa ficha',
   '    if steam_detach(r.steam_id) then perform elo_recompute_all(); end if;'],
  ['  if steam_attach(r.steam_id, r.player_id, auth.uid()) then perform elo_after_attach(r.steam_id); end if; -- (replanteo 34)',
   '  if steam_attach(r.steam_id, r.player_id, auth.uid()) then perform elo_recompute_all(); end if;']
]);
select pg_temp.reemplazar('public.link_steam_id(text, uuid)', array[
  ['    perform steam_detach_elo(s64); -- (replanteo 34) solo esa ficha',
   '    if steam_detach(s64) then perform elo_recompute_all(); end if;'],
  ['  if steam_attach(s64, p_player, auth.uid()) then perform elo_after_attach(s64); end if; -- (replanteo 34)',
   '  if steam_attach(s64, p_player, auth.uid()) then perform elo_recompute_all(); end if;']
]);
select pg_temp.reemplazar('public.admin_remove_steam(text)', array[
  ['  perform steam_detach_elo(p_steam); -- (replanteo 34) solo esa ficha',
   '  if steam_detach(p_steam) then perform elo_recompute_all(); end if;']
]);

drop function public.steam_detach_elo(text);
drop function public.elo_after_attach(text);
drop function public.elo_recompute_player(text, text[]);
drop function public.elo_season_event_key(uuid, boolean, text);

commit;
