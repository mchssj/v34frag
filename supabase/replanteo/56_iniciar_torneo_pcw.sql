-- Replanteo 56: iniciar partidas de torneo y PCW en un servidor libre (plan docs/bitacora/2026-11-02-iniciar-torneo-pcw).
--   1. Aptitud de cada servidor: official_enabled y pcw_enabled, junto a mm_enabled (48).
--   2. Un solo "servidor libre" para las tres cosas (server_free) y un solo candado para ocuparlo (server_alloc_lock):
--      el servidor queda ocupado en la misma transacción que lo elige, venga del matchmaking, de "Iniciar" o de la fila.
--   3. match_bookings: la reserva de una serie de torneo o PCW, por toda la serie y en el mismo servidor.
--   4. Veto con tiempo por turno (30 s; cada torneo lo configura) y mapa al azar cuando vence.
--   5. PCW: listos, fila por orden de llegada, espera de 15 min (primer mapa) y 5 min (siguientes), abandono y sanción
--      (pcw_bans: 3 días, 7 si se repite en 30 días).
--   6. Servidor que deja de responder: 3 min → lost; 10 min más → se libera. Tope total best_of × 90 + 30 min.
--   7. csstv_mm_poll con un tercer parámetro (p_state) y las reservas; csstv_mm_report y csstv_mm_password las aceptan.
-- Se aplica después de la 55. NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.mm_config') is null then
    raise exception 'replanteo 56: falta mm_config (aplicar antes 48_matchmaking.sql)';
  end if;
  if to_regclass('public.match_bookings') is not null then
    raise exception 'replanteo 56: match_bookings ya existe (¿ya se aplicó?)';
  end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 56: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- ---------- 1. Tablas ----------

alter table public.game_servers
  add column official_enabled boolean not null default false,
  add column pcw_enabled boolean not null default false;
comment on column public.game_servers.official_enabled is 'Apto para torneos: "Iniciar" lo ofrece (replanteo 56)';
comment on column public.game_servers.pcw_enabled is 'Apto para PCW: la fila de PCW lo toma (replanteo 56)';

alter table public.events add column veto_turn_seconds integer not null default 30
  constraint events_veto_turn_seconds_check check (veto_turn_seconds between 15 and 120);
comment on column public.events.veto_turn_seconds is 'Segundos por turno del veto desde que el organizador inicia la partida (replanteo 56)';

create table public.match_bookings (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  kind text not null check (kind in ('official', 'pcw')),
  status text not null check (status in ('ready', 'veto', 'queued', 'assigned', 'live', 'between', 'lost', 'finished', 'abandoned', 'cancelled')),
  server_id uuid references public.game_servers(id) on delete set null,
  password text,
  wait_minutes integer not null check (wait_minutes between 1 and 20),
  veto_deadline timestamptz,
  wait_started_at timestamptz,
  wait_deadline timestamptz,
  wait_expired_at timestamptz,
  min_roster1 smallint check (min_roster1 between 1 and 5),
  min_roster2 smallint check (min_roster2 between 1 and 5),
  ready1_by uuid references auth.users(id) on delete set null,
  ready1_at timestamptz,
  ready2_by uuid references auth.users(id) on delete set null,
  ready2_at timestamptz,
  map_no integer not null default 1,
  auto_start boolean not null default false,
  taken_at timestamptz,
  side_ok1 boolean,
  side_ok2 boolean,
  side_n1 smallint,
  side_n2 smallint,
  state_at timestamptz,
  short1_since timestamptz,
  short2_since timestamptz,
  between_since timestamptz,
  lost_from text,
  lost_at timestamptz,
  warned_at timestamptz,
  queued_at timestamptz,
  assigned_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  ended_at timestamptz,
  end_reason text,
  abandoned_side smallint check (abandoned_side in (1, 2, 3))
);
comment on table public.match_bookings is 'Reserva de un servidor para una serie de torneo o PCW, por toda la serie (replanteo 56)';
comment on column public.match_bookings.abandoned_side is 'PCW abandonada: 1 o 2 (equipo de la partida), 3 = los dos';
create unique index match_bookings_open_match on public.match_bookings (match_id) where status not in ('finished', 'abandoned', 'cancelled');
create unique index match_bookings_open_server on public.match_bookings (server_id)
  where server_id is not null and status not in ('finished', 'abandoned', 'cancelled');
create index match_bookings_queue on public.match_bookings (queued_at) where status = 'queued';

create table public.pcw_bans (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  player_id uuid references public.players(id) on delete cascade,
  until timestamptz not null,
  reason text not null,
  match_id uuid references public.matches(id) on delete set null,
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references auth.users(id) on delete set null,
  constraint pcw_bans_sujeto check ((team_id is null) <> (player_id is null))
);
comment on table public.pcw_bans is 'Sin crear ni aceptar PCW hasta until: al equipo oficial y a cada jugador del bando que abandonó (replanteo 56)';
create index pcw_bans_team on public.pcw_bans (team_id, until) where lifted_at is null;
create index pcw_bans_player on public.pcw_bans (player_id, until) where lifted_at is null;

-- Nada se lee ni se escribe directo: todo pasa por las funciones de abajo.
alter table public.match_bookings enable row level security;
alter table public.pcw_bans enable row level security;
revoke all on table public.match_bookings, public.pcw_bans from anon, authenticated;

-- ---------- 2. Servidor libre y candado ----------

/** Candado único para elegir y ocupar un servidor: lo toman mm_tick, match_start y la fila de PCW. */
create function public.server_alloc_lock() returns void
  language sql as $$ select pg_advisory_xact_lock(hashtext('server_alloc')) $$;

/** ¿Está ocupado? Una sala del matchmaking abierta o una reserva abierta con ese servidor. */
create function public.server_busy(p_server uuid) returns boolean
  language sql stable as $$
  select exists (select 1 from mm_lobbies l where l.server_id = p_server and l.status not in ('finished', 'cancelled'))
      or exists (select 1 from match_bookings b where b.server_id = p_server and b.status not in ('finished', 'abandoned', 'cancelled')) $$;

/** Libre para un tipo (mm, official o pcw): apto, en línea, con licencia, disponible y sin sala ni reserva. */
create function public.server_is_free(p_server uuid, p_kind text) returns boolean
  language sql stable as $$
  select exists (
    select 1 from game_servers s join mm_server_state st on st.server_id = s.id
     where s.id = p_server and s.active and (s.license_expires_at is null or s.license_expires_at > now())
       and case p_kind when 'mm' then s.mm_enabled when 'official' then s.official_enabled when 'pcw' then s.pcw_enabled else false end
       and st.last_poll_at > now() - interval '30 seconds'
       and (st.unavailable_until is null or st.unavailable_until < now()))
    and not server_busy(p_server) $$;

/** El servidor libre de un tipo: primero la región más pedida, después el que lleva más tiempo sin usarse. */
create function public.server_free(p_kind text, p_regions text[] default '{}') returns uuid
  language sql stable as $$
  select s.id from game_servers s
   where server_is_free(s.id, p_kind)
   order by (select count(*) from unnest(coalesce(p_regions, '{}')) r where r = s.region) desc,
            greatest((select max(l.ended_at) from mm_lobbies l where l.server_id = s.id),
                     (select max(b.ended_at) from match_bookings b where b.server_id = s.id)) nulls first
   limit 1 $$;

-- El matchmaking pasa a usar la misma definición (y ve las reservas como ocupadas).
create or replace function public.mm_free_server(p_regions text[]) returns uuid
  language sql stable as $$ select server_free('mm', p_regions) $$;

-- mm_tick toma el candado de los servidores y, antes de armar salas, atiende las reservas (orden de llegada).
select pg_temp.reemplazar('public.mm_tick()', array[
  ['if not pg_try_advisory_xact_lock(hashtext(''mm_tick'')) then return jsonb_build_object(''skipped'', true); end if;',
   'if not pg_try_advisory_xact_lock(hashtext(''mm_tick'')) then return jsonb_build_object(''skipped'', true); end if;' || E'\n' ||
   '  -- (replanteo 56) el mismo candado que "Iniciar" y la fila de PCW: nadie más elige servidor mientras corre.' || E'\n' ||
   '  perform server_alloc_lock();'],
  ['  -- La cola se cierra antes del fin de la temporada; las salas ya armadas siguen.',
   '  -- (replanteo 56) reservas de torneos y PCW: plazos, fila y servidores caídos.' || E'\n' ||
   '  perform booking_tick();' || E'\n\n' ||
   '  -- La cola se cierra antes del fin de la temporada; las salas ya armadas siguen.']
]);

-- ---------- 3. Mapas de la serie y avisos ----------

/** Mapas de la serie en orden: los picks del veto y el decisivo (con su versión). Vacío si el veto no terminó. */
create function public.match_series_maps(p_match uuid) returns text[]
  language plpgsql stable security definer set search_path = public as $$
declare
  m matches%rowtype;
  seq text[];
  out text[];
  v_decider map_pool%rowtype;
  v_cfg jsonb;
begin
  select * into m from matches where id = p_match;
  if m.id is null then return '{}'; end if;
  seq := veto_sequence(m.best_of, (select count(*)::int from match_map_pool(p_match)));
  if (select count(*) from match_vetos where match_id = p_match) < cardinality(seq) then return '{}'; end if;
  select coalesce(array_agg(coalesce(v.version, v.map) order by v.seq), '{}') into out
    from match_vetos v where v.match_id = p_match and v.action = 'pick';
  select * into v_decider from match_map_pool(p_match) mp
   where not exists (select 1 from match_vetos v where v.match_id = p_match and v.map = mp.name) limit 1;
  if v_decider.name is not null then
    select config into v_cfg from events where id = m.event_id;
    out := out || coalesce(v_cfg->'decider_versions'->>v_decider.name, v_decider.versions[1], v_decider.name);
  end if;
  return out;
end $$;

/** ¿El veto de la partida ya terminó? */
create function public.match_veto_done(p_match uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select (select count(*) from match_vetos where match_id = p_match)
      >= cardinality(veto_sequence((select best_of from matches where id = p_match), (select count(*)::int from match_map_pool(p_match)))) $$;

/** Cuentas de los planteles de los dos equipos (miembros, capitán y dueño; en una PCW, también los del equipo oficial). */
create function public.match_side_users(p_match uuid, p_side int default null) returns uuid[]
  language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct u) filter (where u is not null), '{}') from (
    select p.user_id u from matches m cross join lateral (values (1, m.team1), (2, m.team2)) s(k, team)
      join match_roster(m.id, s.team) r on true join players p on p.id = r
     where m.id = p_match and (p_side is null or s.k = p_side)
    union all
    select x from matches m cross join lateral (values (1, m.team1), (2, m.team2)) s(k, team)
      join teams t on t.id = s.team
      left join teams par on par.id = t.parent_team_id
      cross join lateral unnest(array[t.captain_id, t.owner_id, par.captain_id, par.owner_id]) x
     where m.id = p_match and (p_side is null or s.k = p_side)) q $$;

/** A quién le importa la reserva: los planteles, quien la creó y el organizador del torneo. */
create function public.booking_users(p_booking uuid) returns uuid[]
  language sql stable security definer set search_path = public as $$
  select match_side_users(b.match_id) || array_remove(array[b.created_by, e.organizer_id], null)
    from match_bookings b join matches m on m.id = b.match_id left join events e on e.id = m.event_id
   where b.id = p_booking $$;

/** Aviso por el socket del matchmaking: lobby lleva el id de la partida; el navegador vuelve a pedir la reserva. */
create function public.booking_emit(p_booking uuid) returns void
  language sql security definer set search_path = public as $$
  select mm_emit('booking.update', (select match_id from match_bookings where id = p_booking), booking_users(p_booking)) $$;

/** Título de la partida para los avisos. */
create function public.booking_title(p_match uuid) returns text
  language sql stable security definer set search_path = public as $$
  select coalesce(t1.name, '?') || ' vs ' || coalesce(t2.name, '?')
    from matches m left join teams t1 on t1.id = m.team1 left join teams t2 on t2.id = m.team2 where m.id = p_match $$;

-- Tipos nuevos de avisos: los de torneos en "tournament", los de PCW en "pcw".
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
                    'match_no_result') then 'admin' -- (replanteo 35) match_no_result
  end $$;

-- ---------- 4. Ciclo de la reserva ----------

/** Cierra la reserva (finished, abandoned o cancelled): el servidor queda libre en esta misma operación. */
create function public.booking_close(p_booking uuid, p_status text, p_reason text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  update match_bookings set status = p_status, end_reason = p_reason, ended_at = now(), auto_start = false
   where id = p_booking and status not in ('finished', 'abandoned', 'cancelled');
  if found then perform booking_emit(p_booking); end if;
end $$;

/** Mapa que toca, desde el veto y los mapas ya jugados. */
create function public.booking_map(p_booking uuid) returns text
  language sql stable security definer set search_path = public as $$
  select (match_series_maps(b.match_id))[b.map_no] from match_bookings b where b.id = p_booking $$;

/** Arranca la espera del mapa que toca (PCW: 15 min el primero y 5 los siguientes; torneo: la del organizador). */
create function public.booking_start_wait(p_booking uuid, p_delay interval default '0') returns void
  language sql security definer set search_path = public as $$
  update match_bookings set
    wait_started_at = now() + p_delay,
    wait_deadline = now() + p_delay + make_interval(mins => case when kind = 'pcw' then case when map_no = 1 then 15 else 5 end else wait_minutes end),
    wait_expired_at = null, auto_start = false, side_ok1 = null, side_ok2 = null, state_at = null,
    short1_since = null, short2_since = null
   where id = p_booking $$;

/** Asigna un servidor libre a una PCW de la fila. Llamar con el candado tomado. true si lo asignó. */
create function public.booking_assign(p_booking uuid) returns boolean
  language plpgsql security definer set search_path = public as $$
declare
  b match_bookings%rowtype;
  v_server uuid;
begin
  select * into b from match_bookings where id = p_booking and status = 'queued' for update;
  if b.id is null then return false; end if;
  v_server := server_free('pcw');
  if v_server is null then return false; end if;
  update match_bookings set server_id = v_server, status = 'assigned', assigned_at = now(), taken_at = null,
    password = coalesce(password, mm_new_password()) where id = b.id;
  update matches set server_id = v_server, server_ip = (select connect_address from game_servers where id = v_server) where id = b.match_id;
  perform booking_start_wait(b.id);
  perform notify(match_side_users(b.match_id), 'pcw_server_ready',
    jsonb_build_object('match_id', b.match_id, 'title', booking_title(b.match_id),
                       'server', (select name from game_servers where id = v_server)), b.match_id::text, true);
  perform booking_emit(b.id);
  return true;
end $$;

/** La PCW entra a la fila y, si hay un servidor libre, lo toma en el acto. */
create function public.booking_enqueue(p_booking uuid, p_first boolean default false) returns void
  language plpgsql security definer set search_path = public as $$
begin
  perform server_alloc_lock();
  update match_bookings set status = 'queued', server_id = null, taken_at = null, veto_deadline = null,
    queued_at = case when p_first then 'epoch'::timestamptz else now() end
   where id = p_booking;
  -- Primero la que más esperó: si hay otra antes en la fila, el tick la atiende en orden.
  if not exists (select 1 from match_bookings o where o.status = 'queued' and o.id <> p_booking
                   and o.queued_at < (select queued_at from match_bookings where id = p_booking)) then
    perform booking_assign(p_booking);
  end if;
  perform booking_emit(p_booking);
end $$;

/** Después de cada acción del veto: si terminó, la reserva sigue; si no, arranca el reloj del turno siguiente. */
create function public.booking_after_veto(p_match uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare b match_bookings%rowtype;
begin
  select * into b from match_bookings where match_id = p_match and status = 'veto' for update;
  if b.id is null then return; end if;
  if match_veto_done(p_match) then
    if b.kind = 'official' then
      update match_bookings set status = 'assigned', veto_deadline = null, assigned_at = coalesce(assigned_at, now()),
        password = coalesce(password, mm_new_password()) where id = b.id;
      perform booking_start_wait(b.id);
      perform notify(match_side_users(p_match), 'match_server_ready',
        jsonb_build_object('match_id', p_match, 'title', booking_title(p_match), 'server', (select name from game_servers where id = b.server_id)),
        p_match::text, true);
      perform booking_emit(b.id);
    else
      perform booking_enqueue(b.id);
    end if;
  else
    update match_bookings set veto_deadline = now() + make_interval(secs => coalesce(
      (select e.veto_turn_seconds from matches m join events e on e.id = m.event_id where m.id = p_match), 30)) where id = b.id;
    perform booking_emit(b.id);
  end if;
end $$;

-- El veto de siempre avisa a la reserva después de cada acción.
select pg_temp.reemplazar('public.veto_act(uuid, text, text)', array[
  ['    perform veto_act_base(p_match, p_map, p_version);',
   '    perform veto_act_base(p_match, p_map, p_version);' || E'\n' ||
   '    perform booking_after_veto(p_match);   -- (replanteo 56) reloj del veto y reserva']
]);

/** Turno vencido: la acción que tocaba (ban o pick) con un mapa al azar de los que quedan. */
create function public.veto_auto(p_match uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  m matches%rowtype;
  seq text[];
  n int;
  mp map_pool%rowtype;
  accion text;
begin
  select * into m from matches where id = p_match for update;
  seq := veto_sequence(m.best_of, (select count(*)::int from match_map_pool(p_match)));
  n := (select count(*) from match_vetos where match_id = p_match);
  if n >= cardinality(seq) then return; end if;
  accion := seq[n + 1];
  select * into mp from match_map_pool(p_match) x
   where not exists (select 1 from match_vetos v where v.match_id = p_match and v.map = x.name) order by random() limit 1;
  insert into match_vetos (match_id, seq, team_id, map, action, by_user, version)
    values (p_match, n + 1, case when n % 2 = 0 then m.team1 else m.team2 end, mp.name, accion, null,
            case when accion = 'pick' then mp.versions[1] end);
end $$;

-- ---------- 5. Sanciones de PCW ----------

/** Hasta cuándo está sancionado un bando de PCW (el equipo oficial o alguno de sus jugadores). Null si no lo está. */
create function public.pcw_ban_until(p_side uuid) returns timestamptz
  language sql stable security definer set search_path = public as $$
  select max(b.until) from pcw_bans b
   where b.lifted_at is null and b.until > now()
     and (b.team_id = (select parent_team_id from teams where id = p_side)
          or b.player_id in (select tm.player_id from team_members tm where tm.team_id = p_side and tm.left_at is null)) $$;

/** Un equipo oficial: hasta cuándo no puede crear ni aceptar PCW. */
create function public.team_pcw_ban_until(p_team uuid) returns timestamptz
  language sql stable security definer set search_path = public as $$
  select max(until) from pcw_bans where team_id = p_team and lifted_at is null and until > now() $$;
grant execute on function public.team_pcw_ban_until(uuid) to anon, authenticated;

/** Ni el bando ni quien publica o acepta pueden estar sancionados. */
create function public.pcw_ban_check(p_side uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare v_until timestamptz;
begin
  v_until := greatest(pcw_ban_until(p_side),
    (select max(b.until) from pcw_bans b join players p on p.id = b.player_id
      where p.user_id = auth.uid() and b.lifted_at is null and b.until > now()));
  if v_until is not null then
    raise exception 'Por abandonar una PCW, no pueden crear ni aceptar PCW hasta el %', to_char(v_until at time zone 'America/Bogota', 'DD/MM HH24:MI')
      using errcode = 'V5601';
  end if;
end $$;

/** Antes de publicar una PCW. */
create function public.pcw_posts_ban_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  perform pcw_ban_check(new.team_id);
  return new;
end $$;
create trigger pcw_posts_ban_guard before insert on public.pcw_posts for each row execute function pcw_posts_ban_guard();

/** Antes de aceptar una PCW (accept_pcw crea la partida con el bando que acepta en team2). */
create function public.matches_pcw_ban_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  perform pcw_ban_check(new.team2);
  return new;
end $$;
create trigger matches_pcw_ban_guard before insert on public.matches
  for each row when (new.kind = 'pcw') execute function matches_pcw_ban_guard();

/** Sanciona al bando que abandonó: a su equipo oficial (si juega como uno) y a cada jugador de su plantel. */
create function public.pcw_ban_side(p_match uuid, p_side int) returns timestamptz
  language plpgsql security definer set search_path = public as $$
declare
  v_team uuid := (select case p_side when 1 then team1 else team2 end from matches where id = p_match);
  v_parent uuid := (select parent_team_id from teams where id = v_team);
  v_player uuid;
  v_until timestamptz;
  v_max timestamptz;
begin
  if v_parent is not null then
    v_until := now() + case when exists (select 1 from pcw_bans where team_id = v_parent and created_at > now() - interval '30 days')
                            then interval '7 days' else interval '3 days' end;
    insert into pcw_bans (team_id, until, reason, match_id) values (v_parent, v_until, 'Abandonó una PCW', p_match);
    v_max := v_until;
  end if;
  for v_player in select tm.player_id from team_members tm where tm.team_id = v_team and tm.left_at is null loop
    v_until := now() + case when exists (select 1 from pcw_bans where player_id = v_player and created_at > now() - interval '30 days')
                            then interval '7 days' else interval '3 days' end;
    insert into pcw_bans (player_id, until, reason, match_id) values (v_player, v_until, 'Abandonó una PCW', p_match);
    v_max := greatest(v_max, v_until);
  end loop;
  return v_max;
end $$;

/** PCW abandonada: no cuenta para nadie, el servidor se libera y quien no estaba queda sancionado. */
create function public.booking_abandon(p_booking uuid, p_side int, p_reason text) returns void
  language plpgsql security definer set search_path = public as $$
declare
  b match_bookings%rowtype;
  v_until timestamptz;
  k int;
begin
  select * into b from match_bookings where id = p_booking for update;
  if b.id is null or b.status in ('finished', 'abandoned', 'cancelled') then return; end if;
  update match_bookings set abandoned_side = p_side where id = b.id;
  perform booking_close(b.id, 'abandoned', p_reason);
  update matches set status = 'cancelled', cancel_reason = 'abandoned', cancelled_by = 'web' where id = b.match_id and status in ('upcoming', 'live');
  for k in select x from unnest(array[1, 2]) x where p_side = 3 or p_side = x loop
    v_until := pcw_ban_side(b.match_id, k);
    perform notify(match_side_users(b.match_id, k), 'pcw_abandoned',
      jsonb_build_object('match_id', b.match_id, 'title', booking_title(b.match_id), 'until', v_until, 'banned', true), b.match_id::text, true);
  end loop;
  if p_side <> 3 then
    perform notify(match_side_users(b.match_id, 3 - p_side), 'pcw_abandoned',
      jsonb_build_object('match_id', b.match_id, 'title', booking_title(b.match_id), 'banned', false), b.match_id::text, true);
  end if;
end $$;

-- ---------- 6. Acciones de la web ----------

/** Torneo: el organizador (o un moderador) inicia la partida en un servidor libre y apto para torneos. */
create function public.match_start(p_match uuid, p_server uuid, p_wait integer default 10) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  m matches%rowtype;
  v_id uuid;
begin
  select * into m from matches where id = p_match for update;
  if m.id is null then raise exception 'No existe esa partida'; end if;
  if m.kind <> 'official' or m.event_id is null then raise exception 'Solo se inician así las partidas de un torneo'; end if;
  if not can_manage_event(m.event_id) then raise exception 'Solo el organizador del torneo o un moderador' using errcode = '42501'; end if;
  if m.team1 is null or m.team2 is null then raise exception 'La partida todavía no tiene los dos equipos'; end if;
  if m.status not in ('upcoming', 'live') then raise exception 'La partida ya terminó o fue cancelada'; end if;
  if coalesce(m.bye, false) then raise exception 'Es un pase libre: no se juega'; end if;
  if p_wait is null or p_wait not between 1 and 20 then raise exception 'La espera va de 1 a 20 minutos'; end if;
  if exists (select 1 from match_bookings where match_id = p_match and status not in ('finished', 'abandoned', 'cancelled')) then
    raise exception 'La partida ya está iniciada';
  end if;
  perform server_alloc_lock();
  if not server_is_free(p_server, 'official') then
    raise exception 'Ese servidor ya no está libre: elegí otro o esperá a que se libere' using errcode = 'V5602';
  end if;
  insert into match_bookings (match_id, kind, status, server_id, password, wait_minutes, assigned_at, created_by, map_no)
    values (p_match, 'official', 'veto', p_server, mm_new_password(), p_wait, now(), auth.uid(),
            coalesce(jsonb_array_length(m.maps), 0) + 1)
    returning id into v_id;
  update matches set server_id = p_server, server_ip = (select connect_address from game_servers where id = p_server) where id = p_match;
  -- Con el veto ya hecho pasa directo a "asignada"; si no, arranca el reloj del primer turno.
  perform booking_after_veto(p_match);
  return v_id;
end $$;

/** Equipo de la partida (1 o 2) al que pertenece la cuenta; 0 si a ninguno. */
create function public.match_my_side(p_match uuid) returns int
  language sql stable security definer set search_path = public as $$
  select case when auth.uid() = any(match_side_users(p_match, 1)) then 1
              when auth.uid() = any(match_side_users(p_match, 2)) then 2 else 0 end $$;

/** PCW: un miembro de cada bando marca "Listos". Con los dos, arranca el veto (si falta) y después la fila. */
create function public.pcw_ready(p_match uuid, p_ready boolean default true) returns void
  language plpgsql security definer set search_path = public as $$
declare
  m matches%rowtype;
  b match_bookings%rowtype;
  k int;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  select * into m from matches where id = p_match for update;
  if m.id is null or m.kind <> 'pcw' then raise exception 'Esa partida no es una PCW'; end if;
  if m.status <> 'upcoming' then raise exception 'La PCW ya empezó, terminó o fue cancelada'; end if;
  k := match_my_side(p_match);
  if k = 0 then raise exception 'Solo un jugador de alguno de los dos equipos' using errcode = '42501'; end if;
  select * into b from match_bookings where match_id = p_match and status not in ('finished', 'abandoned', 'cancelled') for update;

  if not p_ready then
    -- Antes de tener servidor se puede bajar sin sanción. Con servidor, ya no.
    if b.id is null then return; end if;
    if b.status not in ('ready', 'veto', 'queued') then raise exception 'Ya hay un servidor asignado: tienen que entrar'; end if;
    perform booking_close(b.id, 'cancelled', 'ready_removed');
    -- Si el otro equipo ya estaba listo, se le avisa.
    if (k = 1 and b.ready2_at is not null) or (k = 2 and b.ready1_at is not null) then
      perform notify(match_side_users(p_match, 3 - k), 'pcw_cancelled',
        jsonb_build_object('match_id', p_match, 'title', booking_title(p_match), 'reason', 'ready_removed'), p_match::text);
    end if;
    return;
  end if;

  if b.id is null then
    insert into match_bookings (match_id, kind, status, wait_minutes, created_by, map_no)
      values (p_match, 'pcw', 'ready', 15, auth.uid(), coalesce(jsonb_array_length(m.maps), 0) + 1)
      returning * into b;
  elsif b.status <> 'ready' then
    raise exception 'Los dos equipos ya están listos';
  end if;
  if k = 1 then
    update match_bookings set ready1_by = auth.uid(), ready1_at = now() where id = b.id returning * into b;
  else
    update match_bookings set ready2_by = auth.uid(), ready2_at = now() where id = b.id returning * into b;
  end if;
  if b.ready1_at is not null and b.ready2_at is not null then
    update match_bookings set status = 'veto' where id = b.id;
    perform booking_after_veto(p_match);
  else
    perform notify(match_side_users(p_match, 3 - k), 'pcw_accepted',
      jsonb_build_object('match_id', p_match, 'title', booking_title(p_match), 'ready', true), p_match::text);
    perform booking_emit(b.id);
  end if;
end $$;

/** Acciones del organizador sobre la reserva de un torneo (y de un moderador sobre cualquiera). */
create function public.match_booking_action(p_match uuid, p_action text, p_side integer default null, p_minutes integer default null)
  returns void
  language plpgsql security definer set search_path = public as $$
declare
  m matches%rowtype;
  b match_bookings%rowtype;
begin
  select * into m from matches where id = p_match;
  if m.id is null then raise exception 'No existe esa partida'; end if;
  if not (is_moderator() or (m.event_id is not null and can_manage_event(m.event_id))) then
    raise exception 'Solo el organizador del torneo o un moderador' using errcode = '42501';
  end if;
  select * into b from match_bookings where match_id = p_match and status not in ('finished', 'abandoned', 'cancelled') for update;
  if b.id is null then raise exception 'La partida no tiene un servidor reservado'; end if;
  case p_action
    when 'allow_four' then
      if b.kind <> 'official' then raise exception 'En una PCW ya se puede jugar con stand-ins'; end if;
      if p_side not in (1, 2) then raise exception 'Elegí el equipo'; end if;
      if p_side = 1 then update match_bookings set min_roster1 = 4 where id = b.id;
      else update match_bookings set min_roster2 = 4 where id = b.id; end if;
    when 'extend' then
      if b.kind <> 'official' then raise exception 'La espera de una PCW es fija'; end if;
      if b.wait_started_at is null then raise exception 'Todavía no empezó la espera'; end if;
      if p_minutes is null or p_minutes not between 1 and 20 then raise exception 'Se extiende de 1 a 20 minutos'; end if;
      if b.wait_started_at + interval '20 minutes' <= now() then raise exception 'Ya pasaron los 20 minutos de espera'; end if;
      update match_bookings set wait_deadline = least(greatest(wait_deadline, now()) + make_interval(mins => p_minutes), wait_started_at + interval '20 minutes'),
        wait_expired_at = null where id = b.id;
    when 'cancel' then
      if b.status = 'live' then raise exception 'Hay un mapa en juego: se cancela desde el servidor o al terminar'; end if;
      perform booking_close(b.id, 'cancelled', 'admin');
      return;
    else
      raise exception 'Acción desconocida: %', p_action;
  end case;
  perform booking_emit(b.id);
end $$;

/** Moderador: cancela la reserva de cualquier partida (aunque haya un mapa en juego: el servidor lo corta en el poll). */
create function public.match_booking_release(p_match uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_moderator() then raise exception 'Solo moderadores y admins' using errcode = '42501'; end if;
  select id into v_id from match_bookings where match_id = p_match and status not in ('finished', 'abandoned', 'cancelled');
  if v_id is null then raise exception 'La partida no tiene un servidor reservado'; end if;
  perform booking_close(v_id, 'cancelled', 'admin');
end $$;

/** ¿La cuenta puede ver la conexión? Planteles, streamers, el organizador y los moderadores. */
create function public.match_can_connect(p_match uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
       is_moderator()
    or exists (select 1 from matches m where m.id = p_match and m.event_id is not null and can_manage_event(m.event_id))
    or exists (select 1 from hud_streamers h where h.user_id = auth.uid() and h.revoked_at is null)
    or match_my_side(p_match) > 0) $$;

/** Estado de la reserva de una partida (la abierta o la última), con la conexión solo para quien la puede ver. */
create function public.match_booking(p_match uuid) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  m matches%rowtype;
  b match_bookings%rowtype;
  s game_servers%rowtype;
  v_maps text[];
  v_manage boolean;
  v_side int;
  v_conn jsonb;
begin
  select * into m from matches where id = p_match;
  if m.id is null or m.kind not in ('official', 'pcw') then return null; end if;
  select * into b from match_bookings where match_id = p_match order by (status not in ('finished', 'abandoned', 'cancelled')) desc, created_at desc limit 1;
  v_manage := auth.uid() is not null and (is_moderator() or (m.event_id is not null and can_manage_event(m.event_id)));
  v_side := case when auth.uid() is null then 0 else match_my_side(p_match) end;
  v_maps := match_series_maps(p_match);
  if b.server_id is not null then select * into s from game_servers where id = b.server_id; end if;
  if b.id is not null and b.status in ('assigned', 'live', 'between', 'lost') and s.id is not null and match_can_connect(p_match) then
    v_conn := jsonb_build_object('address', s.connect_address, 'password', b.password,
      'url', 'steam://connect/' || s.connect_address || '/' || b.password);
  end if;
  return jsonb_build_object(
    'kind', m.kind,
    'veto_done', match_veto_done(p_match),
    -- Le toca vetar a esta cuenta: capitán del equipo del turno, antes de empezar.
    'can_veto', auth.uid() is not null and m.status = 'upcoming' and not match_veto_done(p_match)
                and exists (select 1 from teams t where t.captain_id = auth.uid()
                              and t.id = case when (select count(*) from match_vetos where match_id = p_match) % 2 = 0 then m.team1 else m.team2 end),
    'veto_turn_seconds', coalesce((select veto_turn_seconds from events where id = m.event_id), 30),
    'maps', to_jsonb(v_maps),
    'my_side', v_side,
    'can_manage', v_manage,
    'can_start', m.kind = 'official' and v_manage and m.team1 is not null and m.team2 is not null and m.status in ('upcoming', 'live')
                 and (b.id is null or b.status in ('finished', 'abandoned', 'cancelled')),
    'can_ready', m.kind = 'pcw' and v_side > 0 and m.status = 'upcoming'
                 and (b.id is null or b.status in ('finished', 'abandoned', 'cancelled', 'ready')),
    'ban_until', case when m.kind = 'pcw' and v_side > 0 then pcw_ban_until(case v_side when 1 then m.team1 else m.team2 end) end,
    'booking', case when b.id is null then null else jsonb_build_object(
      'id', b.id, 'status', b.status, 'kind', b.kind,
      'server', case when s.id is null then null else jsonb_build_object('id', s.id, 'name', s.name, 'region', s.region) end,
      'map', case when b.map_no <= coalesce(cardinality(v_maps), 0) then v_maps[b.map_no] end, 'map_no', b.map_no,
      'veto_deadline', b.veto_deadline, 'wait_started_at', b.wait_started_at, 'wait_deadline', b.wait_deadline,
      'wait_expired', b.wait_expired_at is not null, 'wait_minutes', b.wait_minutes,
      'min_roster1', b.min_roster1, 'min_roster2', b.min_roster2,
      'ready1', b.ready1_at is not null, 'ready2', b.ready2_at is not null,
      'taken', b.taken_at is not null, 'side_ok1', b.side_ok1, 'side_ok2', b.side_ok2, 'side_n1', b.side_n1, 'side_n2', b.side_n2,
      'queue_position', case when b.status = 'queued' then
          (select count(*) from match_bookings o where o.status = 'queued' and (o.queued_at, o.id) <= (b.queued_at, b.id)) end,
      'lost_at', b.lost_at, 'created_at', b.created_at, 'ended_at', b.ended_at, 'end_reason', b.end_reason,
      'abandoned_side', b.abandoned_side, 'connection', v_conn) end);
end $$;

/** Servidores libres para iniciar una partida de torneo (o para la fila de PCW). */
create function public.servers_free(p_kind text default 'official') returns jsonb
  language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_moderator() or is_organizer()) then raise exception 'Solo organizadores y moderadores' using errcode = '42501'; end if;
  if p_kind not in ('official', 'pcw', 'mm') then raise exception 'El tipo es official, pcw o mm'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'region', s.region) order by s.name), '[]')
            from game_servers s where server_is_free(s.id, p_kind));
end $$;

/** Admin: las tres marcas de aptitud de un servidor. Null deja la que estaba. */
create function public.server_set_flags(p_server uuid, p_mm boolean default null, p_official boolean default null, p_pcw boolean default null)
  returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo admins' using errcode = '42501'; end if;
  update game_servers set mm_enabled = coalesce(p_mm, mm_enabled), official_enabled = coalesce(p_official, official_enabled),
    pcw_enabled = coalesce(p_pcw, pcw_enabled) where id = p_server;
  if not found then raise exception 'No existe ese servidor'; end if;
end $$;

/** Moderador: levanta una sanción de PCW. */
create function public.pcw_ban_lift(p_ban uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_moderator() then raise exception 'Solo moderadores y admins' using errcode = '42501'; end if;
  update pcw_bans set lifted_at = now(), lifted_by = auth.uid() where id = p_ban and lifted_at is null;
  if not found then raise exception 'Esa sanción no existe o ya se levantó'; end if;
end $$;

/** Moderador: sanciones de PCW, paginadas, con filtros (vigentes, texto) y orden (created_at o until). */
create function public.admin_pcw_bans(p_active boolean default null, p_q text default null, p_sort text default 'created_at',
                                      p_order text default 'desc', p_page integer default 1, p_per integer default 20) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  v_q text := nullif(lower(trim(coalesce(p_q, ''))), '');
begin
  if not is_moderator() then raise exception 'Solo moderadores y admins' using errcode = '42501'; end if;
  if p_sort not in ('created_at', 'until') or p_order not in ('asc', 'desc') then raise exception 'Orden inválido'; end if;
  return (
    with f as (
      select b.*, t.name team_name, p.nick player_nick, (b.lifted_at is null and b.until > now()) vigente
        from pcw_bans b left join teams t on t.id = b.team_id left join players p on p.id = b.player_id
       where (p_active is null or (b.lifted_at is null and b.until > now()) = p_active)
         and (v_q is null or lower(coalesce(t.name, p.nick, '')) like '%' || v_q || '%'))
    select jsonb_build_object('total', (select count(*) from f), 'items', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'team', case when x.team_id is null then null else jsonb_build_object('id', x.team_id, 'name', x.team_name) end,
               'player', case when x.player_id is null then null else jsonb_build_object('id', x.player_id, 'nick', x.player_nick) end,
               'until', x.until, 'reason', x.reason, 'match_id', x.match_id, 'created_at', x.created_at, 'lifted_at', x.lifted_at, 'active', x.vigente)
             order by case when p_order = 'asc' then case p_sort when 'until' then x.until else x.created_at end end asc,
                      case when p_order = 'desc' then case p_sort when 'until' then x.until else x.created_at end end desc, x.id)
        from (select * from f order by case when p_order = 'asc' then case p_sort when 'until' then f.until else f.created_at end end asc,
                                       case when p_order = 'desc' then case p_sort when 'until' then f.until else f.created_at end end desc, f.id
               offset (greatest(p_page, 1) - 1) * least(greatest(p_per, 1), 100) limit least(greatest(p_per, 1), 100)) x), '[]')));
end $$;

-- La lista del panel de servidores muestra las marcas y las reservas.
select pg_temp.reemplazar('public.mm_admin_lists(text, text)', array[
  ['''mm_enabled'', s.mm_enabled,',
   '''mm_enabled'', s.mm_enabled, ''official_enabled'', s.official_enabled, ''pcw_enabled'', s.pcw_enabled,'],
  ['when exists (select 1 from mm_lobbies l where l.server_id = s.id and l.status not in (''finished'', ''cancelled'')) then ''lobby'' else ''free'' end,',
   'when exists (select 1 from mm_lobbies l where l.server_id = s.id and l.status not in (''finished'', ''cancelled'')) then ''lobby''' || E'\n' ||
   '                      when exists (select 1 from match_bookings b where b.server_id = s.id and b.status not in (''finished'', ''abandoned'', ''cancelled'')) then ''booking'' else ''free'' end,']
]);

-- ---------- 7. Resultados y cierre de la serie ----------

/**
 * Cuando la serie suma un mapa (maps) o termina (status): la reserva pasa al mapa siguiente o se cierra.
 * El W.O. del organizador (event_set_result) y la cancelación de la partida también la cierran.
 */
create function public.booking_on_match() returns trigger
  language plpgsql security definer set search_path = public as $$
declare b match_bookings%rowtype;
begin
  select * into b from match_bookings where match_id = new.id and status not in ('finished', 'abandoned', 'cancelled') for update;
  if b.id is null then return null; end if;
  if new.status in ('finished', 'cancelled') then
    perform booking_close(b.id, case when new.status = 'finished' then 'finished' else 'cancelled' end,
                          case when new.status = 'finished' then 'series_end' else 'match_cancelled' end);
  elsif coalesce(jsonb_array_length(new.maps), 0) <> coalesce(jsonb_array_length(old.maps), 0) and b.status in ('assigned', 'live', 'between', 'lost') then
    update match_bookings set map_no = coalesce(jsonb_array_length(new.maps), 0) + 1,
      status = case when status = 'lost' then 'lost' else 'between' end,
      lost_from = case when status = 'lost' then 'between' else lost_from end,
      between_since = now(), warned_at = null where id = b.id;
    -- El plugin espera 90 s para cargar el mapa siguiente: la espera cuenta desde ahí.
    perform booking_start_wait(b.id, interval '90 seconds');
    perform booking_emit(b.id);
  end if;
  return null;
end $$;
create trigger matches_booking after update of status, maps on public.matches
  for each row when (new.kind in ('official', 'pcw')) execute function booking_on_match();

-- ---------- 8. Plugin ----------

/** El poll con una reserva: los mismos datos que csstv_match_lookup, más la sala, el mapa y la espera. */
create function public.booking_poll_text(p_booking uuid) returns text
  language plpgsql stable security definer set search_path = public as $$
declare
  b match_bookings%rowtype;
  m record;
  linea text := E'\n';
  v_min int;
begin
  select * into b from match_bookings where id = p_booking;
  select x.id, x.kind, x.best_of, x.score1, x.score2, x.stage, x.link_code, x.team1, x.team2,
         (select gm.players_per_team from game_modes gm where gm.code = e.game_mode) as players_min,
         t1.name n1, t2.name n2, e.name torneo
    into m
    from matches x left join teams t1 on t1.id = x.team1 left join teams t2 on t2.id = x.team2 left join events e on e.id = x.event_id
   where x.id = b.match_id;
  v_min := case when m.kind = 'pcw' then 3 else coalesce(m.players_min, 5) end;
  return concat_ws(linea, 'ok=1',
    'lobby=' || b.id,
    'kind=' || m.kind,
    'status=' || case when b.status = 'lost' then coalesce(b.lost_from, 'assigned') else b.status end,
    'map=' || coalesce(booking_map(b.id), ''),
    'map_no=' || b.map_no,
    'password=' || b.password,
    'code=' || m.link_code,
    'title=' || translate(
       case when m.kind = 'pcw' then 'PCW: ' || m.n1 || ' vs ' || m.n2
            else coalesce(m.torneo || ' · ', '') || coalesce(nullif(m.stage, '') || ': ', '') || m.n1 || ' vs ' || m.n2 end,
       E'\r\n', '  '),
    'team1=' || translate(m.n1, E'\r\n', '  '),
    'team2=' || translate(m.n2, E'\r\n', '  '),
    'best_of=' || coalesce(m.best_of, 1),
    'score1=' || coalesce(m.score1, 0),
    'score2=' || coalesce(m.score2, 0),
    't1=' || coalesce((select string_agg(csstv_steam2(x.steam_id), ',' order by x.steam_id) from match_roster(m.id, m.team1) r join player_steam_all x on x.player_id = r), ''),
    't2=' || coalesce((select string_agg(csstv_steam2(x.steam_id), ',' order by x.steam_id) from match_roster(m.id, m.team2) r join player_steam_all x on x.player_id = r), ''),
    'max_standins=' || case when m.kind = 'pcw' then 2 else 0 end,
    'min_roster=' || v_min,
    'min1=' || coalesce(b.min_roster1, v_min),
    'min2=' || coalesce(b.min_roster2, v_min),
    'wait_seconds=' || coalesce(extract(epoch from greatest(b.wait_deadline - now(), interval '0'))::int, 0),
    'auto_start=' || case when b.auto_start then 1 else 0 end);
end $$;

drop function public.csstv_mm_poll(text, text);
/**
 * Poll del servidor. p_state (plugin 2.9.0, solo con una reserva): "ok1,ok2,n1,n2", si cada equipo de la partida cumple
 * la regla del !match con 4 o más en su lado, y cuántos tiene en su lado.
 */
create function public.csstv_mm_poll(p_token text, p_version text default null, p_state text default null) returns text
  language plpgsql security definer set search_path = public as $$
declare
  v_server uuid;
  l mm_lobbies%rowtype;
  m matches%rowtype;
  b match_bookings%rowtype;
  pw mm_server_passwords%rowtype;
  linea text := E'\n';
  st text[];
begin
  begin
    v_server := csstv_auth(p_token);
  exception when others then
    return 'ok=0' || linea || 'error=' || sqlerrm;
  end;
  insert into mm_server_state (server_id, last_poll_at, plugin_version) values (v_server, now(), p_version)
    on conflict (server_id) do update set last_poll_at = now(), plugin_version = coalesce(excluded.plugin_version, mm_server_state.plugin_version);

  -- (replanteo 56) Reserva de torneo o PCW.
  select * into b from match_bookings where server_id = v_server and status in ('assigned', 'live', 'between', 'lost')
   order by created_at desc limit 1 for update;
  if b.id is not null then
    if b.status = 'lost' then
      update match_bookings set status = coalesce(lost_from, 'assigned'), lost_from = null, lost_at = null where id = b.id returning * into b;
      perform booking_emit(b.id);
    end if;
    st := string_to_array(coalesce(p_state, ''), ',');
    if cardinality(st) = 4 then
      update match_bookings set side_ok1 = st[1] = '1', side_ok2 = st[2] = '1',
        side_n1 = nullif(st[3], '')::smallint, side_n2 = nullif(st[4], '')::smallint, state_at = now(),
        short1_since = case when status = 'live' and nullif(st[3], '')::int < 4 then coalesce(short1_since, now()) end,
        short2_since = case when status = 'live' and nullif(st[4], '')::int < 4 then coalesce(short2_since, now()) end
       where id = b.id;
    end if;
    return booking_poll_text(b.id);
  end if;

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
    -- Todos los de cada equipo, con o sin SteamID: el plugin no arranca hasta que estén todos (replanteo 49).
    'n1=' || (select count(*) from mm_lobby_players where lobby_id = l.id and team = 1),
    'n2=' || (select count(*) from mm_lobby_players where lobby_id = l.id and team = 2),
    'unlinked=' || (select count(*) from mm_lobby_players lp join players p on p.id = lp.player_id where lp.lobby_id = l.id and p.steam_id is null),
    'connect_seconds=' || coalesce(extract(epoch from greatest(l.connect_deadline - now(), interval '0'))::int, (select connect_minutes * 60 from mm_config)),
    'abandons=' || (select count(*) filter (where team = 1 and abandoned) || ',' || count(*) filter (where team = 2 and abandoned) from mm_lobby_players where lobby_id = l.id),
    case when l.forfeit_team is not null then 'forfeit=' || l.forfeit_team end);
end $$;
revoke all on function public.csstv_mm_poll(text, text, text) from public;
grant execute on function public.csstv_mm_poll(text, text, text) to anon, authenticated, service_role;

/** Avisos del servidor sobre una reserva: taken, live, mapover (el mapa no contó), abort, connected/left/back (sin efecto). */
create function public.booking_report(p_server uuid, p_booking uuid, p_event text, p_data text) returns boolean
  language plpgsql security definer set search_path = public as $$
declare b match_bookings%rowtype;
begin
  select * into b from match_bookings where id = p_booking and server_id = p_server for update;
  if b.id is null or b.status in ('finished', 'abandoned', 'cancelled') then return false; end if;
  case p_event
    when 'taken' then
      update match_bookings set taken_at = coalesce(taken_at, now()) where id = b.id;
    when 'live' then
      update match_bookings set status = 'live', auto_start = false, short1_since = null, short2_since = null,
        wait_expired_at = null, between_since = null where id = b.id;
      update matches set status = 'live' where id = b.match_id and status = 'upcoming';
    when 'mapover' then
      -- El mapa terminó sin sumar a la serie (cancelado, reinicio o resultado rechazado): se vuelve a jugar.
      if b.status in ('live', 'assigned', 'between') then
        update match_bookings set status = 'between', between_since = now(), warned_at = null where id = b.id;
        perform booking_start_wait(b.id, interval '90 seconds');
      end if;
    when 'abort' then
      -- El servidor no puede con la reserva (le falta el mapa, por ejemplo): otro servidor, sin sanción.
      update mm_server_state set unavailable_until = now() + interval '10 minutes' where server_id = p_server;
      if b.kind = 'pcw' and b.status <> 'live' then
        perform booking_enqueue(b.id, true);
      else
        perform booking_close(b.id, 'cancelled', 'server: ' || left(coalesce(p_data, 'el servidor la canceló'), 120));
        perform notify(array_remove(array[(select e.organizer_id from matches m join events e on e.id = m.event_id where m.id = b.match_id), b.created_by], null),
          'booking_attention', jsonb_build_object('match_id', b.match_id, 'title', booking_title(b.match_id), 'reason', 'server_abort',
                                                  'detail', left(coalesce(p_data, ''), 120)), b.match_id::text, true);
      end if;
    when 'connected', 'left', 'back' then
      null;
    else
      raise exception 'Evento desconocido: %', p_event;
  end case;
  perform booking_emit(b.id);
  return true;
end $$;

select pg_temp.reemplazar('public.csstv_mm_report(text, uuid, text, text)', array[
  ['  select * into l from mm_lobbies where id = p_lobby and server_id = v_server for update;',
   '  -- (replanteo 56) una reserva de torneo o PCW' || E'\n' ||
   '  if exists (select 1 from match_bookings where id = p_lobby) then' || E'\n' ||
   '    return booking_report(v_server, p_lobby, p_event, p_data);' || E'\n' ||
   '  end if;' || E'\n' ||
   '  select * into l from mm_lobbies where id = p_lobby and server_id = v_server for update;']
]);

-- La contraseña de una reserva no es de una sala del matchmaking: se guarda sin lobby_id.
select pg_temp.reemplazar('public.csstv_mm_password(text, text, text, text, uuid)', array[
  ['values (p_uid, v_server, p_password, p_kind, p_lobby, ''plugin'', now())',
   'values (p_uid, v_server, p_password, p_kind, (select id from mm_lobbies where id = p_lobby), ''plugin'', now())']
]);

-- El !match manual de una serie con una reserva abierta solo vale en el servidor reservado.
select pg_temp.reemplazar('public.csstv_match_lookup(text, text)', array[
  ['  m      record;', '  m      record;' || E'\n' || '  v_srv  uuid;   -- (replanteo 56)'],
  ['    perform csstv_auth(p_token);', '    v_srv := csstv_auth(p_token);'],
  ['    return ''ok=0'' || linea || ''error=La partida todavía no tiene los dos equipos'';' || E'\n' || '  end if;',
   '    return ''ok=0'' || linea || ''error=La partida todavía no tiene los dos equipos'';' || E'\n' || '  end if;' || E'\n' ||
   '  -- (replanteo 56) reservada desde la web para otro servidor' || E'\n' ||
   '  if exists (select 1 from match_bookings b where b.match_id = m.id and b.server_id is distinct from v_srv' || E'\n' ||
   '               and b.status not in (''finished'', ''abandoned'', ''cancelled'')) then' || E'\n' ||
   '    return ''ok=0'' || linea || ''error=Esa partida está reservada desde la web para otro servidor'';' || E'\n' ||
   '  end if;']
]);

-- ---------- 9. Plazos (cada 2 s, dentro de mm_tick) ----------

create function public.booking_tick() returns void
  language plpgsql security definer set search_path = public as $$
declare
  b match_bookings%rowtype;
  v_poll timestamptz;
  v_out int;
begin
  for b in select * from match_bookings where status not in ('finished', 'abandoned', 'cancelled') order by queued_at nulls last, created_at loop
    select last_poll_at into v_poll from mm_server_state where server_id = b.server_id;

    -- Veto: turno vencido, mapa al azar.
    if b.status = 'veto' and b.veto_deadline is not null and b.veto_deadline <= now() then
      perform veto_auto(b.match_id);
      perform booking_after_veto(b.match_id);
      continue;
    end if;

    -- Fila de PCW: en orden de llegada (este loop va por queued_at).
    if b.status = 'queued' then
      perform booking_assign(b.id);
      continue;
    end if;

    -- Servidor que deja de responder (no cuenta un mapa en vivo): 3 min → lost; 10 min más → se libera.
    if b.status in ('veto', 'assigned', 'between') and b.server_id is not null and (v_poll is null or v_poll < now() - interval '3 minutes') then
      update match_bookings set lost_from = status, status = 'lost', lost_at = now() where id = b.id;
      perform notify(booking_users(b.id), 'booking_attention',
        jsonb_build_object('match_id', b.match_id, 'title', booking_title(b.match_id), 'reason', 'server_lost'), b.match_id::text, true);
      perform booking_emit(b.id);
      continue;
    end if;
    if b.status = 'lost' then
      if v_poll is not null and v_poll > now() - interval '30 seconds' then
        update match_bookings set status = coalesce(lost_from, 'assigned'), lost_from = null, lost_at = null where id = b.id;
        perform booking_emit(b.id);
      elsif b.lost_at <= now() - interval '10 minutes' then
        if b.kind = 'pcw' then
          perform booking_enqueue(b.id, true);
        else
          perform booking_close(b.id, 'cancelled', 'server_lost');
        end if;
      end if;
      continue;
    end if;

    -- Tope total: best_of × 90 + 30 minutos. Un mapa en vivo nunca se corta: solo se avisa.
    if b.assigned_at is not null and b.assigned_at + make_interval(mins => (select best_of from matches where id = b.match_id) * 90 + 30) <= now() then
      if b.status <> 'live' then
        perform booking_close(b.id, 'cancelled', 'timeout');
        continue;
      elsif b.warned_at is null then
        update match_bookings set warned_at = now() where id = b.id;
        perform notify(array(select id from profiles where role = 'admin'), 'booking_attention',
          jsonb_build_object('match_id', b.match_id, 'title', booking_title(b.match_id), 'reason', 'too_long'), b.match_id::text, true);
      end if;
    end if;

    -- Abandono durante un mapa de PCW: menos de 4 en un lado durante 10 minutos seguidos.
    if b.kind = 'pcw' and b.status = 'live' then
      v_out := case when b.short1_since <= now() - interval '10 minutes' then 1 else 0 end
             + case when b.short2_since <= now() - interval '10 minutes' then 2 else 0 end;
      if v_out > 0 then perform booking_abandon(b.id, v_out, 'short_live'); end if;
      continue;
    end if;

    -- Espera vencida.
    if b.status in ('assigned', 'between') and b.wait_deadline is not null and b.wait_deadline <= now() then
      if b.kind = 'official' then
        -- Torneo: lo decide el organizador. Se le avisa una vez.
        if b.wait_expired_at is null then
          update match_bookings set wait_expired_at = now() where id = b.id;
          perform notify(booking_users(b.id), 'booking_attention',
            jsonb_build_object('match_id', b.match_id, 'title', booking_title(b.match_id), 'reason', 'wait_expired'), b.match_id::text, true);
          perform booking_emit(b.id);
        end if;
      elsif b.taken_at is null then
        -- El servidor nunca la tomó: es del servidor, no de los equipos. Otro servidor, sin sanción.
        update mm_server_state set unavailable_until = now() + interval '10 minutes' where server_id = b.server_id;
        perform booking_enqueue(b.id, true);
      elsif b.state_at is null or b.state_at < now() - interval '30 seconds' then
        null;   -- Sin datos frescos del servidor no se sanciona: lo cubre el plazo de servidor caído.
      elsif b.side_ok1 and b.side_ok2 then
        -- Están los dos: el mapa arranca solo. Si en 2 minutos no arrancó, se vuelve a mirar quién falta.
        if not b.auto_start then
          update match_bookings set auto_start = true where id = b.id;
          perform booking_emit(b.id);
        end if;
      else
        if not b.auto_start or b.wait_deadline <= now() - interval '2 minutes' then
          perform booking_abandon(b.id, case when not b.side_ok1 and not b.side_ok2 then 3 when not b.side_ok1 then 1 else 2 end, 'no_show');
        end if;
      end if;
    end if;

    -- Torneo entre mapas más de 30 minutos: aviso al organizador (lo libera él o un moderador).
    if b.kind = 'official' and b.status = 'between' and b.between_since <= now() - interval '30 minutes' and b.warned_at is null then
      update match_bookings set warned_at = now() where id = b.id;
      perform notify(booking_users(b.id), 'booking_attention',
        jsonb_build_object('match_id', b.match_id, 'title', booking_title(b.match_id), 'reason', 'between_long'), b.match_id::text, true);
    end if;
  end loop;
end $$;

-- ---------- Permisos ----------

revoke all on function public.server_alloc_lock(), public.server_busy(uuid), public.server_is_free(uuid, text), public.server_free(text, text[]),
  public.match_series_maps(uuid), public.match_side_users(uuid, int), public.booking_users(uuid), public.booking_emit(uuid),
  public.booking_title(uuid), public.booking_close(uuid, text, text), public.booking_map(uuid), public.booking_start_wait(uuid, interval),
  public.booking_assign(uuid), public.booking_enqueue(uuid, boolean), public.booking_after_veto(uuid), public.veto_auto(uuid),
  public.pcw_ban_until(uuid), public.pcw_ban_check(uuid), public.pcw_posts_ban_guard(), public.matches_pcw_ban_guard(),
  public.pcw_ban_side(uuid, int), public.booking_abandon(uuid, int, text),
  public.booking_on_match(), public.booking_poll_text(uuid), public.booking_report(uuid, uuid, text, text), public.booking_tick(),
  public.match_my_side(uuid), public.match_can_connect(uuid)
  from public, anon, authenticated;
revoke all on function public.match_start(uuid, uuid, integer), public.pcw_ready(uuid, boolean),
  public.match_booking_action(uuid, text, integer, integer), public.match_booking_release(uuid), public.match_booking(uuid),
  public.servers_free(text), public.server_set_flags(uuid, boolean, boolean, boolean), public.pcw_ban_lift(uuid),
  public.admin_pcw_bans(boolean, text, text, text, integer, integer),
  public.match_veto_done(uuid)
  from public, anon;
grant execute on function public.match_start(uuid, uuid, integer), public.pcw_ready(uuid, boolean),
  public.match_booking_action(uuid, text, integer, integer), public.match_booking_release(uuid),
  public.servers_free(text), public.server_set_flags(uuid, boolean, boolean, boolean), public.pcw_ban_lift(uuid),
  public.admin_pcw_bans(boolean, text, text, text, integer, integer)
  to authenticated;
grant execute on function public.match_booking(uuid), public.match_veto_done(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
