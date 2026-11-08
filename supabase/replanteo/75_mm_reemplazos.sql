-- Replanteo 75: reemplazos en el matchmaking (plan docs/bitacora/2026-11-04-mm-reemplazos, pedido por Daniel el 2026-11-04,
-- aprobado el 2026-11-05).
--   1. mm_config: replace_enabled (apagado por defecto), minutos del link, rondas mínimas que tienen que quedar y el voto de
--      !callreplace (porcentaje, segundos y espera). mm_set_config los acepta.
--   2. mm_lobby_players: replaces_user_id (a quién reemplaza) y replaced_by (en el que abandonó, cuando el reemplazo entró
--      al servidor). Un abandono con replaced_by está cubierto: no cuenta para la derrota automática ni para el ajuste de ELO
--      del equipo (mm_tick, mm_elo_delta y el poll del servidor).
--   3. mm_replacements: cada pedido de reemplazo, con el token del link (en claro solo hasta que se publica; queda el hash).
--   4. mm_tick abre el reemplazo al confirmarse un abandono, vence los links y vuelve a abrir el que no se conectó.
--   5. csstv_mm_report: evento callreplace (voto aprobado en el servidor: abandono en el acto) y "connected"/"back" marcan la
--      llegada del reemplazo. csstv_mm_poll: el plantel sin los reemplazados, los abandonos sin cubrir, si se puede pedir un
--      reemplazo en cada equipo (replace=), el voto (replace_vote=porcentaje,segundos,espera) y los desconectados (away=)
--      para el menú de !callreplace.
--   6. Para la web: mm_replace_info y mm_replace_take (uno solo gana). Para el worker: mm_replace_pending y mm_replace_mark.
--   7. manual_valores: los minutos del link, el porcentaje del voto y las rondas mínimas, para el manual.
--   El ELO del reemplazo es el normal (Daniel, 2026-11-05). El que abandonó queda abandonado, con su sanción y su ELO.
begin;

do $$
begin
  if to_regprocedure('public.mm_balance_elos(uuid[], integer[])') is null then
    raise exception 'replanteo 75: falta el replanteo 73 (aplicar antes 73_mm_equipos_con_rating.sql)';
  end if;
  if to_regclass('public.mm_replacements') is not null then
    raise exception 'replanteo 75: mm_replacements ya existe (¿ya se aplicó?)';
  end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    -- Sin \r: con el archivo en CRLF (autocrlf), los textos de varias líneas no coincidirían con la función.
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'replanteo 75: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

-- ---------- 1. Configuración ----------

alter table public.mm_config
  add column replace_enabled boolean not null default false,
  add column replace_link_minutes integer not null default 10 check (replace_link_minutes between 1 and 60),
  add column replace_min_rounds_left integer not null default 4 check (replace_min_rounds_left between 0 and 30),
  add column replace_vote_pct integer not null default 80 check (replace_vote_pct between 50 and 100),
  add column replace_vote_seconds integer not null default 30 check (replace_vote_seconds between 10 and 120),
  add column replace_vote_cooldown_s integer not null default 60 check (replace_vote_cooldown_s between 0 and 600);
comment on column public.mm_config.replace_enabled is 'Llamar reemplazos (Discord) cuando alguien abandona una sala en vivo, y !callreplace. Replanteo 75';
comment on column public.mm_config.replace_link_minutes is 'Minutos que sirve el link de un reemplazo. Replanteo 75';
comment on column public.mm_config.replace_min_rounds_left is 'No se llama un reemplazo si quedan menos rondas que esto para el fin del tiempo reglamentario. Replanteo 75';
comment on column public.mm_config.replace_vote_pct is '!callreplace pasa con más de este porcentaje de los compañeros conectados (el que no vota cuenta como No). Replanteo 75';
comment on column public.mm_config.replace_vote_seconds is 'Duración del voto de !callreplace. Replanteo 75';
comment on column public.mm_config.replace_vote_cooldown_s is 'Espera de un equipo entre dos votos de !callreplace. Replanteo 75';

alter table public.mm_lobby_players
  add column replaces_user_id uuid references auth.users (id) on delete set null,
  add column replaced_by uuid references auth.users (id) on delete set null;
comment on column public.mm_lobby_players.replaces_user_id is 'Entró como reemplazo de este jugador. Replanteo 75';
comment on column public.mm_lobby_players.replaced_by is 'Abandonó y su reemplazo entró al servidor: el abandono está cubierto. Replanteo 75';

-- ---------- 2. Pedidos de reemplazo ----------

create table public.mm_replacements (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.mm_lobbies (id) on delete cascade,
  team smallint not null check (team in (1, 2)),
  replaced_user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('auto', 'vote')),
  status text not null default 'open' check (status in ('open', 'taken', 'connected', 'expired', 'cancelled')),
  token text,                     -- en claro solo hasta que el worker lo publica
  token_hash text not null unique,
  expires_at timestamptz not null,
  taken_by uuid references auth.users (id) on delete set null,
  taken_at timestamptz,
  connect_deadline timestamptz,
  connected_at timestamptz,
  discord_message_id text,
  posted_status text check (posted_status in ('open', 'found', 'closed')),
  post_attempts integer not null default 0,
  created_at timestamptz not null default now()
);
comment on table public.mm_replacements is 'Pedidos de reemplazo de una sala del matchmaking en vivo y su aviso en Discord. Sin acceso directo. Replanteo 75';
-- Uno abierto (o tomado y sin conectar) por equipo a la vez.
create unique index mm_replacements_team_active on public.mm_replacements (lobby_id, team) where status in ('open', 'taken');
alter table public.mm_replacements enable row level security;
revoke all on table public.mm_replacements from public, anon, authenticated;

create function public.mm_replace_hash(p_token text) returns text language sql immutable as $$
  select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
$$;

/** Lo que muestra el mensaje de Discord para cada estado. */
create function public.mm_replace_shown(p_status text) returns text language sql immutable as $$
  select case p_status when 'open' then 'open' when 'taken' then 'found' when 'connected' then 'found' else 'closed' end
$$;

/** Rondas que faltan como mínimo para el fin del tiempo reglamentario, según el mix en vivo del servidor (null: no se sabe). */
create function public.mm_replace_rounds_left(p_server uuid) returns integer
  language sql stable security definer set search_path = public as $$
  select greatest(0, least(m.max_rounds - (m.score_a + m.score_b), m.max_rounds / 2 + 1 - greatest(m.score_a, m.score_b)))
    from live_matches m
   where m.server_id = p_server and m.max_rounds > 0 and m.updated_at > now() - interval '10 minutes'
   order by m.updated_at desc limit 1
$$;

/** ¿Se puede pedir un reemplazo para el equipo? Encendido, sala en vivo, quedan rondas y ninguno abierto en ese equipo. */
create function public.mm_replace_can_open(p_lobby uuid, p_team smallint) returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(c.replace_enabled and l.status = 'live'
           and coalesce(mm_replace_rounds_left(l.server_id) >= c.replace_min_rounds_left, true)
           and not exists (select 1 from mm_replacements x where x.lobby_id = l.id and x.team = p_team and x.status in ('open', 'taken')), false)
    from mm_lobbies l, mm_config c where l.id = p_lobby
$$;

/** El jugador abandonó y ya hay un reemplazo que tomó su lugar: no está en el plantel del servidor. */
create function public.mm_replace_out(p_lobby uuid, p_user uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from mm_replacements x where x.lobby_id = p_lobby and x.replaced_user_id = p_user and x.status in ('taken', 'connected'))
$$;

create function public.mm_replace_open(p_lobby uuid, p_team smallint, p_user uuid, p_source text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '');
  v_id uuid;
begin
  insert into mm_replacements (lobby_id, team, replaced_user_id, source, token, token_hash, expires_at)
    values (p_lobby, p_team, p_user, p_source, v_token, mm_replace_hash(v_token),
            now() + make_interval(mins => (select replace_link_minutes from mm_config)))
    returning id into v_id;
  perform mm_emit('lobby.player', p_lobby, mm_lobby_users(p_lobby));
  return v_id;
end $$;

/** En cada vuelta de mm_tick, para una sala en vivo: vence links, saca al que tomó y no entró, y abre los que faltan. */
create function public.mm_replace_sweep(p_lobby uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  x mm_replacements%rowtype;
  r record;
begin
  update mm_replacements set status = 'expired', token = null where lobby_id = p_lobby and status = 'open' and expires_at <= now();
  -- Tomó el link y no entró a tiempo: sale de la sala, se sanciona y se vuelve a llamar (en esta misma vuelta).
  for x in select * from mm_replacements where lobby_id = p_lobby and status = 'taken' and connect_deadline <= now() loop
    update mm_replacements set status = 'cancelled', token = null where id = x.id;
    delete from mm_lobby_players where lobby_id = p_lobby and user_id = x.taken_by and connected_at is null;
    if x.taken_by is not null then perform mm_penalize(x.taken_by, 'No te conectaste a la partida que tomaste como reemplazo'); end if;
    perform mm_emit('lobby.player', p_lobby, mm_lobby_users(p_lobby));
  end loop;
  -- Abandonos sin reemplazo. Uno que ya venció no se vuelve a llamar; uno cancelado (no se conectó) sí.
  for r in select lp.user_id, lp.team from mm_lobby_players lp
            where lp.lobby_id = p_lobby and lp.abandoned and lp.replaced_by is null
              and not exists (select 1 from mm_replacements y where y.lobby_id = p_lobby and y.replaced_user_id = lp.user_id
                                and y.status in ('open', 'taken', 'connected', 'expired'))
            order by lp.team, lp.user_id loop
    if mm_replace_can_open(p_lobby, r.team) then
      perform mm_replace_open(p_lobby, r.team, r.user_id, 'auto');
    end if;
  end loop;
end $$;

/** Salas que terminaron o se anularon: sus pedidos vencen y el que tomó un link sin entrar sale de la sala. */
create function public.mm_replace_close_finished() returns void
  language plpgsql security definer set search_path = public as $$
declare x mm_replacements%rowtype;
begin
  for x in select r.* from mm_replacements r join mm_lobbies l on l.id = r.lobby_id
            where r.status in ('open', 'taken') and l.status in ('finished', 'cancelled') for update of r loop
    update mm_replacements set status = 'expired', token = null where id = x.id;
    if x.status = 'taken' then
      delete from mm_lobby_players where lobby_id = x.lobby_id and user_id = x.taken_by and connected_at is null;
    end if;
  end loop;
end $$;

/** El reemplazo entró al servidor ("connected" o "back" del plugin): el abandono queda cubierto. */
create function public.mm_replace_arrived(p_lobby uuid, p_user uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare v_replaced uuid;
begin
  update mm_replacements set status = 'connected', connected_at = now()
   where lobby_id = p_lobby and taken_by = p_user and status = 'taken'
   returning replaced_user_id into v_replaced;
  if v_replaced is not null then
    update mm_lobby_players set replaced_by = p_user where lobby_id = p_lobby and user_id = v_replaced;
  end if;
end $$;

/** Por qué este usuario no puede tomar el reemplazo (null: puede). Lo mismo que para entrar a la cola, y no haber jugado esta. */
create function public.mm_replace_reason(p_user uuid, p_lobby uuid) returns text
  language plpgsql stable security definer set search_path = public as $$
declare
  p players%rowtype;
  razon text;
begin
  if exists (select 1 from mm_lobby_players lp where lp.lobby_id = p_lobby
              and (lp.user_id = p_user or lp.player_id = (select id from players where user_id = p_user))) then
    return 'Ya jugaste en esta partida';
  end if;
  razon := mm_block_reason(p_user);
  if razon is not null then return razon; end if;
  select * into p from players where user_id = p_user;
  if p.id is null or p.steam_id is null then return 'Para entrar como reemplazo tenés que vincular tu SteamID (Mi perfil › Vinculación)'; end if;
  if mm_active_lobby(p_user) is not null then return 'Ya estás en otra sala'; end if;
  return null;
end $$;

-- ---------- 3. mm_tick ----------

select pg_temp.reemplazar('public.mm_tick()', array[
  ['      -- 2 o más abandonos: ese equipo pierde (el plugin lo ve en el poll). En los dos equipos, la partida se anula.' || E'\n' ||
   '      select count(*) filter (where team = 1 and abandoned), count(*) filter (where team = 2 and abandoned) into v_ab1, v_ab2',
   '      -- (replanteo 75) Reemplazos: vencen los links, sale el que no entró y se llama por los abandonos nuevos.' || E'\n' ||
   '      perform mm_replace_sweep(l.id);' || E'\n' ||
   '      -- 2 o más abandonos: ese equipo pierde (el plugin lo ve en el poll). En los dos equipos, la partida se anula.' || E'\n' ||
   '      -- (replanteo 75) Un abandono cubierto por un reemplazo que ya entró no cuenta.' || E'\n' ||
   '      select count(*) filter (where team = 1 and abandoned and replaced_by is null), count(*) filter (where team = 2 and abandoned and replaced_by is null) into v_ab1, v_ab2'],
  ['  -- (replanteo 56) reservas de torneos y PCW: plazos, fila y servidores caídos.',
   '  -- (replanteo 75) Los pedidos de reemplazo de salas que terminaron vencen.' || E'\n' ||
   '  perform mm_replace_close_finished();' || E'\n' ||
   '  -- (replanteo 56) reservas de torneos y PCW: plazos, fila y servidores caídos.']
]);

-- ---------- 4. Lo que llega del servidor ----------

select pg_temp.reemplazar('public.csstv_mm_report(text,uuid,text,text)', array[
  ['  v_user uuid;',
   '  v_user uuid;' || E'\n' ||
   '  v_team smallint;'],
  ['  if p_event in (''connected'', ''left'', ''back'') then',
   '  if p_event in (''connected'', ''left'', ''back'', ''callreplace'') then'],
  ['      update mm_lobby_players set connected_at = coalesce(connected_at, now()) where lobby_id = l.id and user_id = v_user;',
   '      update mm_lobby_players set connected_at = coalesce(connected_at, now()) where lobby_id = l.id and user_id = v_user;' || E'\n' ||
   '      perform mm_replace_arrived(l.id, v_user);'],
  ['      update mm_lobby_players set left_at = null where lobby_id = l.id and user_id = v_user and not abandoned;',
   '      -- (replanteo 75) En vivo, un reemplazo que entra llega como "back": también cuenta como conectado.' || E'\n' ||
   '      update mm_lobby_players set left_at = null, connected_at = coalesce(connected_at, now()) where lobby_id = l.id and user_id = v_user and not abandoned;' || E'\n' ||
   '      perform mm_replace_arrived(l.id, v_user);'],
  ['    when ''abort'' then',
   '    when ''callreplace'' then' || E'\n' ||
   '      -- (replanteo 75) Pasó el voto de !callreplace: el desconectado abandona ya, sin esperar los minutos de reconexión.' || E'\n' ||
   '      select team into v_team from mm_lobby_players where lobby_id = l.id and user_id = v_user and left_at is not null and not abandoned;' || E'\n' ||
   '      if v_team is null or not mm_replace_can_open(l.id, v_team) then return false; end if;' || E'\n' ||
   '      update mm_lobby_players set abandoned = true, left_at = null where lobby_id = l.id and user_id = v_user;' || E'\n' ||
   '      perform mm_penalize(v_user, ''Abandonaste una partida (tu equipo pidió un reemplazo)'');' || E'\n' ||
   '      perform mm_replace_open(l.id, v_team, v_user, ''vote'');' || E'\n' ||
   '    when ''abort'' then']
]);

select pg_temp.reemplazar('public.csstv_mm_poll(text,text,text)', array[
  ['where lp.lobby_id = l.id and lp.team = 1), ''''),',
   'where lp.lobby_id = l.id and lp.team = 1 and not mm_replace_out(l.id, lp.user_id)), ''''),'],
  ['where lp.lobby_id = l.id and lp.team = 2), ''''),',
   'where lp.lobby_id = l.id and lp.team = 2 and not mm_replace_out(l.id, lp.user_id)), ''''),'],
  ['    ''n1='' || (select count(*) from mm_lobby_players where lobby_id = l.id and team = 1),' || E'\n' ||
   '    ''n2='' || (select count(*) from mm_lobby_players where lobby_id = l.id and team = 2),',
   '    ''n1='' || (select count(*) from mm_lobby_players lp where lobby_id = l.id and team = 1 and not mm_replace_out(l.id, lp.user_id)),' || E'\n' ||
   '    ''n2='' || (select count(*) from mm_lobby_players lp where lobby_id = l.id and team = 2 and not mm_replace_out(l.id, lp.user_id)),'],
  ['    ''abandons='' || (select count(*) filter (where team = 1 and abandoned) || '','' || count(*) filter (where team = 2 and abandoned) from mm_lobby_players where lobby_id = l.id),',
   '    -- (replanteo 75) Solo los abandonos sin cubrir; si se puede pedir un reemplazo en cada equipo; y los desconectados' || E'\n' ||
   '    -- (SteamID|equipo|nick;…) para el menú de !callreplace.' || E'\n' ||
   '    ''abandons='' || (select count(*) filter (where team = 1 and abandoned and replaced_by is null) || '','' || count(*) filter (where team = 2 and abandoned and replaced_by is null) from mm_lobby_players where lobby_id = l.id),' || E'\n' ||
   '    ''replace='' || case when mm_replace_can_open(l.id, 1::smallint) then 1 else 0 end || '','' || case when mm_replace_can_open(l.id, 2::smallint) then 1 else 0 end,' || E'\n' ||
   '    ''replace_vote='' || (select replace_vote_pct || '','' || replace_vote_seconds || '','' || replace_vote_cooldown_s from mm_config),' || E'\n' ||
   '    ''away='' || coalesce((select string_agg(csstv_steam2(p.steam_id) || ''|'' || lp.team || ''|'' || left(regexp_replace(p.nick, ''[|;=\r\n]'', '''', ''g''), 24), '';'')' || E'\n' ||
   '        from mm_lobby_players lp join players p on p.id = lp.player_id' || E'\n' ||
   '       where lp.lobby_id = l.id and lp.left_at is not null and not lp.abandoned and p.steam_id is not null), ''''),']
]);

-- ---------- 5. ELO y la ficha de la sala ----------

select pg_temp.reemplazar('public.mm_elo_delta(uuid,text,integer,double precision,double precision,integer)', array[
  ['    from mm_lobby_players where lobby_id = v_lobby and abandoned;',
   '    from mm_lobby_players where lobby_id = v_lobby and abandoned and replaced_by is null;   -- (replanteo 75) sin los cubiertos'],
  ['   where lp.lobby_id = v_lobby and lp.abandoned;',
   '   where lp.lobby_id = v_lobby and lp.abandoned and lp.replaced_by is null;']
]);

select pg_temp.reemplazar('public.mm_player_card(uuid,uuid,mm_lobby_players)', array[
  ['    ''abandoned'', coalesce((p_lp).abandoned, false),',
   '    ''abandoned'', coalesce((p_lp).abandoned, false),' || E'\n' ||
   '    ''replacement'', (p_lp).replaces_user_id is not null, ''replaced'', (p_lp).replaced_by is not null,']
]);

select pg_temp.reemplazar('public.mm_set_config(jsonb)', array[
  ['    balance_rating_days = coalesce((p->>''balance_rating_days'')::int, balance_rating_days)',
   '    balance_rating_days = coalesce((p->>''balance_rating_days'')::int, balance_rating_days),' || E'\n' ||
   '    replace_enabled = coalesce((p->>''replace_enabled'')::boolean, replace_enabled),' || E'\n' ||
   '    replace_link_minutes = coalesce((p->>''replace_link_minutes'')::int, replace_link_minutes),' || E'\n' ||
   '    replace_min_rounds_left = coalesce((p->>''replace_min_rounds_left'')::int, replace_min_rounds_left),' || E'\n' ||
   '    replace_vote_pct = coalesce((p->>''replace_vote_pct'')::int, replace_vote_pct),' || E'\n' ||
   '    replace_vote_seconds = coalesce((p->>''replace_vote_seconds'')::int, replace_vote_seconds),' || E'\n' ||
   '    replace_vote_cooldown_s = coalesce((p->>''replace_vote_cooldown_s'')::int, replace_vote_cooldown_s)']
]);

-- ---------- 5b. Los valores que muestra el manual ----------

select pg_temp.reemplazar('public.manual_valores()', array[
  ['    ''mm.volver'', m.reconnect_minutes,',
   '    ''mm.volver'', m.reconnect_minutes,' || E'
' ||
   '    ''mm.reemplazo_link'', m.replace_link_minutes, ''mm.reemplazo_voto'', m.replace_vote_pct, ''mm.reemplazo_rondas'', m.replace_min_rounds_left,']
]);

-- ---------- 6. La página del link (web) ----------

/** Lo que muestra la página del link: la partida, el equipo, si sigue abierto y si este usuario lo puede tomar. */
create function public.mm_replace_info(p_token text) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  x mm_replacements%rowtype;
  l mm_lobbies%rowtype;
  m matches%rowtype;
  lv live_matches%rowtype;
  v_status text;
begin
  if me is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  select * into x from mm_replacements where token_hash = mm_replace_hash(p_token);
  if x.id is null then raise exception 'Este link de reemplazo no existe' using errcode = 'P0002'; end if;
  select * into l from mm_lobbies where id = x.lobby_id;
  select * into m from matches where id = l.match_id;
  select * into lv from live_matches where server_id = l.server_id and l.status = 'live' order by updated_at desc limit 1;
  v_status := case when x.status = 'open' and x.expires_at <= now() then 'expired' else x.status end;
  return jsonb_build_object(
    'status', v_status, 'mine', coalesce(x.taken_by = me, false), 'lobby_id', case when x.taken_by = me then x.lobby_id end,
    'mode', l.mode, 'map', l.map, 'team', x.team, 'team_name', case x.team when 1 then m.side1_name else m.side2_name end,
    'score', case when lv.uid is not null then jsonb_build_object('a', lv.score_a, 'b', lv.score_b) end,
    'rounds_left', mm_replace_rounds_left(l.server_id),
    'expires_at', x.expires_at,
    'reason', case when v_status = 'open' then mm_replace_reason(me, x.lobby_id) end);
end $$;

/** Toma el reemplazo. Dos a la vez: el update con status = 'open' bloquea la fila y solo uno lo consigue. */
create function public.mm_replace_take(p_token text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  x mm_replacements%rowtype;
  q mm_queue%rowtype;
  v_player uuid;
  razon text;
begin
  if me is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  select * into x from mm_replacements where token_hash = mm_replace_hash(p_token);
  if x.id is null then raise exception 'Este link de reemplazo no existe' using errcode = 'P0002'; end if;
  if x.taken_by = me and x.status in ('taken', 'connected') then return x.lobby_id; end if;
  if x.status <> 'open' or x.expires_at <= now() then
    raise exception '%', case when x.status in ('taken', 'connected') then 'Ya lo tomó otro jugador' else 'Este link ya venció' end using errcode = 'V3901';
  end if;
  razon := mm_replace_reason(me, x.lobby_id);
  if razon is not null then raise exception '%', razon; end if;
  update mm_replacements set status = 'taken', taken_by = me, taken_at = now(), token = null,
         connect_deadline = now() + make_interval(mins => (select connect_minutes from mm_config))
   where id = x.id and status = 'open' and expires_at > now()
   returning * into x;
  if x.id is null then raise exception 'Ya lo tomó otro jugador' using errcode = 'V3901'; end if;
  -- Sale de la cola; si buscaba con su grupo, sale el grupo entero (no puede quedar a medias).
  select * into q from mm_queue where user_id = me;
  if q.party_id is not null then perform mm_party_clear_queue(q.party_id); elsif q.user_id is not null then perform mm_queue_remove(me, 'left'); end if;
  select id into v_player from players where user_id = me;
  insert into mm_lobby_players (lobby_id, user_id, player_id, team, elo, joined_at, accepted_at, replaces_user_id)
    values (x.lobby_id, me, v_player, x.team, mm_player_elo(v_player), now(), now(), x.replaced_user_id);
  perform mm_emit('lobby.update', x.lobby_id, mm_lobby_users(x.lobby_id));
  return x.lobby_id;
end $$;

-- ---------- 7. El aviso en Discord (worker del matchmaking) ----------

/** Pedidos cuyo mensaje de Discord no muestra el estado actual: publicar (con el token) o editar. */
create function public.mm_replace_pending() returns jsonb
  language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id, 'shown', mm_replace_shown(x.status), 'message_id', x.discord_message_id,
      'token', case when x.discord_message_id is null then x.token end,
      'mode', l.mode, 'map', l.map, 'expires_at', x.expires_at,
      'score', (select jsonb_build_object('a', lv.score_a, 'b', lv.score_b) from live_matches lv
                 where lv.server_id = l.server_id order by lv.updated_at desc limit 1)) order by x.created_at), '[]')
    from mm_replacements x join mm_lobbies l on l.id = x.lobby_id
   where x.post_attempts < 5
     and mm_replace_shown(x.status) is distinct from x.posted_status
     -- Uno que se cerró sin llegar a publicarse no se publica.
     and (x.discord_message_id is not null or (x.status = 'open' and x.token is not null and x.expires_at > now()))
$$;

/** El worker publicó o editó el mensaje (p_ok) o falló (suma un intento; a los 5 se deja de intentar). */
create function public.mm_replace_mark(p_id uuid, p_shown text, p_message_id text, p_ok boolean) returns void
  language sql security definer set search_path = public as $$
  update mm_replacements
     set posted_status = case when p_ok then p_shown else posted_status end,
         discord_message_id = coalesce(discord_message_id, case when p_ok then p_message_id end),
         token = case when p_ok then null else token end,
         post_attempts = case when p_ok then 0 else post_attempts + 1 end
   where id = p_id
$$;

-- ---------- Permisos ----------

revoke all on function public.mm_replace_hash(text), public.mm_replace_shown(text), public.mm_replace_rounds_left(uuid),
  public.mm_replace_can_open(uuid, smallint), public.mm_replace_out(uuid, uuid), public.mm_replace_open(uuid, smallint, uuid, text),
  public.mm_replace_sweep(uuid), public.mm_replace_close_finished(), public.mm_replace_arrived(uuid, uuid),
  public.mm_replace_reason(uuid, uuid), public.mm_replace_info(text), public.mm_replace_take(text),
  public.mm_replace_pending(), public.mm_replace_mark(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.mm_replace_info(text), public.mm_replace_take(text) to authenticated;
grant execute on function public.mm_replace_pending(), public.mm_replace_mark(uuid, text, text, boolean) to service_role;

comment on function public.mm_replace_info(text) is 'La página del link de un reemplazo: la partida, si sigue abierto y si lo puedo tomar. Replanteo 75';
comment on function public.mm_replace_take(text) is 'Tomar un reemplazo: entra a la sala en el equipo del que abandonó. Uno solo gana. Replanteo 75';
comment on function public.mm_replace_pending() is 'Avisos de reemplazo a publicar o editar en Discord (worker del matchmaking). Replanteo 75';
comment on function public.mm_replace_mark(uuid, text, text, boolean) is 'El worker publicó, editó o falló un aviso de reemplazo. Replanteo 75';

notify pgrst, 'reload schema';
commit;
