-- Replanteo 28: notificaciones en la web, primera etapa (plan docs/bitacora/2026-10-25-notificaciones).
--   1. Tabla notifications (una fila por destinatario: la cuenta, no la ficha), con RLS: cada uno lee las suyas.
--   2. notify(): saca al autor, a las fichas sin cuenta y a los que apagaron la categoría; recorta a 100 por cuenta.
--      Preferencias en user_preferences.preferences.notifications (`news` apagada por defecto; tres obligatorias).
--   3. Los eventos, casi todos con triggers en las tablas: salen igual desde la API, el plugin o el SQL Editor.
--      Las tareas programadas (partida en 1 hora, PCW vencida, temporada por terminar…) son la segunda etapa.
--   4. notifications_mark_read y notifications_unread para la API.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.notifications') is not null then
    raise exception 'replanteo 28: ya existe notifications (¿ya se aplicó?)';
  end if;
  if to_regclass('public.mix_deletions') is null then
    raise exception 'replanteo 28: falta mix_deletions (aplicar antes 27_mixes_perfil_ranking.sql)';
  end if;
  if to_regclass('public.season_standings') is null then
    raise exception 'replanteo 28: falta season_standings (aplicar antes 24_temporadas.sql)';
  end if;
end $$;

-- =====================================================================================================
-- 1. Tabla
-- =====================================================================================================
create table public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null,
  category    text not null check (category in ('team', 'tournament', 'pcw', 'elo', 'season', 'account', 'news', 'admin')),
  data        jsonb not null default '{}',
  ref         text,
  actionable  boolean not null default false,
  resolution  text check (resolution in ('accepted', 'rejected', 'cancelled', 'expired')),
  actor_id    uuid,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index notifications_user on public.notifications (user_id, id desc);
create index notifications_unread on public.notifications (user_id) where read_at is null;
create index notifications_ref on public.notifications (ref) where ref is not null;
comment on table public.notifications is
  'Notificaciones de la web (últimas 100 por cuenta). El texto lo arma el frontend con type y data';

alter table public.notifications enable row level security;
create policy notifications_own on public.notifications for select to authenticated using (user_id = auth.uid());
revoke all on table public.notifications from anon, authenticated;
grant select on table public.notifications to authenticated;

-- =====================================================================================================
-- 2. Categorías, preferencias y notify()
-- =====================================================================================================
-- Mismos tramos que LEVEL_FLOORS (web/backend/src/lib/db.ts).
create function public.elo_level(p_elo integer) returns integer language sql immutable as $$
  select case when p_elo is null then null
              else (select count(*)::int from unnest(array[0, 501, 751, 901, 1051, 1201, 1351, 1531, 1751, 2001]) f where p_elo >= f) end $$;

create function public.notification_category(p_type text) returns text language sql immutable as $$
  select case
    when p_type in ('team_invite', 'team_join_request', 'team_invite_answered', 'team_join_answered', 'team_captain', 'team_removed',
                    'team_member_left', 'team_role_changed', 'team_added', 'team_deleted', 'team_request_answered') then 'team'
    when p_type in ('event_registration', 'event_fixture', 'match_scheduled', 'veto_turn', 'veto_done', 'veto_reset',
                    'match_result', 'event_progress', 'event_cancelled') then 'tournament'
    when p_type in ('pcw_accepted', 'pcw_cancelled', 'pcw_result') then 'pcw'
    when p_type in ('level_changed', 'mix_review_resolved', 'mix_deleted', 'elo_adjusted', 'clip_ready') then 'elo'
    when p_type in ('season_ranked', 'season_closed', 'medal_granted') then 'season'
    when p_type in ('steam_claimed', 'steam_request_answered', 'alias_changed', 'role_changed', 'password_changed') then 'account'
    when p_type in ('event_new', 'season_started') then 'news'
    when p_type in ('admin_steam_request', 'admin_team_request', 'admin_mix_review', 'admin_demo_failed', 'admin_season_delayed') then 'admin'
  end $$;

alter table public.notifications add constraint notifications_type_ok check (public.notification_category(type) is not null);

-- Las que no se apagan: sin ellas el que invita o pide nunca recibe respuesta, y la contraseña es seguridad.
create function public.notification_required(p_type text) returns boolean language sql immutable as $$
  select p_type in ('team_invite', 'team_join_request', 'password_changed') $$;

-- La cuenta quiere esta categoría: lo que eligió en preferences.notifications o el valor por defecto
-- (todas prendidas menos `news`).
create function public.notification_wants(p_user uuid, p_type text) returns boolean
  language sql stable security definer set search_path = public as $$
  select notification_required(p_type) or coalesce(
    (select (up.preferences -> 'notifications' ->> notification_category(p_type))::boolean
       from user_preferences up where up.user_id = p_user
        and jsonb_typeof(up.preferences -> 'notifications' -> notification_category(p_type)) = 'boolean'),
    notification_category(p_type) <> 'news') $$;

-- Crea la notificación para cada cuenta. No a quien hizo la acción (salvo p_keep_actor), ni a ids que no son cuentas,
-- ni a quien apagó la categoría. Recorta a las últimas 100 por cuenta.
create function public.notify(p_users uuid[], p_type text, p_data jsonb default '{}', p_ref text default null,
                              p_keep_actor boolean default false) returns void
  language plpgsql security definer set search_path = public as $$
declare v_users uuid[];
begin
  select coalesce(array_agg(distinct u), '{}') into v_users
    from unnest(p_users) u
   where u is not null
     and (p_keep_actor or u is distinct from auth.uid())
     and exists (select 1 from profiles where id = u)
     and notification_wants(u, p_type);
  if cardinality(v_users) = 0 then return; end if;
  insert into notifications(user_id, type, category, data, ref, actionable, actor_id)
  select u, p_type, notification_category(p_type), coalesce(p_data, '{}'), p_ref,
         p_type in ('team_invite', 'team_join_request'), auth.uid()
    from unnest(v_users) u;
  delete from notifications n
   using (select id from (select id, row_number() over (partition by user_id order by id desc) as rn
                            from notifications where user_id = any(v_users)) x where x.rn > 100) d
   where n.id = d.id;
end $$;

create function public.notifications_resolve(p_ref text, p_resolution text) returns void
  language sql security definer set search_path = public as $$
  update notifications set resolution = p_resolution where ref = p_ref and resolution is null $$;

-- Ayudantes: de fichas, SteamID, equipos y partidas a cuentas.
create function public.users_of_players(p_players uuid[]) returns uuid[]
  language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct user_id), '{}') from players where id = any(p_players) and user_id is not null $$;

create function public.users_of_steam(p_steam text[]) returns uuid[]
  language sql stable security definer set search_path = public as $$
  select users_of_players(array(select steam_owner(s) from unnest(p_steam) s)) $$;

create function public.team_roster_users(p_team uuid) returns uuid[]
  language sql stable security definer set search_path = public as $$
  select users_of_players(array(select player_id from team_members where team_id = p_team and left_at is null)) $$;

-- Los que juegan por ese equipo en una partida: los inscritos en el torneo; si no, el roster activo.
create function public.side_users(p_team uuid, p_event uuid default null) returns uuid[]
  language sql stable security definer set search_path = public as $$
  select case when p_event is not null and exists (select 1 from tournament_registration_players where event_id = p_event and team_id = p_team)
              then users_of_players(array(select player_id from tournament_registration_players where event_id = p_event and team_id = p_team))
              else team_roster_users(p_team) end $$;

create function public.match_users(p_match uuid) returns uuid[]
  language sql stable security definer set search_path = public as $$
  select coalesce(side_users(m.team1, m.event_id), '{}') || coalesce(side_users(m.team2, m.event_id), '{}')
    from matches m where m.id = p_match $$;

create function public.mix_users(p_match uuid) returns uuid[]
  language sql stable security definer set search_path = public as $$
  select users_of_steam(array(select steam_id from match_player_stats where match_id = p_match)) $$;

create function public.notify_admin_ids() returns uuid[]
  language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from profiles where role = 'admin' $$;

create function public.team_ref(p_team uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'name', name, 'tag', tag) from teams where id = p_team $$;

create function public.player_ref(p_player uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'alias', nick) from players where id = p_player $$;

create function public.event_ref(p_event uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'name', name) from events where id = p_event $$;

-- Recibe el id (no la fila): una función con la fila de matches sería una columna calculada para PostgREST.
create function public.match_ref(p_match uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('match_id', m.id, 'kind', m.kind, 'team1', team_ref(m.team1), 'team2', team_ref(m.team2),
                            'event', event_ref(m.event_id), 'starts_at', m.starts_at)
    from matches m where m.id = p_match $$;

revoke all on function public.notify(uuid[], text, jsonb, text, boolean), public.notifications_resolve(text, text),
  public.notification_wants(uuid, text), public.users_of_players(uuid[]), public.users_of_steam(text[]),
  public.team_roster_users(uuid), public.side_users(uuid, uuid), public.match_users(uuid), public.mix_users(uuid),
  public.notify_admin_ids(), public.team_ref(uuid), public.player_ref(uuid), public.event_ref(uuid), public.match_ref(uuid)
  from public, anon, authenticated;

-- =====================================================================================================
-- 3. Eventos
-- =====================================================================================================
-- ---------- Equipos ----------
create function public.tg_notify_team_invites() returns trigger language plpgsql security definer set search_path = public as $$
declare v_ref text := 'team_invite:' || new.id; v_team jsonb := team_ref(new.team_id);
begin
  if tg_op = 'INSERT' then
    if new.status <> 'open' then return null; end if;
    if new.kind = 'invite' then
      perform notify(users_of_players(array[new.player_id]), 'team_invite',
                     jsonb_build_object('invite_id', new.id, 'team', v_team), v_ref);
    else
      perform notify(array[(select captain_id from teams where id = new.team_id)], 'team_join_request',
                     jsonb_build_object('invite_id', new.id, 'team', v_team, 'player', player_ref(new.player_id)), v_ref);
    end if;
  elsif old.status = 'open' and new.status <> 'open' then
    perform notifications_resolve(v_ref, new.status);
    if new.status in ('accepted', 'rejected') then
      if new.kind = 'invite' then
        perform notify(array[(select captain_id from teams where id = new.team_id)], 'team_invite_answered',
                       jsonb_build_object('team', v_team, 'player', player_ref(new.player_id), 'accepted', new.status = 'accepted'));
      else
        perform notify(users_of_players(array[new.player_id]), 'team_join_answered',
                       jsonb_build_object('team', v_team, 'accepted', new.status = 'accepted'));
      end if;
    end if;
  end if;
  return null;
end $$;
create trigger notify_team_invites after insert or update of status on public.team_invites
  for each row execute function public.tg_notify_team_invites();

create function public.tg_notify_teams() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.kind = 'official' then
      perform set_config('v34.team_deleting', old.id::text, true);
      perform notify(team_roster_users(old.id), 'team_deleted', jsonb_build_object('team', jsonb_build_object('id', old.id, 'name', old.name, 'tag', old.tag)));
    end if;
    return old;
  end if;
  if new.kind = 'official' and new.captain_id is distinct from old.captain_id and new.captain_id is not null then
    perform notify(array[new.captain_id], 'team_captain', jsonb_build_object('team', team_ref(new.id)));
  end if;
  return null;
end $$;
create trigger notify_teams_captain after update of captain_id on public.teams
  for each row execute function public.tg_notify_teams();
create trigger notify_teams_delete before delete on public.teams
  for each row execute function public.tg_notify_teams();

create function public.tg_notify_team_members() returns trigger language plpgsql security definer set search_path = public as $$
declare t teams%rowtype; v_user uuid;
begin
  select * into t from teams where id = new.team_id;
  if t.kind is distinct from 'official' then return null; end if;
  v_user := (select user_id from players where id = new.player_id);
  if tg_op = 'INSERT' then
    -- Entró por una invitación o un pedido (lo avisa su respuesta) o es quien creó el equipo: nada más.
    if new.left_at is null and v_user is distinct from t.captain_id
       and not exists (select 1 from team_invites where team_id = new.team_id and player_id = new.player_id and status = 'open') then
      perform notify(array[v_user], 'team_added', jsonb_build_object('team', team_ref(t.id), 'role', new.role));
    end if;
    return null;
  end if;
  if old.left_at is null and new.left_at is not null then
    if current_setting('v34.team_deleting', true) = t.id::text then return null; end if;
    if v_user is not null and v_user = auth.uid() then
      perform notify(array[t.captain_id], 'team_member_left', jsonb_build_object('team', team_ref(t.id), 'player', player_ref(new.player_id)));
    else
      perform notify(array[v_user], 'team_removed', jsonb_build_object('team', team_ref(t.id)));
    end if;
  elsif new.left_at is null and new.role is distinct from old.role then
    perform notify(array[v_user], 'team_role_changed', jsonb_build_object('team', team_ref(t.id), 'role', new.role));
  end if;
  return null;
end $$;
create trigger notify_team_members after insert or update of left_at, role on public.team_members
  for each row execute function public.tg_notify_team_members();

create function public.tg_notify_team_requests() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or (old.status is distinct from 'pending' and new.status = 'pending') then
    if new.status = 'pending' then
      perform notify(notify_admin_ids(), 'admin_team_request',
                     jsonb_build_object('name', new.name, 'tag', new.tag, 'user', jsonb_build_object('id', new.user_id, 'alias', (select tag from profiles where id = new.user_id))));
    end if;
  elsif old.status = 'pending' and new.status in ('approved', 'rejected') then
    perform notify(array[new.user_id], 'team_request_answered',
                   jsonb_build_object('name', new.name, 'tag', new.tag, 'approved', new.status = 'approved'));
  end if;
  return null;
end $$;
create trigger notify_team_requests after insert or update of status on public.team_requests
  for each row execute function public.tg_notify_team_requests();

-- ---------- Cuenta y SteamID ----------
create function public.tg_notify_steam_requests() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      perform notify(notify_admin_ids(), 'admin_steam_request', jsonb_build_object('kind', new.kind, 'player', player_ref(new.player_id)));
    end if;
  elsif old.status = 'pending' and new.status in ('approved', 'rejected') then
    perform notify(array[coalesce(new.user_id, (select user_id from players where id = new.player_id))], 'steam_request_answered',
                   jsonb_build_object('kind', new.kind, 'approved', new.status = 'approved', 'reason', new.reason));
  end if;
  return null;
end $$;
create trigger notify_steam_requests after insert or update of status on public.steam_requests
  for each row execute function public.tg_notify_steam_requests();

-- claim_with_code escribe 'Listo: tu cuenta quedó vinculada' solo cuando vincula de verdad (no si ya estaba o queda pendiente).
create function public.tg_notify_claim_log() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.ok and new.user_id is not null and new.result like 'Listo:%' then
    perform notify(array[new.user_id], 'steam_claimed', jsonb_build_object('player', player_ref(new.player_id), 'nick', new.nick));
  end if;
  return null;
end $$;
create trigger notify_claim_log after insert on public.claim_log
  for each row execute function public.tg_notify_claim_log();

create function public.tg_notify_profiles() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- El alias que cambia el propio usuario no se avisa; el que cambia un admin, sí.
  if new.tag is distinct from old.tag and auth.uid() is distinct from new.id then
    perform notify(array[new.id], 'alias_changed', jsonb_build_object('alias', new.tag));
  end if;
  if new.role is distinct from old.role then
    perform notify(array[new.id], 'role_changed', jsonb_build_object('role', new.role));
  end if;
  if new.password_changed_at is distinct from old.password_changed_at and new.password_changed_at is not null then
    perform notify(array[new.id], 'password_changed', jsonb_build_object('at', new.password_changed_at), null, true);
  end if;
  return null;
end $$;
create trigger notify_profiles after update of tag, role, password_changed_at on public.profiles
  for each row execute function public.tg_notify_profiles();

-- ---------- Mixes y ELO ----------
-- Nivel y "ya tienes puesto en la temporada". No dentro de elo_recompute_all (un recálculo no es una novedad).
create function public.tg_notify_player_elo() returns trigger language plpgsql security definer set search_path = public as $$
declare s seasons%rowtype; n int; v_users uuid[];
begin
  if current_setting('v34.elo_recompute', true) = 'on' then return null; end if;
  v_users := users_of_steam(array[new.steam_id]);
  if elo_level(new.elo) is distinct from elo_level(old.elo) and old.elo is not null then
    perform notify(v_users, 'level_changed', jsonb_build_object('from', elo_level(old.elo), 'to', elo_level(new.elo), 'elo', new.elo));
  end if;
  if new.matches > old.matches then
    select * into s from seasons where status = 'active';
    if s.id is not null then
      select count(*) into n
        from match_player_stats mps join matches m on m.id = mps.match_id
       where elo_key(mps.steam_id) = new.steam_id and m.kind = 'mix' and m.status = 'finished'
         and mps.elo_after is not null and coalesce(m.played_at, m.starts_at) > s.starts_at;
      if n = s.min_matches then
        perform notify(v_users, 'season_ranked',
                       jsonb_build_object('season', jsonb_build_object('id', s.id, 'number', s.number, 'name', s.name), 'min_matches', s.min_matches));
      end if;
    end if;
  end if;
  return null;
end $$;
create trigger notify_player_elo after update of elo, matches on public.player_elo
  for each row execute function public.tg_notify_player_elo();

create function public.tg_notify_match_crashes() returns trigger language plpgsql security definer set search_path = public as $$
declare m matches%rowtype;
begin
  select * into m from matches where id = new.match_id;
  if tg_op = 'INSERT' then
    perform notify(notify_admin_ids(), 'admin_mix_review', jsonb_build_object('match_id', new.match_id, 'map', m.map));
  elsif old.decision is null and new.decision is not null then
    perform notify(mix_users(new.match_id), 'mix_review_resolved',
                   jsonb_build_object('match_id', new.match_id, 'map', m.map, 'applied', new.decision = 'applied'));
  end if;
  return null;
end $$;
create trigger notify_match_crashes after insert or update of decision on public.match_crashes
  for each row execute function public.tg_notify_match_crashes();

-- admin_delete_mix escribe el registro antes de borrar la partida: las stats todavía están.
create function public.tg_notify_mix_deletions() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform notify(mix_users(new.match_id), 'mix_deleted',
                 jsonb_build_object('map', new.map, 'played_at', new.played_at, 'elo_mode', new.elo_mode));
  return null;
end $$;
create trigger notify_mix_deletions after insert on public.mix_deletions
  for each row execute function public.tg_notify_mix_deletions();

-- Solo los ajustes del admin ('manual'); los internos de un mix borrado ('mix_kept') no se ven.
create function public.tg_notify_elo_adjustments() returns trigger language plpgsql security definer set search_path = public as $$
declare a elo_adjustments%rowtype;
begin
  a := case when tg_op = 'DELETE' then old else new end;
  if a.source <> 'manual' then return null; end if;
  perform notify(users_of_steam(array[a.steam_id]), 'elo_adjusted',
                 jsonb_build_object('delta', a.delta, 'set_elo', a.set_elo, 'reason', a.reason, 'removed', tg_op = 'DELETE'));
  return null;
end $$;
create trigger notify_elo_adjustments after insert or delete on public.elo_adjustments
  for each row execute function public.tg_notify_elo_adjustments();

-- Un clip reprocesado (migración 20261028180000_clips_vip_reprocesar.sql) avisa cuando el admin lo aprueba, no al grabarse.
create function public.tg_notify_match_clips() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.video_status = 'done' and old.video_status is distinct from 'done' and new.video_review is distinct from 'pending')
     or (new.video_review = 'approved' and old.video_review is distinct from 'approved') then
    perform notify(users_of_steam(array[new.player_steamid]), 'clip_ready',
                   jsonb_build_object('clip_id', new.id, 'match_id', new.match_id, 'round', new.round,
                                      'kills', cardinality(new.kill_ticks), 'clutch_vs', new.clutch_vs));
  end if;
  return null;
end $$;
create trigger notify_match_clips after update of video_status, video_review on public.match_clips
  for each row execute function public.tg_notify_match_clips();

-- ---------- Temporadas y medallas ----------
create function public.tg_notify_season_standings() returns trigger language plpgsql security definer set search_path = public as $$
declare s seasons%rowtype;
begin
  if new.matches = 0 then return null; end if;
  select * into s from seasons where id = new.season_id;
  perform notify(users_of_players(array[new.player_id]), 'season_closed',
                 jsonb_build_object('season', jsonb_build_object('id', s.id, 'number', s.number, 'name', s.name),
                                    'rank', new.rank, 'eligible', new.eligible, 'elo', new.elo, 'elo_after', new.elo_after,
                                    'medal', case when new.tier is not null then jsonb_build_object('name', new.tier, 'icon', new.icon) end));
  return null;
end $$;
create trigger notify_season_standings after insert on public.season_standings
  for each row execute function public.tg_notify_season_standings();

create function public.tg_notify_seasons() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform notify(array(select id from profiles), 'season_started',
                 jsonb_build_object('season', jsonb_build_object('id', new.id, 'number', new.number, 'name', new.name), 'ends_at', new.ends_at));
  return null;
end $$;
create trigger notify_seasons after insert on public.seasons
  for each row execute function public.tg_notify_seasons();

-- Las medallas de una temporada se avisan con season_closed; acá solo las que da un admin a mano.
create function public.tg_notify_player_medals() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.season_id is null then
    perform notify(users_of_players(array[new.player_id]), 'medal_granted', jsonb_build_object('title', new.title, 'icon', new.icon));
  end if;
  return null;
end $$;
create trigger notify_player_medals after insert on public.player_medals
  for each row execute function public.tg_notify_player_medals();

-- El cron avisa a los admins que el cierre espera por un mix en vivo (una vez cada 6 horas como mucho).
create function public.notify_season_delayed(p_season uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from notifications where type = 'admin_season_delayed' and data ->> 'season_id' = p_season::text
              and created_at > now() - interval '6 hours') then
    return;
  end if;
  perform notify(notify_admin_ids(), 'admin_season_delayed', jsonb_build_object('season_id', p_season));
end $$;
revoke all on function public.notify_season_delayed(uuid) from public, anon, authenticated;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 28: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.season_close_due()', array[
  [E'    return jsonb_build_object(''closed'', false, ''reason'', ''live_match'', ''season_id'', s.id, ''ends_at'', s.ends_at);',
   E'    perform notify_season_delayed(s.id); -- (replanteo 28)\n' ||
   E'    return jsonb_build_object(''closed'', false, ''reason'', ''live_match'', ''season_id'', s.id, ''ends_at'', s.ends_at);']
]);

-- ---------- Partidas: horario, veto, resultado y demo ----------
create function public.tg_notify_matches() returns trigger language plpgsql security definer set search_path = public as $$
declare v_seq text[];
begin
  if new.kind = 'mix' then
    if tg_op = 'UPDATE' and new.demo_status = 'missing' and old.demo_status is distinct from 'missing' then
      perform notify(notify_admin_ids(), 'admin_demo_failed', jsonb_build_object('match_id', new.id, 'map', new.map));
    end if;
    return null;
  end if;
  if coalesce(new.bye, false) then return null; end if;

  -- Empieza el veto: los dos equipos definidos y la partida por jugar. Le toca al equipo 1.
  if new.status = 'upcoming' and new.team1 is not null and new.team2 is not null
     and (tg_op = 'INSERT' or old.team1 is null or old.team2 is null)
     and not exists (select 1 from match_vetos where match_id = new.id) then
    v_seq := veto_sequence(new.best_of, (select count(*)::int from map_pool where active));
    if cardinality(v_seq) > 0 then
      perform notify(array[(select captain_id from teams where id = new.team1)], 'veto_turn',
                     match_ref(new.id) || jsonb_build_object('action', v_seq[1]));
    end if;
  end if;
  if tg_op = 'INSERT' then return null; end if;

  if new.kind = 'official' and new.status = 'upcoming' and new.starts_at is distinct from old.starts_at and new.starts_at is not null
     and new.team1 is not null and new.team2 is not null then
    perform notify(match_users(new.id), 'match_scheduled', match_ref(new.id) || jsonb_build_object('previous', old.starts_at));
  end if;

  if new.status = 'finished' and (old.status is distinct from 'finished' or new.winner is distinct from old.winner
                                  or new.score1 is distinct from old.score1 or new.score2 is distinct from old.score2) then
    perform notify(match_users(new.id), case when new.kind = 'pcw' then 'pcw_result' else 'match_result' end,
                   match_ref(new.id) || jsonb_build_object('score1', new.score1, 'score2', new.score2, 'winner', new.winner,
                                                        'walkover', new.end_reason = 'walkover', 'corrected', old.status = 'finished'));
  end if;
  return null;
end $$;
create trigger notify_matches after insert or update of team1, team2, status, starts_at, winner, score1, score2, demo_status
  on public.matches for each row execute function public.tg_notify_matches();

create function public.tg_notify_match_vetos() returns trigger language plpgsql security definer set search_path = public as $$
declare m matches%rowtype; v_seq text[]; v_next uuid;
begin
  if tg_op = 'DELETE' then
    -- veto_reset borra todo el veto: se avisa una vez (con el primer paso). Si se borró la partida, nada.
    if old.seq <> 1 then return null; end if;
    select * into m from matches where id = old.match_id;
    if not found then return null; end if;
    perform notify(array[(select captain_id from teams where id = m.team1), (select captain_id from teams where id = m.team2)],
                   'veto_reset', match_ref(m.id));
    return null;
  end if;
  select * into m from matches where id = new.match_id;
  v_seq := veto_sequence(m.best_of, (select count(*)::int from map_pool where active));
  if new.seq < cardinality(v_seq) then
    v_next := case when new.seq % 2 = 0 then m.team1 else m.team2 end;
    perform notify(array[(select captain_id from teams where id = v_next)], 'veto_turn',
                   match_ref(m.id) || jsonb_build_object('action', v_seq[new.seq + 1], 'last', jsonb_build_object('map', new.map, 'action', new.action)));
  else
    perform notify(match_users(m.id), 'veto_done',
                   match_ref(m.id) || jsonb_build_object('maps', (select coalesce(jsonb_agg(jsonb_build_object('map', map, 'version', version) order by seq), '[]')
                                                                 from match_vetos where match_id = m.id and action = 'pick')));
  end if;
  return null;
end $$;
create trigger notify_match_vetos after insert or delete on public.match_vetos
  for each row execute function public.tg_notify_match_vetos();

-- ---------- Torneos ----------
create function public.tg_notify_events() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if tg_op = 'INSERT' then
    if new.status = 'registration' then
      perform notify(array(select id from profiles), 'event_new', jsonb_build_object('event', event_ref(new.id), 'starts_on', new.starts_on));
    end if;
    return null;
  end if;
  if tg_op = 'DELETE' then
    perform notify(array(select unnest(side_users(team_id, old.id)) from tournament_registrations where event_id = old.id),
                   'event_cancelled', jsonb_build_object('event', jsonb_build_object('id', old.id, 'name', old.name)));
    return old;
  end if;
  if new.status = old.status then return null; end if;
  if new.status = 'in_progress' and old.status = 'registration' then
    -- Fixture listo: cada equipo con su primer rival.
    for r in
      select tr.team_id,
             (select m.id from matches m where m.event_id = new.id and (m.team1 = tr.team_id or m.team2 = tr.team_id) and not coalesce(m.bye, false)
               order by m.round nulls last, m.pos nulls last limit 1) as match_id
        from tournament_registrations tr where tr.event_id = new.id
    loop
      perform notify(side_users(r.team_id, new.id), 'event_fixture',
                     jsonb_build_object('event', event_ref(new.id), 'team', team_ref(r.team_id), 'match_id', r.match_id,
                                        'opponent', (select team_ref(case when m.team1 = r.team_id then m.team2 else m.team1 end)
                                                       from matches m where m.id = r.match_id)));
    end loop;
  elsif new.status = 'cancelled' then
    perform notify(array(select unnest(side_users(team_id, new.id)) from tournament_registrations where event_id = new.id),
                   'event_cancelled', jsonb_build_object('event', event_ref(new.id)));
  elsif new.status = 'finished' then
    for r in select distinct team_id, result from player_titles where event_id = new.id loop
      perform notify(side_users(r.team_id, new.id), 'event_progress',
                     jsonb_build_object('event', event_ref(new.id), 'team', team_ref(r.team_id), 'result', r.result));
    end loop;
  end if;
  return null;
end $$;
create trigger notify_events after insert or update of status on public.events
  for each row execute function public.tg_notify_events();
create trigger notify_events_delete before delete on public.events
  for each row execute function public.tg_notify_events();

-- Alta o baja hecha por el organizador (no por el líder del equipo): se le avisa al líder.
create function public.tg_notify_registrations() returns trigger language plpgsql security definer set search_path = public as $$
declare r tournament_registrations%rowtype; v_captain uuid;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  if not exists (select 1 from events where id = r.event_id and status = 'registration') then return null; end if;
  v_captain := (select captain_id from teams where id = r.team_id);
  if v_captain is not distinct from auth.uid() then return null; end if;
  perform notify(array[v_captain], 'event_registration',
                 jsonb_build_object('event', event_ref(r.event_id), 'team', team_ref(r.team_id), 'registered', tg_op = 'INSERT'));
  return null;
end $$;
create trigger notify_registrations after insert or delete on public.tournament_registrations
  for each row execute function public.tg_notify_registrations();

-- ---------- PCW ----------
-- accept_pcw pasa el anuncio a 'matched'; cancel_pcw_match lo pasa a 'cancelled' antes de borrar la partida.
create function public.tg_notify_pcw_posts() returns trigger language plpgsql security definer set search_path = public as $$
declare m matches%rowtype;
begin
  if old.status = new.status then return null; end if;
  select * into m from matches where id = coalesce(new.match_id, old.match_id);
  if old.status = 'open' and new.status = 'matched' then
    perform notify(array[new.by_user] || team_roster_users(new.team_id), 'pcw_accepted',
                   match_ref(m.id) || jsonb_build_object('rival', team_ref(case when m.team1 = new.team_id then m.team2 else m.team1 end)));
  elsif old.status = 'matched' and new.status = 'cancelled' and m.id is not null then
    perform notify(match_users(m.id), 'pcw_cancelled', match_ref(m.id));
  end if;
  return null;
end $$;
create trigger notify_pcw_posts after update of status on public.pcw_posts
  for each row execute function public.tg_notify_pcw_posts();

revoke all on function public.tg_notify_team_invites(), public.tg_notify_teams(), public.tg_notify_team_members(),
  public.tg_notify_team_requests(), public.tg_notify_steam_requests(), public.tg_notify_claim_log(), public.tg_notify_profiles(),
  public.tg_notify_player_elo(), public.tg_notify_match_crashes(), public.tg_notify_mix_deletions(), public.tg_notify_elo_adjustments(),
  public.tg_notify_match_clips(), public.tg_notify_season_standings(), public.tg_notify_seasons(), public.tg_notify_player_medals(),
  public.tg_notify_matches(), public.tg_notify_match_vetos(), public.tg_notify_events(), public.tg_notify_registrations(),
  public.tg_notify_pcw_posts()
  from public, anon, authenticated;

-- =====================================================================================================
-- 4. Para la API
-- =====================================================================================================
-- Marca como leídas las del usuario: las de p_ids o, con p_all, todas. Devuelve cuántas cambió.
create function public.notifications_mark_read(p_ids bigint[] default null, p_all boolean default false) returns integer
  language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  update notifications set read_at = now()
   where user_id = auth.uid() and read_at is null and (p_all or id = any(coalesce(p_ids, '{}')));
  get diagnostics n = row_count;
  return n;
end $$;

-- Contador de la campana: sin leer, pendientes de responder y la última (para el ETag).
create function public.notifications_unread() returns table(unread integer, actionable integer, last_id bigint)
  language sql stable security definer set search_path = public as $$
  select count(*) filter (where read_at is null)::int,
         count(*) filter (where actionable and resolution is null)::int,
         coalesce(max(id), 0)
    from notifications where user_id = auth.uid() $$;

revoke all on function public.notifications_mark_read(bigint[], boolean), public.notifications_unread() from public, anon;
grant execute on function public.notifications_mark_read(bigint[], boolean), public.notifications_unread() to authenticated;

-- Vista de la lista con el alias del autor, para paginar y filtrar en la API. Corre con los permisos de su dueño
-- (profiles solo deja ver la propia fila), así que filtra a mano: cada uno ve solo las suyas.
create view public.notification_list as
select n.id, n.user_id, n.type, n.category, n.data, n.ref, n.actionable, n.resolution, n.created_at, n.read_at,
       n.actor_id, pr.tag as actor_alias
  from notifications n
  left join profiles pr on pr.id = n.actor_id
 where n.user_id = auth.uid();
grant select on public.notification_list to authenticated;

commit;
