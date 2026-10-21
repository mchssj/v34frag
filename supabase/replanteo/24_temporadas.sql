-- Replanteo 24: temporadas (plan docs/bitacora/2026-10-20-temporadas).
--   - Una temporada activa a la vez. Al cerrarse (cron del VPS al llegar la fecha, o el botón del admin) se guarda la
--     foto del ranking final, el top N con el mínimo de mixes recibe medallas por tramo, los nivel 10 se reinician
--     (nuevo = piso + redondeo((ELO − piso) × porcentaje)) y se abre la siguiente.
--   - El cierre es un evento en la línea de tiempo del ELO, como los ajustes: elo_recompute_all lo vuelve a aplicar
--     con los parámetros de esa temporada. Al empezar cada temporada el ELO pico arranca en el ELO actual.
--   - Un mix con fecha anterior al último cierre (llegó tarde) recalcula todo, para que el reinicio quede después.
--   - Fecha de fin por defecto: las 06:00 de Argentina del día de fin (duración en días, 30 al principio).
-- Necesita la 22 y la migración de mixes en vivo (live_matches).
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regprocedure('public.cancel_steam_unlink(text)') is null then
    raise exception 'replanteo 24: falta cancel_steam_unlink (aplicar antes 22_cancelar_desvincular_password.sql)';
  end if;
  if to_regclass('public.live_matches') is null then
    raise exception 'replanteo 24: falta live_matches (aplicar antes supabase/migrations/20261017120000_mixes_en_vivo.sql)';
  end if;
  if to_regclass('public.seasons') is not null then
    raise exception 'replanteo 24: seasons ya existe (¿ya se aplicó?)';
  end if;
end $$;

-- =====================================================================================================
-- 1. Reglas: tramos de medallas, reinicio y fecha de fin
-- =====================================================================================================
-- Tramos: [{from, to, name, icon}] en orden, desde el puesto 1 y sin huecos; el último no tiene `to` (llega hasta el
-- top N). En `name`, {top} se reemplaza por el top N ("Top {top}" → "Top 20").
create function public.season_tiers_ok(p jsonb) returns boolean language plpgsql immutable as $$
declare
  t      jsonb;
  v_next integer := 1;
  v_open boolean := false;
begin
  if p is null or jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p) not between 1 and 20 then return false; end if;
  for t in select value from jsonb_array_elements(p) loop
    if v_open then return false; end if;   -- después del tramo abierto no puede haber otro
    if jsonb_typeof(t) is distinct from 'object'
       or exists (select 1 from jsonb_object_keys(t) k where k not in ('from', 'to', 'name', 'icon'))
       or jsonb_typeof(t->'from') is distinct from 'number' or (t->>'from')::numeric is distinct from v_next
       or jsonb_typeof(t->'name') is distinct from 'string' or length(btrim(t->>'name')) not between 1 and 40
       or jsonb_typeof(t->'icon') is distinct from 'string' or length(btrim(t->>'icon')) not between 1 and 8 then
      return false;
    end if;
    if coalesce(jsonb_typeof(t->'to'), 'null') = 'null' then
      v_open := true;
    elsif jsonb_typeof(t->'to') <> 'number' or (t->>'to')::numeric <> trunc((t->>'to')::numeric) or (t->>'to')::numeric < v_next then
      return false;
    else
      v_next := (t->>'to')::integer + 1;
    end if;
  end loop;
  return v_open;
end $$;

-- Medalla de un puesto: el tramo que lo contiene, si está dentro del top N.
create function public.season_tier(p_tiers jsonb, p_rank integer, p_top_n integer)
  returns table(name text, icon text) language sql immutable as $$
  select replace(t->>'name', '{top}', p_top_n::text), t->>'icon'
    from jsonb_array_elements(p_tiers) t
   where p_rank is not null and p_rank <= p_top_n
     and p_rank >= (t->>'from')::integer and p_rank <= coalesce((t->>'to')::integer, p_top_n)
   limit 1 $$;

-- ELO después del reinicio: conserva el porcentaje de lo que tenía sobre el piso. Debajo del piso no cambia.
create function public.season_reset_elo(p_elo integer, p_pct integer, p_floor integer) returns integer language sql immutable as $$
  select case when p_elo > p_floor then p_floor + round((p_elo - p_floor) * p_pct / 100.0)::integer else p_elo end $$;

-- Fin por defecto: las 06:00 de Argentina (la mayoría de los jugadores) del día de inicio + p_days.
create function public.season_default_end(p_from timestamptz, p_days integer) returns timestamptz language sql stable as $$
  select (((p_from at time zone 'America/Argentina/Buenos_Aires')::date + p_days) + time '06:00') at time zone 'America/Argentina/Buenos_Aires' $$;

-- Valida los parámetros de un cierre (los mismos rangos que las restricciones de las tablas, con mensajes claros).
create function public.season_check(p_top_n integer, p_min_matches integer, p_reset_pct integer, p_reset_floor integer,
                                    p_tiers jsonb default '[{"from":1,"name":"x","icon":"x"}]') returns void
  language plpgsql immutable as $$
begin
  if p_top_n is null or p_top_n not between 1 and 500 then
    raise exception 'El top tiene que estar entre 1 y 500'; end if;
  if p_min_matches is null or p_min_matches not between 1 and 1000 then
    raise exception 'El mínimo de mixes tiene que estar entre 1 y 1000'; end if;
  if p_reset_pct is null or p_reset_pct not between 0 and 100 then
    raise exception 'El porcentaje del reinicio tiene que estar entre 0 y 100'; end if;
  if p_reset_floor is null or p_reset_floor not between 0 and 10000 then
    raise exception 'El piso del reinicio tiene que estar entre 0 y 10000'; end if;
  if not season_tiers_ok(p_tiers) then
    raise exception 'Los tramos de medallas no son válidos: en orden desde el puesto 1, sin huecos, y el último sin "hasta"';
  end if;
end $$;

-- =====================================================================================================
-- 2. Tablas
-- =====================================================================================================
create table public.season_config (
  id            smallint primary key default 1 check (id = 1),
  duration_days integer not null default 30 check (duration_days between 1 and 365),
  top_n         integer not null default 20 check (top_n between 1 and 500),
  min_matches   integer not null default 20 check (min_matches between 1 and 1000),
  reset_pct     integer not null default 10 check (reset_pct between 0 and 100),
  reset_floor   integer not null default 2001 check (reset_floor between 0 and 10000),
  tiers         jsonb not null default '[{"from":1,"to":1,"name":"Campeón","icon":"🏆"},{"from":2,"to":2,"name":"Subcampeón","icon":"🥈"},{"from":3,"to":3,"name":"Tercer puesto","icon":"🥉"},{"from":4,"to":10,"name":"Top 10","icon":"🎖️"},{"from":11,"to":null,"name":"Top {top}","icon":"🏅"}]'
                check (season_tiers_ok(tiers)),
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);
insert into public.season_config(id) values (1);
comment on table public.season_config is 'Valores por defecto de la próxima temporada (una fila). Cada temporada copia los suyos al abrirse';

create table public.seasons (
  id          uuid primary key default gen_random_uuid(),
  number      integer not null unique check (number >= 1),
  name        text not null check (length(btrim(name)) between 1 and 60),
  status      text not null default 'active' check (status in ('active', 'closed')),
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,                -- fin planeado; el cierre real es closed_at
  closed_at   timestamptz,
  closed_by   uuid,                                -- null = el cron
  top_n       integer not null check (top_n between 1 and 500),
  min_matches integer not null check (min_matches between 1 and 1000),
  reset_pct   integer not null check (reset_pct between 0 and 100),
  reset_floor integer not null check (reset_floor between 0 and 10000),
  tiers       jsonb not null check (season_tiers_ok(tiers)),
  created_at  timestamptz not null default now(),
  created_by  uuid,
  check (ends_at > starts_at),
  check ((status = 'closed') = (closed_at is not null)),
  check (closed_at is null or closed_at >= starts_at)
);
create unique index seasons_una_activa on public.seasons ((true)) where status = 'active';
comment on table public.seasons is 'Temporadas. Los parámetros del cierre (top, mínimo, reinicio y tramos) quedan congelados al cerrarse';

create table public.season_standings (
  season_id  uuid not null references public.seasons(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  rank       integer check (rank >= 1),           -- null: no llegó al mínimo de mixes
  eligible   boolean not null,
  elo        integer not null,
  peak_elo   integer not null,
  matches    integer not null,
  wins       integer not null,
  losses     integer not null,
  elo_after  integer not null,                     -- después del reinicio
  tier       text,                                 -- medalla (null: sin medalla)
  icon       text,
  primary key (season_id, player_id)
);
create index season_standings_rank on public.season_standings (season_id, rank);
comment on table public.season_standings is 'Foto del ranking al cerrar cada temporada. Un recálculo posterior del ELO no la cambia';

alter table public.player_medals
  add column season_id uuid references public.seasons(id) on delete cascade,
  add column rank integer,
  add column tier text,
  add constraint player_medals_temporada check ((season_id is null) = (rank is null) and (season_id is null) = (tier is null));
create index player_medals_season on public.player_medals (season_id) where season_id is not null;

alter table public.season_config enable row level security;
alter table public.seasons enable row level security;
alter table public.season_standings enable row level security;
create policy "season_config: todos ven" on public.season_config for select using (true);
create policy "seasons: todos ven" on public.seasons for select using (true);
create policy "season_standings: todos ven" on public.season_standings for select using (true);
revoke all on public.season_config, public.seasons, public.season_standings from anon, authenticated;
grant select on public.season_config, public.seasons, public.season_standings to anon, authenticated;

-- =====================================================================================================
-- 3. Ranking de una temporada
-- =====================================================================================================
-- Fichas con ELO, con sus mixes entre p_from (sin incluir) y p_until (incluido). Cuentan los mixes terminados que le
-- movieron el ELO (los interrumpidos aprobados también). Puesto entre los que llegan al mínimo: ELO, después más
-- mixes, después quien llegó antes a ese ELO (su último mix o ajuste de la temporada).
create function public.season_rank(p_from timestamptz, p_until timestamptz, p_min_matches integer)
  returns table(player_id uuid, elo integer, peak_elo integer, matches integer, wins integer, losses integer,
                last_at timestamptz, eligible boolean, rank integer)
  language sql stable set search_path = public as $$
  with mix as (
    select x.player_id,
           count(distinct ps.match_id)::integer as matches,
           count(distinct ps.match_id) filter (where ps.team = m.winner_side)::integer as wins,
           count(distinct ps.match_id) filter (where m.winner_side is not null and ps.team <> m.winner_side)::integer as losses,
           max(coalesce(m.played_at, m.starts_at)) as last_at
      from match_player_stats ps
      join matches m on m.id = ps.match_id
      join player_steam_all x on x.steam_id = ps.steam_id
     where m.kind = 'mix' and m.status = 'finished' and ps.elo_after is not null
       and coalesce(m.played_at, m.starts_at) > p_from and coalesce(m.played_at, m.starts_at) <= p_until
     group by x.player_id
  ), aju as (
    select x.player_id, max(a.applied_at) as last_at
      from elo_adjustments a join player_steam_all x on x.steam_id = a.steam_id
     where a.applied_at > p_from and a.applied_at <= p_until
     group by x.player_id
  ), t as (
    select p.id, e.elo, e.peak_elo, coalesce(mx.matches, 0) as matches, coalesce(mx.wins, 0) as wins,
           coalesce(mx.losses, 0) as losses, greatest(mx.last_at, aj.last_at) as last_at,
           coalesce(mx.matches, 0) >= p_min_matches as eligible
      from players p
      join player_elo e on e.steam_id = p.steam_id
      left join mix mx on mx.player_id = p.id
      left join aju aj on aj.player_id = p.id
  )
  select id, elo, peak_elo, matches, wins, losses, last_at, eligible,
         case when eligible then (row_number() over (partition by eligible order by elo desc, matches desc, last_at nulls last, id))::integer end
    from t $$;

-- Ranking en vivo de la temporada activa (con la medalla y el ELO después del reinicio si cerrara ahora).
create view public.season_live_standings with (security_invoker = true) as
select s.id as season_id, r.player_id, p.nick, coalesce(p.photo_url, d.avatar_url) as photo_url, r.rank, r.eligible,
       r.elo, r.peak_elo, r.matches, r.wins, r.losses, season_reset_elo(r.elo, s.reset_pct, s.reset_floor) as elo_after,
       t.name as tier, t.icon, search_norm(p.nick) as search
  from seasons s
  cross join lateral season_rank(s.starts_at, now(), s.min_matches) r
  join players p on p.id = r.player_id
  left join profile_details d on d.user_id = p.user_id
  left join lateral season_tier(s.tiers, r.rank, s.top_n) t on true
 where s.status = 'active';
comment on view public.season_live_standings is 'Ranking en vivo de la temporada activa';

-- Ranking de cualquier temporada: la foto si está cerrada, en vivo si está activa.
create view public.season_standings_list with (security_invoker = true) as
select st.season_id, st.player_id, p.nick, coalesce(p.photo_url, d.avatar_url) as photo_url, st.rank, st.eligible,
       st.elo, st.peak_elo, st.matches, st.wins, st.losses, st.elo_after, st.tier, st.icon, search_norm(p.nick) as search
  from season_standings st
  join players p on p.id = st.player_id
  left join profile_details d on d.user_id = p.user_id
union all
select * from season_live_standings;
comment on view public.season_standings_list is 'Ranking por temporada: la foto de las cerradas y el ranking en vivo de la activa';

create view public.season_list with (security_invoker = true) as
select s.id, s.number, s.name, s.status, s.starts_at, s.ends_at, s.closed_at, s.top_n, s.min_matches, s.reset_pct,
       s.reset_floor, s.tiers, ch.player_id as champion_id, cp.nick as champion_nick,
       (select count(*) from player_medals pm where pm.season_id = s.id)::integer as medals
  from seasons s
  left join season_standings ch on ch.season_id = s.id and ch.rank = 1
  left join players cp on cp.id = ch.player_id;
comment on view public.season_list is 'Temporadas con su estado, fechas, parámetros, campeón y cantidad de medallas';

-- Historial de un jugador: su puesto en cada temporada cerrada.
create view public.player_season_list with (security_invoker = true) as
select st.player_id, s.id as season_id, s.number, s.name, st.rank, st.eligible, st.elo, st.peak_elo, st.matches, st.wins,
       st.losses, st.elo_after, st.tier, st.icon
  from season_standings st
  join seasons s on s.id = st.season_id;
comment on view public.player_season_list is 'Puesto, ELO, pico, mixes y medalla de cada jugador en cada temporada cerrada';

grant select on public.season_live_standings, public.season_standings_list, public.season_list, public.player_season_list
  to anon, authenticated;

-- =====================================================================================================
-- 4. El ELO: cierre y comienzo como eventos en la línea de tiempo
-- =====================================================================================================
-- Cierre: reinicia a los nivel 10 con los parámetros de la temporada. Cierre y comienzo: el pico arranca en el ELO.
create function public.elo_season_event(p_season uuid, p_close boolean) returns void
  language plpgsql security definer set search_path = public as $$
declare s seasons%rowtype;
begin
  select * into s from seasons where id = p_season;
  if p_close then
    update player_elo set elo = season_reset_elo(elo, s.reset_pct, s.reset_floor), updated_at = now() where elo > s.reset_floor;
  end if;
  update player_elo set peak_elo = elo, updated_at = now() where peak_elo is distinct from elo;
end $$;
revoke all on function public.elo_season_event(uuid, boolean) from public, anon, authenticated;

-- Igual que en 20261015210000_elo_ajustes.sql, más los cierres (después de los mixes de la misma hora) y los
-- comienzos de temporada. v34.elo_recompute avisa a elo_apply_match que el mix se aplica dentro del recálculo.
create or replace function public.elo_recompute_all()
returns integer language plpgsql security definer set search_path = public as $$
declare
  ev record;
  n  integer := 0;
begin
  -- Desde la web solo un admin; desde el SQL Editor no hay usuario.
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede recalcular el ELO' using errcode = '42501';
  end if;
  lock table player_elo in exclusive mode;   -- espera a los envíos en curso y frena los nuevos hasta terminar
  perform set_config('v34.elo_recompute', 'on', true);

  delete from player_elo where true;
  update match_player_stats set elo_before = null, elo_after = null, elo_delta = null, win_prob = null
   where elo_after is not null or win_prob is not null;

  for ev in
    select * from (
      select coalesce(played_at, starts_at) at, 1 k, id mid, null::bigint aid, null::text steam_id, null::integer delta, null::uuid sid
        from matches where kind = 'mix' and status = 'finished'
      union all
      select applied_at, 0, null, id, steam_id, delta, null from elo_adjustments
      union all
      select closed_at, 2, null, null, null, null, id from seasons where status = 'closed'
      union all
      select starts_at, 3, null, null, null, null, id from seasons
    ) e
    order by e.at, e.k, e.mid, e.aid, e.sid
  loop
    if ev.k = 1 then
      perform elo_apply_match(ev.mid);
      n := n + 1;
    elsif ev.k = 0 then
      perform elo_apply_adjustment(ev.steam_id, ev.delta);
    else
      perform elo_season_event(ev.sid, ev.k = 2);
    end if;
  end loop;
  perform set_config('v34.elo_recompute', 'off', true);
  return n;
end $$;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 24: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- Un mix con fecha anterior a un cierre o comienzo de temporada (llegó tarde, o se aprobó después) recalcula todo.
select pg_temp.reemplazar('public.elo_apply_match(uuid)', array[
  [E'  if exists (select 1 from match_player_stats where match_id = p_match and elo_after is not null) then return; end if;\n',
   E'  if exists (select 1 from match_player_stats where match_id = p_match and elo_after is not null) then return; end if;\n' ||
   E'  -- (replanteo 24) anterior a un cierre de temporada: recalcula todo, para que el reinicio quede después del mix\n' ||
   E'  if current_setting(''v34.elo_recompute'', true) is distinct from ''on''\n' ||
   E'     and exists (select 1 from seasons s, matches x\n' ||
   E'                  where x.id = p_match and coalesce(s.closed_at, s.starts_at) >= coalesce(x.played_at, x.starts_at)) then\n' ||
   E'    perform elo_recompute_all();\n' ||
   E'    return;\n' ||
   E'  end if;\n']
]);

-- =====================================================================================================
-- 5. Abrir, cambiar y cerrar
-- =====================================================================================================
-- Admin: abre la primera temporada (o la siguiente, si no hay ninguna activa) con los valores de season_config.
create function public.season_start(p_name text default null, p_ends_at timestamptz default null) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  cfg  season_config%rowtype;
  v_n  integer;
  v_id uuid;
begin
  if not is_admin() then raise exception 'Solo un admin puede abrir una temporada' using errcode = '42501'; end if;
  lock table player_elo in exclusive mode;
  if exists (select 1 from seasons where status = 'active') then
    raise exception 'Ya hay una temporada activa' using errcode = '23505';
  end if;
  if p_ends_at is not null and p_ends_at <= now() then
    raise exception 'La fecha de fin tiene que ser futura';
  end if;
  select * into cfg from season_config where id = 1;
  select coalesce(max(number), 0) + 1 into v_n from seasons;
  insert into seasons(number, name, ends_at, top_n, min_matches, reset_pct, reset_floor, tiers, created_by)
  values (v_n, coalesce(nullif(btrim(p_name), ''), 'Temporada ' || v_n), coalesce(p_ends_at, season_default_end(now(), cfg.duration_days)),
          cfg.top_n, cfg.min_matches, cfg.reset_pct, cfg.reset_floor, cfg.tiers, auth.uid())
  returning id into v_id;
  perform elo_season_event(v_id, false);
  return v_id;
end $$;

-- Admin: cambia la temporada activa. Lo que llega en null no cambia.
create function public.season_update(p_id uuid, p_name text default null, p_ends_at timestamptz default null,
                                     p_top_n integer default null, p_min_matches integer default null,
                                     p_reset_pct integer default null, p_reset_floor integer default null,
                                     p_tiers jsonb default null) returns void
  language plpgsql security definer set search_path = public as $$
declare s seasons%rowtype;
begin
  if not is_admin() then raise exception 'Solo un admin puede cambiar una temporada' using errcode = '42501'; end if;
  select * into s from seasons where id = p_id for update;
  if s.id is null then raise exception 'No existe esa temporada' using errcode = 'P0002'; end if;
  if s.status <> 'active' then raise exception 'Una temporada cerrada no se puede cambiar'; end if;
  if p_name is not null and length(btrim(p_name)) not between 1 and 60 then
    raise exception 'El nombre tiene entre 1 y 60 caracteres'; end if;
  if p_ends_at is not null and p_ends_at <= now() then
    raise exception 'La fecha de fin tiene que ser futura (para terminarla ya, "Terminar temporada")'; end if;
  perform season_check(coalesce(p_top_n, s.top_n), coalesce(p_min_matches, s.min_matches), coalesce(p_reset_pct, s.reset_pct),
                       coalesce(p_reset_floor, s.reset_floor), coalesce(p_tiers, s.tiers));
  update seasons
     set name = coalesce(btrim(p_name), name), ends_at = coalesce(p_ends_at, ends_at), top_n = coalesce(p_top_n, top_n),
         min_matches = coalesce(p_min_matches, min_matches), reset_pct = coalesce(p_reset_pct, reset_pct),
         reset_floor = coalesce(p_reset_floor, reset_floor), tiers = coalesce(p_tiers, tiers)
   where id = p_id;
end $$;

-- Admin: valores por defecto de la próxima temporada.
create function public.set_season_config(p_duration_days integer, p_top_n integer, p_min_matches integer,
                                         p_reset_pct integer, p_reset_floor integer, p_tiers jsonb) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin puede cambiar la configuración de las temporadas' using errcode = '42501'; end if;
  if p_duration_days is null or p_duration_days not between 1 and 365 then
    raise exception 'La duración tiene que estar entre 1 y 365 días'; end if;
  perform season_check(p_top_n, p_min_matches, p_reset_pct, p_reset_floor, p_tiers);
  update season_config
     set duration_days = p_duration_days, top_n = p_top_n, min_matches = p_min_matches, reset_pct = p_reset_pct,
         reset_floor = p_reset_floor, tiers = p_tiers, updated_at = now(), updated_by = auth.uid()
   where id = 1;
end $$;

-- El cierre completo (interno): foto, medallas, reinicio y la temporada siguiente. p_by null = el cron.
create function public.season_close_run(p_season uuid, p_by uuid) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  s        seasons%rowtype;
  cfg      season_config%rowtype;
  v_at     timestamptz := now();
  v_next   uuid;
  v_medals integer;
  v_reset  integer;
begin
  lock table player_elo in exclusive mode;   -- frena la ingesta y los recálculos hasta terminar
  select * into s from seasons where id = p_season for update;
  if s.id is null then raise exception 'No existe esa temporada' using errcode = 'P0002'; end if;
  if s.status <> 'active' then raise exception 'Esa temporada ya está cerrada'; end if;

  insert into season_standings(season_id, player_id, rank, eligible, elo, peak_elo, matches, wins, losses, elo_after, tier, icon)
  select s.id, r.player_id, r.rank, r.eligible, r.elo, r.peak_elo, r.matches, r.wins, r.losses,
         season_reset_elo(r.elo, s.reset_pct, s.reset_floor), t.name, t.icon
    from season_rank(s.starts_at, v_at, s.min_matches) r
    left join lateral season_tier(s.tiers, r.rank, s.top_n) t on true;

  insert into player_medals(player_id, title, icon, season_id, rank, tier)
  select player_id, s.name || ' · #' || rank, icon, s.id, rank, tier
    from season_standings where season_id = s.id and tier is not null;
  get diagnostics v_medals = row_count;

  select count(*) into v_reset from player_elo where elo > s.reset_floor;
  update seasons set status = 'closed', closed_at = v_at, closed_by = p_by where id = s.id;
  perform elo_season_event(s.id, true);

  select * into cfg from season_config where id = 1;
  insert into seasons(number, name, starts_at, ends_at, top_n, min_matches, reset_pct, reset_floor, tiers, created_by)
  values (s.number + 1, 'Temporada ' || (s.number + 1), v_at, season_default_end(v_at, cfg.duration_days),
          cfg.top_n, cfg.min_matches, cfg.reset_pct, cfg.reset_floor, cfg.tiers, p_by)
  returning id into v_next;

  return jsonb_build_object('season_id', s.id, 'next_season_id', v_next, 'medals', v_medals, 'reset', v_reset, 'closed_at', v_at);
end $$;
revoke all on function public.season_close_run(uuid, uuid) from public, anon, authenticated;

-- Admin: "Terminar temporada", con la doble confirmación.
create function public.season_close(p_id uuid, p_confirm text) returns jsonb
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin puede terminar una temporada' using errcode = '42501'; end if;
  if lower(btrim(coalesce(p_confirm, ''))) <> 'estoy seguro' then
    raise exception 'Para terminar la temporada, escribe "estoy seguro"';
  end if;
  return season_close_run(p_id, auth.uid());
end $$;

-- Cron del VPS (solo service_role): cierra la activa si venció. Con un mix en vivo espera, hasta 6 horas.
create function public.season_close_due() returns jsonb
  language plpgsql security definer set search_path = public as $$
declare s seasons%rowtype;
begin
  select * into s from seasons where status = 'active';
  if s.id is null then return jsonb_build_object('closed', false, 'reason', 'no_season'); end if;
  if s.ends_at > now() then return jsonb_build_object('closed', false, 'reason', 'not_due', 'season_id', s.id, 'ends_at', s.ends_at); end if;
  if now() < s.ends_at + interval '6 hours' and exists (select 1 from live_matches where updated_at > now() - interval '10 minutes') then
    return jsonb_build_object('closed', false, 'reason', 'live_match', 'season_id', s.id, 'ends_at', s.ends_at);
  end if;
  return jsonb_build_object('closed', true) || season_close_run(s.id, null);
end $$;

-- =====================================================================================================
-- 6. Vista previa del cierre (admin)
-- =====================================================================================================
-- Cómo quedaría el cierre de la temporada activa si fuera ahora con esos valores (los tramos son los de la activa).
-- Sin temporada activa: los mixes desde el último cierre (o todos) y los tramos de season_config.
create function public.season_preview(p_top_n integer, p_min_matches integer, p_reset_pct integer, p_reset_floor integer)
  returns table(player_id uuid, nick text, rank integer, eligible boolean, elo integer, matches integer,
                tier text, icon text, elo_after integer, reset boolean, search text)
  language plpgsql stable security definer set search_path = public as $$
declare
  v_from  timestamptz;
  v_tiers jsonb;
begin
  if not is_admin() then raise exception 'Solo un admin puede ver la vista previa del cierre' using errcode = '42501'; end if;
  perform season_check(p_top_n, p_min_matches, p_reset_pct, p_reset_floor);
  select s.starts_at, s.tiers into v_from, v_tiers from seasons s where s.status = 'active';
  if v_tiers is null then
    select coalesce(max(closed_at), '-infinity') into v_from from seasons;
    select c.tiers into v_tiers from season_config c where c.id = 1;
  end if;
  return query
  select r.player_id, p.nick, r.rank, r.eligible, r.elo, r.matches, t.name, t.icon,
         season_reset_elo(r.elo, p_reset_pct, p_reset_floor), r.elo > p_reset_floor, search_norm(p.nick)
    from season_rank(v_from, now(), p_min_matches) r
    join players p on p.id = r.player_id
    left join lateral season_tier(v_tiers, r.rank, p_top_n) t on true;
end $$;

-- Resumen de la vista previa: cuántos llegan al mínimo, cuántas medallas y cuánto bajan los nivel 10.
create function public.season_preview_summary(p_top_n integer, p_min_matches integer, p_reset_pct integer, p_reset_floor integer)
  returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
           'players', count(*),
           'eligible', count(*) filter (where eligible),
           'medals', count(*) filter (where tier is not null),
           'reset', count(*) filter (where reset),
           'avg_drop', coalesce(round(avg(elo - elo_after) filter (where reset), 1), 0),
           'max_drop', coalesce(max(elo - elo_after) filter (where reset), 0))
    from season_preview(p_top_n, p_min_matches, p_reset_pct, p_reset_floor) $$;

revoke all on function public.season_start(text, timestamptz), public.season_update(uuid, text, timestamptz, integer, integer, integer, integer, jsonb),
  public.set_season_config(integer, integer, integer, integer, integer, jsonb), public.season_close(uuid, text),
  public.season_preview(integer, integer, integer, integer), public.season_preview_summary(integer, integer, integer, integer)
  from public, anon;
grant execute on function public.season_start(text, timestamptz), public.season_update(uuid, text, timestamptz, integer, integer, integer, integer, jsonb),
  public.set_season_config(integer, integer, integer, integer, integer, jsonb), public.season_close(uuid, text),
  public.season_preview(integer, integer, integer, integer), public.season_preview_summary(integer, integer, integer, integer)
  to authenticated;
revoke all on function public.season_close_due() from public, anon, authenticated;
grant execute on function public.season_close_due() to service_role;

commit;
