-- Replanteo 58: !claim de un SteamID nuevo sin esperar al admin (plan docs/bitacora/2026-11-02-claim-varios-steamid, opción A).
--   1. claim_with_code: una ficha que ya tiene SteamID suma el nuevo al instante (si no es de otra ficha y no pasó el
--      máximo por ficha). A los admins les llega admin_steam_linked para revisarlo después. Al llegar al máximo, sigue
--      siendo un pedido al admin. Los pedidos pendientes de antes quedan como están.
--   2. Salas del matchmaking: el plantel (csstv_mm_poll) y los avisos del servidor (csstv_mm_report) con todos los SteamID
--      de cada ficha, no solo el principal. Las reservas de torneo y PCW ya los usaban.
-- Se aplica después de la 57. NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regprocedure('public.csstv_mm_poll(text, text, text)') is null then
    raise exception 'replanteo 58: falta csstv_mm_poll de tres parámetros (aplicar antes 56_iniciar_torneo_pcw.sql)';
  end if;
  if position('admin_steam_linked' in pg_get_functiondef('public.claim_with_code(text, text, text, text)'::regprocedure)) > 0 then
    raise exception 'replanteo 58: claim_with_code ya avisa admin_steam_linked (¿ya se aplicó?)';
  end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 58: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- 1. El SteamID nuevo se suma al instante.
select pg_temp.reemplazar('public.claim_with_code(text, text, text, text)', array[
  [$q$          insert into steam_requests(player_id, user_id, steam_id, nick, server_id) values (acc.id, c.user_id, s64, v_nick, t.sid);
          res := jsonb_build_object('ok', true, 'pending', true, 'message', 'Pedido enviado: un admin lo tiene que aprobar');$q$,
   $q$          -- (replanteo 58) Con un código válido se suma al instante; los admins lo revisan después.
          if steam_attach(s64, acc.id, null) then perform elo_recompute_all(); end if;
          v_player := acc.id;
          perform notify(notify_admin_ids(), 'admin_steam_linked',
            jsonb_build_object('player', player_ref(acc.id), 'steam_id', s64, 'nick', v_nick));
          res := jsonb_build_object('ok', true, 'pending', false, 'message', 'Listo: sumamos este SteamID a tu ficha');$q$]
]);

-- 2. Plantel y avisos de la sala con todos los SteamID de la ficha.
select pg_temp.reemplazar('public.csstv_mm_poll(text, text, text)', array[
  [$q$'t1=' || coalesce((select string_agg(csstv_steam2(p.steam_id), ',') from mm_lobby_players lp join players p on p.id = lp.player_id where lp.lobby_id = l.id and lp.team = 1), '')$q$,
   $q$'t1=' || coalesce((select string_agg(csstv_steam2(x.steam_id), ',') from mm_lobby_players lp join player_steam_all x on x.player_id = lp.player_id where lp.lobby_id = l.id and lp.team = 1), '')$q$],
  [$q$'t2=' || coalesce((select string_agg(csstv_steam2(p.steam_id), ',') from mm_lobby_players lp join players p on p.id = lp.player_id where lp.lobby_id = l.id and lp.team = 2), '')$q$,
   $q$'t2=' || coalesce((select string_agg(csstv_steam2(x.steam_id), ',') from mm_lobby_players lp join player_steam_all x on x.player_id = lp.player_id where lp.lobby_id = l.id and lp.team = 2), '')$q$]
]);
select pg_temp.reemplazar('public.csstv_mm_report(text, uuid, text, text)', array[
  [$q$csstv_steam2(p.steam_id) = p_data$q$,
   $q$exists (select 1 from player_steam_all x where x.player_id = p.id and csstv_steam2(x.steam_id) = p_data)$q$]
]);

-- 3. El aviso nuevo, en la categoría de los admins.
create or replace function public.notification_category(p_type text) returns text language sql immutable as $$
  select case
    when p_type in ('team_invite', 'team_join_request', 'team_invite_answered', 'team_join_answered', 'team_captain', 'team_removed',
                    'team_member_left', 'team_role_changed', 'team_added', 'team_deleted', 'team_request_answered',
                    'team_dissolved') then 'team' -- (replanteo 39) team_dissolved
    when p_type in ('event_registration', 'event_fixture', 'match_scheduled', 'veto_turn', 'veto_done', 'veto_reset',
                    'match_result', 'event_progress', 'event_cancelled', 'event_lineup', 'match_soon',
                    'match_server_ready', 'booking_attention') then 'tournament' -- (replanteo 35) match_soon; (replanteo 56) reservas
    when p_type in ('pcw_accepted', 'pcw_cancelled', 'pcw_result', 'pcw_soon', 'pcw_expired',
                    'pcw_server_ready', 'pcw_abandoned') then 'pcw' -- (replanteo 35) pcw_soon y pcw_expired; (replanteo 56) reservas
    when p_type in ('level_changed', 'mix_review_resolved', 'mix_deleted', 'elo_adjusted', 'clip_ready') then 'elo'
    when p_type in ('season_ranked', 'season_closed', 'medal_granted', 'season_ending') then 'season' -- (replanteo 35) season_ending
    when p_type in ('steam_claimed', 'steam_request_answered', 'alias_changed', 'role_changed', 'password_changed',
                    'vip_granted', 'vip_revoked', 'vip_expiring',
                    'streamer_granted', 'streamer_revoked') then 'account' -- (replanteo 36) streamer_granted y streamer_revoked
    when p_type in ('event_new', 'season_started') then 'news'
    when p_type in ('admin_steam_request', 'admin_team_request', 'admin_mix_review', 'admin_demo_failed', 'admin_season_delayed',
                    'match_no_result', 'admin_steam_linked') then 'admin' -- (replanteo 35) match_no_result; (replanteo 58) admin_steam_linked
  end $$;

notify pgrst, 'reload schema';

commit;
