-- Replanteo 42: matchmaking con cola en la web y servidor automático (plan docs/bitacora/2026-10-28-matchmaking).
--   - Todo el estado vive en la base: cola, grupos, salas, confirmaciones y sanciones.
--   - mm_tick() arma las salas y vence los plazos; lo llama cada 2 s el worker con la service_role.
--   - La partida es una fila de matches (kind = 'mm'): el veto y el chat son los de siempre.
--   - Las tablas no se leen directo: solo por funciones. La contraseña nunca viaja en un NOTIFY.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.ac_devices') is null then
    raise exception 'replanteo 42: falta ac_devices (aplicar antes 39_anticheat.sql)';
  end if;
  if to_regclass('public.game_modes') is null or to_regclass('public.bans') is null then
    raise exception 'replanteo 42: faltan game_modes o bans (aplicar antes 31 y 33)';
  end if;
  if to_regclass('public.mm_config') is not null then
    raise exception 'replanteo 42: mm_config ya existe (¿ya se aplicó?)';
  end if;
end $$;

-- Cambios en tablas que ya existen.
alter table public.matches drop constraint matches_kind_check;
alter table public.matches add constraint matches_kind_check
  check (kind = any (array['official', 'pcw', 'mix', 'mm'])) not valid;
alter table public.match_chat add column side smallint check (side in (1, 2));
-- En una mm no hay equipos ni, en un baneo automático, autor: el bando va en side.
alter table public.match_vetos alter column team_id drop not null, alter column by_user drop not null;
alter table public.match_vetos add column side smallint check (side in (1, 2));
alter table public.game_servers add column mm_enabled boolean not null default false;
alter table public.notifications drop constraint notifications_category_check;
alter table public.notifications add constraint notifications_category_check
  check (category = any (array['team', 'tournament', 'pcw', 'elo', 'season', 'account', 'news', 'admin', 'mm']));

-- Configuración.
create table public.mm_config (
  id integer primary key default 1 check (id = 1),
  open boolean not null default false,
  max_party_size integer not null default 2 check (max_party_size between 1 and 5),
  party_max_elo_gap integer not null default 500 check (party_max_elo_gap >= 0),
  accept_seconds integer not null default 20 check (accept_seconds between 5 and 120),
  veto_seconds integer not null default 15 check (veto_seconds between 5 and 120),
  connect_minutes integer not null default 5 check (connect_minutes between 1 and 30),
  server_wait_minutes integer not null default 3 check (server_wait_minutes between 1 and 30),
  elo_window_start integer not null default 150,
  elo_window_step integer not null default 50,
  elo_window_every_s integer not null default 30 check (elo_window_every_s >= 1),
  elo_window_max integer not null default 600,
  elo_unlimited_after_s integer not null default 300,
  penalty_ladder integer[] not null default '{5,15,60,1440}' check (cardinality(penalty_ladder) >= 1),
  reconnect_minutes integer not null default 3 check (reconnect_minutes between 1 and 30),
  require_anticheat boolean not null default true,
  max_blocks integer not null default 1 check (max_blocks between 0 and 10),
  blocks_vip_only boolean not null default true,
  min_mixes integer not null default 5 check (min_mixes >= 0),
  min_account_days integer not null default 7 check (min_account_days >= 0),
  season_queue_close_minutes integer not null default 15 check (season_queue_close_minutes >= 0)
);
insert into public.mm_config default values;

create table public.mm_mode_settings (
  mode text primary key references public.game_modes(code),
  enabled boolean not null default false,
  affects_elo boolean not null default false,
  position integer not null default 0
);
insert into public.mm_mode_settings (mode, enabled, affects_elo, position)
  select code, code = '5v5', code = '5v5', sort from public.game_modes;

create table public.mm_mode_maps (
  mode text not null references public.game_modes(code),
  map text not null references public.map_pool(name) on update cascade,
  position integer not null default 0,
  primary key (mode, map)
);
insert into public.map_pool (name, versions, position, active)
  select n, array[n], 100 + o, true
    from unnest(array['de_dust2', 'de_inferno', 'de_tuscan', 'de_nuke', 'de_season', 'de_cbble', 'de_cache', 'de_train', 'de_mirage'])
         with ordinality as t(n, o)
   where not exists (select 1 from public.map_pool m where m.name = t.n);
insert into public.mm_mode_maps (mode, map, position)
  select '5v5', n, o
    from unnest(array['de_dust2', 'de_inferno', 'de_tuscan', 'de_nuke', 'de_season', 'de_cbble', 'de_cache', 'de_train', 'de_mirage'])
         with ordinality as t(n, o)
   where exists (select 1 from public.game_modes where code = '5v5');
insert into public.mm_mode_maps (mode, map, position)
  select g.code, m.name, m.position from public.game_modes g cross join public.map_pool m
   where g.code <> '5v5' and m.mixes and m.active;

-- Grupos.
create table public.mm_parties (
  id uuid primary key default gen_random_uuid(),
  leader_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.mm_party_members (
  party_id uuid not null references public.mm_parties(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (party_id, user_id)
);
create table public.mm_party_invites (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.mm_parties(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '60 seconds',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired'))
);
create unique index mm_party_invites_pending on public.mm_party_invites (from_user, to_user) where status = 'pending';

-- Cola.
create table public.mm_queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  party_id uuid references public.mm_parties(id) on delete set null,
  mode text not null references public.game_modes(code),
  region text,
  elo integer not null,
  joined_at timestamptz not null default now()
);
create index mm_queue_mode on public.mm_queue (mode, joined_at);

create table public.mm_queue_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,
  joined_at timestamptz not null,
  left_at timestamptz not null default now(),
  outcome text not null check (outcome in ('matched', 'left', 'cancelled', 'closed'))
);

-- Salas.
create table public.mm_lobbies (
  id uuid primary key default gen_random_uuid(),
  mode text not null references public.game_modes(code),
  status text not null default 'accepting'
    check (status in ('accepting', 'veto', 'waiting_server', 'assigned', 'connecting', 'live', 'finished', 'cancelled')),
  match_id uuid references public.matches(id) on delete set null,
  server_id uuid references public.game_servers(id) on delete set null,
  map text,
  password text,
  require_anticheat boolean not null default true,
  affects_elo boolean not null default true,
  accept_deadline timestamptz,
  veto_turn smallint check (veto_turn in (1, 2)),
  veto_deadline timestamptz,
  assign_deadline timestamptz,
  connect_deadline timestamptz,
  server_wait_deadline timestamptz,
  winner_team smallint check (winner_team in (1, 2)),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text
);
create index mm_lobbies_open on public.mm_lobbies (status) where status not in ('finished', 'cancelled');
create unique index mm_lobbies_server on public.mm_lobbies (server_id) where server_id is not null and status not in ('finished', 'cancelled');

create table public.mm_lobby_players (
  lobby_id uuid not null references public.mm_lobbies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  party_id uuid,
  region text,
  team smallint not null check (team in (1, 2)),
  is_captain boolean not null default false,
  elo integer not null,
  joined_at timestamptz not null,
  accepted_at timestamptz,
  declined_at timestamptz,
  connected_at timestamptz,
  left_at timestamptz,
  abandoned boolean not null default false,
  primary key (lobby_id, user_id)
);
create index mm_lobby_players_user on public.mm_lobby_players (user_id);

-- Moderación, sanciones y lo social.
create table public.mm_penalties (
  user_id uuid primary key references auth.users(id) on delete cascade,
  level integer not null default 0,
  until timestamptz,
  last_offense_at timestamptz
);
create table public.mm_penalty_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  until timestamptz not null
);
create table public.mm_reports (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.mm_lobbies(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('afk', 'toxic', 'cheat', 'abandon', 'other')),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'dismissed', 'warned', 'banned')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  unique (lobby_id, reporter_id, reported_id)
);
create table public.mm_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  until timestamptz not null,
  reason text not null,
  report_id uuid references public.mm_reports(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index mm_bans_user on public.mm_bans (user_id, until);
create table public.mm_blocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, player_id)
);
create table public.mm_friends (
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, player_id)
);
create table public.mm_commends (
  lobby_id uuid not null references public.mm_lobbies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lobby_id, user_id)
);
create table public.mm_sounds (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  url text not null,
  -- null = del catálogo de los admins; con dueño = sonido propio de un VIP (uno por cuenta).
  owner_id uuid unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.mm_sound_choice (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sound_id uuid references public.mm_sounds(id) on delete set null
);

-- Servidores.
create table public.mm_server_state (
  server_id uuid primary key references public.game_servers(id) on delete cascade,
  last_poll_at timestamptz,
  unavailable_until timestamptz,
  plugin_version text
);
create table public.mm_server_passwords (
  id uuid primary key default gen_random_uuid(),
  uid text unique,
  server_id uuid not null references public.game_servers(id) on delete cascade,
  password text not null,
  kind text not null check (kind in ('mix', 'idle')),
  lobby_id uuid references public.mm_lobbies(id) on delete set null,
  set_by text not null,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index mm_server_passwords_server on public.mm_server_passwords (server_id, created_at desc);

-- Nada se lee ni se escribe directo: todo pasa por las funciones de abajo.
do $$
declare t text;
begin
  foreach t in array array['mm_config', 'mm_mode_settings', 'mm_mode_maps', 'mm_parties', 'mm_party_members', 'mm_party_invites',
    'mm_queue', 'mm_queue_log', 'mm_lobbies', 'mm_lobby_players', 'mm_penalties', 'mm_penalty_log', 'mm_reports', 'mm_bans',
    'mm_blocks', 'mm_friends', 'mm_commends', 'mm_sounds', 'mm_sound_choice', 'mm_server_state', 'mm_server_passwords'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Sonidos: públicos para leer. Los admins escriben en catalogo/ y cada VIP en su carpeta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('sounds', 'sounds', true, 1048576, array['audio/mpeg', 'audio/ogg', 'audio/wav']) on conflict (id) do nothing;
create policy "sonidos: leer" on storage.objects for select to anon, authenticated using (bucket_id = 'sounds');
create policy "sonidos: escribir" on storage.objects for insert to authenticated with check (
  bucket_id = 'sounds' and (((storage.foldername(name))[1] = 'catalogo' and is_admin())
    or ((storage.foldername(name))[1] = auth.uid()::text and is_vip(auth.uid()))));
create policy "sonidos: borrar" on storage.objects for delete to authenticated using (
  bucket_id = 'sounds' and (((storage.foldername(name))[1] = 'catalogo' and is_admin()) or (storage.foldername(name))[1] = auth.uid()::text));

-- ---------- Ayudas ----------

create function public.mm_new_password(p_len int default 6) returns text
  language sql volatile as $$
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + floor(random() * 31)::int, 1), '')
    from generate_series(1, p_len) $$;

create function public.mm_emit(p_type text, p_lobby uuid, p_users uuid[]) returns void
  language sql as $$
  select pg_notify('mm', json_build_object('t', p_type, 'lobby', p_lobby, 'users', coalesce(p_users, '{}'))::text) $$;

create function public.mm_lobby_users(p_lobby uuid) returns uuid[]
  language sql stable as $$ select coalesce(array_agg(user_id), '{}') from mm_lobby_players where lobby_id = p_lobby $$;

create function public.mm_active_lobby(p_user uuid) returns uuid
  language sql stable as $$
  select l.id from mm_lobby_players lp join mm_lobbies l on l.id = lp.lobby_id
   where lp.user_id = p_user and l.status not in ('finished', 'cancelled')
   order by l.created_at desc limit 1 $$;

create function public.mm_player_elo(p_player uuid) returns integer
  language sql stable as $$ select coalesce((select elo from player_overview where id = p_player), 1000) $$;

create function public.mm_elo_window(p_wait_s numeric) returns integer
  language sql stable as $$
  select case when p_wait_s >= c.elo_unlimited_after_s then null
              else least(c.elo_window_max, c.elo_window_start + c.elo_window_step * floor(p_wait_s / c.elo_window_every_s)::int) end
    from mm_config c $$;

/** Por qué esta cuenta no puede entrar a la cola; null = puede. */
create function public.mm_block_reason(p_user uuid) returns text
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

create function public.mm_penalize(p_user uuid, p_reason text) returns void
  language plpgsql security definer set search_path = public as $$
declare
  ladder int[] := (select penalty_ladder from mm_config);
  lvl int;
  fin timestamptz;
begin
  -- El contador baja uno cada 7 días sin faltas.
  select greatest(0, level - floor(extract(epoch from now() - coalesce(last_offense_at, now())) / 604800)::int) + 1
    into lvl from mm_penalties where user_id = p_user;
  lvl := least(coalesce(lvl, 1), cardinality(ladder));
  fin := now() + make_interval(mins => ladder[lvl]);
  insert into mm_penalties (user_id, level, until, last_offense_at) values (p_user, lvl, fin, now())
    on conflict (user_id) do update set level = excluded.level, until = excluded.until, last_offense_at = now();
  insert into mm_penalty_log (user_id, reason, until) values (p_user, p_reason, fin);
end $$;

create function public.mm_queue_remove(p_user uuid, p_outcome text) returns void
  language plpgsql security definer set search_path = public as $$
declare q mm_queue%rowtype;
begin
  delete from mm_queue where user_id = p_user returning * into q;
  if q.user_id is not null then
    insert into mm_queue_log (user_id, mode, joined_at, outcome) values (q.user_id, q.mode, q.joined_at, p_outcome);
  end if;
end $$;

-- ---------- Cola ----------

create function public.mm_join(p_mode text, p_region text default null) returns void
  language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_party uuid;
  v_leader uuid;
  v_size int;
  r record;
  razon text;
begin
  if me is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  if not (select open from mm_config) then raise exception 'La cola está cerrada'; end if;
  select pm.party_id, p.leader_id into v_party, v_leader from mm_party_members pm join mm_parties p on p.id = pm.party_id where pm.user_id = me;
  if v_party is not null and v_leader <> me then raise exception 'Solo el líder del grupo entra a la cola'; end if;
  select g.players_per_team into v_size from mm_mode_settings s join game_modes g on g.code = s.mode where s.mode = p_mode and s.enabled;
  if v_size is null then raise exception 'Ese modo no está habilitado'; end if;
  if v_party is not null and (select count(*) from mm_party_members where party_id = v_party) > v_size then
    raise exception 'Tu grupo no entra en un equipo de %', p_mode;
  end if;
  if (select count(*) from game_servers s where s.mm_enabled and (s.region = p_region or p_region is null)) = 0 and p_region is not null then
    raise exception 'No hay servidores en esa región';
  end if;
  for r in select coalesce(pm.user_id, me) as uid from (select 1) x left join mm_party_members pm on pm.party_id = v_party loop
    razon := mm_block_reason(r.uid);
    if razon is not null then
      raise exception '%', case when r.uid = me then razon else 'Alguien de tu grupo no puede jugar: ' || razon end;
    end if;
    if mm_active_lobby(r.uid) is not null then raise exception 'Hay alguien del grupo en una sala'; end if;
  end loop;
  insert into mm_queue (user_id, player_id, party_id, mode, region, elo)
    select u.uid, p.id, v_party, p_mode, p_region, mm_player_elo(p.id)
      from (select coalesce(pm.user_id, me) as uid from (select 1) x left join mm_party_members pm on pm.party_id = v_party) u
      join players p on p.user_id = u.uid
    on conflict (user_id) do nothing;
end $$;

create function public.mm_leave() returns void
  language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_party uuid := (select party_id from mm_party_members where user_id = me);
  r record;
begin
  if (select l.status from mm_lobbies l where l.id = mm_active_lobby(me)) = 'accepting' then
    perform mm_decline();
    return;
  end if;
  for r in select user_id from mm_queue where user_id = me or (v_party is not null and party_id = v_party) loop
    perform mm_queue_remove(r.user_id, 'left');
  end loop;
end $$;

-- ---------- Grupos ----------

create function public.mm_party_clear_queue(p_party uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select user_id from mm_queue where party_id = p_party loop perform mm_queue_remove(r.user_id, 'left'); end loop;
end $$;

create function public.mm_party_invite(p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  c mm_config%rowtype;
  v_to uuid;
  v_party uuid;
  mine int;
begin
  select * into c from mm_config;
  if me is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  select user_id into v_to from players where id = p_player;
  if v_to is null then raise exception 'Ese jugador no tiene cuenta'; end if;
  if v_to = me then raise exception 'No te podés invitar a vos mismo'; end if;
  if exists (select 1 from mm_queue where user_id = me) or mm_active_lobby(me) is not null then raise exception 'Primero salí de la cola'; end if;
  if coalesce((select preferences->>'mm_invites' from user_preferences where user_id = v_to), 'public') = 'private' then
    raise exception 'Ese jugador no acepta invitaciones';
  end if;
  mine := (select id_elo from (select mm_player_elo(id) id_elo from players where user_id = me) x);
  if abs(mine - mm_player_elo(p_player)) > c.party_max_elo_gap then
    raise exception 'La diferencia de ELO con ese jugador es mayor a %', c.party_max_elo_gap;
  end if;
  select party_id into v_party from mm_party_members where user_id = me;
  if v_party is null then
    insert into mm_parties (leader_id) values (me) returning id into v_party;
    insert into mm_party_members (party_id, user_id) values (v_party, me);
  elsif (select leader_id from mm_parties where id = v_party) <> me then
    raise exception 'Solo el líder invita';
  end if;
  if (select count(*) from mm_party_members where party_id = v_party) >= c.max_party_size then raise exception 'Tu grupo ya está completo'; end if;
  update mm_party_invites set status = 'expired' where from_user = me and to_user = v_to and status = 'pending';
  insert into mm_party_invites (party_id, from_user, to_user) values (v_party, me, v_to);
end $$;

create function public.mm_party_detach(p_user uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_party uuid := (select party_id from mm_party_members where user_id = p_user);
  v_next uuid;
begin
  if v_party is null then return; end if;
  perform mm_party_clear_queue(v_party);
  delete from mm_party_members where user_id = p_user;
  select user_id into v_next from mm_party_members where party_id = v_party order by joined_at limit 1;
  if v_next is null or (select count(*) from mm_party_members where party_id = v_party) = 1 then
    delete from mm_parties where id = v_party;
  elsif (select leader_id from mm_parties where id = v_party) = p_user then
    update mm_parties set leader_id = v_next where id = v_party;
  end if;
end $$;

create function public.mm_party_respond(p_invite uuid, p_accept boolean) returns void
  language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  i mm_party_invites%rowtype;
begin
  select * into i from mm_party_invites where id = p_invite and to_user = me and status = 'pending' for update;
  if i.id is null or i.expires_at <= now() then raise exception 'Esa invitación ya no está'; end if;
  if not p_accept then
    update mm_party_invites set status = 'declined' where id = i.id;
    -- Un grupo que solo tenía al que invitó se borra.
    if (select count(*) from mm_party_members where party_id = i.party_id) = 1
       and not exists (select 1 from mm_party_invites where party_id = i.party_id and status = 'pending') then
      delete from mm_parties where id = i.party_id;
    end if;
    return;
  end if;
  if mm_active_lobby(me) is not null then raise exception 'No podés cambiar de grupo durante una sala'; end if;
  if (select count(*) from mm_party_members where party_id = i.party_id)
     >= (select max_party_size from mm_config) then raise exception 'Ese grupo ya está completo'; end if;
  perform mm_queue_remove(me, 'left');
  perform mm_party_detach(me);
  perform mm_party_clear_queue(i.party_id);
  insert into mm_party_members (party_id, user_id) values (i.party_id, me);
  update mm_party_invites set status = 'accepted' where id = i.id;
end $$;

create function public.mm_party_leave() returns void
  language plpgsql security definer set search_path = public as $$
begin
  if mm_active_lobby(auth.uid()) is not null then raise exception 'No podés salir del grupo durante una sala'; end if;
  perform mm_party_detach(auth.uid());
end $$;

create function public.mm_party_kick(p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_party uuid := (select id from mm_parties where leader_id = me);
  v_user uuid := (select user_id from players where id = p_player);
begin
  if v_party is null then raise exception 'Solo el líder saca a alguien'; end if;
  if mm_active_lobby(me) is not null then raise exception 'No se puede durante una sala'; end if;
  if v_user = me or not exists (select 1 from mm_party_members where party_id = v_party and user_id = v_user) then
    raise exception 'Ese jugador no está en tu grupo';
  end if;
  perform mm_party_detach(v_user);
end $$;

create function public.mm_party_promote(p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_party uuid := (select id from mm_parties where leader_id = auth.uid());
  v_user uuid := (select user_id from players where id = p_player);
begin
  if v_party is null then raise exception 'Solo el líder pasa el liderazgo'; end if;
  if not exists (select 1 from mm_party_members where party_id = v_party and user_id = v_user) then
    raise exception 'Ese jugador no está en tu grupo';
  end if;
  update mm_parties set leader_id = v_user where id = v_party;
end $$;

-- ---------- Armado de salas ----------

/** Servidor libre: en línea, habilitado, con licencia y sin otra sala. Primero la región más pedida. */
create function public.mm_free_server(p_regions text[]) returns uuid
  language sql stable as $$
  select s.id from game_servers s join mm_server_state st on st.server_id = s.id
   where s.mm_enabled and s.active and (s.license_expires_at is null or s.license_expires_at > now())
     and st.last_poll_at > now() - interval '30 seconds'
     and (st.unavailable_until is null or st.unavailable_until < now())
     and not exists (select 1 from mm_lobbies l where l.server_id = s.id and l.status not in ('finished', 'cancelled'))
   order by (select count(*) from unnest(p_regions) r where r = s.region) desc,
            (select max(l.ended_at) from mm_lobbies l where l.server_id = s.id) nulls first
   limit 1 $$;

/** La mejor división en dos equipos: no separa grupos, no junta bloqueados y minimiza la diferencia de ELO. */
create function public.mm_best_split(p_users uuid[], p_elos int[], p_parties uuid[], p_size int) returns smallint[]
  language plpgsql stable security definer set search_path = public as $$
declare
  n int := cardinality(p_users);
  sides smallint[];
  best_sides smallint[];
  mask int;
  i int; j int;
  sum1 int; sum2 int; cnt int;
  ok boolean;
  diff int;
  best int;
  bloqueados int[][] := array(select array[a.o::int, b.o::int]
      from unnest(p_users) with ordinality a(u, o)
      join mm_blocks bl on bl.user_id = a.u
      join players pl on pl.id = bl.player_id
      join unnest(p_users) with ordinality b(u, o) on b.u = pl.user_id);
  par int[];
begin
  -- El jugador 1 queda siempre en el equipo 1: las demás combinaciones son espejadas.
  for mask in 0..(1 << (n - 1)) - 1 loop
    sides := array[1]::smallint[]; cnt := 1; sum1 := p_elos[1]; sum2 := 0; ok := true;
    for i in 2..n loop
      if (mask >> (i - 2)) & 1 = 1 then
        sides := sides || 1::smallint; cnt := cnt + 1; sum1 := sum1 + p_elos[i];
      else
        sides := sides || 2::smallint; sum2 := sum2 + p_elos[i];
      end if;
    end loop;
    if cnt <> p_size then continue; end if;
    -- Un grupo nunca se separa.
    for i in 1..n loop
      for j in i + 1..n loop
        if p_parties[i] = p_parties[j] and sides[i] <> sides[j] then ok := false; end if;
      end loop;
    end loop;
    -- Dos que se bloquearon no van en el mismo equipo.
    if ok and cardinality(bloqueados) > 0 then
      foreach par slice 1 in array bloqueados loop
        if sides[par[1]] = sides[par[2]] then ok := false; end if;
      end loop;
    end if;
    if not ok then continue; end if;
    diff := abs(sum1 - sum2);
    if best is null or diff < best then best := diff; best_sides := sides; end if;
  end loop;
  return best_sides;
end $$;

create function public.mm_try_build(p_mode text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  c mm_config%rowtype;
  v_size int := (select players_per_team from game_modes where code = p_mode);
  anchor record;
  unit record;
  v_users uuid[]; v_players uuid[]; v_elos int[]; v_parties uuid[]; v_joined timestamptz[]; v_regions text[];
  v_window int;
  teams smallint[];
  v_server uuid;
  v_lobby uuid;
  i int;
begin
  select * into c from mm_config;
  -- Cada grupo cuenta como una unidad; se prueba desde el que más esperó.
  for anchor in
    select coalesce(party_id::text, user_id::text) k, avg(elo)::int elo, min(joined_at) joined
      from mm_queue where mode = p_mode group by 1 order by 3
  loop
    v_users := '{}'; v_players := '{}'; v_elos := '{}'; v_parties := '{}'; v_joined := '{}'; v_regions := '{}';
    v_window := mm_elo_window(extract(epoch from now() - anchor.joined));
    for unit in
      select coalesce(party_id::text, user_id::text) k, avg(elo)::int elo, min(joined_at) joined, count(*)::int n
        from mm_queue where mode = p_mode group by 1 order by (coalesce(party_id::text, user_id::text) <> anchor.k), 3
    loop
      if v_window is not null and abs(unit.elo - anchor.elo) > v_window then continue; end if;
      if cardinality(v_users) + unit.n > v_size * 2 or unit.n > v_size then continue; end if;
      select v_users || array_agg(user_id order by user_id), v_players || array_agg(player_id order by user_id),
             v_elos || array_agg(elo order by user_id), v_parties || array_agg(party_id order by user_id),
             v_joined || array_agg(joined_at order by user_id), v_regions || array_agg(region order by user_id)
        into v_users, v_players, v_elos, v_parties, v_joined, v_regions
        from mm_queue where mode = p_mode and coalesce(party_id::text, user_id::text) = unit.k;
      exit when cardinality(v_users) = v_size * 2;
    end loop;
    if cardinality(v_users) <> v_size * 2 then continue; end if;
    teams := mm_best_split(v_users, v_elos, v_parties, v_size);
    if teams is null then continue; end if;
    -- Sin servidor libre no se arma: siguen en cola.
    v_server := mm_free_server(v_regions);
    if v_server is null then return null; end if;
    insert into mm_lobbies (mode, server_id, accept_deadline, require_anticheat, affects_elo)
      values (p_mode, v_server, now() + make_interval(secs => c.accept_seconds), c.require_anticheat,
              (select affects_elo from mm_mode_settings where mode = p_mode))
      returning id into v_lobby;
    for i in 1..cardinality(v_users) loop
      insert into mm_lobby_players (lobby_id, user_id, player_id, party_id, region, team, elo, joined_at)
        values (v_lobby, v_users[i], v_players[i], v_parties[i], v_regions[i], teams[i], v_elos[i], v_joined[i]);
      perform mm_queue_remove(v_users[i], 'matched');
    end loop;
    perform mm_emit('lobby.found', v_lobby, v_users);
    return v_lobby;
  end loop;
  return null;
end $$;

/** Cierra una sala. Devuelve a la cola a los que aceptaron, con su lugar, si fue en la confirmación. */
create function public.mm_cancel_lobby(p_lobby uuid, p_reason text, p_requeue boolean default false) returns void
  language plpgsql security definer set search_path = public as $$
declare
  l mm_lobbies%rowtype;
  r record;
begin
  update mm_lobbies set status = 'cancelled', ended_at = now(), end_reason = p_reason where id = p_lobby and status not in ('finished', 'cancelled') returning * into l;
  if l.id is null then return; end if;
  if l.match_id is not null then
    update matches set status = 'cancelled', cancel_reason = p_reason where id = l.match_id and status <> 'finished';
  end if;
  if p_requeue then
    -- Un grupo vuelve solo si aceptaron todos sus integrantes.
    for r in
      select lp.* from mm_lobby_players lp where lp.lobby_id = p_lobby and lp.accepted_at is not null
         and not exists (select 1 from mm_lobby_players o where o.lobby_id = p_lobby and o.party_id = lp.party_id and o.accepted_at is null)
    loop
      insert into mm_queue (user_id, player_id, party_id, mode, region, elo, joined_at)
        values (r.user_id, r.player_id, r.party_id, l.mode, r.region, r.elo, r.joined_at) on conflict (user_id) do nothing;
    end loop;
  end if;
  perform mm_emit('lobby.cancelled', p_lobby, mm_lobby_users(p_lobby));
end $$;

create function public.mm_accept() returns void
  language plpgsql security definer set search_path = public as $$
declare v_lobby uuid := mm_active_lobby(auth.uid());
begin
  if v_lobby is null or (select status from mm_lobbies where id = v_lobby) <> 'accepting' then raise exception 'No hay nada para aceptar'; end if;
  update mm_lobby_players set accepted_at = coalesce(accepted_at, now()) where lobby_id = v_lobby and user_id = auth.uid();
end $$;

create function public.mm_decline() returns void
  language plpgsql security definer set search_path = public as $$
declare v_lobby uuid := mm_active_lobby(auth.uid());
begin
  if v_lobby is null or (select status from mm_lobbies where id = v_lobby) <> 'accepting' then raise exception 'No hay nada para rechazar'; end if;
  update mm_lobby_players set declined_at = now() where lobby_id = v_lobby and user_id = auth.uid();
  perform mm_penalize(auth.uid(), 'Rechazaste una partida');
  perform mm_cancel_lobby(v_lobby, 'Un jugador rechazó la partida', true);
end $$;

create function public.mm_start_veto(p_lobby uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  l mm_lobbies%rowtype;
  v_match uuid;
  a1 numeric; a2 numeric;
  n1 text; n2 text;
begin
  select * into l from mm_lobbies where id = p_lobby;
  -- Capitán: el de más ELO de cada equipo; si empatan, el que más esperó.
  update mm_lobby_players set is_captain = true where (lobby_id, user_id) in (
    select distinct on (team) lobby_id, user_id from mm_lobby_players where lobby_id = p_lobby order by team, elo desc, joined_at);
  select avg(elo) filter (where team = 1), avg(elo) filter (where team = 2) into a1, a2 from mm_lobby_players where lobby_id = p_lobby;
  select 'team_' || p.nick into n1 from mm_lobby_players lp join players p on p.id = lp.player_id where lp.lobby_id = p_lobby and lp.team = 1 and lp.is_captain;
  select 'team_' || p.nick into n2 from mm_lobby_players lp join players p on p.id = lp.player_id where lp.lobby_id = p_lobby and lp.team = 2 and lp.is_captain;
  insert into matches (kind, status, best_of, side1_name, side2_name, server_id, lineup1, lineup2)
    values ('mm', 'upcoming', 1, n1, n2, l.server_id,
      (select coalesce(array_agg(player_id), '{}') from mm_lobby_players where lobby_id = p_lobby and team = 1),
      (select coalesce(array_agg(player_id), '{}') from mm_lobby_players where lobby_id = p_lobby and team = 2))
    returning id into v_match;
  -- Empieza a banear el equipo con menor ELO promedio.
  update mm_lobbies set status = 'veto', match_id = v_match, veto_turn = case when a1 <= a2 then 1 else 2 end,
    veto_deadline = now() + make_interval(secs => (select veto_seconds from mm_config)) where id = p_lobby;
  perform mm_emit('lobby.veto', p_lobby, mm_lobby_users(p_lobby));
end $$;

/** Registra un baneo. Si queda un mapa, termina el veto y le da la contraseña a la sala. */
create function public.mm_ban_map(p_lobby uuid, p_map text, p_by uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  l mm_lobbies%rowtype;
  n int;
  v_left text;
  v_count int;
begin
  select * into l from mm_lobbies where id = p_lobby for update;
  if l.status <> 'veto' then raise exception 'El veto ya terminó'; end if;
  if not exists (select 1 from mm_mode_maps where mode = l.mode and map = p_map) then raise exception 'Ese mapa no está en el pool'; end if;
  if exists (select 1 from match_vetos where match_id = l.match_id and map = p_map) then raise exception 'Ese mapa ya se baneó'; end if;
  n := (select count(*) from match_vetos where match_id = l.match_id);
  insert into match_vetos (match_id, seq, map, action, by_user, side) values (l.match_id, n + 1, p_map, 'ban', p_by, l.veto_turn);
  select count(*), min(m.map) into v_count, v_left from mm_mode_maps m
   where m.mode = l.mode and not exists (select 1 from match_vetos v where v.match_id = l.match_id and v.map = m.map);
  if v_count = 1 then
    update matches set map = v_left where id = l.match_id;
    update mm_lobbies set map = v_left, veto_turn = null, veto_deadline = null, status = 'waiting_server', password = mm_new_password(),
      server_wait_deadline = now() + make_interval(mins => (select server_wait_minutes from mm_config)) where id = p_lobby;
  else
    update mm_lobbies set veto_turn = 3 - veto_turn, veto_deadline = now() + make_interval(secs => (select veto_seconds from mm_config)) where id = p_lobby;
  end if;
  perform mm_emit('lobby.veto', p_lobby, mm_lobby_users(p_lobby));
end $$;

/** Con el advisory lock, nunca corren dos a la vez. */
create function public.mm_tick() returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  c mm_config%rowtype;
  l mm_lobbies%rowtype;
  r record;
  built int := 0;
  v_server uuid;
  v_map text;
  v_ends timestamptz;
begin
  if not pg_try_advisory_xact_lock(hashtext('mm_tick')) then return jsonb_build_object('skipped', true); end if;
  select * into c from mm_config;

  update mm_party_invites set status = 'expired' where status = 'pending' and expires_at <= now();
  delete from mm_parties p where not exists (select 1 from mm_party_invites i where i.party_id = p.id and i.status = 'pending')
     and (select count(*) from mm_party_members m where m.party_id = p.id) <= 1;

  for l in select * from mm_lobbies where status not in ('finished', 'cancelled') loop
    if l.status = 'accepting' then
      if not exists (select 1 from mm_lobby_players where lobby_id = l.id and accepted_at is null) then
        perform mm_start_veto(l.id);
      elsif l.accept_deadline <= now() then
        for r in select user_id from mm_lobby_players where lobby_id = l.id and accepted_at is null loop
          perform mm_penalize(r.user_id, 'No aceptaste una partida');
        end loop;
        perform mm_cancel_lobby(l.id, 'Un jugador no aceptó a tiempo', true);
      end if;
    elsif l.status = 'veto' then
      if l.veto_deadline <= now() then
        select m.map into v_map from mm_mode_maps m
         where m.mode = l.mode and not exists (select 1 from match_vetos v where v.match_id = l.match_id and v.map = m.map)
         order by random() limit 1;
        perform mm_ban_map(l.id, v_map, null);
      end if;
    elsif l.status = 'waiting_server' then
      v_server := case when l.server_id is not null and exists (select 1 from mm_server_state s where s.server_id = l.server_id and s.last_poll_at > now() - interval '30 seconds'
                                 and (s.unavailable_until is null or s.unavailable_until < now())) then l.server_id
                       else mm_free_server(array(select region from mm_lobby_players where lobby_id = l.id)) end;
      if v_server is not null then
        update mm_lobbies set server_id = v_server, status = 'assigned', assign_deadline = now() + interval '30 seconds' where id = l.id;
        update matches set server_id = v_server where id = l.match_id;
        perform mm_emit('lobby.server', l.id, mm_lobby_users(l.id));
      elsif l.server_wait_deadline <= now() then
        perform mm_cancel_lobby(l.id, 'No hubo un servidor libre');
      end if;
    elsif l.status = 'assigned' then
      if l.assign_deadline <= now() then
        update mm_server_state set unavailable_until = now() + interval '10 minutes' where server_id = l.server_id;
        update mm_lobbies set status = 'waiting_server', server_id = null where id = l.id;
      end if;
    elsif l.status = 'connecting' then
      if l.connect_deadline <= now() then
        for r in select user_id from mm_lobby_players where lobby_id = l.id and connected_at is null loop
          perform mm_penalize(r.user_id, 'No te conectaste a la partida');
        end loop;
        perform mm_cancel_lobby(l.id, 'No se conectaron todos a tiempo');
      end if;
    elsif l.status = 'live' then
      for r in select user_id from mm_lobby_players where lobby_id = l.id and left_at is not null and not abandoned
                  and left_at + make_interval(mins => c.reconnect_minutes) <= now() loop
        update mm_lobby_players set abandoned = true, left_at = null where lobby_id = l.id and user_id = r.user_id;
        perform mm_penalize(r.user_id, 'Abandonaste una partida');
        perform mm_emit('lobby.player', l.id, mm_lobby_users(l.id));
      end loop;
    end if;
  end loop;

  -- La cola se cierra antes del fin de la temporada; las salas ya armadas siguen.
  select ends_at into v_ends from seasons where status = 'active' limit 1;
  if c.open and not (v_ends is not null and v_ends <= now() + make_interval(mins => c.season_queue_close_minutes)) then
    for r in select mode from mm_mode_settings where enabled loop
      while mm_try_build(r.mode) is not null loop built := built + 1; end loop;
    end loop;
  end if;
  delete from mm_queue_log where left_at < now() - interval '180 days';
  return jsonb_build_object('built', built);
end $$;

-- ---------- Veto y chat: los de siempre, con el caso mm ----------

alter function public.veto_act(uuid, text, text) rename to veto_act_base;
create function public.veto_act(p_match uuid, p_map text, p_version text default null) returns void
  language plpgsql security definer set search_path = public as $$
declare l mm_lobbies%rowtype;
begin
  if (select kind from matches where id = p_match) is distinct from 'mm' then
    perform veto_act_base(p_match, p_map, p_version);
    return;
  end if;
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  select * into l from mm_lobbies where match_id = p_match;
  if l.status <> 'veto' then raise exception 'El veto ya terminó'; end if;
  if not exists (select 1 from mm_lobby_players where lobby_id = l.id and user_id = auth.uid() and is_captain and team = l.veto_turn) then
    raise exception 'No es tu turno de banear' using errcode = '42501';
  end if;
  perform mm_ban_map(l.id, p_map, auth.uid());
end $$;
revoke all on function public.veto_act(uuid, text, text), public.veto_act_base(uuid, text, text) from public, anon;
grant execute on function public.veto_act(uuid, text, text) to authenticated;

create or replace function public.match_chat_can_write(p_match uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from matches m where m.id = p_match
       and (m.kind = 'mix' or is_admin() or (m.event_id is not null and can_manage_event(m.event_id)) or is_match_participant(p_match)
            or (m.kind = 'mm' and exists (select 1 from mm_lobbies l join mm_lobby_players lp on lp.lobby_id = l.id
                                           where l.match_id = m.id and lp.user_id = auth.uid()))))
$$;

/** En una mm leen los 10 y los admins, y los mensajes de equipo solo ese equipo. */
create function public.mm_my_team(p_match uuid) returns smallint
  language sql stable security definer set search_path = public as $$
  select lp.team from mm_lobbies l join mm_lobby_players lp on lp.lobby_id = l.id where l.match_id = p_match and lp.user_id = auth.uid() $$;

create function public.mm_chat_can_read(p_match uuid, p_side smallint) returns boolean
  language sql stable security definer set search_path = public as $$
  select not exists (select 1 from matches m where m.id = p_match and m.kind = 'mm')
      or is_admin()
      or exists (select 1 from mm_lobbies l join mm_lobby_players lp on lp.lobby_id = l.id
                  where l.match_id = p_match and lp.user_id = auth.uid() and (p_side is null or lp.team = p_side)) $$;
grant execute on function public.mm_chat_can_read(uuid, smallint) to anon, authenticated;
create policy "chat: mm solo la sala" on public.match_chat as restrictive for select to anon, authenticated
  using (mm_chat_can_read(match_id, side));
create or replace view public.match_chat_public as
  select c.id, c.match_id, c.user_id, coalesce(p.tag, c.tag, 'Usuario'::text) as alias, c.message, c.created_at, c.side
    from match_chat c left join profiles p on p.id = c.user_id
   where mm_chat_can_read(c.match_id, c.side);

-- ---------- Cierre por resultado ----------

alter function public.csstv_link_game(uuid, text, int) rename to csstv_link_game_base;
create function public.csstv_link_game(p_game uuid, p_code text, p_side_a int) returns boolean
  language plpgsql security definer set search_path = public as $$
declare
  par matches%rowtype;
  g matches%rowtype;
  l mm_lobbies%rowtype;
  r1 int; r2 int;
  lado int := coalesce(p_side_a, 1);
begin
  select * into par from matches where link_code = upper(trim(coalesce(p_code, ''))) and status in ('upcoming', 'live') for update;
  if par.id is null or par.kind <> 'mm' then return csstv_link_game_base(p_game, p_code, p_side_a); end if;
  select * into g from matches where id = p_game and kind = 'mix' and status = 'finished' and parent_match_id is null;
  if g.id is null then return false; end if;
  select * into l from mm_lobbies where match_id = par.id;
  r1 := case lado when 1 then g.score1 else g.score2 end;
  r2 := case lado when 1 then g.score2 else g.score1 end;
  update matches set parent_match_id = par.id, parent_side1 = lado, side1_name = par.side1_name, side2_name = par.side2_name where id = g.id;
  update matches set maps = jsonb_build_array(jsonb_build_object('map', g.map, 'r1', r1, 'r2', r2, 'game_id', g.id)),
    score1 = r1, score2 = r2, map = g.map, server_id = g.server_id, played_at = g.played_at, status = 'finished'
   where id = par.id;
  update mm_lobbies set status = 'finished', ended_at = now(), end_reason = 'result',
    winner_team = case when r1 > r2 then 1 when r2 > r1 then 2 end where id = l.id;
  perform mm_emit('lobby.finished', l.id, mm_lobby_users(l.id));
  return true;
end $$;
revoke all on function public.csstv_link_game(uuid, text, int), public.csstv_link_game_base(uuid, text, int) from public, anon, authenticated;

-- ---------- Plugin ----------

create function public.csstv_mm_poll(p_token text, p_version text default null) returns text
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
    'connect_seconds=' || coalesce(greatest(0, extract(epoch from l.connect_deadline - now()))::int, (select connect_minutes * 60 from mm_config)));
end $$;

create function public.csstv_mm_report(p_token text, p_lobby uuid, p_event text, p_data text default null) returns boolean
  language plpgsql security definer set search_path = public as $$
declare
  v_server uuid := csstv_auth(p_token);
  l mm_lobbies%rowtype;
  v_user uuid;
begin
  select * into l from mm_lobbies where id = p_lobby and server_id = v_server for update;
  if l.id is null then return false; end if;
  if p_event in ('connected', 'left', 'back') then
    select p.user_id into v_user from players p join mm_lobby_players lp on lp.player_id = p.id
     where lp.lobby_id = l.id and csstv_steam2(p.steam_id) = p_data;
    if v_user is null then return false; end if;
  end if;
  case p_event
    when 'taken' then
      if l.status <> 'assigned' then return false; end if;
      update mm_lobbies set status = 'connecting', connect_deadline = now() + make_interval(mins => (select connect_minutes from mm_config)) where id = l.id;
      perform mm_emit('lobby.update', l.id, mm_lobby_users(l.id));
    when 'connected' then
      update mm_lobby_players set connected_at = coalesce(connected_at, now()) where lobby_id = l.id and user_id = v_user;
      perform mm_emit('lobby.update', l.id, mm_lobby_users(l.id));
    when 'live' then
      update mm_lobbies set status = 'live' where id = l.id and status = 'connecting';
      update matches set status = 'live' where id = l.match_id;
      perform mm_emit('lobby.update', l.id, mm_lobby_users(l.id));
    when 'left' then
      update mm_lobby_players set left_at = now() where lobby_id = l.id and user_id = v_user and not abandoned;
      perform mm_emit('lobby.player', l.id, mm_lobby_users(l.id));
    when 'back' then
      update mm_lobby_players set left_at = null where lobby_id = l.id and user_id = v_user and not abandoned;
      perform mm_emit('lobby.player', l.id, mm_lobby_users(l.id));
    when 'abort' then
      perform mm_cancel_lobby(l.id, coalesce(p_data, 'El servidor canceló la partida'));
    else
      raise exception 'Evento desconocido: %', p_event;
  end case;
  return true;
end $$;

create function public.csstv_mm_password(p_token text, p_uid text, p_password text, p_kind text, p_lobby uuid default null) returns boolean
  language plpgsql security definer set search_path = public as $$
declare
  v_server uuid := csstv_auth(p_token);
begin
  -- p_uid: el id de una rotación pedida por un admin, o uno propio para que la cola de envíos no duplique.
  update mm_server_passwords set applied_at = coalesce(applied_at, now()) where id::text = p_uid and server_id = v_server;
  if not found then
    insert into mm_server_passwords (uid, server_id, password, kind, lobby_id, set_by, applied_at)
      values (p_uid, v_server, p_password, p_kind, p_lobby, 'plugin', now()) on conflict (uid) do nothing;
  end if;
  delete from mm_server_passwords where id in (
    select id from mm_server_passwords where server_id = v_server order by created_at desc offset 50);
  return true;
end $$;

-- ---------- Bloqueos, amigos, felicitaciones, sonidos y reportes ----------

create function public.mm_block(p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare c mm_config%rowtype;
begin
  select * into c from mm_config;
  if c.blocks_vip_only and not is_vip(auth.uid()) then raise exception 'El bloqueo es exclusivo para VIP'; end if;
  if (select count(*) from mm_blocks where user_id = auth.uid()) >= c.max_blocks then raise exception 'Ya usaste todos tus bloqueos'; end if;
  if (select user_id from players where id = p_player) = auth.uid() then raise exception 'No te podés bloquear a vos mismo'; end if;
  insert into mm_blocks (user_id, player_id) values (auth.uid(), p_player) on conflict do nothing;
end $$;
create function public.mm_unblock(p_player uuid) returns void
  language sql security definer set search_path = public as $$ delete from mm_blocks where user_id = auth.uid() and player_id = p_player $$;
create function public.mm_add_friend(p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if (select user_id from players where id = p_player) = auth.uid() then raise exception 'No te podés sumar a vos mismo'; end if;
  insert into mm_friends (user_id, player_id) values (auth.uid(), p_player) on conflict do nothing;
end $$;
create function public.mm_remove_friend(p_player uuid) returns void
  language sql security definer set search_path = public as $$ delete from mm_friends where user_id = auth.uid() and player_id = p_player $$;
create function public.mm_commend(p_lobby uuid, p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from mm_lobbies l join mm_lobby_players me on me.lobby_id = l.id and me.user_id = auth.uid()
                  join mm_lobby_players o on o.lobby_id = l.id and o.player_id = p_player and o.user_id <> auth.uid()
                 where l.id = p_lobby and l.status = 'finished') then
    raise exception 'Solo felicitás a alguien de tu partida, cuando termina';
  end if;
  insert into mm_commends (lobby_id, user_id, player_id) values (p_lobby, auth.uid(), p_player);
exception when unique_violation then
  raise exception 'Ya felicitaste en esta partida';
end $$;
create function public.mm_set_sound(p_sound uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if p_sound is not null and not exists (select 1 from mm_sounds where id = p_sound and (owner_id is null or owner_id = auth.uid())) then
    raise exception 'Ese sonido no existe';
  end if;
  insert into mm_sound_choice (user_id, sound_id) values (auth.uid(), p_sound) on conflict (user_id) do update set sound_id = excluded.sound_id;
end $$;
create function public.mm_set_my_sound(p_name text, p_url text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not is_vip(auth.uid()) then raise exception 'Subir tu propio sonido es exclusivo para VIP'; end if;
  insert into mm_sounds (name, url, owner_id) values (p_name, p_url, auth.uid())
    on conflict (owner_id) do update set name = excluded.name, url = excluded.url returning id into v;
  perform mm_set_sound(v);
  return v;
end $$;
create function public.mm_delete_my_sound() returns text
  language sql security definer set search_path = public as $$ delete from mm_sounds where owner_id = auth.uid() returning url $$;

create function public.mm_report(p_lobby uuid, p_player uuid, p_reason text, p_note text default null) returns void
  language plpgsql security definer set search_path = public as $$
declare v_user uuid := (select user_id from players where id = p_player);
begin
  if not exists (select 1 from mm_lobbies l join mm_lobby_players a on a.lobby_id = l.id and a.user_id = auth.uid()
                  join mm_lobby_players b on b.lobby_id = l.id and b.user_id = v_user
                 where l.id = p_lobby and a.user_id <> b.user_id and (l.ended_at is null or l.ended_at > now() - interval '24 hours')) then
    raise exception 'Solo se reporta a alguien de tu sala, hasta 24 h después';
  end if;
  insert into mm_reports (lobby_id, reporter_id, reported_id, reason, note) values (p_lobby, auth.uid(), v_user, p_reason, nullif(trim(p_note), ''));
exception when unique_violation then
  raise exception 'Ya reportaste a ese jugador en esta sala';
end $$;

create function public.mm_admin_resolve_report(p_report uuid, p_action text, p_days int default null) returns void
  language plpgsql security definer set search_path = public as $$
declare
  r mm_reports%rowtype;
  v_player players%rowtype;
begin
  if not is_moderator() then raise exception 'Solo moderadores y admins' using errcode = '42501'; end if;
  select * into r from mm_reports where id = p_report and status = 'pending' for update;
  if r.id is null then raise exception 'Ese reporte ya se resolvió'; end if;
  select * into v_player from players where user_id = r.reported_id;
  if p_action = 'mm_ban' then
    if coalesce(p_days, 0) <= 0 then raise exception 'Indicá por cuántos días'; end if;
    insert into mm_bans (user_id, until, reason, report_id, created_by) values (r.reported_id, now() + make_interval(days => p_days), 'Reporte: ' || r.reason, r.id, auth.uid());
  elsif p_action = 'server_ban' then
    perform ban_create(v_player.id, v_player.steam_id, 'Reporte de matchmaking: ' || r.reason, case when p_days is null then null else now() + make_interval(days => p_days) end);
  elsif p_action not in ('dismiss', 'warn') then
    raise exception 'Acción desconocida';
  end if;
  update mm_reports set resolved_by = auth.uid(), resolved_at = now(),
    status = case p_action when 'dismiss' then 'dismissed' when 'warn' then 'warned' else 'banned' end where id = r.id;
end $$;

-- ---------- Administración ----------

create function public.mm_admin_guard() returns void
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo admins' using errcode = '42501'; end if;
end $$;

create function public.mm_admin_config() returns jsonb
  language plpgsql stable security definer set search_path = public as $$
begin
  perform mm_admin_guard();
  return (select to_jsonb(c) - 'id' from mm_config c) || jsonb_build_object('modes', (
    select coalesce(jsonb_agg(jsonb_build_object('mode', s.mode, 'players_per_team', g.players_per_team, 'enabled', s.enabled, 'affects_elo', s.affects_elo) order by s.position), '[]')
      from mm_mode_settings s join game_modes g on g.code = s.mode));
end $$;

create function public.mm_set_config(p jsonb) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare m jsonb;
begin
  perform mm_admin_guard();
  update mm_config set
    open = coalesce((p->>'open')::boolean, open),
    max_party_size = coalesce((p->>'max_party_size')::int, max_party_size),
    party_max_elo_gap = coalesce((p->>'party_max_elo_gap')::int, party_max_elo_gap),
    accept_seconds = coalesce((p->>'accept_seconds')::int, accept_seconds),
    veto_seconds = coalesce((p->>'veto_seconds')::int, veto_seconds),
    connect_minutes = coalesce((p->>'connect_minutes')::int, connect_minutes),
    server_wait_minutes = coalesce((p->>'server_wait_minutes')::int, server_wait_minutes),
    elo_window_start = coalesce((p->>'elo_window_start')::int, elo_window_start),
    elo_window_step = coalesce((p->>'elo_window_step')::int, elo_window_step),
    elo_window_every_s = coalesce((p->>'elo_window_every_s')::int, elo_window_every_s),
    elo_window_max = coalesce((p->>'elo_window_max')::int, elo_window_max),
    elo_unlimited_after_s = coalesce((p->>'elo_unlimited_after_s')::int, elo_unlimited_after_s),
    penalty_ladder = coalesce(array(select jsonb_array_elements_text(p->'penalty_ladder'))::int[], penalty_ladder),
    reconnect_minutes = coalesce((p->>'reconnect_minutes')::int, reconnect_minutes),
    require_anticheat = coalesce((p->>'require_anticheat')::boolean, require_anticheat),
    max_blocks = coalesce((p->>'max_blocks')::int, max_blocks),
    blocks_vip_only = coalesce((p->>'blocks_vip_only')::boolean, blocks_vip_only),
    min_mixes = coalesce((p->>'min_mixes')::int, min_mixes),
    min_account_days = coalesce((p->>'min_account_days')::int, min_account_days),
    season_queue_close_minutes = coalesce((p->>'season_queue_close_minutes')::int, season_queue_close_minutes);
  for m in select * from jsonb_array_elements(coalesce(p->'modes', '[]')) loop
    update mm_mode_settings set enabled = (m->>'enabled')::boolean, affects_elo = (m->>'affects_elo')::boolean where mode = m->>'mode';
  end loop;
  if not exists (select 1 from mm_mode_settings where enabled) then raise exception 'Tiene que quedar al menos un modo habilitado'; end if;
  -- Los que estaban en la cola de un modo apagado salen.
  perform mm_queue_remove(q.user_id, 'closed') from mm_queue q join mm_mode_settings s on s.mode = q.mode where not s.enabled;
  perform mm_emit('mm.config', null, null);
  return mm_admin_config();
end $$;

create function public.mm_set_mode_maps(p_mode text, p_maps text[]) returns void
  language plpgsql security definer set search_path = public as $$
begin
  perform mm_admin_guard();
  if cardinality(p_maps) < 2 then raise exception 'Hacen falta al menos 2 mapas'; end if;
  if exists (select 1 from unnest(p_maps) n where not exists (select 1 from map_pool m where m.name = n and m.active)) then
    raise exception 'Hay un mapa que no está disponible en el catálogo';
  end if;
  delete from mm_mode_maps where mode = p_mode;
  insert into mm_mode_maps (mode, map, position) select p_mode, n, o from unnest(p_maps) with ordinality t(n, o);
end $$;

create function public.mm_admin_cancel(p_lobby uuid, p_reason text default 'Cancelada por un admin') returns void
  language plpgsql security definer set search_path = public as $$
begin
  perform mm_admin_guard();
  perform mm_cancel_lobby(p_lobby, p_reason);
end $$;

create function public.mm_admin_unban(p_user uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  perform mm_admin_guard();
  update mm_bans set until = now() where user_id = p_user and until > now();
end $$;

create function public.mm_admin_rotate_password(p_server uuid) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v mm_server_passwords%rowtype;
begin
  perform mm_admin_guard();
  if exists (select 1 from mm_lobbies where server_id = p_server and status not in ('finished', 'cancelled')) then
    raise exception 'Solo se rota con el servidor libre';
  end if;
  insert into mm_server_passwords (server_id, password, kind, set_by) values (p_server, mm_new_password(8), 'idle', auth.uid()::text) returning * into v;
  return to_jsonb(v);
end $$;

create function public.mm_admin_sound_add(p_name text, p_url text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v mm_sounds%rowtype;
begin
  perform mm_admin_guard();
  insert into mm_sounds (name, url) values (p_name, p_url) returning * into v;
  return jsonb_build_object('id', v.id, 'name', v.name, 'url', v.url);
end $$;
create function public.mm_admin_sound_delete(p_id uuid) returns text
  language plpgsql security definer set search_path = public as $$
declare v text;
begin
  perform mm_admin_guard();
  delete from mm_sounds where id = p_id and owner_id is null returning url into v;
  return v;
end $$;
create function public.mm_admin_sounds() returns jsonb
  language plpgsql stable security definer set search_path = public as $$
begin
  perform mm_admin_guard();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'url', url) order by created_at), '[]') from mm_sounds where owner_id is null);
end $$;

-- ---------- Lectura ----------

/** Partidas anteriores de quien mira con ese jugador: en su equipo o en contra. */
create function public.mm_meetings(p_viewer uuid, p_player uuid, p_same boolean) returns jsonb
  language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('match_id', x.match_id, 'map', x.map, 'played_at', x.played_at, 'won', x.won, 'score', x.score) order by x.played_at desc), '[]')
    from (select a.match_id, a.map, a.played_at, a.won, a.score1 || ' : ' || a.score2 as score
            from player_matches a join player_matches b on b.match_id = a.match_id and b.player_id = p_player
           where a.player_id = (select id from players where user_id = p_viewer) and a.player_id <> p_player
             and (a.side = b.side) = p_same and a.played_at is not null
           order by a.played_at desc limit 10) x $$;

create function public.mm_player_card(p_player uuid, p_viewer uuid, p_lp mm_lobby_players default null) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'player_id', p.id, 'nick', p.nick, 'photo_url', p.photo_url,
    'elo', mm_player_elo(p.id), 'level', elo_level(mm_player_elo(p.id)),
    'vip', coalesce(is_vip(p.user_id), false), 'is_me', p.user_id = p_viewer, 'country', null,
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

create function public.mm_team_win_pct(p_lobby uuid, p_team int, p_map text) returns integer
  language sql stable security definer set search_path = public as $$
  select round(100.0 * sum(s.wins) / nullif(sum(s.wins + s.losses), 0))::int
    from mm_lobby_players lp join player_map_stats s on s.player_id = lp.player_id and s.map_name = p_map
   where lp.lobby_id = p_lobby and lp.team = p_team $$;

create function public.mm_lobby_json(p_lobby uuid, p_viewer uuid) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  l mm_lobbies%rowtype;
  m matches%rowtype;
  srv game_servers%rowtype;
begin
  select * into l from mm_lobbies where id = p_lobby;
  if l.id is null then return null; end if;
  select * into m from matches where id = l.match_id;
  select * into srv from game_servers where id = l.server_id;
  return jsonb_build_object(
    'id', l.id, 'mode', l.mode, 'status', l.status, 'map', l.map, 'accept_deadline', l.accept_deadline,
    'connect_deadline', l.connect_deadline, 'match_id', l.match_id, 'end_reason', l.end_reason, 'region', srv.region,
    'players', (select jsonb_agg(mm_player_card(lp.player_id, p_viewer, lp) order by lp.team, lp.elo desc) from mm_lobby_players lp where lp.lobby_id = l.id),
    'server', case when l.status in ('assigned', 'connecting', 'live') then jsonb_build_object(
        'name', srv.name, 'address', srv.connect_address, 'password', l.password,
        'tv', case when srv.tv_port is not null then jsonb_build_object('host', split_part(srv.connect_address, ':', 1), 'port', srv.tv_port) end) end,
    'veto', case when l.match_id is not null then jsonb_build_object(
        'turn', l.veto_turn, 'deadline', l.veto_deadline,
        'bans', (select coalesce(jsonb_agg(jsonb_build_object('seq', v.seq, 'team', v.side, 'map', v.map, 'auto', v.by_user is null) order by v.seq), '[]') from match_vetos v where v.match_id = l.match_id),
        'pool', (select jsonb_agg(jsonb_build_object('name', mm.map, 'label', initcap(regexp_replace(mm.map, '^[a-z]+_', '')), 'image_url', mp.image_url,
                    'team1_win_pct', mm_team_win_pct(l.id, 1, mm.map), 'team2_win_pct', mm_team_win_pct(l.id, 2, mm.map)) order by mm.position)
                   from mm_mode_maps mm join map_pool mp on mp.name = mm.map where mm.mode = l.mode)) end,
    'match', case when l.status = 'finished' or (l.status = 'live' and m.id is not null) then jsonb_build_object(
        'score1', coalesce(m.score1, 0), 'score2', coalesce(m.score2, 0), 'rounds', coalesce(m.score1, 0) + coalesce(m.score2, 0), 'halves', null,
        'winner', l.winner_team, 'played_at', coalesce(m.played_at, l.created_at), 'demo_url', null, 'stats', '[]'::jsonb, 'clips', '[]'::jsonb) end,
    'reported', (select coalesce(jsonb_agg(p.id), '[]') from mm_reports r join players p on p.user_id = r.reported_id where r.lobby_id = l.id and r.reporter_id = p_viewer),
    'commended', (select player_id from mm_commends where lobby_id = l.id and user_id = p_viewer),
    'elo_stake', null);
end $$;

create function public.mm_my_state() returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  c mm_config%rowtype;
  v_player players%rowtype;
  q mm_queue%rowtype;
  v_party uuid;
  v_lobby uuid;
  v_ban record;
  v_sound mm_sounds%rowtype;
  v_custom mm_sounds%rowtype;
  v_vip boolean;
  v_season_end timestamptz;
begin
  if me is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  select * into c from mm_config;
  select * into v_player from players where user_id = me;
  select * into q from mm_queue where user_id = me;
  select party_id into v_party from mm_party_members where user_id = me;
  -- Sala abierta, o la que terminó en la última hora: el resumen sigue a la vista.
  v_lobby := coalesce(mm_active_lobby(me), (select l.id from mm_lobby_players lp join mm_lobbies l on l.id = lp.lobby_id
     where lp.user_id = me and l.status = 'finished' and l.ended_at > now() - interval '1 hour' order by l.ended_at desc limit 1));
  select until, reason into v_ban from mm_bans where user_id = me and until > now() order by until desc limit 1;
  v_vip := is_vip(me);
  select s.* into v_sound from mm_sound_choice ch join mm_sounds s on s.id = ch.sound_id where ch.user_id = me and (s.owner_id is null or v_vip);
  select * into v_custom from mm_sounds where owner_id = me;
  select ends_at into v_season_end from seasons where status = 'active' and ends_at < now() + interval '1 hour' limit 1;
  return jsonb_build_object(
    'open', c.open,
    'me', coalesce(mm_player_card(v_player.id, me), jsonb_build_object('nick', '', 'elo', 0, 'level', 1))
          || jsonb_build_object('recent', coalesce((select jsonb_agg(case when x.won then 'W' else 'L' end) from (
               select won from player_matches where player_id = v_player.id and won is not null order by played_at desc limit 5) x), '[]')),
    'modes', (select coalesce(jsonb_agg(jsonb_build_object('mode', s.mode, 'players_per_team', g.players_per_team, 'enabled', true, 'affects_elo', s.affects_elo) order by s.position), '[]')
                from mm_mode_settings s join game_modes g on g.code = s.mode where s.enabled),
    'regions', (select coalesce(jsonb_agg(distinct region), '[]') from game_servers where mm_enabled and region is not null),
    'max_party_size', c.max_party_size,
    'invites_pref', coalesce((select preferences->>'mm_invites' from user_preferences where user_id = me), 'public'),
    'queue_size', (select count(*) from mm_queue),
    'active_players', (select count(distinct x.user_id) from (select user_id from mm_queue union all select lp.user_id from mm_lobby_players lp join mm_lobbies l on l.id = lp.lobby_id where l.status not in ('finished', 'cancelled')) x),
    'live_matches', (select count(*) from mm_lobbies where status = 'live'),
    'queue', case when q.user_id is not null then jsonb_build_object('mode', q.mode, 'region', q.region, 'joined_at', q.joined_at,
        'position', (select count(*) + 1 from mm_queue o where o.mode = q.mode and o.joined_at < q.joined_at),
        'elo_window', mm_elo_window(extract(epoch from now() - q.joined_at)),
        'eta_s', (select round(extract(epoch from avg(left_at - joined_at))) from mm_queue_log where mode = q.mode and outcome = 'matched' and left_at > now() - interval '7 days')) end,
    'lobby', mm_lobby_json(v_lobby, me),
    'party', case when v_party is not null then jsonb_build_object('id', v_party, 'max_size', c.max_party_size,
        'members', (select jsonb_agg(jsonb_build_object('player_id', p.id, 'nick', p.nick, 'level', elo_level(mm_player_elo(p.id)), 'elo', mm_player_elo(p.id),
                       'is_me', pm.user_id = me, 'is_leader', pm.user_id = pa.leader_id) order by pm.joined_at)
                      from mm_party_members pm join players p on p.user_id = pm.user_id join mm_parties pa on pa.id = pm.party_id where pm.party_id = v_party),
        'pending', (select jsonb_build_object('to_nick', p.nick, 'expires_at', i.expires_at) from mm_party_invites i join players p on p.user_id = i.to_user
                     where i.party_id = v_party and i.status = 'pending' and i.expires_at > now() limit 1)) end,
    'invites', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'expires_at', i.expires_at,
          'from', jsonb_build_object('player_id', p.id, 'nick', p.nick, 'level', elo_level(mm_player_elo(p.id)), 'elo', mm_player_elo(p.id)))), '[]')
        from mm_party_invites i join players p on p.user_id = i.from_user where i.to_user = me and i.status = 'pending' and i.expires_at > now()),
    'penalty', (select jsonb_build_object('until', until, 'level', level) from mm_penalties where user_id = me and until > now()),
    'blocks', jsonb_build_object('max', c.max_blocks, 'vip_only', c.blocks_vip_only, 'allowed', not c.blocks_vip_only or v_vip,
        'list', (select coalesce(jsonb_agg(jsonb_build_object('player_id', p.id, 'nick', p.nick)), '[]') from mm_blocks b join players p on p.id = b.player_id where b.user_id = me)),
    'sounds', jsonb_build_object(
        'catalog', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'url', url) order by created_at), '[]') from mm_sounds where owner_id is null),
        'selected', v_sound.id, 'url', v_sound.url, 'can_upload', v_vip,
        'custom', case when v_vip and v_custom.id is not null then jsonb_build_object('id', v_custom.id, 'name', v_custom.name, 'url', v_custom.url) end),
    'queue_activity', jsonb_build_object(
        'modes', (select coalesce(jsonb_agg(jsonb_build_object('mode', s.mode, 'searching', n.c, 'missing', g.players_per_team * 2 - n.c % (g.players_per_team * 2)) order by s.position), '[]')
                    from mm_mode_settings s join game_modes g on g.code = s.mode cross join lateral (select count(*)::int c from mm_queue q2 where q2.mode = s.mode) n where s.enabled),
        'levels', jsonb_build_array(
          jsonb_build_object('label', 'Nivel 1 a 3', 'count', (select count(*) from mm_queue where elo_level(elo) between 1 and 3)),
          jsonb_build_object('label', 'Nivel 4 a 7', 'count', (select count(*) from mm_queue where elo_level(elo) between 4 and 7)),
          jsonb_build_object('label', 'Nivel 8 a 10', 'count', (select count(*) from mm_queue where elo_level(elo) >= 8)))),
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
    'anticheat', jsonb_build_object('required', c.require_anticheat, 'status', case
        when exists (select 1 from ac_devices d where d.user_id = me and d.revoked_at is null and d.last_seen_at > now() - interval '90 seconds') then 'ok'
        when exists (select 1 from ac_devices d where d.user_id = me and d.revoked_at is null) then 'stale' else 'no_agent' end),
    'ban', case when v_ban.until is not null then jsonb_build_object('until', v_ban.until, 'reason', v_ban.reason) end,
    'newcomer', null,
    'servers', jsonb_build_object(
        'total', (select count(*) from game_servers where mm_enabled and active),
        'free', (select count(*) from game_servers s join mm_server_state st on st.server_id = s.id where s.mm_enabled and s.active and st.last_poll_at > now() - interval '30 seconds'
                   and not exists (select 1 from mm_lobbies l where l.server_id = s.id and l.status not in ('finished', 'cancelled')))),
    'season', case when v_season_end is not null then jsonb_build_object('ends_at', v_season_end,
        'queue_closes_at', v_season_end - make_interval(mins => c.season_queue_close_minutes)) end,
    'block_reason', mm_block_reason(me));
end $$;

create function public.mm_admin_lists(p_what text, p_arg text default null) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
begin
  if p_what in ('reports', 'bans') then
    if not is_moderator() then raise exception 'Solo moderadores y admins' using errcode = '42501'; end if;
  else
    perform mm_admin_guard();
  end if;
  return case p_what
    when 'lobbies' then (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'mode', l.mode, 'status', l.status, 'map', l.map, 'created_at', l.created_at,
        'server', (select name from game_servers where id = l.server_id), 'players', (select count(*) from mm_lobby_players where lobby_id = l.id)) order by l.created_at desc), '[]')
        from mm_lobbies l where l.status not in ('finished', 'cancelled'))
    when 'reports' then (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'lobby_id', r.lobby_id, 'reason', r.reason, 'note', r.note, 'status', r.status, 'created_at', r.created_at,
        'mode', (select mode from mm_lobbies where id = r.lobby_id),
        'reporter', (select nick from players where user_id = r.reporter_id), 'reported', (select nick from players where user_id = r.reported_id), 'reported_user_id', r.reported_id) order by r.created_at desc), '[]')
        from mm_reports r)
    when 'bans' then (select coalesce(jsonb_agg(jsonb_build_object('user_id', b.user_id, 'until', b.until, 'reason', b.reason, 'nick', (select nick from players where user_id = b.user_id)) order by b.until desc), '[]')
        from mm_bans b where b.until > now())
    when 'servers' then (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'address', s.connect_address, 'region', s.region, 'mm_enabled', s.mm_enabled,
        'state', case when st.last_poll_at is null or st.last_poll_at < now() - interval '30 seconds' then 'offline'
                      when exists (select 1 from mm_lobbies l where l.server_id = s.id and l.status = 'live') then 'live'
                      when exists (select 1 from mm_lobbies l where l.server_id = s.id and l.status not in ('finished', 'cancelled')) then 'lobby' else 'free' end,
        'password', (select to_jsonb(p) from mm_server_passwords p where p.server_id = s.id and p.applied_at is not null order by p.applied_at desc limit 1)) order by s.name), '[]')
        from game_servers s left join mm_server_state st on st.server_id = s.id)
    when 'passwords' then (select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc), '[]') from mm_server_passwords p where p.server_id = p_arg::uuid)
    when 'maps' then (select coalesce(jsonb_agg(jsonb_build_object('name', mp.name, 'label', initcap(regexp_replace(mp.name, '^[a-z]+_', '')), 'image_url', mp.image_url, 'in_mm', mm.map is not null) order by mm.position nulls last, mp.position), '[]')
        from map_pool mp left join mm_mode_maps mm on mm.map = mp.name and mm.mode = p_arg where mp.active)
    when 'stats' then (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'mode', d.mode, 'lobbies', d.lobbies, 'played', d.played, 'abandons', d.abandons,
        'cancelled', (select coalesce(jsonb_object_agg(x.r, x.n), '{}') from (select end_reason r, count(*) n from mm_lobbies c where c.status = 'cancelled' and c.mode = d.mode and c.created_at::date = d.day group by 1) x),
        'avg_wait_s', coalesce((select round(extract(epoch from avg(q.left_at - q.joined_at))) from mm_queue_log q where q.outcome = 'matched' and q.mode = d.mode and q.left_at::date = d.day), 0),
        'p90_wait_s', coalesce((select round(percentile_cont(0.9) within group (order by extract(epoch from q.left_at - q.joined_at))) from mm_queue_log q where q.outcome = 'matched' and q.mode = d.mode and q.left_at::date = d.day), 0),
        'avg_elo_diff', coalesce((select round(avg(x.diff)) from (select abs(avg(lp.elo) filter (where lp.team = 1) - avg(lp.elo) filter (where lp.team = 2)) diff
             from mm_lobby_players lp join mm_lobbies c on c.id = lp.lobby_id where c.mode = d.mode and c.created_at::date = d.day group by lp.lobby_id) x), 0)) order by d.day desc), '[]')
        from (select l.created_at::date as day, l.mode, count(*) lobbies, count(*) filter (where l.status = 'finished') played,
                     (select count(*) from mm_lobby_players lp join mm_lobbies x on x.id = lp.lobby_id where lp.abandoned and x.mode = l.mode and x.created_at::date = l.created_at::date) abandons
                from mm_lobbies l where l.created_at > now() - make_interval(days => coalesce(p_arg::int, 7)) group by 1, 2) d)
  end;
end $$;

create function public.mm_set_server_enabled(p_server uuid, p_enabled boolean) returns void
  language plpgsql security definer set search_path = public as $$
begin
  perform mm_admin_guard();
  update game_servers set mm_enabled = p_enabled where id = p_server;
end $$;

-- ---------- Eventos ----------

create function public.mm_trg_notify() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
begin
  if tg_table_name = 'mm_queue' then
    perform mm_emit('queue.changed', null, null);
  elsif tg_table_name = 'mm_lobby_players' then
    if tg_op = 'UPDATE' and new.accepted_at is distinct from old.accepted_at then
      perform mm_emit('lobby.accept', new.lobby_id, mm_lobby_users(new.lobby_id));
    end if;
  elsif tg_table_name = 'mm_party_invites' then
    perform mm_emit(case when tg_op = 'INSERT' then 'party.invite' else 'party.changed' end, null,
      array[coalesce(v_new, v_old)->>'to_user', coalesce(v_new, v_old)->>'from_user']::uuid[]);
  elsif tg_table_name = 'mm_party_members' then
    perform mm_emit('party.changed', null, array(
      select pm.user_id from mm_party_members pm where pm.party_id = coalesce((v_new->>'party_id'), (v_old->>'party_id'))::uuid
      union select coalesce((v_old->>'user_id'), (v_new->>'user_id'))::uuid));
  end if;
  return null;
end $$;
create trigger mm_notify_queue after insert or delete on public.mm_queue for each row execute function mm_trg_notify();
create trigger mm_notify_lobby_players after update on public.mm_lobby_players for each row execute function mm_trg_notify();
create trigger mm_notify_invites after insert or update on public.mm_party_invites for each row execute function mm_trg_notify();
create trigger mm_notify_party after insert or delete on public.mm_party_members for each row execute function mm_trg_notify();

create function public.mm_trg_chat() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_lobby uuid := (select id from mm_lobbies where match_id = new.match_id);
begin
  if v_lobby is not null then
    perform mm_emit('lobby.chat', v_lobby, array(select user_id from mm_lobby_players where lobby_id = v_lobby and (new.side is null or team = new.side)));
  end if;
  return null;
end $$;
create trigger mm_notify_chat after insert on public.match_chat for each row execute function mm_trg_chat();

-- Permisos: a menos que se indique, las funciones son internas (service_role).
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and (p.proname like 'mm\_%' or p.proname like 'csstv\_mm\_%') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
grant execute on function public.mm_join(text, text), public.mm_leave(), public.mm_accept(), public.mm_decline(),
  public.mm_party_invite(uuid), public.mm_party_respond(uuid, boolean), public.mm_party_leave(), public.mm_party_kick(uuid),
  public.mm_party_promote(uuid), public.mm_block(uuid), public.mm_unblock(uuid), public.mm_add_friend(uuid), public.mm_remove_friend(uuid),
  public.mm_commend(uuid, uuid), public.mm_set_sound(uuid), public.mm_set_my_sound(text, text), public.mm_delete_my_sound(),
  public.mm_report(uuid, uuid, text, text), public.mm_admin_resolve_report(uuid, text, integer), public.mm_admin_config(),
  public.mm_set_config(jsonb), public.mm_set_mode_maps(text, text[]), public.mm_admin_cancel(uuid, text), public.mm_admin_unban(uuid),
  public.mm_admin_rotate_password(uuid), public.mm_admin_sound_add(text, text), public.mm_admin_sound_delete(uuid), public.mm_admin_sounds(),
  public.mm_my_state(), public.mm_admin_lists(text, text), public.mm_set_server_enabled(uuid, boolean), public.mm_my_team(uuid)
  to authenticated;
-- El chat las usa con la sesión de quien lee.
grant execute on function public.mm_chat_can_read(uuid, smallint) to anon, authenticated;
-- El plugin autentica con su token (como csstv_match_lookup).
grant execute on function public.csstv_mm_poll(text, text), public.csstv_mm_report(text, uuid, text, text),
  public.csstv_mm_password(text, text, text, text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
