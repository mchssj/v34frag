-- Replanteo 59: avisos del matchmaking que traen el dato y un estado liviano (plan docs/bitacora/2026-11-02-mm-avisos-livianos).
--   1. mm_emit con p_data: el aviso lleva `d` además del tipo y la sala. queue.changed lleva los tamaños de la cola (la web
--      actualiza el contador sin pedir nada), lobby.found el modo, el tamaño y el plazo (la ventana se abre en el acto),
--      lobby.accept quién aceptó y cuántos van, y lobby.veto el mapa y el turno.
--   2. mm_my_state() pasa a ser mm_my_profile() || mm_my_live(true). mm_my_live() (sin true) trae la sala sin las
--      estadísticas de la partida; esas salen de mm_lobby_match(), solo para quien jugó la sala.
-- Ningún `d` lleva contraseñas, IP ni datos que el destinatario no vea hoy. Se aplica después de la 58.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regprocedure('public.mm_my_live(boolean)') is not null then
    raise exception 'replanteo 59: mm_my_live ya existe (¿ya se aplicó?)';
  end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    -- Sin \r: con el archivo en CRLF (autocrlf), los textos de varias líneas no coincidirían con la función.
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'replanteo 59: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

-- ---------- 1. Avisos con el dato ----------

drop function public.mm_emit(text, uuid, uuid[]);
create function public.mm_emit(p_type text, p_lobby uuid, p_users uuid[], p_data jsonb default null) returns void
  language sql as $$
  select pg_notify('mm', json_build_object('t', p_type, 'lobby', p_lobby, 'users', coalesce(p_users, '{}'), 'd', p_data)::text) $$;
comment on function public.mm_emit(text, uuid, uuid[], jsonb) is 'Aviso del socket del matchmaking: tipo, sala, destinatarios (vacío = todos) y d, lo que cambió (replanteo 59)';

/** Tamaños de la cola para queue.changed: total y por modo. */
create function public.mm_queue_sizes() returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('size', (select count(*) from mm_queue),
    'by_mode', coalesce((select jsonb_object_agg(mode, n) from (select mode, count(*) n from mm_queue group by mode) x), '{}')) $$;

select pg_temp.reemplazar('public.mm_trg_notify()', array[
  [$q$    perform mm_emit('queue.changed', null, null);$q$,
   $q$    perform mm_emit('queue.changed', null, null, mm_queue_sizes());   -- (replanteo 59) la web actualiza el contador sin pedir nada$q$],
  [$q$      perform mm_emit('lobby.accept', new.lobby_id, mm_lobby_users(new.lobby_id));$q$,
   $q$      perform mm_emit('lobby.accept', new.lobby_id, mm_lobby_users(new.lobby_id), jsonb_build_object(
        'user_id', new.user_id,
        'accepted', (select count(*) from mm_lobby_players where lobby_id = new.lobby_id and accepted_at is not null),
        'total', (select count(*) from mm_lobby_players where lobby_id = new.lobby_id)));$q$]
]);

select pg_temp.reemplazar('public.mm_try_build(text)', array[
  [$q$    perform mm_emit('lobby.found', v_lobby, v_users);$q$,
   $q$    -- (replanteo 59) Con esto la web abre "Partida encontrada" sin esperar a pedir el estado.
    perform mm_emit('lobby.found', v_lobby, v_users, jsonb_build_object('mode', p_mode, 'size', cardinality(v_users),
      'accept_deadline', (select accept_deadline from mm_lobbies where id = v_lobby)));$q$]
]);

select pg_temp.reemplazar('public.mm_ban_map(uuid, text, uuid)', array[
  [$q$  perform mm_emit('lobby.veto', p_lobby, mm_lobby_users(p_lobby));$q$,
   $q$  perform mm_emit('lobby.veto', p_lobby, mm_lobby_users(p_lobby), (select jsonb_build_object('map', p_map, 'side', l.veto_turn,
    'turn', x.veto_turn, 'deadline', x.veto_deadline, 'done', x.status <> 'veto') from mm_lobbies x where x.id = p_lobby));$q$]
]);

-- ---------- 2. Estado liviano y estado pesado ----------

/** Lo que casi no cambia: mi ficha, mis últimas partidas, los modos, los amigos, los sonidos y las sanciones. */
create function public.mm_my_profile() returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  c mm_config%rowtype;
  v_player players%rowtype;
  v_sound mm_sounds%rowtype;
  v_custom mm_sounds%rowtype;
  v_vip boolean;
begin
  if me is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  select * into c from mm_config;
  select * into v_player from players where user_id = me;
  v_vip := is_vip(me);
  select s.* into v_sound from mm_sound_choice ch join mm_sounds s on s.id = ch.sound_id where ch.user_id = me and (s.owner_id is null or v_vip);
  select * into v_custom from mm_sounds where owner_id = me;
  return jsonb_build_object(
    'me', coalesce(mm_player_card(v_player.id, me), jsonb_build_object('nick', '', 'elo', 0, 'level', 1))
          || jsonb_build_object('recent', coalesce((select jsonb_agg(case when x.won then 'W' else 'L' end) from (
               select won from player_matches where player_id = v_player.id and won is not null order by played_at desc limit 5) x), '[]')),
    'modes', (select coalesce(jsonb_agg(jsonb_build_object('mode', s.mode, 'players_per_team', g.players_per_team, 'enabled', true, 'affects_elo', s.affects_elo) order by s.position), '[]')
                from mm_mode_settings s join game_modes g on g.code = s.mode where s.enabled),
    'regions', (select coalesce(jsonb_agg(distinct region), '[]') from game_servers where mm_enabled and region is not null),
    'max_party_size', c.max_party_size,
    'invites_pref', coalesce((select preferences->>'mm_invites' from user_preferences where user_id = me), 'public'),
    'blocks', jsonb_build_object('max', c.max_blocks, 'vip_only', c.blocks_vip_only, 'allowed', not c.blocks_vip_only or v_vip,
        'list', (select coalesce(jsonb_agg(jsonb_build_object('player_id', p.id, 'nick', p.nick)), '[]') from mm_blocks b join players p on p.id = b.player_id where b.user_id = me)),
    'sounds', jsonb_build_object(
        'catalog', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'url', url) order by created_at), '[]') from mm_sounds where owner_id is null),
        'selected', v_sound.id, 'url', v_sound.url, 'can_upload', v_vip,
        'custom', case when v_vip and v_custom.id is not null then jsonb_build_object('id', v_custom.id, 'name', v_custom.name, 'url', v_custom.url) end),
    'friends', (select coalesce(jsonb_agg(jsonb_build_object('player_id', p.id, 'nick', p.nick, 'level', elo_level(mm_player_elo(p.id)),
          -- El estado solo se ve si los dos se marcaron.
          'status', case when not exists (select 1 from mm_friends o where o.user_id = p.user_id and o.player_id = v_player.id) then null
                         when exists (select 1 from mm_queue x where x.user_id = p.user_id) then 'queue'
                         when mm_active_lobby(p.user_id) is not null then 'playing'
                         else 'free' end) order by p.nick), '[]')
        from mm_friends f join players p on p.id = f.player_id where f.user_id = me),
    'sanctions', jsonb_build_object(
        'items', (select coalesce(jsonb_agg(x.j order by x.at desc), '[]') from (
            select jsonb_build_object('id', 'p' || id, 'kind', 'penalty', 'reason', reason, 'created_at', created_at, 'until', until) j, created_at at from mm_penalty_log where user_id = me
            union all select jsonb_build_object('id', id, 'kind', 'mm_ban', 'reason', reason, 'created_at', created_at, 'until', until), created_at from mm_bans where user_id = me
            union all select jsonb_build_object('id', id, 'kind', 'server_ban', 'reason', reason, 'created_at', created_at, 'until', expires_at), created_at from bans where player_id = v_player.id and lifted_at is null) x),
        'level', coalesce((select level from mm_penalties where user_id = me), 0),
        'level_resets_at', (select last_offense_at + interval '7 days' from mm_penalties where user_id = me and level > 0)),
    'newcomer', null);
end $$;

/**
 * Lo que cambia rápido: la cola, la sala, el grupo, las invitaciones, la sanción vigente, los servidores y los contadores.
 * Sin p_full, la sala va sin las estadísticas de la partida (salen de mm_lobby_match).
 */
create function public.mm_my_live(p_full boolean default false) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  c mm_config%rowtype;
  q mm_queue%rowtype;
  v_party uuid;
  v_lobby uuid;
  v_ban record;
  v_season_end timestamptz;
  v_lobby_json jsonb;
begin
  if me is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  select * into c from mm_config;
  select * into q from mm_queue where user_id = me;
  select party_id into v_party from mm_party_members where user_id = me;
  -- Sala abierta, o la que terminó en la última hora: el resumen sigue a la vista.
  v_lobby := coalesce(mm_active_lobby(me), (select l.id from mm_lobby_players lp join mm_lobbies l on l.id = lp.lobby_id
     where lp.user_id = me and l.status = 'finished' and l.ended_at > now() - interval '1 hour' order by l.ended_at desc limit 1));
  select until, reason into v_ban from mm_bans where user_id = me and until > now() order by until desc limit 1;
  select ends_at into v_season_end from seasons where status = 'active' and ends_at < now() + interval '1 hour' limit 1;
  v_lobby_json := mm_lobby_json(v_lobby, me);
  if not p_full then v_lobby_json := v_lobby_json #- '{match,stats}'; end if;
  return jsonb_build_object(
    'open', c.open,
    'queue_size', (select count(*) from mm_queue),
    'active_players', (select count(distinct x.user_id) from (select user_id from mm_queue union all select lp.user_id from mm_lobby_players lp join mm_lobbies l on l.id = lp.lobby_id where l.status not in ('finished', 'cancelled')) x),
    'live_matches', (select count(*) from mm_lobbies where status = 'live'),
    'queue', case when q.user_id is not null then jsonb_build_object('mode', q.mode, 'region', q.region, 'joined_at', q.joined_at,
        'position', (select count(*) + 1 from mm_queue o where o.mode = q.mode and o.joined_at < q.joined_at),
        'elo_window', mm_elo_window(extract(epoch from now() - q.joined_at)),
        'eta_s', (select round(extract(epoch from avg(left_at - joined_at))) from mm_queue_log where mode = q.mode and outcome = 'matched' and left_at > now() - interval '7 days')) end,
    'lobby', v_lobby_json,
    'party', case when v_party is not null then jsonb_build_object('id', v_party, 'max_size', c.max_party_size,
        'members', (select jsonb_agg(jsonb_build_object('player_id', p.id, 'nick', p.nick, 'photo_url', mm_player_photo(p.id), 'level', elo_level(mm_player_elo(p.id)), 'elo', mm_player_elo(p.id),
                       'is_me', pm.user_id = me, 'is_leader', pm.user_id = pa.leader_id) order by pm.joined_at)
                      from mm_party_members pm join players p on p.user_id = pm.user_id join mm_parties pa on pa.id = pm.party_id where pm.party_id = v_party),
        'pending', (select jsonb_build_object('to_nick', p.nick, 'expires_at', i.expires_at) from mm_party_invites i join players p on p.user_id = i.to_user
                     where i.party_id = v_party and i.status = 'pending' and i.expires_at > now() limit 1)) end,
    'invites', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'expires_at', i.expires_at,
          'from', jsonb_build_object('player_id', p.id, 'nick', p.nick, 'level', elo_level(mm_player_elo(p.id)), 'elo', mm_player_elo(p.id)))), '[]')
        from mm_party_invites i join players p on p.user_id = i.from_user where i.to_user = me and i.status = 'pending' and i.expires_at > now()),
    'penalty', (select jsonb_build_object('until', until, 'level', level) from mm_penalties where user_id = me and until > now()),
    'queue_activity', jsonb_build_object(
        'modes', (select coalesce(jsonb_agg(jsonb_build_object('mode', s.mode, 'searching', n.c, 'missing', g.players_per_team * 2 - n.c % (g.players_per_team * 2)) order by s.position), '[]')
                    from mm_mode_settings s join game_modes g on g.code = s.mode cross join lateral (select count(*)::int c from mm_queue q2 where q2.mode = s.mode) n where s.enabled),
        'levels', jsonb_build_array(
          jsonb_build_object('label', 'Nivel 1 a 3', 'count', (select count(*) from mm_queue where elo_level(elo) between 1 and 3)),
          jsonb_build_object('label', 'Nivel 4 a 7', 'count', (select count(*) from mm_queue where elo_level(elo) between 4 and 7)),
          jsonb_build_object('label', 'Nivel 8 a 10', 'count', (select count(*) from mm_queue where elo_level(elo) >= 8))),
        'players', (select coalesce(jsonb_agg(jsonb_build_object('player_id', x.id, 'nick', x.nick, 'level', elo_level(x.elo), 'mode', x.mode) order by x.joined_at), '[]')
                      from (select p.id, p.nick, q3.elo, q3.mode, q3.joined_at from mm_queue q3 join players p on p.id = q3.player_id order by q3.joined_at limit 50) x)),
    'anticheat', jsonb_build_object('required', c.require_anticheat, 'status', case
        when exists (select 1 from ac_devices d where d.user_id = me and d.revoked_at is null and d.last_seen_at > now() - interval '90 seconds') then 'ok'
        when exists (select 1 from ac_devices d where d.user_id = me and d.revoked_at is null) then 'stale' else 'no_agent' end),
    'ban', case when v_ban.until is not null then jsonb_build_object('until', v_ban.until, 'reason', v_ban.reason) end,
    'servers', jsonb_build_object(
        'total', (select count(*) from game_servers where mm_enabled and active),
        'free', (select count(*) from game_servers s join mm_server_state st on st.server_id = s.id where s.mm_enabled and s.active and st.last_poll_at > now() - interval '30 seconds'
                   and not exists (select 1 from mm_lobbies l where l.server_id = s.id and l.status not in ('finished', 'cancelled')))),
    'season', case when v_season_end is not null then jsonb_build_object('ends_at', v_season_end,
        'queue_closes_at', v_season_end - make_interval(mins => c.season_queue_close_minutes)) end,
    'block_reason', mm_block_reason(me));
end $$;

-- El estado completo de siempre (la web vieja lo sigue usando): las dos partes juntas.
create or replace function public.mm_my_state() returns jsonb
  language sql stable security definer set search_path = public as $$
  select mm_my_profile() || mm_my_live(true) $$;

/** La partida de una sala (con las estadísticas), solo para quien jugó la sala o un admin. */
create function public.mm_lobby_match(p_lobby uuid) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  if not (is_admin() or exists (select 1 from mm_lobby_players where lobby_id = p_lobby and user_id = auth.uid())) then
    raise exception 'No jugaste esa sala' using errcode = '42501';
  end if;
  return mm_lobby_json(p_lobby, auth.uid())->'match';
end $$;

revoke all on function public.mm_queue_sizes(), public.mm_emit(text, uuid, uuid[], jsonb) from public, anon, authenticated;
revoke all on function public.mm_my_profile(), public.mm_my_live(boolean), public.mm_lobby_match(uuid), public.mm_my_state() from public, anon;
grant execute on function public.mm_my_profile(), public.mm_my_live(boolean), public.mm_lobby_match(uuid), public.mm_my_state() to authenticated;

notify pgrst, 'reload schema';

commit;
