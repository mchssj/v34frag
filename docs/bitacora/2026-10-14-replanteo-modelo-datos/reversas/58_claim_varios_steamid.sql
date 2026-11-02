-- Inversa del replanteo 58: el SteamID nuevo vuelve a ser un pedido al admin y el plantel del matchmaking, solo el principal.
-- Los SteamID que ya se sumaron al instante quedan sumados.
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 58: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.claim_with_code(text, text, text, text)', array[
  [$q$          -- (replanteo 58) Con un código válido se suma al instante; los admins lo revisan después.
          if steam_attach(s64, acc.id, null) then perform elo_recompute_all(); end if;
          v_player := acc.id;
          perform notify(notify_admin_ids(), 'admin_steam_linked',
            jsonb_build_object('player', player_ref(acc.id), 'steam_id', s64, 'nick', v_nick));
          res := jsonb_build_object('ok', true, 'pending', false, 'message', 'Listo: sumamos este SteamID a tu ficha');$q$,
   $q$          insert into steam_requests(player_id, user_id, steam_id, nick, server_id) values (acc.id, c.user_id, s64, v_nick, t.sid);
          res := jsonb_build_object('ok', true, 'pending', true, 'message', 'Pedido enviado: un admin lo tiene que aprobar');$q$]
]);
select pg_temp.reemplazar('public.csstv_mm_poll(text, text, text)', array[
  [$q$'t1=' || coalesce((select string_agg(csstv_steam2(x.steam_id), ',') from mm_lobby_players lp join player_steam_all x on x.player_id = lp.player_id where lp.lobby_id = l.id and lp.team = 1), '')$q$,
   $q$'t1=' || coalesce((select string_agg(csstv_steam2(p.steam_id), ',') from mm_lobby_players lp join players p on p.id = lp.player_id where lp.lobby_id = l.id and lp.team = 1), '')$q$],
  [$q$'t2=' || coalesce((select string_agg(csstv_steam2(x.steam_id), ',') from mm_lobby_players lp join player_steam_all x on x.player_id = lp.player_id where lp.lobby_id = l.id and lp.team = 2), '')$q$,
   $q$'t2=' || coalesce((select string_agg(csstv_steam2(p.steam_id), ',') from mm_lobby_players lp join players p on p.id = lp.player_id where lp.lobby_id = l.id and lp.team = 2), '')$q$]
]);
select pg_temp.reemplazar('public.csstv_mm_report(text, uuid, text, text)', array[
  [$q$exists (select 1 from player_steam_all x where x.player_id = p.id and csstv_steam2(x.steam_id) = p_data)$q$,
   $q$csstv_steam2(p.steam_id) = p_data$q$]
]);
select pg_temp.reemplazar('public.notification_category(text)', array[
  [$q$'match_no_result', 'admin_steam_linked') then 'admin' -- (replanteo 35) match_no_result; (replanteo 58) admin_steam_linked$q$,
   $q$'match_no_result') then 'admin' -- (replanteo 35) match_no_result$q$]
]);

notify pgrst, 'reload schema';

commit;
