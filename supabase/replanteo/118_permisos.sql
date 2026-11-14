-- 118 (antes 114): los permisos de producción vuelven a ser los de las migraciones (bitácora docs/bitacora/2026-11-12-permisos-funciones/).
--
-- La mudanza al VPS (2026-11-03, deploy/supabase/migrar-vps.sh) cargó el esquema de public en un Supabase nuevo, donde
-- cada objeto recibe permisos por defecto para anon y authenticated, y el volcado no traía los revoke. Quedaron
-- 332 funciones que anon o authenticated pueden ejecutar por la API aunque las migraciones se lo quitan (entre ellas
-- season_close_run y csstv_after_ingest) y 75 tablas y vistas con permisos de más (las protege la RLS, pero no se dejan).
--
-- Generado por docs/bitacora/2026-11-12-permisos-funciones/pruebas/generar_114.py desde la comparación con una base
-- armada desde cero con las migraciones (comparar.sh). Solo quita lo que sobra: no da ningún permiso.
-- No toca datos ni definiciones. Se puede aplicar con mixes en curso.

begin;

do $$
declare v text; faltan text[] := '{}';
begin
  foreach v in array array[
    'public.ac_admin_chain(uuid)',
    'public.ac_admin_hold(uuid,boolean)',
    'public.ac_admin_record_integrity(uuid,text,jsonb)',
    'public.ac_admin_request_capture(uuid,text)',
    'public.ac_admin_session_evidence(uuid)',
    'public.ac_admin_sessions(text,integer,integer)',
    'public.ac_can_review()',
    'public.ac_device_of(text,text)',
    'public.ac_device_revoke(uuid)',
    'public.ac_hash(text)',
    'public.ac_link_approve(text)',
    'public.ac_require_api(text)',
    'public.ac_retention_delete(uuid)',
    'public.ac_retention_due(integer)',
    'public.ac_retention_paths(uuid)',
    'public.ac_session_accepts(uuid,uuid,timestamp with time zone)',
    'public.ac_set_open(integer)',
    'public.ac_token(text)',
    'public.ac_user_code()',
    'public.admin_create_demo_worker(text)',
    'public.admin_create_server(text,text,text,timestamp with time zone,text,text,text,integer)',
    'public.admin_delete_mix(uuid,text)',
    'public.admin_demo_retry(uuid)',
    'public.admin_grant_streamer(uuid)',
    'public.admin_name_blocked(text)',
    'public.admin_pcw_bans(boolean,text,text,text,integer,integer)',
    'public.admin_player_ips(uuid)',
    'public.admin_regenerate_hud_key(uuid)',
    'public.admin_remove_steam(text)',
    'public.admin_revoke_streamer(uuid)',
    'public.admin_set_primary_steam(text)',
    'public.admin_set_server_hud(uuid,integer,boolean)',
    'public.admin_users(text)',
    'public.admin_vip_grant(uuid,integer,timestamp with time zone,boolean,text)',
    'public.admin_vip_revoke(uuid,text)',
    'public.approve_steam_request(bigint)',
    'public.ban_active_for(text)',
    'public.ban_create(uuid,text,text,timestamp with time zone)',
    'public.ban_insert(uuid,text,text,text,timestamp with time zone,text,uuid,text,text,uuid)',
    'public.ban_lift(uuid,text)',
    'public.ban_steams(uuid,text)',
    'public.ban_unix(timestamp with time zone)',
    'public.ban_update(uuid,text,timestamp with time zone,boolean)',
    'public.blocked_names_hits()',
    'public.booking_abandon(uuid,integer,text)',
    'public.booking_after_veto(uuid)',
    'public.booking_assign(uuid)',
    'public.booking_close(uuid,text,text)',
    'public.booking_emit(uuid)',
    'public.booking_enqueue(uuid,boolean)',
    'public.booking_map(uuid)',
    'public.booking_on_match()',
    'public.booking_poll_text(uuid)',
    'public.booking_report(uuid,uuid,text,text)',
    'public.booking_start_wait(uuid,interval)',
    'public.booking_tick()',
    'public.booking_title(uuid)',
    'public.booking_users(uuid)',
    'public.cancel_steam_unlink(text)',
    'public.clip_force(uuid)',
    'public.clip_reprocess(uuid)',
    'public.clip_review_ok(uuid)',
    'public.clip_set_config(jsonb,integer,integer,integer,integer,integer,integer)',
    'public.clip_unforce(uuid)',
    'public.create_claim_code()',
    'public.create_pcw_post(text,integer,text,timestamp with time zone,text,uuid[],text[],uuid,text[])',
    'public.create_render_worker_token(text)',
    'public.csstv_after_ingest(uuid,jsonb,text)',
    'public.csstv_clips_save(uuid,jsonb)',
    'public.csstv_ip(text)',
    'public.csstv_jcounts(jsonb)',
    'public.csstv_jint_null(jsonb,text,integer)',
    'public.csstv_link_game(uuid,text,integer)',
    'public.csstv_link_game_base(uuid,text,integer)',
    'public.csstv_live_upsert(uuid,text,jsonb)',
    'public.csstv_match_extra(uuid,jsonb)',
    'public.elo_add_adjustment(text[],integer,text,timestamp with time zone)',
    'public.elo_adjust_players(uuid[],integer,integer,text)',
    'public.elo_after_attach(text)',
    'public.elo_apply_adjustment(text,integer)',
    'public.elo_apply_adjustment_row(bigint)',
    'public.elo_apply_set(text,integer)',
    'public.elo_crash_apply(uuid)',
    'public.elo_crash_discard(uuid)',
    'public.elo_recompute_all()',
    'public.elo_recompute_player(text,text[])',
    'public.elo_remove_adjustment(bigint)',
    'public.elo_season_event(uuid,boolean)',
    'public.elo_season_event_key(uuid,boolean,text)',
    'public.elo_simulate(integer,integer,numeric,integer,integer,integer,integer)',
    'public.event_build_double(uuid,uuid[],jsonb)',
    'public.event_build_group_double(uuid,uuid[],jsonb)',
    'public.event_build_groups(uuid,uuid[],jsonb)',
    'public.event_build_ko(uuid,uuid[],integer,jsonb)',
    'public.event_draw(uuid)',
    'public.event_engine_on()',
    'public.event_generate(uuid)',
    'public.event_group_double_team(uuid,integer,integer)',
    'public.event_group_qualifiers(uuid)',
    'public.event_progress(uuid)',
    'public.event_propagate_dead(uuid)',
    'public.event_ref(uuid)',
    'public.event_register(uuid,uuid,uuid[],uuid[],integer)',
    'public.event_reset(uuid)',
    'public.event_resolve_tie(uuid,integer,uuid[])',
    'public.event_seed_ranking(uuid)',
    'public.event_set_result(uuid,jsonb,uuid,boolean)',
    'public.event_swiss_phase(uuid,integer)',
    'public.event_swiss_round(uuid,integer)',
    'public.event_unregister(uuid,uuid)',
    'public.event_unroute(uuid)',
    'public.handle_password_change()',
    'public.hud_new_key()',
    'public.hud_streamer_new_token()',
    'public.hud_streaming(uuid)',
    'public.live_match_close(text)',
    'public.manual_valores()',
    'public.map_pool_check(text[],text[],integer)',
    'public.match_booking_action(uuid,text,integer,integer)',
    'public.match_booking_release(uuid)',
    'public.match_can_connect(uuid)',
    'public.match_clips_video_guard()',
    'public.match_link_code(uuid)',
    'public.match_my_side(uuid)',
    'public.match_ref(uuid)',
    'public.match_roster(uuid,uuid)',
    'public.match_schedule(uuid,timestamp with time zone,uuid)',
    'public.match_series_maps(uuid)',
    'public.match_set_maps(uuid,jsonb)',
    'public.match_side_users(uuid,integer)',
    'public.match_start(uuid,uuid,integer)',
    'public.match_users(uuid)',
    'public.matches_pcw_ban_guard()',
    'public.mix_users(uuid)',
    'public.mm_accept()',
    'public.mm_active_lobby(uuid)',
    'public.mm_add_friend(uuid)',
    'public.mm_admin_cancel(uuid,text)',
    'public.mm_admin_config()',
    'public.mm_admin_guard()',
    'public.mm_admin_lift_penalty(uuid,text)',
    'public.mm_admin_lists(text,text)',
    'public.mm_admin_resolve_report(uuid,text,integer)',
    'public.mm_admin_rotate_password(uuid)',
    'public.mm_admin_set_mvp_image(text)',
    'public.mm_admin_sound_add(text,text)',
    'public.mm_admin_sound_delete(uuid)',
    'public.mm_admin_sounds()',
    'public.mm_admin_unban(uuid)',
    'public.mm_after_claim(uuid)',
    'public.mm_assign_server(uuid)',
    'public.mm_ban_map(uuid,text,uuid)',
    'public.mm_best_split(uuid[],integer[],uuid[],integer)',
    'public.mm_block(uuid)',
    'public.mm_block_reason(uuid)',
    'public.mm_cancel_lobby(uuid,text,boolean)',
    'public.mm_commend(uuid,uuid)',
    'public.mm_decline()',
    'public.mm_delete_my_sound()',
    'public.mm_elo_abandoned(uuid,text)',
    'public.mm_elo_delta(uuid,text,integer,double precision,double precision,integer)',
    'public.mm_elo_stake(uuid,uuid)',
    'public.mm_elo_window(numeric)',
    'public.mm_emit(text,uuid,uuid[],jsonb)',
    'public.mm_ensure_player(uuid)',
    'public.mm_free_server(text[])',
    'public.mm_friend_users(uuid)',
    'public.mm_game_stats(uuid,uuid)',
    'public.mm_join(text,text)',
    'public.mm_leave()',
    'public.mm_lobby_json(uuid,uuid)',
    'public.mm_lobby_match(uuid)',
    'public.mm_lobby_users(uuid)',
    'public.mm_logout()',
    'public.mm_meetings(uuid,uuid,boolean)',
    'public.mm_mvp_image()',
    'public.mm_my_live(boolean)',
    'public.mm_my_profile()',
    'public.mm_my_state()',
    'public.mm_my_team(uuid)',
    'public.mm_new_password(integer)',
    'public.mm_party_clear_queue(uuid)',
    'public.mm_party_detach(uuid)',
    'public.mm_party_invite(uuid)',
    'public.mm_party_kick(uuid)',
    'public.mm_party_leave()',
    'public.mm_party_promote(uuid)',
    'public.mm_party_respond(uuid,boolean)',
    'public.mm_penalize(uuid,text)',
    'public.mm_player_card(uuid,uuid,mm_lobby_players)',
    'public.mm_player_elo(uuid)',
    'public.mm_player_photo(uuid)',
    'public.mm_queue_away(uuid)',
    'public.mm_queue_back(uuid)',
    'public.mm_queue_drop_away(uuid,integer)',
    'public.mm_queue_ping()',
    'public.mm_queue_ping_cancel(uuid)',
    'public.mm_queue_ping_next()',
    'public.mm_queue_ping_status()',
    'public.mm_queue_presence_sweep(uuid[],integer)',
    'public.mm_queue_remove(uuid,text)',
    'public.mm_queue_sizes()',
    'public.mm_remove_friend(uuid)',
    'public.mm_report(uuid,uuid,text,text)',
    'public.mm_set_config(jsonb)',
    'public.mm_set_mode_maps(text,text[])',
    'public.mm_set_my_sound(text,text)',
    'public.mm_set_server_enabled(uuid,boolean)',
    'public.mm_set_sound(uuid)',
    'public.mm_start_veto(uuid)',
    'public.mm_summary()',
    'public.mm_team_win_pct(uuid,integer,text)',
    'public.mm_tick()',
    'public.mm_trg_chat()',
    'public.mm_trg_notify()',
    'public.mm_try_build(text)',
    'public.mm_try_build_now(text)',
    'public.mm_unblock(uuid)',
    'public.mm_unit_away(text)',
    'public.name_blocked(text)',
    'public.notification_wants(uuid,text)',
    'public.notifications_mark_read(bigint[],boolean)',
    'public.notifications_resolve(text,text)',
    'public.notifications_unread()',
    'public.notify(uuid[],text,jsonb,text,boolean)',
    'public.notify_admin_ids()',
    'public.notify_due()',
    'public.notify_season_delayed(uuid)',
    'public.pcw_ban_check(uuid)',
    'public.pcw_ban_lift(uuid)',
    'public.pcw_ban_side(uuid,integer)',
    'public.pcw_ban_until(uuid)',
    'public.pcw_posts_ban_guard()',
    'public.pcw_ready(uuid,boolean)',
    'public.pcw_set_result(uuid,jsonb)',
    'public.pcw_side_team(uuid,uuid)',
    'public.player_is_empty(uuid)',
    'public.player_merge_empty(uuid,uuid)',
    'public.player_ref(uuid)',
    'public.profile_avatar_clears_player_photo()',
    'public.reject_steam_request(bigint,text)',
    'public.render_auth(text)',
    'public.request_steam_unlink(text,text)',
    'public.rotate_demo_worker_token(uuid)',
    'public.season_close(uuid,text)',
    'public.season_close_due()',
    'public.season_close_run(uuid,uuid)',
    'public.season_preview(integer,integer,integer,integer,boolean)',
    'public.season_preview_summary(integer,integer,integer,integer,boolean)',
    'public.season_start(text,timestamp with time zone)',
    'public.season_update(uuid,text,timestamp with time zone,integer,integer,integer,integer,jsonb,boolean)',
    'public.server_alloc_lock()',
    'public.server_busy(uuid)',
    'public.server_free(text,text[])',
    'public.server_is_free(uuid,text)',
    'public.server_set_flags(uuid,boolean,boolean,boolean)',
    'public.servers_free(text)',
    'public.set_claim_config(integer)',
    'public.set_game_mode_active(text,boolean)',
    'public.set_my_bio(text)',
    'public.set_my_preferences(jsonb)',
    'public.set_my_primary_steam(text)',
    'public.set_pcw_formats(integer[])',
    'public.set_ranking_config(integer,integer)',
    'public.set_season_config(integer,integer,integer,integer,integer,jsonb,boolean)',
    'public.set_team_config(integer,integer,integer)',
    'public.set_user_role(uuid,text)',
    'public.set_user_tag(uuid,text,boolean)',
    'public.side_users(uuid,uuid)',
    'public.site_admin_set_auth_image(text)',
    'public.steam_attach(text,uuid,uuid)',
    'public.steam_detach(text)',
    'public.steam_detach_elo(text)',
    'public.steam_group(text)',
    'public.steam_history_release(text,uuid)',
    'public.steam_history_to(text,uuid)',
    'public.steam_make_primary(text,uuid)',
    'public.steam_requests_expire()',
    'public.team_audit_add(uuid,text,jsonb)',
    'public.team_can_join(uuid,uuid)',
    'public.team_create(text,text)',
    'public.team_dissolve(uuid)',
    'public.team_invite(uuid,uuid,text,text,text)',
    'public.team_invite_answer(uuid,boolean)',
    'public.team_invite_cancel(uuid)',
    'public.team_invites_expire()',
    'public.team_kick(uuid,uuid)',
    'public.team_leave(uuid)',
    'public.team_name_blocked(text,text)',
    'public.team_ref(uuid)',
    'public.team_rename(uuid,text,text)',
    'public.team_request_join(uuid,text)',
    'public.team_roster_users(uuid)',
    'public.team_set_logo(uuid,text)',
    'public.team_set_member_role(uuid,uuid,text)',
    'public.team_staff_add_member(uuid,uuid,text,text)',
    'public.team_staff_begin(uuid,text,boolean)',
    'public.team_staff_dissolve(uuid,text)',
    'public.team_staff_end(teams,text,jsonb)',
    'public.team_staff_remove_logo(uuid,text)',
    'public.team_staff_remove_member(uuid,uuid,text)',
    'public.team_staff_rename(uuid,text,text,text)',
    'public.team_staff_set_captain(uuid,uuid,text)',
    'public.team_staff_set_role(uuid,uuid,text,text)',
    'public.team_update(uuid,text[])',
    'public.tg_game_servers_hud_off()',
    'public.tg_notify_claim_log()',
    'public.tg_notify_elo_adjustments()',
    'public.tg_notify_events()',
    'public.tg_notify_match_clips()',
    'public.tg_notify_match_crashes()',
    'public.tg_notify_match_vetos()',
    'public.tg_notify_matches()',
    'public.tg_notify_mix_deletions()',
    'public.tg_notify_pcw_posts()',
    'public.tg_notify_player_elo()',
    'public.tg_notify_player_medals()',
    'public.tg_notify_profiles()',
    'public.tg_notify_registrations()',
    'public.tg_notify_season_standings()',
    'public.tg_notify_seasons()',
    'public.tg_notify_steam_requests()',
    'public.tg_notify_team_invites()',
    'public.tg_notify_team_members()',
    'public.tg_notify_team_requests()',
    'public.tg_notify_teams()',
    'public.users_of_players(uuid[])',
    'public.users_of_steam(text[])',
    'public.veto_act(uuid,text,text)',
    'public.veto_act_base(uuid,text,text)',
    'public.veto_auto(uuid)',
    'public.veto_reset(uuid)'] loop
    if to_regprocedure(v) is null then faltan := faltan || v; end if;
  end loop;
  foreach v in array array[
    'public.ac_admin_actions',
    'public.ac_capture_requests',
    'public.ac_config',
    'public.ac_devices',
    'public.ac_evidence',
    'public.ac_integrity_logs',
    'public.ac_link_requests',
    'public.ac_process_events',
    'public.ac_screenshots',
    'public.ac_server_policy',
    'public.ac_sessions',
    'public.bans',
    'public.blocked_words',
    'public.clip_video_trash',
    'public.connect_attempts',
    'public.elo_adjustments',
    'public.event_stage_teams',
    'public.game_modes',
    'public.hud_relays',
    'public.hud_sessions',
    'public.hud_streamers',
    'public.live_matches',
    'public.map_pool',
    'public.match_bookings',
    'public.match_crashes',
    'public.matches',
    'public.mix_deletions',
    'public.mm_bans',
    'public.mm_blocks',
    'public.mm_commends',
    'public.mm_config',
    'public.mm_friends',
    'public.mm_lobbies',
    'public.mm_lobby_players',
    'public.mm_mode_maps',
    'public.mm_mode_settings',
    'public.mm_parties',
    'public.mm_party_invites',
    'public.mm_party_members',
    'public.mm_penalties',
    'public.mm_penalty_log',
    'public.mm_queue',
    'public.mm_queue_log',
    'public.mm_queue_pings',
    'public.mm_reports',
    'public.mm_server_passwords',
    'public.mm_server_state',
    'public.mm_sound_choice',
    'public.mm_sounds',
    'public.mm_summary_last',
    'public.notification_sent',
    'public.notifications',
    'public.pcw_bans',
    'public.pcw_config',
    'public.player_connections',
    'public.player_ips',
    'public.ranking_config',
    'public.replanteo71_fotos_ficha',
    'public.season_config',
    'public.season_standings',
    'public.seasons',
    'public.site_config',
    'public.team_config',
    'public.team_invites',
    'public.tournament_registration_players',
    'public.user_preferences',
    'public.vip_memberships',
    'public.live_match_list',
    'public.live_match_players',
    'public.match_clutch_data',
    'public.match_clutches',
    'public.mix_list',
    'public.player_clutches',
    'public.vip_public',
    'public.vip_status'] loop
    if to_regclass(v) is null then faltan := faltan || v; end if;
  end loop;
  if cardinality(faltan) > 0 then raise exception 'replanteo 118: no existen %', faltan; end if;
end $$;

revoke execute on function public.ac_admin_chain(uuid) from anon;
revoke execute on function public.ac_admin_hold(uuid,boolean) from anon;
revoke execute on function public.ac_admin_record_integrity(uuid,text,jsonb) from anon;
revoke execute on function public.ac_admin_request_capture(uuid,text) from anon;
revoke execute on function public.ac_admin_session_evidence(uuid) from anon;
revoke execute on function public.ac_admin_sessions(text,integer,integer) from anon;
revoke execute on function public.ac_can_review() from anon;
revoke execute on function public.ac_device_of(text,text) from anon, authenticated;
revoke execute on function public.ac_device_revoke(uuid) from anon;
revoke execute on function public.ac_hash(text) from anon, authenticated;
revoke execute on function public.ac_link_approve(text) from anon;
revoke execute on function public.ac_require_api(text) from anon, authenticated;
revoke execute on function public.ac_retention_delete(uuid) from anon, authenticated;
revoke execute on function public.ac_retention_due(integer) from anon, authenticated;
revoke execute on function public.ac_retention_paths(uuid) from anon, authenticated;
revoke execute on function public.ac_session_accepts(uuid,uuid,timestamp with time zone) from anon, authenticated;
revoke execute on function public.ac_set_open(integer) from anon;
revoke execute on function public.ac_token(text) from anon, authenticated;
revoke execute on function public.ac_user_code() from anon, authenticated;
revoke execute on function public.admin_create_demo_worker(text) from anon;
revoke execute on function public.admin_create_server(text,text,text,timestamp with time zone,text,text,text,integer) from anon;
revoke execute on function public.admin_delete_mix(uuid,text) from anon;
revoke execute on function public.admin_demo_retry(uuid) from anon;
revoke execute on function public.admin_grant_streamer(uuid) from anon;
revoke execute on function public.admin_name_blocked(text) from anon;
revoke execute on function public.admin_pcw_bans(boolean,text,text,text,integer,integer) from anon;
revoke execute on function public.admin_player_ips(uuid) from anon;
revoke execute on function public.admin_regenerate_hud_key(uuid) from anon;
revoke execute on function public.admin_remove_steam(text) from anon;
revoke execute on function public.admin_revoke_streamer(uuid) from anon;
revoke execute on function public.admin_set_primary_steam(text) from anon;
revoke execute on function public.admin_set_server_hud(uuid,integer,boolean) from anon;
revoke execute on function public.admin_users(text) from anon;
revoke execute on function public.admin_vip_grant(uuid,integer,timestamp with time zone,boolean,text) from anon;
revoke execute on function public.admin_vip_revoke(uuid,text) from anon;
revoke execute on function public.approve_steam_request(bigint) from anon;
revoke execute on function public.ban_active_for(text) from anon, authenticated;
revoke execute on function public.ban_create(uuid,text,text,timestamp with time zone) from anon;
revoke execute on function public.ban_insert(uuid,text,text,text,timestamp with time zone,text,uuid,text,text,uuid) from anon, authenticated;
revoke execute on function public.ban_lift(uuid,text) from anon;
revoke execute on function public.ban_steams(uuid,text) from anon, authenticated;
revoke execute on function public.ban_unix(timestamp with time zone) from anon, authenticated;
revoke execute on function public.ban_update(uuid,text,timestamp with time zone,boolean) from anon;
revoke execute on function public.blocked_names_hits() from anon;
revoke execute on function public.booking_abandon(uuid,integer,text) from anon, authenticated;
revoke execute on function public.booking_after_veto(uuid) from anon, authenticated;
revoke execute on function public.booking_assign(uuid) from anon, authenticated;
revoke execute on function public.booking_close(uuid,text,text) from anon, authenticated;
revoke execute on function public.booking_emit(uuid) from anon, authenticated;
revoke execute on function public.booking_enqueue(uuid,boolean) from anon, authenticated;
revoke execute on function public.booking_map(uuid) from anon, authenticated;
revoke execute on function public.booking_on_match() from anon, authenticated;
revoke execute on function public.booking_poll_text(uuid) from anon, authenticated;
revoke execute on function public.booking_report(uuid,uuid,text,text) from anon, authenticated;
revoke execute on function public.booking_start_wait(uuid,interval) from anon, authenticated;
revoke execute on function public.booking_tick() from anon, authenticated;
revoke execute on function public.booking_title(uuid) from anon, authenticated;
revoke execute on function public.booking_users(uuid) from anon, authenticated;
revoke execute on function public.cancel_steam_unlink(text) from anon;
revoke execute on function public.clip_force(uuid) from anon;
revoke execute on function public.clip_reprocess(uuid) from anon;
revoke execute on function public.clip_review_ok(uuid) from anon;
revoke execute on function public.clip_set_config(jsonb,integer,integer,integer,integer,integer,integer) from anon;
revoke execute on function public.clip_unforce(uuid) from anon;
revoke execute on function public.create_claim_code() from anon;
revoke execute on function public.create_pcw_post(text,integer,text,timestamp with time zone,text,uuid[],text[],uuid,text[]) from anon;
revoke execute on function public.create_render_worker_token(text) from anon;
revoke execute on function public.csstv_after_ingest(uuid,jsonb,text) from anon, authenticated;
revoke execute on function public.csstv_clips_save(uuid,jsonb) from anon, authenticated;
revoke execute on function public.csstv_ip(text) from anon, authenticated;
revoke execute on function public.csstv_jcounts(jsonb) from anon, authenticated;
revoke execute on function public.csstv_jint_null(jsonb,text,integer) from anon, authenticated;
revoke execute on function public.csstv_link_game(uuid,text,integer) from anon, authenticated;
revoke execute on function public.csstv_link_game_base(uuid,text,integer) from anon, authenticated;
revoke execute on function public.csstv_live_upsert(uuid,text,jsonb) from anon, authenticated;
revoke execute on function public.csstv_match_extra(uuid,jsonb) from anon, authenticated;
revoke execute on function public.elo_add_adjustment(text[],integer,text,timestamp with time zone) from anon;
revoke execute on function public.elo_adjust_players(uuid[],integer,integer,text) from anon;
revoke execute on function public.elo_after_attach(text) from anon, authenticated;
revoke execute on function public.elo_apply_adjustment(text,integer) from anon, authenticated;
revoke execute on function public.elo_apply_adjustment_row(bigint) from anon, authenticated;
revoke execute on function public.elo_apply_set(text,integer) from anon, authenticated;
revoke execute on function public.elo_crash_apply(uuid) from anon;
revoke execute on function public.elo_crash_discard(uuid) from anon;
revoke execute on function public.elo_recompute_all() from anon, authenticated;
revoke execute on function public.elo_recompute_player(text,text[]) from anon, authenticated;
revoke execute on function public.elo_remove_adjustment(bigint) from anon;
revoke execute on function public.elo_season_event(uuid,boolean) from anon, authenticated;
revoke execute on function public.elo_season_event_key(uuid,boolean,text) from anon, authenticated;
revoke execute on function public.elo_simulate(integer,integer,numeric,integer,integer,integer,integer) from anon, authenticated;
revoke execute on function public.event_build_double(uuid,uuid[],jsonb) from anon, authenticated;
revoke execute on function public.event_build_group_double(uuid,uuid[],jsonb) from anon, authenticated;
revoke execute on function public.event_build_groups(uuid,uuid[],jsonb) from anon, authenticated;
revoke execute on function public.event_build_ko(uuid,uuid[],integer,jsonb) from anon, authenticated;
revoke execute on function public.event_draw(uuid) from anon;
revoke execute on function public.event_engine_on() from anon, authenticated;
revoke execute on function public.event_generate(uuid) from anon;
revoke execute on function public.event_group_double_team(uuid,integer,integer) from anon, authenticated;
revoke execute on function public.event_group_qualifiers(uuid) from anon, authenticated;
revoke execute on function public.event_progress(uuid) from anon, authenticated;
revoke execute on function public.event_propagate_dead(uuid) from anon, authenticated;
revoke execute on function public.event_ref(uuid) from anon, authenticated;
revoke execute on function public.event_register(uuid,uuid,uuid[],uuid[],integer) from anon;
revoke execute on function public.event_reset(uuid) from anon;
revoke execute on function public.event_resolve_tie(uuid,integer,uuid[]) from anon;
revoke execute on function public.event_seed_ranking(uuid) from anon;
revoke execute on function public.event_set_result(uuid,jsonb,uuid,boolean) from anon;
revoke execute on function public.event_swiss_phase(uuid,integer) from anon, authenticated;
revoke execute on function public.event_swiss_round(uuid,integer) from anon, authenticated;
revoke execute on function public.event_unregister(uuid,uuid) from anon;
revoke execute on function public.event_unroute(uuid) from anon, authenticated;
revoke execute on function public.handle_password_change() from anon, authenticated;
revoke execute on function public.hud_new_key() from anon, authenticated;
revoke execute on function public.hud_streamer_new_token() from anon;
revoke execute on function public.hud_streaming(uuid) from anon;
revoke execute on function public.live_match_close(text) from anon;
revoke execute on function public.manual_valores() from anon;
revoke execute on function public.map_pool_check(text[],text[],integer) from anon, authenticated;
revoke execute on function public.match_booking_action(uuid,text,integer,integer) from anon;
revoke execute on function public.match_booking_release(uuid) from anon;
revoke execute on function public.match_can_connect(uuid) from anon, authenticated;
revoke execute on function public.match_clips_video_guard() from anon, authenticated;
revoke execute on function public.match_link_code(uuid) from anon;
revoke execute on function public.match_my_side(uuid) from anon, authenticated;
revoke execute on function public.match_ref(uuid) from anon, authenticated;
revoke execute on function public.match_roster(uuid,uuid) from anon, authenticated;
revoke execute on function public.match_schedule(uuid,timestamp with time zone,uuid) from anon;
revoke execute on function public.match_series_maps(uuid) from anon, authenticated;
revoke execute on function public.match_set_maps(uuid,jsonb) from anon;
revoke execute on function public.match_side_users(uuid,integer) from anon, authenticated;
revoke execute on function public.match_start(uuid,uuid,integer) from anon;
revoke execute on function public.match_users(uuid) from anon, authenticated;
revoke execute on function public.matches_pcw_ban_guard() from anon, authenticated;
revoke execute on function public.mix_users(uuid) from anon, authenticated;
revoke execute on function public.mm_accept() from anon;
revoke execute on function public.mm_active_lobby(uuid) from anon, authenticated;
revoke execute on function public.mm_add_friend(uuid) from anon;
revoke execute on function public.mm_admin_cancel(uuid,text) from anon;
revoke execute on function public.mm_admin_config() from anon;
revoke execute on function public.mm_admin_guard() from anon, authenticated;
revoke execute on function public.mm_admin_lift_penalty(uuid,text) from anon;
revoke execute on function public.mm_admin_lists(text,text) from anon;
revoke execute on function public.mm_admin_resolve_report(uuid,text,integer) from anon;
revoke execute on function public.mm_admin_rotate_password(uuid) from anon;
revoke execute on function public.mm_admin_set_mvp_image(text) from anon;
revoke execute on function public.mm_admin_sound_add(text,text) from anon;
revoke execute on function public.mm_admin_sound_delete(uuid) from anon;
revoke execute on function public.mm_admin_sounds() from anon;
revoke execute on function public.mm_admin_unban(uuid) from anon;
revoke execute on function public.mm_after_claim(uuid) from anon, authenticated;
revoke execute on function public.mm_assign_server(uuid) from anon, authenticated;
revoke execute on function public.mm_ban_map(uuid,text,uuid) from anon, authenticated;
revoke execute on function public.mm_best_split(uuid[],integer[],uuid[],integer) from anon, authenticated;
revoke execute on function public.mm_block(uuid) from anon;
revoke execute on function public.mm_block_reason(uuid) from anon, authenticated;
revoke execute on function public.mm_cancel_lobby(uuid,text,boolean) from anon, authenticated;
revoke execute on function public.mm_commend(uuid,uuid) from anon;
revoke execute on function public.mm_decline() from anon;
revoke execute on function public.mm_delete_my_sound() from anon;
revoke execute on function public.mm_elo_abandoned(uuid,text) from anon, authenticated;
revoke execute on function public.mm_elo_delta(uuid,text,integer,double precision,double precision,integer) from anon, authenticated;
revoke execute on function public.mm_elo_stake(uuid,uuid) from anon, authenticated;
revoke execute on function public.mm_elo_window(numeric) from anon, authenticated;
revoke execute on function public.mm_emit(text,uuid,uuid[],jsonb) from anon, authenticated;
revoke execute on function public.mm_ensure_player(uuid) from anon, authenticated;
revoke execute on function public.mm_free_server(text[]) from anon, authenticated;
revoke execute on function public.mm_friend_users(uuid) from anon, authenticated;
revoke execute on function public.mm_game_stats(uuid,uuid) from anon, authenticated;
revoke execute on function public.mm_join(text,text) from anon;
revoke execute on function public.mm_leave() from anon;
revoke execute on function public.mm_lobby_json(uuid,uuid) from anon, authenticated;
revoke execute on function public.mm_lobby_match(uuid) from anon;
revoke execute on function public.mm_lobby_users(uuid) from anon, authenticated;
revoke execute on function public.mm_logout() from anon;
revoke execute on function public.mm_meetings(uuid,uuid,boolean) from anon, authenticated;
revoke execute on function public.mm_mvp_image() from anon;
revoke execute on function public.mm_my_live(boolean) from anon;
revoke execute on function public.mm_my_profile() from anon;
revoke execute on function public.mm_my_state() from anon;
revoke execute on function public.mm_my_team(uuid) from anon;
revoke execute on function public.mm_new_password(integer) from anon, authenticated;
revoke execute on function public.mm_party_clear_queue(uuid) from anon, authenticated;
revoke execute on function public.mm_party_detach(uuid) from anon, authenticated;
revoke execute on function public.mm_party_invite(uuid) from anon;
revoke execute on function public.mm_party_kick(uuid) from anon;
revoke execute on function public.mm_party_leave() from anon;
revoke execute on function public.mm_party_promote(uuid) from anon;
revoke execute on function public.mm_party_respond(uuid,boolean) from anon;
revoke execute on function public.mm_penalize(uuid,text) from anon, authenticated;
revoke execute on function public.mm_player_card(uuid,uuid,mm_lobby_players) from anon, authenticated;
revoke execute on function public.mm_player_elo(uuid) from anon, authenticated;
revoke execute on function public.mm_player_photo(uuid) from anon, authenticated;
revoke execute on function public.mm_queue_away(uuid) from anon, authenticated;
revoke execute on function public.mm_queue_back(uuid) from anon, authenticated;
revoke execute on function public.mm_queue_drop_away(uuid,integer) from anon, authenticated;
revoke execute on function public.mm_queue_ping() from anon;
revoke execute on function public.mm_queue_ping_cancel(uuid) from anon;
revoke execute on function public.mm_queue_ping_next() from anon;
revoke execute on function public.mm_queue_ping_status() from anon;
revoke execute on function public.mm_queue_presence_sweep(uuid[],integer) from anon, authenticated;
revoke execute on function public.mm_queue_remove(uuid,text) from anon, authenticated;
revoke execute on function public.mm_queue_sizes() from anon, authenticated;
revoke execute on function public.mm_remove_friend(uuid) from anon;
revoke execute on function public.mm_report(uuid,uuid,text,text) from anon;
revoke execute on function public.mm_set_config(jsonb) from anon;
revoke execute on function public.mm_set_mode_maps(text,text[]) from anon;
revoke execute on function public.mm_set_my_sound(text,text) from anon;
revoke execute on function public.mm_set_server_enabled(uuid,boolean) from anon;
revoke execute on function public.mm_set_sound(uuid) from anon;
revoke execute on function public.mm_start_veto(uuid) from anon, authenticated;
revoke execute on function public.mm_summary() from anon, authenticated;
revoke execute on function public.mm_team_win_pct(uuid,integer,text) from anon, authenticated;
revoke execute on function public.mm_tick() from anon, authenticated;
revoke execute on function public.mm_trg_chat() from anon, authenticated;
revoke execute on function public.mm_trg_notify() from anon, authenticated;
revoke execute on function public.mm_try_build(text) from anon, authenticated;
revoke execute on function public.mm_try_build_now(text) from anon, authenticated;
revoke execute on function public.mm_unblock(uuid) from anon;
revoke execute on function public.mm_unit_away(text) from anon, authenticated;
revoke execute on function public.name_blocked(text) from anon, authenticated;
revoke execute on function public.notification_wants(uuid,text) from anon, authenticated;
revoke execute on function public.notifications_mark_read(bigint[],boolean) from anon;
revoke execute on function public.notifications_resolve(text,text) from anon, authenticated;
revoke execute on function public.notifications_unread() from anon;
revoke execute on function public.notify(uuid[],text,jsonb,text,boolean) from anon, authenticated;
revoke execute on function public.notify_admin_ids() from anon, authenticated;
revoke execute on function public.notify_due() from anon, authenticated;
revoke execute on function public.notify_season_delayed(uuid) from anon, authenticated;
revoke execute on function public.pcw_ban_check(uuid) from anon, authenticated;
revoke execute on function public.pcw_ban_lift(uuid) from anon;
revoke execute on function public.pcw_ban_side(uuid,integer) from anon, authenticated;
revoke execute on function public.pcw_ban_until(uuid) from anon, authenticated;
revoke execute on function public.pcw_posts_ban_guard() from anon, authenticated;
revoke execute on function public.pcw_ready(uuid,boolean) from anon;
revoke execute on function public.pcw_set_result(uuid,jsonb) from anon;
revoke execute on function public.pcw_side_team(uuid,uuid) from anon, authenticated;
revoke execute on function public.player_is_empty(uuid) from anon, authenticated;
revoke execute on function public.player_merge_empty(uuid,uuid) from anon, authenticated;
revoke execute on function public.player_ref(uuid) from anon, authenticated;
revoke execute on function public.profile_avatar_clears_player_photo() from anon, authenticated;
revoke execute on function public.reject_steam_request(bigint,text) from anon;
revoke execute on function public.render_auth(text) from anon, authenticated;
revoke execute on function public.request_steam_unlink(text,text) from anon;
revoke execute on function public.rotate_demo_worker_token(uuid) from anon;
revoke execute on function public.season_close(uuid,text) from anon;
revoke execute on function public.season_close_due() from anon, authenticated;
revoke execute on function public.season_close_run(uuid,uuid) from anon, authenticated;
revoke execute on function public.season_preview(integer,integer,integer,integer,boolean) from anon;
revoke execute on function public.season_preview_summary(integer,integer,integer,integer,boolean) from anon;
revoke execute on function public.season_start(text,timestamp with time zone) from anon;
revoke execute on function public.season_update(uuid,text,timestamp with time zone,integer,integer,integer,integer,jsonb,boolean) from anon;
revoke execute on function public.server_alloc_lock() from anon, authenticated;
revoke execute on function public.server_busy(uuid) from anon, authenticated;
revoke execute on function public.server_free(text,text[]) from anon, authenticated;
revoke execute on function public.server_is_free(uuid,text) from anon, authenticated;
revoke execute on function public.server_set_flags(uuid,boolean,boolean,boolean) from anon;
revoke execute on function public.servers_free(text) from anon;
revoke execute on function public.set_claim_config(integer) from anon;
revoke execute on function public.set_game_mode_active(text,boolean) from anon;
revoke execute on function public.set_my_bio(text) from anon;
revoke execute on function public.set_my_preferences(jsonb) from anon;
revoke execute on function public.set_my_primary_steam(text) from anon;
revoke execute on function public.set_pcw_formats(integer[]) from anon;
revoke execute on function public.set_ranking_config(integer,integer) from anon;
revoke execute on function public.set_season_config(integer,integer,integer,integer,integer,jsonb,boolean) from anon;
revoke execute on function public.set_team_config(integer,integer,integer) from anon;
revoke execute on function public.set_user_role(uuid,text) from anon;
revoke execute on function public.set_user_tag(uuid,text,boolean) from anon;
revoke execute on function public.side_users(uuid,uuid) from anon, authenticated;
revoke execute on function public.site_admin_set_auth_image(text) from anon;
revoke execute on function public.steam_attach(text,uuid,uuid) from anon, authenticated;
revoke execute on function public.steam_detach(text) from anon, authenticated;
revoke execute on function public.steam_detach_elo(text) from anon, authenticated;
revoke execute on function public.steam_group(text) from anon, authenticated;
revoke execute on function public.steam_history_release(text,uuid) from anon, authenticated;
revoke execute on function public.steam_history_to(text,uuid) from anon, authenticated;
revoke execute on function public.steam_make_primary(text,uuid) from anon, authenticated;
revoke execute on function public.steam_requests_expire() from anon;
revoke execute on function public.team_audit_add(uuid,text,jsonb) from anon, authenticated;
revoke execute on function public.team_can_join(uuid,uuid) from anon, authenticated;
revoke execute on function public.team_create(text,text) from anon;
revoke execute on function public.team_dissolve(uuid) from anon;
revoke execute on function public.team_invite(uuid,uuid,text,text,text) from anon;
revoke execute on function public.team_invite_answer(uuid,boolean) from anon;
revoke execute on function public.team_invite_cancel(uuid) from anon;
revoke execute on function public.team_invites_expire() from anon, authenticated;
revoke execute on function public.team_kick(uuid,uuid) from anon;
revoke execute on function public.team_leave(uuid) from anon;
revoke execute on function public.team_name_blocked(text,text) from anon;
revoke execute on function public.team_ref(uuid) from anon, authenticated;
revoke execute on function public.team_rename(uuid,text,text) from anon;
revoke execute on function public.team_request_join(uuid,text) from anon;
revoke execute on function public.team_roster_users(uuid) from anon, authenticated;
revoke execute on function public.team_set_logo(uuid,text) from anon;
revoke execute on function public.team_set_member_role(uuid,uuid,text) from anon;
revoke execute on function public.team_staff_add_member(uuid,uuid,text,text) from anon;
revoke execute on function public.team_staff_begin(uuid,text,boolean) from anon, authenticated;
revoke execute on function public.team_staff_dissolve(uuid,text) from anon;
revoke execute on function public.team_staff_end(teams,text,jsonb) from anon, authenticated;
revoke execute on function public.team_staff_remove_logo(uuid,text) from anon;
revoke execute on function public.team_staff_remove_member(uuid,uuid,text) from anon;
revoke execute on function public.team_staff_rename(uuid,text,text,text) from anon;
revoke execute on function public.team_staff_set_captain(uuid,uuid,text) from anon;
revoke execute on function public.team_staff_set_role(uuid,uuid,text,text) from anon;
revoke execute on function public.team_update(uuid,text[]) from anon;
revoke execute on function public.tg_game_servers_hud_off() from anon, authenticated;
revoke execute on function public.tg_notify_claim_log() from anon, authenticated;
revoke execute on function public.tg_notify_elo_adjustments() from anon, authenticated;
revoke execute on function public.tg_notify_events() from anon, authenticated;
revoke execute on function public.tg_notify_match_clips() from anon, authenticated;
revoke execute on function public.tg_notify_match_crashes() from anon, authenticated;
revoke execute on function public.tg_notify_match_vetos() from anon, authenticated;
revoke execute on function public.tg_notify_matches() from anon, authenticated;
revoke execute on function public.tg_notify_mix_deletions() from anon, authenticated;
revoke execute on function public.tg_notify_pcw_posts() from anon, authenticated;
revoke execute on function public.tg_notify_player_elo() from anon, authenticated;
revoke execute on function public.tg_notify_player_medals() from anon, authenticated;
revoke execute on function public.tg_notify_profiles() from anon, authenticated;
revoke execute on function public.tg_notify_registrations() from anon, authenticated;
revoke execute on function public.tg_notify_season_standings() from anon, authenticated;
revoke execute on function public.tg_notify_seasons() from anon, authenticated;
revoke execute on function public.tg_notify_steam_requests() from anon, authenticated;
revoke execute on function public.tg_notify_team_invites() from anon, authenticated;
revoke execute on function public.tg_notify_team_members() from anon, authenticated;
revoke execute on function public.tg_notify_team_requests() from anon, authenticated;
revoke execute on function public.tg_notify_teams() from anon, authenticated;
revoke execute on function public.users_of_players(uuid[]) from anon, authenticated;
revoke execute on function public.users_of_steam(text[]) from anon, authenticated;
revoke execute on function public.veto_act(uuid,text,text) from anon;
revoke execute on function public.veto_act_base(uuid,text,text) from anon;
revoke execute on function public.veto_auto(uuid) from anon, authenticated;
revoke execute on function public.veto_reset(uuid) from anon;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.ac_admin_actions from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.ac_capture_requests from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.ac_config from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.ac_devices from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.ac_evidence from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.ac_integrity_logs from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.ac_link_requests from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.ac_process_events from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.ac_screenshots from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.ac_server_policy from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.ac_sessions from anon;
revoke delete, insert, maintain, references, trigger, truncate, update on table public.ac_sessions from authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.bans from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.blocked_words from anon;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.clip_video_trash from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.connect_attempts from anon, authenticated;
revoke delete, insert, maintain, references, trigger, truncate, update on table public.elo_adjustments from anon, authenticated;
revoke delete, insert, truncate, update on table public.event_stage_teams from anon, authenticated;
revoke delete, insert, truncate, update on table public.game_modes from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.hud_relays from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.hud_sessions from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.hud_streamers from anon, authenticated;
revoke delete, insert, maintain, references, trigger, truncate, update on table public.live_matches from anon, authenticated;
revoke delete, insert, truncate, update on table public.map_pool from anon;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.match_bookings from anon, authenticated;
revoke delete, insert, maintain, references, trigger, truncate, update on table public.match_crashes from anon, authenticated;
revoke select on table public.matches from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mix_deletions from anon;
revoke delete, insert, maintain, references, trigger, truncate, update on table public.mix_deletions from authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_bans from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_blocks from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_commends from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_config from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_friends from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_lobbies from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_lobby_players from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_mode_maps from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_mode_settings from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_parties from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_party_invites from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_party_members from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_penalties from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_penalty_log from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_queue from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_queue_log from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_queue_pings from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_reports from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_server_passwords from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_server_state from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_sound_choice from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_sounds from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.mm_summary_last from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.notification_sent from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.notifications from anon;
revoke delete, insert, maintain, references, trigger, truncate, update on table public.notifications from authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.pcw_bans from anon, authenticated;
revoke delete, insert, truncate, update on table public.pcw_config from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.player_connections from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.player_ips from anon, authenticated;
revoke delete, insert, truncate, update on table public.ranking_config from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.replanteo71_fotos_ficha from anon, authenticated;
revoke delete, insert, maintain, references, trigger, truncate, update on table public.season_config from anon, authenticated;
revoke delete, insert, maintain, references, trigger, truncate, update on table public.season_standings from anon, authenticated;
revoke delete, insert, maintain, references, trigger, truncate, update on table public.seasons from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.site_config from anon, authenticated;
revoke delete, insert, truncate, update on table public.team_config from anon, authenticated;
revoke delete, insert, select, truncate, update on table public.team_invites from anon;
revoke delete, insert, truncate, update on table public.team_invites from authenticated;
revoke delete, insert, truncate, update on table public.tournament_registration_players from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.user_preferences from anon;
revoke delete, maintain, references, trigger, truncate on table public.user_preferences from authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.vip_memberships from anon;
revoke delete, insert, maintain, references, trigger, truncate, update on table public.vip_memberships from authenticated;
revoke delete, insert, maintain, references, trigger, truncate, update on table public.live_match_list from anon, authenticated;
revoke delete, insert, maintain, references, trigger, truncate, update on table public.live_match_players from anon, authenticated;
revoke delete, insert, maintain, references, trigger, truncate, update on table public.match_clutch_data from anon, authenticated;
revoke delete, insert, maintain, references, trigger, truncate, update on table public.match_clutches from anon, authenticated;
revoke delete, insert, maintain, references, trigger, truncate, update on table public.mix_list from anon, authenticated;
revoke delete, insert, maintain, references, trigger, truncate, update on table public.player_clutches from anon, authenticated;
revoke delete, insert, maintain, references, trigger, truncate, update on table public.vip_public from anon, authenticated;
revoke delete, insert, maintain, references, select, trigger, truncate, update on table public.vip_status from anon;

-- Los permisos por columna que el revoke de la tabla se llevó (los de la referencia).
grant select (id, user_id, name, agent_version, last_seen_at, revoked_at, created_at) on table public.ac_devices to authenticated;
do $$
begin
  execute 'grant select (' || (select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
                                 from information_schema.columns
                                where table_schema = 'public' and table_name = 'matches' and column_name <> 'link_code')
          || ') on public.matches to anon, authenticated';
end $$;

do $$ begin
  if has_function_privilege('anon', 'public.season_close_run(uuid, uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.season_close_run(uuid, uuid)', 'execute')
     or has_function_privilege('anon', 'public.csstv_after_ingest(uuid, jsonb, text)', 'execute')
     or has_function_privilege('anon', 'public.elo_recompute_player(text, text[])', 'execute')
     or has_function_privilege('authenticated', 'public.notify_due()', 'execute') then
    raise exception 'replanteo 118: quedó algún permiso de los que se quitan';
  end if;
  -- Lo que tiene que seguir andando: el plugin (anon con su token) y la web (con sesión).
  if not has_function_privilege('anon', 'public.csstv_ingest(uuid, jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.mm_my_state()', 'execute') then
    raise exception 'replanteo 118: se quitó un permiso que se usa';
  end if;
  -- matches: todo menos el código de !match.
  if has_column_privilege('anon', 'public.matches', 'link_code', 'select')
     or not has_column_privilege('anon', 'public.matches', 'parent_approved', 'select')
     or not has_column_privilege('authenticated', 'public.matches', 'status', 'select') then
    raise exception 'replanteo 118: los permisos de matches no quedaron como tienen que quedar';
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
