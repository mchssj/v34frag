-- 123: pines y trofeos de torneo, premios individuales y vitrina del jugador (bitácora docs/bitacora/2026-11-15-pines-y-trofeos/,
-- Daniel 2026-11-15, sobre la propuesta de Kyan 2026-11-14-pines-de-torneo).
--
--   1. events.pins: la configuración de cada torneo (estilo, escalones, premios). null = valores por defecto.
--   2. team_pins, player_pins, player_awards, event_pins_log, player_showcase y player_showcase_prefs.
--   3. event_final_places(evento): el puesto y el escalón de cada equipo que jugó.
--   4. event_award_stats(evento): las cifras de cada jugador para los premios individuales.
--   5. event_pins_sync(evento): deja los pines y los premios automáticos iguales al resultado y a la configuración.
--      Reemplaza a event_medals_sync (114) en los mismos triggers diferidos, más matches (corregir un resultado
--      cambia los puestos aunque no cambie el campeón) y events.pins.
--   6. event_award_candidates, event_award_pick y event_award_clear: elegir los premios a mano.
--   7. Avisos event_pin y event_award (categoría tournament). No avisan en los torneos históricos ni con
--      cmleague.pins_quiet = 'on'.
--   8. Vista player_showcase_shown: los 6 destacados del Resumen del perfil, y los logros destacados
--      (player_medal_featured, player_medals_featured_set).
--   9. Retroactivo: los pines de todos los torneos terminados, sin avisos. Las medallas de torneo de la 114
--      (también las manuales adoptadas) pasan a ser pines y se borran; si a alguien le faltara el pin de una medalla
--      que tenía, la migración se cancela. campeon_torneo y finalista_torneo vuelven a ser medallas manuales (para
--      torneos de afuera de la plataforma).
--
-- Necesita la 114. Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/123_pines_de_torneo.sql.
begin;

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'event_medals_sync' and pronamespace = 'public'::regnamespace) then
    raise exception 'replanteo 123: falta la 114 (event_medals_sync)';
  end if;
  if to_regclass('public.team_pins') is not null then
    raise exception 'replanteo 123: ya se aplicó (team_pins existe)';
  end if;
end $$;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 123: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- =====================================================================================================
-- 1. Configuración: events.pins
-- =====================================================================================================
-- Los valores por defecto (los mismos que la web, features/pins). Un torneo con pins = null usa estos.
create function public.pins_default() returns jsonb language sql immutable set search_path = public as $$
  select '{
    "enabled": true,
    "style": "anillos",
    "tiers": {
      "champion":     {"on": true,  "metal": "oro",    "min_teams": null},
      "finalist":     {"on": true,  "metal": "plata",  "min_teams": null},
      "third":        {"on": true,  "metal": "bronce", "min_teams": null},
      "semifinalist": {"on": true,  "metal": "bronce", "min_teams": 4},
      "quarter":      {"on": true,  "metal": "acero",  "min_teams": 8},
      "round16":      {"on": false, "metal": "acero",  "min_teams": 16},
      "participant":  {"on": false, "metal": "acero",  "min_teams": 8}
    },
    "awards": {
      "mvp":         {"on": true,  "mode": "auto"},
      "top_fragger": {"on": true,  "mode": "auto"},
      "awp":         {"on": true,  "mode": "auto"},
      "clutch":      {"on": true,  "mode": "auto"},
      "hs":          {"on": true,  "mode": "auto"},
      "adr":         {"on": false, "mode": "auto"},
      "entry":       {"on": false, "mode": "auto"},
      "play":        {"on": false, "mode": "pick"}
    }
  }'::jsonb
$$;
comment on function public.pins_default() is 'Configuración de pines por defecto de un torneo (replanteo 123)';

-- La configuración efectiva: los valores por defecto con lo que el torneo cambió encima, escalón por escalón.
create function public.pins_config(p jsonb) returns jsonb language sql immutable set search_path = public as $$
  with d as (select pins_default() as d), c as (select coalesce(p, '{}'::jsonb) as c)
  select jsonb_build_object(
    'enabled', coalesce((c->'enabled'), d->'enabled'),
    'style',   coalesce((c->'style'), d->'style'),
    'tiers',  (select jsonb_object_agg(k, (d->'tiers'->k) || coalesce(c->'tiers'->k, '{}'::jsonb)) from jsonb_object_keys(d->'tiers') k),
    'awards', (select jsonb_object_agg(k, (d->'awards'->k) || coalesce(c->'awards'->k, '{}'::jsonb)
                                            -- La jugada no se puede calcular: siempre es a mano.
                                            || case when k = 'play' then '{"mode":"pick"}'::jsonb else '{}'::jsonb end)
                 from jsonb_object_keys(d->'awards') k))
  from d, c
$$;
comment on function public.pins_config(jsonb) is 'events.pins con los valores por defecto completados (replanteo 123)';

create function public.pins_valid(p jsonb) returns boolean language plpgsql immutable set search_path = public as $$
declare k text; v jsonb;
begin
  if p is null then return true; end if;
  if jsonb_typeof(p) <> 'object' then return false; end if;
  if exists (select 1 from jsonb_object_keys(p) x where x not in ('enabled', 'style', 'tiers', 'awards')) then return false; end if;
  if p ? 'enabled' and jsonb_typeof(p->'enabled') <> 'boolean' then return false; end if;
  if p ? 'style' and coalesce(p->>'style', '') not in ('clasico', 'cristal', 'escudo', 'moneda', 'estrella', 'globo', 'cinta', 'angular',
       'anillos', 'isotipo', 'rombo', 'jarron', 'orbe', 'alas', 'bloques', 'corona', 'disco', 'obelisco', 'estrella3d') then
    return false;
  end if;
  if p ? 'tiers' then
    if jsonb_typeof(p->'tiers') <> 'object' then return false; end if;
    for k, v in select * from jsonb_each(p->'tiers') loop
      if k not in ('champion', 'finalist', 'third', 'semifinalist', 'quarter', 'round16', 'participant') or jsonb_typeof(v) <> 'object' then
        return false;
      end if;
      if exists (select 1 from jsonb_object_keys(v) x where x not in ('on', 'metal', 'min_teams')) then return false; end if;
      if v ? 'on' and jsonb_typeof(v->'on') <> 'boolean' then return false; end if;
      if v ? 'metal' and coalesce(v->>'metal', '') not in ('oro', 'plata', 'bronce', 'acero') then return false; end if;
      if v ? 'min_teams' and jsonb_typeof(v->'min_teams') <> 'null'
         and (jsonb_typeof(v->'min_teams') <> 'number' or (v->>'min_teams')::numeric not between 2 and 128
              or (v->>'min_teams')::numeric <> trunc((v->>'min_teams')::numeric)) then
        return false;
      end if;
    end loop;
  end if;
  if p ? 'awards' then
    if jsonb_typeof(p->'awards') <> 'object' then return false; end if;
    for k, v in select * from jsonb_each(p->'awards') loop
      if k not in ('mvp', 'top_fragger', 'awp', 'clutch', 'hs', 'adr', 'entry', 'play') or jsonb_typeof(v) <> 'object' then return false; end if;
      if exists (select 1 from jsonb_object_keys(v) x where x not in ('on', 'mode')) then return false; end if;
      if v ? 'on' and jsonb_typeof(v->'on') <> 'boolean' then return false; end if;
      if v ? 'mode' and coalesce(v->>'mode', '') not in ('auto', 'pick') then return false; end if;
    end loop;
  end if;
  return true;
end $$;
comment on function public.pins_valid(jsonb) is 'Valida events.pins: claves, estilos, metales, modos y min_teams entre 2 y 128 (replanteo 123)';

alter table public.events add column pins jsonb, add constraint events_pins_valid check (pins_valid(pins));
comment on column public.events.pins is
  'Pines y premios del torneo: {enabled, style, tiers: {champion: {on, metal, min_teams}, …}, awards: {mvp: {on, mode}, …}}. '
  'null o lo que falte = pins_default() (replanteo 123)';

-- =====================================================================================================
-- 2. Tablas
-- =====================================================================================================
create table public.team_pins (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  team_id    uuid not null references public.teams(id) on delete cascade,
  tier       text not null check (tier in ('champion', 'finalist', 'third', 'semifinalist', 'quarter', 'round16', 'participant')),
  place      integer not null check (place >= 1),
  year       integer not null,
  awarded_at timestamptz not null default now(),
  unique (event_id, team_id)
);
comment on table public.team_pins is 'El pin de cada equipo en un torneo: uno solo, el de su puesto final (replanteo 123)';
comment on column public.team_pins.place is 'Puesto final (1, 2, 3, 4, 5…). Los empatados comparten el número';
comment on column public.team_pins.year is 'Año del torneo (de la última partida, o ends_on): va escrito en el pin';
create index team_pins_team on public.team_pins (team_id);

create table public.player_pins (
  id          uuid primary key default gen_random_uuid(),
  team_pin_id uuid not null references public.team_pins(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  notified    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (team_pin_id, player_id)
);
comment on table public.player_pins is 'Los jugadores que reciben el pin de su equipo (replanteo 123)';
comment on column public.player_pins.notified is 'Ya se avisó (o no correspondía avisar): un recálculo no vuelve a avisar';
create index player_pins_player on public.player_pins (player_id);

create table public.player_awards (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  award      text not null check (award in ('mvp', 'top_fragger', 'awp', 'clutch', 'hs', 'adr', 'entry', 'play')),
  player_id  uuid not null references public.players(id) on delete cascade,
  team_id    uuid references public.teams(id) on delete set null,
  value      numeric,
  manual     boolean not null default false,
  clip_id    uuid references public.match_clips(id) on delete set null,
  picked_by  uuid references auth.users(id) on delete set null,
  notified   boolean not null default false,
  awarded_at timestamptz not null default now(),
  unique (event_id, award, player_id),
  constraint player_awards_clip check (clip_id is null or award = 'play')
);
comment on table public.player_awards is 'Premios individuales de un torneo (MVP, top fragger…): automáticos o elegidos a mano (replanteo 123)';
comment on column public.player_awards.value is 'La cifra con la que lo ganó (rating, kills, %, ADR…). null si se eligió sin stats';
comment on column public.player_awards.manual is 'Lo eligió el organizador: pisa al automático y se mantiene en los recálculos';
create index player_awards_player on public.player_awards (player_id);

create table public.event_pins_log (
  id         bigint generated always as identity primary key,
  event_id   uuid not null references public.events(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  before     jsonb,
  after      jsonb
);
comment on table public.event_pins_log is 'Cambios de events.pins con el torneo ya terminado: quién, cuándo, antes y después (replanteo 123)';
create index event_pins_log_event on public.event_pins_log (event_id, changed_at desc);

create table public.player_showcase_prefs (
  player_id  uuid primary key references public.players(id) on delete cascade,
  mode       text not null default 'auto' check (mode in ('auto', 'manual')),
  updated_at timestamptz not null default now()
);
comment on table public.player_showcase_prefs is 'Cómo elige cada jugador los destacados de su vitrina (auto: los mejores; manual: los que marcó). Replanteo 123';

create table public.player_showcase (
  player_id uuid not null references public.players(id) on delete cascade,
  kind      text not null check (kind in ('pin', 'award')),
  ref_id    uuid not null,
  position  smallint not null check (position between 1 and 6),
  primary key (player_id, kind, ref_id),
  unique (player_id, position)
);
comment on table public.player_showcase is
  'Los pines (player_pins.id) y premios (player_awards.id) que el jugador destacó, en orden (modo manual). Replanteo 123';

alter table public.team_pins enable row level security;
alter table public.player_pins enable row level security;
alter table public.player_awards enable row level security;
alter table public.event_pins_log enable row level security;
alter table public.player_showcase_prefs enable row level security;
alter table public.player_showcase enable row level security;
revoke all on public.team_pins, public.player_pins, public.player_awards, public.event_pins_log,
              public.player_showcase_prefs, public.player_showcase from anon, authenticated;
grant select on public.team_pins, public.player_pins, public.player_awards, public.player_showcase_prefs, public.player_showcase
  to anon, authenticated;
grant select on public.event_pins_log to authenticated;
create policy "pines: ver" on public.team_pins for select using (event_visible(event_id));
create policy "pines jugador: ver" on public.player_pins for select
  using (exists (select 1 from team_pins t where t.id = team_pin_id and event_visible(t.event_id)));
create policy "premios: ver" on public.player_awards for select using (event_visible(event_id));
create policy "registro pines: ver" on public.event_pins_log for select using (can_manage_event(event_id));
create policy "vitrina: ver" on public.player_showcase for select using (true);
create policy "vitrina modo: ver" on public.player_showcase_prefs for select using (true);
-- Escriben solo las funciones (security definer) y la API con la service key.

-- =====================================================================================================
-- 3. Puesto final de cada equipo
-- =====================================================================================================
-- Cada equipo que jugó al menos una partida (sin contar byes). El puesto sale de la última partida que jugó en la parte
-- eliminatoria: los playoffs (ko y 3.er puesto, en la última fase) o, en doble eliminación, las llaves de abajo y la gran
-- final. Puesto = 1 + los equipos que quedaron eliminados más tarde. Los que no llegaron a esa parte (grupos o suizo)
-- son participantes. En una liga (grupos sin playoffs) el puesto es el de la tabla.
create function public.event_final_places(p_event uuid)
returns table (team_id uuid, place integer, tier text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  e        events%rowtype;
  v_phase  int;
  v_rounds int;
  v_n      int;
  v_third  boolean;
begin
  select * into e from events where id = p_event;
  if not found or e.champion is null or e.status <> 'finished' then return; end if;
  -- «Tercer puesto» solo existe con partido por el 3.º o en doble eliminación.
  v_third := e.template = 'double'
             or exists (select 1 from matches where event_id = p_event and stage = 'third' and status = 'finished' and not bye);

  create temp table if not exists fp_jugaron (team_id uuid primary key) on commit drop;
  create temp table if not exists fp_puesto (team_id uuid primary key, elim numeric) on commit drop;
  truncate pg_temp.fp_jugaron, pg_temp.fp_puesto;

  insert into pg_temp.fp_jugaron
  select distinct t from matches m, unnest(array[m.team1, m.team2]) t
   where m.event_id = p_event and m.status = 'finished' and not m.bye and m.team1 is not null and m.team2 is not null
  union
  select e.champion;

  -- Liga: grupos de un solo clasificado, sin playoffs.
  if e.template = 'groups' and not exists (select 1 from matches where event_id = p_event and stage = 'ko') then
    return query
      select j.team_id,
             case when j.team_id = e.champion then 1 else coalesce(o.place, 999) end,
             case when j.team_id = e.champion then 'champion'
                  when o.place = 2 then 'finalist'
                  when o.place = 3 then 'third'
                  else 'participant' end
        from pg_temp.fp_jugaron j
        left join lateral (select x.place from event_group_order(p_event, 1) x where x.team_id = j.team_id) o on true;
    return;
  end if;

  -- La parte eliminatoria: cada partida con una clave (más alta = más tarde en el torneo).
  if e.template = 'double' then
    insert into pg_temp.fp_puesto
    select distinct on (t.team_id) t.team_id, t.k + case when t.won then 0.5 else 0 end
      from (select x.team_id, x.won,
                   case m.stage when 'upper' then 0 when 'lower' then m.round else 1000 + coalesce(m.round, 1) end::numeric as k
              from matches m
             cross join lateral (values (m.team1, m.winner = m.team1), (m.team2, m.winner = m.team2)) x(team_id, won)
             where m.event_id = p_event and m.status = 'finished' and not m.bye and m.winner is not null
               and m.team1 is not null and m.team2 is not null and m.stage in ('upper', 'lower', 'grand')) t
     order by t.team_id, t.k desc;
  else
    select max(phase) into v_phase from matches where event_id = p_event and stage = 'ko';
    select max(round) into v_rounds from matches where event_id = p_event and stage = 'ko' and phase is not distinct from v_phase;
    insert into pg_temp.fp_puesto
    select distinct on (t.team_id) t.team_id, t.k + case when t.won then 0.5 else 0 end
      from (select x.team_id, x.won,
                   -- ko: 2 × ronda; el partido por el 3.º va entre semis y la final.
                   case m.stage when 'ko' then 2 * m.round else 2 * v_rounds - 1 end::numeric as k
              from matches m
             cross join lateral (values (m.team1, m.winner = m.team1), (m.team2, m.winner = m.team2)) x(team_id, won)
             where m.event_id = p_event and m.status = 'finished' and not m.bye and m.winner is not null
               and m.team1 is not null and m.team2 is not null and m.stage in ('ko', 'third')
               and m.phase is not distinct from v_phase) t
     order by t.team_id, t.k desc;
  end if;
  insert into pg_temp.fp_puesto values (e.champion, 1e9) on conflict (team_id) do update set elim = 1e9;

  select count(*) into v_n from pg_temp.fp_puesto;
  return query
    with p as (
      select j.team_id,
             case when f.elim is null then null
                  else 1 + (select count(*) from pg_temp.fp_puesto g where g.elim > f.elim)::int end as place
        from pg_temp.fp_jugaron j left join pg_temp.fp_puesto f on f.team_id = j.team_id
    )
    select p.team_id,
           coalesce(p.place, v_n + 1),
           case when p.team_id = e.champion then 'champion'
                when p.place is null then 'participant'
                when p.place = 2 then 'finalist'
                when p.place = 3 and v_third and (select count(*) from p q where q.place = 3) = 1 then 'third'
                when p.place in (3, 4) then 'semifinalist'
                when p.place between 5 and 8 then 'quarter'
                when p.place between 9 and 16 then 'round16'
                else 'participant' end
      from p;
end $$;
revoke all on function public.event_final_places(uuid) from public, anon, authenticated;
comment on function public.event_final_places(uuid) is
  'Puesto final y escalón de cada equipo que jugó un torneo terminado, sin mirar la configuración (replanteo 123)';

-- =====================================================================================================
-- 4. Cifras para los premios individuales
-- =====================================================================================================
-- Solo cuentan los mapas del torneo jugados en el servidor: los mixes vinculados (y aprobados) a sus partidas. Cada
-- jugador cuenta para el equipo con el que está inscrito. Devuelve solo a los que llegan al mínimo de cada premio.
create function public.event_award_stats(p_event uuid)
returns table (award text, player_id uuid, team_id uuid, value numeric, kills bigint, adr numeric, rating numeric, maps bigint)
language sql stable security definer set search_path = public as $$
  with mapas as (
    select x.id from matches x join matches p on p.id = x.parent_match_id
     where p.event_id = p_event and x.parent_approved and x.status = 'finished'
    union
    select m.id from matches m where m.event_id = p_event and m.status = 'finished' and not m.bye
  ), s as (
    select s.player_id, r.team_id, s.match_id, s.kills, s.headshots, s.damage, s.rounds, s.first_kills, s.rating,
           (x.match_id is not null) as extra,
           coalesce((x.weapon_kills->>'awp')::int, 0) as awp,
           coalesce(x.clutch_1v1, 0) + coalesce(x.clutch_1v2, 0) + coalesce(x.clutch_1v3, 0)
             + coalesce(x.clutch_1v4, 0) + coalesce(x.clutch_1v5, 0) as clutches
      from match_player_stats s
      join mapas m on m.id = s.match_id
      join tournament_registration_players r on r.event_id = p_event and r.player_id = s.player_id
      left join match_player_extra x on x.match_id = s.match_id and x.steam_id = s.steam_id
  ), equipo as (
    select s.team_id, count(distinct s.match_id) as maps from s group by s.team_id
  ), j as (
    select s.player_id, s.team_id, count(distinct s.match_id) as maps,
           sum(s.kills) as kills, sum(s.headshots) as hs, sum(s.damage) as damage, sum(s.rounds) as rounds,
           sum(s.first_kills) as fk,
           sum(s.rating * s.rounds) filter (where s.rating is not null) / nullif(sum(s.rounds) filter (where s.rating is not null), 0) as rating,
           sum(s.awp) filter (where s.extra) as awp, sum(s.clutches) filter (where s.extra) as clutches
      from s group by s.player_id, s.team_id
  ), b as (
    select j.*, round(j.damage::numeric / nullif(j.rounds, 0), 1) as adr,
           j.maps * 2 >= q.maps as medio
      from j join equipo q on q.team_id = j.team_id
  )
  select a.award, b.player_id, b.team_id, a.value, b.kills, b.adr, round(b.rating, 2), b.maps
    from b
   cross join lateral (values
     ('mvp',         round(b.rating, 2),                                           b.medio and b.rating is not null),
     ('top_fragger', b.kills::numeric,                                             b.medio),
     ('hs',          round(100.0 * b.hs / nullif(b.kills, 0), 1),                  b.kills >= 50),
     ('adr',         b.adr,                                                        b.medio and b.adr is not null),
     ('entry',       b.fk::numeric,                                                b.medio),
     ('awp',         b.awp::numeric,                                               coalesce(b.awp, 0) >= 10),
     ('clutch',      b.clutches::numeric,                                          coalesce(b.clutches, 0) >= 2)
   ) a(award, value, ok)
   where a.ok and a.value is not null
$$;
revoke all on function public.event_award_stats(uuid) from public, anon, authenticated;
comment on function public.event_award_stats(uuid) is
  'Cifras de cada jugador del torneo para cada premio individual, solo los que llegan al mínimo (replanteo 123)';

-- ¿El torneo tiene stats para ese premio? AWP y clutch necesitan mapas del reporter 2.7.0 (match_player_extra).
create function public.event_award_calculable(p_event uuid, p_award text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_award <> 'play' and exists (
    select 1 from match_player_stats s
      join matches x on x.id = s.match_id
      left join matches p on p.id = x.parent_match_id
     where x.status = 'finished'
       and (x.event_id = p_event or (p.event_id = p_event and x.parent_approved))
       and (p_award not in ('awp', 'clutch')
            or exists (select 1 from match_player_extra e where e.match_id = s.match_id and e.steam_id = s.steam_id)))
$$;
revoke all on function public.event_award_calculable(uuid, text) from public, anon, authenticated;
grant execute on function public.event_award_calculable(uuid, text) to anon, authenticated;

-- =====================================================================================================
-- 5. event_pins_sync
-- =====================================================================================================
create function public.event_pins_sync(p_event uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  e      events%rowtype;
  cfg    jsonb;
  v_ok   boolean;
  v_n    int;
  v_year int;
  k      text;
  a      jsonb;
  quiet  boolean;
  rec    record;
begin
  select * into e from events where id = p_event;
  if not found then return; end if;
  cfg := pins_config(e.pins);
  v_ok := e.status = 'finished' and not e.testing and e.approval = 'approved' and e.champion is not null
          and (cfg->>'enabled')::boolean;
  quiet := e.historic or coalesce(current_setting('cmleague.pins_quiet', true), '') = 'on';

  -- ---------- Pines por puesto ----------
  create temp table if not exists ps_pines (team_id uuid primary key, tier text, place int) on commit drop;
  truncate pg_temp.ps_pines;
  if v_ok then
    insert into pg_temp.ps_pines select f.team_id, f.tier, f.place from event_final_places(p_event) f;
    select count(*) into v_n from pg_temp.ps_pines;
    -- Con «Tercer puesto» apagado, el 3.º es semifinalista.
    update pg_temp.ps_pines set tier = 'semifinalist'
     where tier = 'third' and not (cfg->'tiers'->'third'->>'on')::boolean;
    delete from pg_temp.ps_pines p
     where not (cfg->'tiers'->p.tier->>'on')::boolean
        or v_n < coalesce((cfg->'tiers'->p.tier->>'min_teams')::int, 0);
  end if;
  v_year := extract(year from coalesce(
              (select max(coalesce(m.played_at, m.starts_at)) from matches m where m.event_id = p_event and m.status = 'finished'),
              e.ends_on::timestamptz, now()))::int;

  delete from team_pins t where t.event_id = p_event and not exists (select 1 from pg_temp.ps_pines p where p.team_id = t.team_id);
  insert into team_pins (event_id, team_id, tier, place, year)
  select p_event, p.team_id, p.tier, p.place, v_year from pg_temp.ps_pines p
  on conflict (event_id, team_id) do update
     set tier = excluded.tier, place = excluded.place, year = excluded.year
   where (team_pins.tier, team_pins.place, team_pins.year) is distinct from (excluded.tier, excluded.place, excluded.year);

  -- Jugadores: los inscritos con ese equipo, menos los suplentes que no jugaron ningún mapa del torneo. En un
  -- histórico, todo el plantel inscrito.
  create temp table if not exists ps_jugadores (team_pin_id uuid, player_id uuid, primary key (team_pin_id, player_id)) on commit drop;
  truncate pg_temp.ps_jugadores;
  insert into pg_temp.ps_jugadores
  select t.id, r.player_id
    from team_pins t
    join tournament_registration_players r on r.event_id = t.event_id and r.team_id = t.team_id
   where t.event_id = p_event
     and (e.historic or r.role = 'active' or exists (
            select 1 from match_player_stats s join matches x on x.id = s.match_id left join matches p on p.id = x.parent_match_id
             where s.player_id = r.player_id and x.status = 'finished'
               and (x.event_id = p_event or (p.event_id = p_event and x.parent_approved))));

  delete from player_pins pp using team_pins t
   where t.id = pp.team_pin_id and t.event_id = p_event
     and not exists (select 1 from pg_temp.ps_jugadores j where j.team_pin_id = pp.team_pin_id and j.player_id = pp.player_id);
  insert into player_pins (team_pin_id, player_id, notified)
  select j.team_pin_id, j.player_id, quiet from pg_temp.ps_jugadores j
  on conflict (team_pin_id, player_id) do nothing;

  if not quiet then
    for rec in select t.tier, t.place, t.team_id, tm.name as team_name, array_agg(pp.player_id) as players
               from player_pins pp join team_pins t on t.id = pp.team_pin_id join teams tm on tm.id = t.team_id
              where t.event_id = p_event and not pp.notified
              group by t.tier, t.place, t.team_id, tm.name loop
      perform notify(users_of_players(rec.players), 'event_pin',
                     jsonb_build_object('event_id', p_event, 'event', e.name, 'tier', rec.tier, 'place', rec.place,
                                        'team_id', rec.team_id, 'team', rec.team_name, 'year', v_year,
                                        'style', cfg->>'style', 'metal', cfg->'tiers'->rec.tier->>'metal'),
                     'event:' || p_event);
    end loop;
  end if;
  update player_pins pp set notified = true from team_pins t
   where t.id = pp.team_pin_id and t.event_id = p_event and not pp.notified;

  -- ---------- Premios individuales ----------
  for k, a in select * from jsonb_each(cfg->'awards') loop
    if not v_ok or not (a->>'on')::boolean then
      delete from player_awards where event_id = p_event and award = k;
      continue;
    end if;
    -- Los elegidos a mano siguen mientras el jugador esté inscrito en el torneo.
    delete from player_awards w where w.event_id = p_event and w.award = k and w.manual
       and not exists (select 1 from tournament_registration_players r where r.event_id = p_event and r.player_id = w.player_id);
    if exists (select 1 from player_awards where event_id = p_event and award = k and manual) or a->>'mode' <> 'auto' then
      delete from player_awards where event_id = p_event and award = k and not manual;
      continue;
    end if;
    -- Automático: gana el de mejor cifra; desempate por kills, ADR y rating; si sigue igual, ganan todos.
    create temp table if not exists ps_premio (player_id uuid primary key, team_id uuid, value numeric) on commit drop;
    truncate pg_temp.ps_premio;
    insert into pg_temp.ps_premio
    select s.player_id, s.team_id, s.value
      from (select st.*, rank() over (order by st.value desc, st.kills desc, st.adr desc nulls last, st.rating desc nulls last) as rk
              from event_award_stats(p_event) st where st.award = k) s
     where s.rk = 1;
    delete from player_awards w where w.event_id = p_event and w.award = k and not w.manual
       and not exists (select 1 from pg_temp.ps_premio p where p.player_id = w.player_id);
    insert into player_awards (event_id, award, player_id, team_id, value, notified)
    select p_event, k, p.player_id, p.team_id, p.value, quiet from pg_temp.ps_premio p
    on conflict (event_id, award, player_id) do update set team_id = excluded.team_id, value = excluded.value
     where (player_awards.team_id, player_awards.value) is distinct from (excluded.team_id, excluded.value);
  end loop;

  if not quiet then
    for rec in select w.award, w.player_id, w.value from player_awards w where w.event_id = p_event and not w.notified loop
      perform notify(users_of_players(array[rec.player_id]), 'event_award',
                     jsonb_build_object('event_id', p_event, 'event', e.name, 'award', rec.award, 'value', rec.value,
                                        'year', v_year, 'style', cfg->>'style'),
                     'event:' || p_event);
    end loop;
  end if;
  update player_awards set notified = true where event_id = p_event and not notified;
end $$;
revoke all on function public.event_pins_sync(uuid) from public, anon, authenticated;
comment on function public.event_pins_sync(uuid) is
  'Deja los pines y los premios automáticos de un torneo iguales a su resultado y a events.pins; avisa solo la primera vez (replanteo 123)';

-- =====================================================================================================
-- 6. Elegir premios a mano
-- =====================================================================================================
create function public.event_award_candidates(p_event uuid, p_award text)
returns table (player_id uuid, team_id uuid, value numeric, kills bigint, adr numeric, rating numeric, maps bigint, suggested boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not can_manage_event(p_event) then
    raise exception 'Solo el organizador del torneo o un admin puede elegir premios' using errcode = '42501';
  end if;
  if p_award not in ('mvp', 'top_fragger', 'awp', 'clutch', 'hs', 'adr', 'entry', 'play') then raise exception 'Premio desconocido'; end if;
  -- Todo el plantel inscrito. Los 10 mejores por la cifra del premio (entre los que llegan al mínimo) van primero,
  -- como sugeridos; el resto, con su cifra si llega al mínimo. Sin stats, nadie es sugerido.
  return query
    with s as (
      select st.*, row_number() over (order by st.value desc, st.kills desc, st.adr desc nulls last, st.rating desc nulls last) as rn
        from event_award_stats(p_event) st where st.award = p_award
    )
    select r.player_id, r.team_id, s.value, s.kills, s.adr, s.rating, s.maps, coalesce(s.rn <= 10, false)
      from tournament_registration_players r
      left join s on s.player_id = r.player_id
     where r.event_id = p_event
     order by s.rn nulls last, r.player_id;
end $$;
revoke all on function public.event_award_candidates(uuid, text) from public, anon;
grant execute on function public.event_award_candidates(uuid, text) to authenticated;
comment on function public.event_award_candidates(uuid, text) is
  'Para elegir un premio a mano: todo el plantel, con los 10 mejores por la cifra del premio primero (suggested) (replanteo 123)';

create function public.event_award_pick(p_event uuid, p_award text, p_player uuid, p_clip uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  e   events%rowtype;
  v_team uuid;
  v_value numeric;
  v_id uuid;
begin
  if not can_manage_event(p_event) then
    raise exception 'Solo el organizador del torneo o un admin puede elegir premios' using errcode = '42501';
  end if;
  select * into e from events where id = p_event;
  if e.status <> 'finished' then raise exception 'Los premios se eligen con el torneo terminado'; end if;
  if not coalesce((pins_config(e.pins)->'awards'->p_award->>'on')::boolean, false) then
    raise exception 'Ese premio está apagado en la configuración del torneo';
  end if;
  if p_award = 'play' then
    if p_clip is null then raise exception 'La jugada del torneo se elige con un clip'; end if;
    select l.player_id into p_player
      from match_clip_list l join matches x on x.id = l.match_id left join matches p on p.id = x.parent_match_id
     where l.id = p_clip and (x.event_id = p_event or (p.event_id = p_event and x.parent_approved));
    if not found then raise exception 'Ese clip no es de una partida del torneo'; end if;
  elsif p_clip is not null then
    raise exception 'Solo la jugada del torneo lleva un clip';
  end if;
  select r.team_id into v_team from tournament_registration_players r where r.event_id = p_event and r.player_id = p_player;
  if not found then raise exception 'El jugador no está inscrito en el torneo'; end if;
  select s.value into v_value from event_award_stats(p_event) s where s.award = p_award and s.player_id = p_player;

  delete from player_awards where event_id = p_event and award = p_award;
  insert into player_awards (event_id, award, player_id, team_id, value, manual, clip_id, picked_by, notified)
  values (p_event, p_award, p_player, v_team, v_value, true, p_clip, auth.uid(), false)
  returning id into v_id;
  perform event_pins_sync(p_event);
  return v_id;
end $$;
revoke all on function public.event_award_pick(uuid, text, uuid, uuid) from public, anon;
grant execute on function public.event_award_pick(uuid, text, uuid, uuid) to authenticated;
comment on function public.event_award_pick(uuid, text, uuid, uuid) is
  'El organizador elige el ganador de un premio (o el clip de la jugada); pisa al automático (replanteo 123)';

create function public.event_award_clear(p_event uuid, p_award text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_manage_event(p_event) then
    raise exception 'Solo el organizador del torneo o un admin puede elegir premios' using errcode = '42501';
  end if;
  delete from player_awards where event_id = p_event and award = p_award and manual;
  perform event_pins_sync(p_event);
end $$;
revoke all on function public.event_award_clear(uuid, text) from public, anon;
grant execute on function public.event_award_clear(uuid, text) to authenticated;
comment on function public.event_award_clear(uuid, text) is 'Borra la elección a mano de un premio: vuelve al automático o queda pendiente (replanteo 123)';

-- =====================================================================================================
-- 7. Triggers: reemplazan a los de la 114
-- =====================================================================================================
drop trigger event_medals on public.events;
drop trigger event_medals on public.tournament_registrations;
drop trigger event_medals on public.tournament_registration_players;
drop function public.tg_event_medals();
drop function public.event_medals_sync(uuid);

create function public.tg_event_pins() returns trigger language plpgsql security definer set search_path = public as $$
declare v_event uuid;
begin
  if tg_table_name = 'events' then
    if tg_op = 'UPDATE' then perform event_pins_sync(new.id); end if;
  elsif tg_table_name = 'matches' then
    -- Solo importa en un torneo terminado. Un mix vinculado cuenta para el torneo de su partida.
    v_event := coalesce(new.event_id, (select p.event_id from matches p where p.id = new.parent_match_id));
    if v_event is not null and exists (select 1 from events where id = v_event and status = 'finished') then
      perform event_pins_sync(v_event);
    end if;
  elsif tg_op = 'DELETE' then
    perform event_pins_sync(old.event_id);
  else
    perform event_pins_sync(new.event_id);
    if tg_op = 'UPDATE' and old.event_id is distinct from new.event_id then perform event_pins_sync(old.event_id); end if;
  end if;
  return null;
end $$;

create constraint trigger event_pins after update of status, champion, approval, testing, name, pins on public.events
  deferrable initially deferred for each row execute function public.tg_event_pins();
create constraint trigger event_pins after insert or update or delete on public.tournament_registrations
  deferrable initially deferred for each row execute function public.tg_event_pins();
create constraint trigger event_pins after insert or update or delete on public.tournament_registration_players
  deferrable initially deferred for each row execute function public.tg_event_pins();
create constraint trigger event_pins after update of status, winner, team1, team2, bye, parent_approved on public.matches
  deferrable initially deferred for each row execute function public.tg_event_pins();

-- Registro de los cambios de configuración con el torneo terminado.
create function public.tg_event_pins_log() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'finished' and new.pins is distinct from old.pins then
    insert into event_pins_log (event_id, changed_by, before, after) values (new.id, auth.uid(), old.pins, new.pins);
  end if;
  return null;
end $$;
create trigger event_pins_log after update of pins on public.events for each row execute function public.tg_event_pins_log();

-- =====================================================================================================
-- 8. Avisos y vitrina
-- =====================================================================================================
select pg_temp.reemplazar('public.notification_category(text)', array[
  ['''booking_attention'', ''event_reviewed'', ''game_reviewed'') then ''tournament''',
   '''booking_attention'', ''event_reviewed'', ''game_reviewed'', ''event_pin'', ''event_award'') then ''tournament'' -- (replanteo 123) event_pin y event_award']]);

-- Los 6 destacados de cada jugador: los que eligió (modo manual) o, si no, los mejores pines (por puesto) y después los
-- premios, del más reciente al más viejo.
create view public.player_showcase_shown with (security_invoker = true) as
  with todo as (
    select pp.player_id, 'pin'::text as kind, pp.id as ref_id, t.place as orden, t.awarded_at as at
      from player_pins pp join team_pins t on t.id = pp.team_pin_id
    union all
    select w.player_id, 'award', w.id, case w.award when 'mvp' then 4 else 6 end, w.awarded_at from player_awards w
  ), elegidos as (
    select s.player_id, s.kind, s.ref_id, s.position::int as pos
      from player_showcase s join player_showcase_prefs pr on pr.player_id = s.player_id and pr.mode = 'manual'
      join todo t on t.player_id = s.player_id and t.kind = s.kind and t.ref_id = s.ref_id
  ), solos as (
    select t.player_id, t.kind, t.ref_id,
           row_number() over (partition by t.player_id order by t.orden, t.at desc, t.ref_id)::int as pos
      from todo t
     where not exists (select 1 from player_showcase_prefs pr where pr.player_id = t.player_id and pr.mode = 'manual')
  )
  select player_id, kind, ref_id, pos from elegidos
  union all
  select player_id, kind, ref_id, pos from solos where pos <= 6;
grant select on public.player_showcase_shown to anon, authenticated;
comment on view public.player_showcase_shown is
  'Los hasta 6 pines o premios que se ven en el Resumen del perfil: los elegidos o los mejores (replanteo 123)';

-- Listados con todo lo que hace falta para dibujar el pin: torneo, equipo, estilo y metal (de events.pins).
create view public.team_pin_list with (security_invoker = true) as
  select t.id, t.event_id, e.name as event_name, t.team_id, tm.name as team_name, tm.tag as team_tag, tm.logo_url as team_logo_url,
         t.tier, t.place, t.year, t.awarded_at, c.cfg->>'style' as style, c.cfg->'tiers'->t.tier->>'metal' as metal
    from team_pins t
    join events e on e.id = t.event_id
    join teams tm on tm.id = t.team_id
   cross join lateral (select pins_config(e.pins) as cfg) c;
create view public.player_pin_list with (security_invoker = true) as
  select pp.id, pp.player_id, l.id as team_pin_id, l.event_id, l.event_name, l.team_id, l.team_name, l.team_tag, l.team_logo_url,
         l.tier, l.place, l.year, l.awarded_at, l.style, l.metal
    from player_pins pp join team_pin_list l on l.id = pp.team_pin_id;
create view public.player_award_list with (security_invoker = true) as
  select w.id, w.event_id, e.name as event_name, w.award, w.player_id, p.nick, w.team_id, tm.name as team_name, tm.tag as team_tag,
         tm.logo_url as team_logo_url, w.value, w.manual, w.clip_id, w.awarded_at,
         extract(year from coalesce((select max(coalesce(m.played_at, m.starts_at)) from matches m
                                      where m.event_id = w.event_id and m.status = 'finished'), e.ends_on::timestamptz, w.awarded_at))::int as year,
         pins_config(e.pins)->>'style' as style
    from player_awards w
    join events e on e.id = w.event_id
    join players p on p.id = w.player_id
    left join teams tm on tm.id = w.team_id;
grant select on public.team_pin_list, public.player_pin_list, public.player_award_list to anon, authenticated;

-- El jugador guarda sus destacados: modo y hasta 6 pines o premios suyos, en orden.
create function public.player_showcase_set(p_mode text, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_player uuid; v_n int;
begin
  select id into v_player from players where user_id = auth.uid();
  if v_player is null then raise exception 'Tu cuenta no tiene ficha de jugador' using errcode = '42501'; end if;
  if p_mode not in ('auto', 'manual') then raise exception 'El modo es auto o manual'; end if;
  if jsonb_typeof(coalesce(p_items, '[]')) <> 'array' or jsonb_array_length(coalesce(p_items, '[]')) > 6 then
    raise exception 'Hasta 6 destacados';
  end if;
  select count(*) into v_n
    from jsonb_array_elements(coalesce(p_items, '[]')) i
   where not ((i->>'kind' = 'pin' and exists (select 1 from player_pins where id = (i->>'id')::uuid and player_id = v_player))
           or (i->>'kind' = 'award' and exists (select 1 from player_awards where id = (i->>'id')::uuid and player_id = v_player)));
  if v_n > 0 then raise exception 'Solo podés destacar tus pines y premios'; end if;
  insert into player_showcase_prefs (player_id, mode) values (v_player, p_mode)
  on conflict (player_id) do update set mode = excluded.mode, updated_at = now();
  delete from player_showcase where player_id = v_player;
  insert into player_showcase (player_id, kind, ref_id, position)
  select v_player, i->>'kind', (i->>'id')::uuid, n::smallint
    from jsonb_array_elements(coalesce(p_items, '[]')) with ordinality x(i, n);
end $$;
revoke all on function public.player_showcase_set(text, jsonb) from public, anon;
grant execute on function public.player_showcase_set(text, jsonb) to authenticated;
comment on function public.player_showcase_set(text, jsonb) is
  'El jugador elige el modo de su vitrina y sus destacados: [{kind: pin | award, id}], hasta 6 (replanteo 123)';

-- Los logros (medallas) destacados del Resumen: como la vitrina, automáticos o elegidos por el jugador. Cada logro del
-- Resumen es un grupo de medallas con la misma definición, título y puesto (rank).
alter table public.player_showcase_prefs
  add column medals_mode text not null default 'auto' check (medals_mode in ('auto', 'manual'));
comment on column public.player_showcase_prefs.medals_mode is
  'Logros del Resumen: auto (los de más veces conseguidos) o manual (los que marcó, en player_medal_featured). Replanteo 123';

create table public.player_medal_featured (
  player_id     uuid not null references public.players(id) on delete cascade,
  definition_id uuid not null references public.medal_definitions(id) on delete cascade,
  title         text not null,
  rank          integer,
  position      smallint not null check (position between 1 and 10),
  unique (player_id, position)
);
create unique index player_medal_featured_uno on public.player_medal_featured (player_id, definition_id, title, coalesce(rank, -1));
comment on table public.player_medal_featured is 'Los logros que el jugador eligió para el Resumen, en orden (replanteo 123)';
alter table public.player_medal_featured enable row level security;
revoke all on public.player_medal_featured from anon, authenticated;
grant select on public.player_medal_featured to anon, authenticated;
create policy "logros destacados: ver" on public.player_medal_featured for select using (true);

create function public.player_medals_featured_set(p_mode text, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_player uuid; v_n int;
begin
  select id into v_player from players where user_id = auth.uid();
  if v_player is null then raise exception 'Tu cuenta no tiene ficha de jugador' using errcode = '42501'; end if;
  if p_mode not in ('auto', 'manual') then raise exception 'El modo es auto o manual'; end if;
  if jsonb_typeof(coalesce(p_items, '[]')) <> 'array' or jsonb_array_length(coalesce(p_items, '[]')) > 10 then
    raise exception 'Hasta 10 logros destacados';
  end if;
  select count(*) into v_n
    from jsonb_array_elements(coalesce(p_items, '[]')) i
   where not exists (select 1 from player_medals m
                      where m.player_id = v_player and m.definition_id = (i->>'definition_id')::uuid
                        and m.title = i->>'title' and m.rank is not distinct from (i->>'rank')::int);
  if v_n > 0 then raise exception 'Solo podés destacar tus logros'; end if;
  insert into player_showcase_prefs (player_id, medals_mode) values (v_player, p_mode)
  on conflict (player_id) do update set medals_mode = excluded.medals_mode, updated_at = now();
  delete from player_medal_featured where player_id = v_player;
  insert into player_medal_featured (player_id, definition_id, title, rank, position)
  select v_player, (i->>'definition_id')::uuid, i->>'title', (i->>'rank')::int, n::smallint
    from jsonb_array_elements(coalesce(p_items, '[]')) with ordinality x(i, n);
end $$;
revoke all on function public.player_medals_featured_set(text, jsonb) from public, anon;
grant execute on function public.player_medals_featured_set(text, jsonb) to authenticated;
comment on function public.player_medals_featured_set(text, jsonb) is
  'El jugador elige cómo se eligen sus logros del Resumen y cuáles: [{definition_id, title, rank}], hasta 10 (replanteo 123)';

-- =====================================================================================================
-- 9. Retroactivo: pines de los torneos terminados y reemplazo de las medallas de torneo
-- =====================================================================================================
set local cmleague.pins_quiet = 'on';
select event_pins_sync(id) from events where status = 'finished';
set local cmleague.pins_quiet = 'off';

-- Que nadie pierda nada: cada medalla de torneo tiene que tener su pin (de cualquier escalón) en ese torneo.
do $$
declare v_falta int; v_medallas int; v_pines int;
begin
  select count(*) into v_medallas from player_medals where source = 'event';
  select count(*) into v_falta
    from player_medals m
   where m.source = 'event'
     and not exists (select 1 from player_pins pp join team_pins t on t.id = pp.team_pin_id
                      where t.event_id = m.event_id and pp.player_id = m.player_id);
  if v_falta > 0 then
    raise exception 'replanteo 123: % medallas de torneo quedarían sin su pin', v_falta;
  end if;
  select count(*) into v_pines from player_pins;
  raise notice 'replanteo 123: % medallas de torneo pasan a pines; % pines de jugador en total', v_medallas, v_pines;
end $$;

-- Las medallas manuales adoptadas por la 114 se guardan aparte por si hay que volver atrás.
create table public.player_medals_123_respaldo as
  select * from public.player_medals where source = 'event';
comment on table public.player_medals_123_respaldo is
  'Las medallas de torneo (source = event) que la 123 reemplazó por pines, para la inversa. Se puede borrar después del 2026-12-15';
revoke all on public.player_medals_123_respaldo from anon, authenticated;
alter table public.player_medals_123_respaldo enable row level security;

delete from public.player_medals where source = 'event';

-- Las dos definiciones vuelven a ser manuales (como antes de la 114): lo automático ahora son los pines, y un admin
-- sigue pudiendo dar la medalla por un torneo de afuera de la plataforma (las que ya dio no se tocan).
alter table public.medal_definitions disable trigger medal_definitions_cambios;
update public.medal_definitions set metric = 'manual', aggregation = 'manual', filters = '{}', status = 'active', updated_at = now()
 where key in ('campeon_torneo', 'finalista_torneo');
alter table public.medal_definitions enable trigger medal_definitions_cambios;

commit;
