-- Inversa del replanteo 49: deja mm_block_reason, mm_player_card y csstv_mm_poll como en la 48.
-- Una ficha sin SteamID que esté en la cola o en una sala sigue ahí: la sala se cancela sola si no se conecta.
begin;

create or replace function public.mm_block_reason(p_user uuid) returns text
  language plpgsql stable security definer set search_path = public as $$
declare
  c mm_config%rowtype;
  p players%rowtype;
  u auth.users%rowtype;
  dev ac_devices%rowtype;
  n int;
begin
  select * into c from mm_config;
  select * into p from players where user_id = p_user;
  if p.id is null then return 'Tu cuenta no tiene una ficha de jugador vinculada'; end if;
  if p.steam_id is null then return 'Tu ficha no tiene un SteamID principal'; end if;
  select * into u from auth.users where id = p_user;
  if u.email_confirmed_at is null then return 'Confirmá tu correo para jugar'; end if;
  if exists (select 1 from mm_penalties where user_id = p_user and until > now()) then return 'Tenés una sanción vigente'; end if;
  if exists (select 1 from mm_bans where user_id = p_user and until > now()) then return 'Estás excluido del matchmaking'; end if;
  if exists (select 1 from bans b where b.lifted_at is null and (b.expires_at is null or b.expires_at > now())
              and (b.player_id = p.id or b.steam_id = p.steam_id)) then return 'Tenés un baneo activo en los servidores'; end if;
  if c.min_mixes > 0 then
    n := coalesce((select maps from player_overview where id = p.id), 0);
    if n < c.min_mixes then return format('Te faltan %s mixes para jugar matchmaking', c.min_mixes - n); end if;
  end if;
  if u.created_at > now() - make_interval(days => c.min_account_days) then
    return 'Tu cuenta es muy nueva para jugar matchmaking';
  end if;
  if c.require_anticheat then
    select * into dev from ac_devices where user_id = p_user and revoked_at is null order by last_seen_at desc nulls last limit 1;
    if dev.id is null then return 'Para jugar tenés que vincular el anticheat'; end if;
    if dev.last_seen_at is null or dev.last_seen_at < now() - interval '90 seconds' then return 'Tu anticheat no está activo'; end if;
  end if;
  return null;
end $$;

create or replace function public.mm_player_card(p_player uuid, p_viewer uuid, p_lp mm_lobby_players default null) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'player_id', p.id, 'nick', p.nick, 'photo_url', p.photo_url,
    -- En una sala, el ELO con el que entró: el resumen calcula el cambio desde ese valor.
    'elo', coalesce((p_lp).elo, mm_player_elo(p.id)), 'level', elo_level(coalesce((p_lp).elo, mm_player_elo(p.id))),
    'vip', coalesce(is_vip(p.user_id), false), 'is_me', p.user_id = p_viewer, 'country', (select country from profile_details d where d.user_id = p.user_id),
    'team', (p_lp).team, 'party_id', (p_lp).party_id, 'is_captain', coalesce((p_lp).is_captain, false),
    'accepted', (p_lp).accepted_at is not null, 'connected', (p_lp).connected_at is not null,
    'left_until', (p_lp).left_at + make_interval(mins => (select reconnect_minutes from mm_config)),
    'abandoned', coalesce((p_lp).abandoned, false),
    'anticheat', exists (select 1 from ac_devices d where d.user_id = p.user_id and d.revoked_at is null and d.last_seen_at > now() - interval '90 seconds'),
    'form', coalesce((select jsonb_agg(case when x.won then 'W' else 'L' end) from (
        select won from player_matches where player_id = p.id and won is not null order by played_at desc limit 5) x), '[]'),
    'fav_map', (select jsonb_build_object('map', map_name, 'win_pct', round(100.0 * wins / nullif(wins + losses, 0)))
                  from player_map_stats where player_id = p.id and wins + losses > 0
                 order by 1.0 * wins / (wins + losses) desc, maps desc limit 1),
    'elo_trend', (select elo_delta from player_matches where player_id = p.id and elo_delta is not null order by played_at desc limit 1),
    'recent', (select jsonb_build_object('matches', count(*), 'win_pct', round(100.0 * count(*) filter (where won) / nullif(count(*), 0)),
                  'rating', round(coalesce(avg(rating), 0), 2), 'k', round(coalesce(avg(kills), 0)), 'd', round(coalesce(avg(deaths), 0)), 'a', round(coalesce(avg(assists), 0)),
                  'kd', round(coalesce(sum(kills)::numeric / nullif(sum(deaths), 0), 0), 2), 'kr', round(coalesce(sum(kills)::numeric / nullif(sum(rounds), 0), 0), 2),
                  'adr', round(coalesce(sum(damage)::numeric / nullif(sum(rounds), 0), 0), 1))
                from (select * from player_matches where player_id = p.id order by played_at desc limit 30) r having count(*) > 0),
    'meetings', jsonb_build_object(
      'with', mm_meetings(p_viewer, p.id, true), 'against', mm_meetings(p_viewer, p.id, false)))
  from players p where p.id = p_player $$;

create or replace function public.csstv_mm_poll(p_token text, p_version text default null) returns text
  language plpgsql security definer set search_path = public as $$
declare
  v_server uuid;
  l mm_lobbies%rowtype;
  m matches%rowtype;
  pw mm_server_passwords%rowtype;
  linea text := E'\n';
begin
  begin
    v_server := csstv_auth(p_token);
  exception when others then
    return 'ok=0' || linea || 'error=' || sqlerrm;
  end;
  insert into mm_server_state (server_id, last_poll_at, plugin_version) values (v_server, now(), p_version)
    on conflict (server_id) do update set last_poll_at = now(), plugin_version = coalesce(excluded.plugin_version, mm_server_state.plugin_version);
  select * into l from mm_lobbies where server_id = v_server and status in ('assigned', 'connecting', 'live') order by created_at desc limit 1;
  if l.id is null then
    -- Rotación pedida por un admin, pendiente de aplicar.
    select * into pw from mm_server_passwords where server_id = v_server and kind = 'idle' and applied_at is null order by created_at desc limit 1;
    return concat_ws(linea, 'ok=1', 'lobby=', case when pw.id is not null then 'idle_id=' || pw.id end, case when pw.id is not null then 'idle_password=' || pw.password end);
  end if;
  select * into m from matches where id = l.match_id;
  return concat_ws(linea, 'ok=1', 'lobby=' || l.id, 'status=' || l.status, 'map=' || l.map, 'password=' || l.password, 'code=' || m.link_code,
    'team1=' || translate(m.side1_name, E'\r\n', '  '), 'team2=' || translate(m.side2_name, E'\r\n', '  '),
    't1=' || coalesce((select string_agg(csstv_steam2(p.steam_id), ',') from mm_lobby_players lp join players p on p.id = lp.player_id where lp.lobby_id = l.id and lp.team = 1), ''),
    't2=' || coalesce((select string_agg(csstv_steam2(p.steam_id), ',') from mm_lobby_players lp join players p on p.id = lp.player_id where lp.lobby_id = l.id and lp.team = 2), ''),
    'connect_seconds=' || coalesce(extract(epoch from greatest(l.connect_deadline - now(), interval '0'))::int, (select connect_minutes * 60 from mm_config)),
    'abandons=' || (select count(*) filter (where team = 1 and abandoned) || ',' || count(*) filter (where team = 2 and abandoned) from mm_lobby_players where lobby_id = l.id),
    case when l.forfeit_team is not null then 'forfeit=' || l.forfeit_team end);
end $$;

notify pgrst, 'reload schema';

commit;
