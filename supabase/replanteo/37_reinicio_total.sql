-- Replanteo 37: el reinicio de una temporada puede incluir a los que están debajo del piso
-- (plan docs/bitacora/2026-10-29-temporada-reinicio-total).
--   - season_config.reset_all y seasons.reset_all (false por defecto: como hasta ahora).
--   - season_reset_elo(elo, pct, piso, todos): con todos, la misma fórmula vale debajo del piso (suben hacia el piso).
--     Con 0 % todos quedan en el piso: el reinicio total.
--   - El cierre (elo_season_event, elo_season_event_key y season_close_run), season_start, las vistas
--     season_live_standings y season_list, y season_update, set_season_config, season_preview y
--     season_preview_summary (firma nueva, con p_reset_all) lo usan.
-- Necesita la 24 (temporadas), la 30 (rating y K/D en el cierre) y la 34 (elo_season_event_key).
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.seasons') is null or to_regprocedure('public.season_player_stats(timestamptz, timestamptz)') is null
     or to_regprocedure('public.elo_season_event_key(uuid, boolean, text)') is null then
    raise exception 'replanteo 37: faltan la 24, la 30 o la 34';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'seasons'
                                                          and column_name = 'reset_all') then
    raise exception 'replanteo 37: seasons.reset_all ya existe (¿ya se aplicó?)';
  end if;
end $$;

-- =====================================================================================================
-- 1. Columnas y fórmula
-- =====================================================================================================
alter table public.season_config add column reset_all boolean not null default false;
alter table public.seasons add column reset_all boolean not null default false;
comment on column public.season_config.reset_all is 'El reinicio incluye a los que están debajo del piso (con 0 %, todos al piso). Replanteo 37';
comment on column public.seasons.reset_all is 'El reinicio incluye a los que están debajo del piso (con 0 %, todos al piso). Replanteo 37';

-- Como la de 3 parámetros; con p_all, los que están debajo del piso también conservan el porcentaje de su distancia al piso.
create function public.season_reset_elo(p_elo integer, p_pct integer, p_floor integer, p_all boolean) returns integer
  language sql immutable as $$
  select case when p_elo > p_floor or p_all then p_floor + round((p_elo - p_floor) * p_pct / 100.0)::integer else p_elo end $$;

-- =====================================================================================================
-- 2. El cierre y la apertura
-- =====================================================================================================
create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 37: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.elo_season_event(uuid, boolean)', array[
  ['set elo = season_reset_elo(elo, s.reset_pct, s.reset_floor), updated_at = now() where elo > s.reset_floor;',
   'set elo = season_reset_elo(elo, s.reset_pct, s.reset_floor, s.reset_all), updated_at = now() where (elo > s.reset_floor or s.reset_all); -- (replanteo 37)']
]);
select pg_temp.reemplazar('public.elo_season_event_key(uuid, boolean, text)', array[
  ['set elo = season_reset_elo(elo, s.reset_pct, s.reset_floor), updated_at = now()',
   'set elo = season_reset_elo(elo, s.reset_pct, s.reset_floor, s.reset_all), updated_at = now()'],
  ['where steam_id = p_key and elo > s.reset_floor;',
   'where steam_id = p_key and (elo > s.reset_floor or s.reset_all); -- (replanteo 37)']
]);
select pg_temp.reemplazar('public.season_close_run(uuid, uuid)', array[
  ['season_reset_elo(r.elo, s.reset_pct, s.reset_floor), t.name',
   'season_reset_elo(r.elo, s.reset_pct, s.reset_floor, s.reset_all), t.name'],
  ['select count(*) into v_reset from player_elo where elo > s.reset_floor;',
   'select count(*) into v_reset from player_elo where elo > s.reset_floor or (s.reset_all and elo <> s.reset_floor); -- (replanteo 37)'],
  ['insert into seasons(number, name, starts_at, ends_at, top_n, min_matches, reset_pct, reset_floor, tiers, created_by)',
   'insert into seasons(number, name, starts_at, ends_at, top_n, min_matches, reset_pct, reset_floor, reset_all, tiers, created_by)'],
  ['cfg.top_n, cfg.min_matches, cfg.reset_pct, cfg.reset_floor, cfg.tiers, p_by)',
   'cfg.top_n, cfg.min_matches, cfg.reset_pct, cfg.reset_floor, cfg.reset_all, cfg.tiers, p_by)']
]);
select pg_temp.reemplazar('public.season_start(text, timestamptz)', array[
  ['insert into seasons(number, name, ends_at, top_n, min_matches, reset_pct, reset_floor, tiers, created_by)',
   'insert into seasons(number, name, ends_at, top_n, min_matches, reset_pct, reset_floor, reset_all, tiers, created_by)'],
  ['cfg.top_n, cfg.min_matches, cfg.reset_pct, cfg.reset_floor, cfg.tiers, auth.uid())',
   'cfg.top_n, cfg.min_matches, cfg.reset_pct, cfg.reset_floor, cfg.reset_all, cfg.tiers, auth.uid())']
]);

-- =====================================================================================================
-- 3. Vistas
-- =====================================================================================================
create or replace view public.season_live_standings with (security_invoker = true) as
select s.id as season_id, r.player_id, p.nick, coalesce(p.photo_url, d.avatar_url) as photo_url, r.rank, r.eligible,
       r.elo, r.peak_elo, r.matches, r.wins, r.losses, season_reset_elo(r.elo, s.reset_pct, s.reset_floor, s.reset_all) as elo_after,
       t.name as tier, t.icon, search_norm(p.nick) as search, ps.rating, ps.kd
  from seasons s
  cross join lateral season_rank(s.starts_at, now(), s.min_matches) r
  join players p on p.id = r.player_id
  left join profile_details d on d.user_id = p.user_id
  left join lateral season_tier(s.tiers, r.rank, s.top_n) t on true
  left join lateral season_player_stats(s.starts_at, now()) ps on ps.player_id = r.player_id
 where s.status = 'active';

create or replace view public.season_list with (security_invoker = true) as
select s.id, s.number, s.name, s.status, s.starts_at, s.ends_at, s.closed_at, s.top_n, s.min_matches, s.reset_pct,
       s.reset_floor, s.tiers, ch.player_id as champion_id, cp.nick as champion_nick,
       (select count(*) from player_medals pm where pm.season_id = s.id)::integer as medals,
       s.reset_all
  from seasons s
  left join season_standings ch on ch.season_id = s.id and ch.rank = 1
  left join players cp on cp.id = ch.player_id;

-- =====================================================================================================
-- 4. Funciones del admin con p_reset_all (firma nueva)
-- =====================================================================================================
drop function public.season_update(uuid, text, timestamptz, integer, integer, integer, integer, jsonb);
drop function public.set_season_config(integer, integer, integer, integer, integer, jsonb);
drop function public.season_preview_summary(integer, integer, integer, integer);
drop function public.season_preview(integer, integer, integer, integer);

-- Admin: cambia la temporada activa. Lo que llega en null no cambia.
create function public.season_update(p_id uuid, p_name text default null, p_ends_at timestamptz default null,
                                     p_top_n integer default null, p_min_matches integer default null,
                                     p_reset_pct integer default null, p_reset_floor integer default null,
                                     p_tiers jsonb default null, p_reset_all boolean default null) returns void
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
         reset_floor = coalesce(p_reset_floor, reset_floor), tiers = coalesce(p_tiers, tiers),
         reset_all = coalesce(p_reset_all, reset_all)
   where id = p_id;
end $$;

-- Admin: valores por defecto de la próxima temporada.
create function public.set_season_config(p_duration_days integer, p_top_n integer, p_min_matches integer,
                                         p_reset_pct integer, p_reset_floor integer, p_tiers jsonb,
                                         p_reset_all boolean default false) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin puede cambiar la configuración de las temporadas' using errcode = '42501'; end if;
  if p_duration_days is null or p_duration_days not between 1 and 365 then
    raise exception 'La duración tiene que estar entre 1 y 365 días'; end if;
  perform season_check(p_top_n, p_min_matches, p_reset_pct, p_reset_floor, p_tiers);
  update season_config
     set duration_days = p_duration_days, top_n = p_top_n, min_matches = p_min_matches, reset_pct = p_reset_pct,
         reset_floor = p_reset_floor, reset_all = coalesce(p_reset_all, false), tiers = p_tiers,
         updated_at = now(), updated_by = auth.uid()
   where id = 1;
end $$;

-- Cómo quedaría el cierre de la temporada activa si fuera ahora con esos valores (los tramos son los de la activa).
-- Sin temporada activa: los mixes desde el último cierre (o todos) y los tramos de season_config.
-- reset: a quién le cambia el ELO el reinicio (sin p_reset_all, los que están sobre el piso).
create function public.season_preview(p_top_n integer, p_min_matches integer, p_reset_pct integer, p_reset_floor integer,
                                      p_reset_all boolean default false)
  returns table(player_id uuid, nick text, rank integer, eligible boolean, elo integer, matches integer,
                tier text, icon text, elo_after integer, reset boolean, search text)
  language plpgsql stable security definer set search_path = public as $$
declare
  v_from  timestamptz;
  v_tiers jsonb;
  v_all   boolean := coalesce(p_reset_all, false);
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
         season_reset_elo(r.elo, p_reset_pct, p_reset_floor, v_all),
         r.elo > p_reset_floor or (v_all and r.elo <> p_reset_floor), search_norm(p.nick)
    from season_rank(v_from, now(), p_min_matches) r
    join players p on p.id = r.player_id
    left join lateral season_tier(v_tiers, r.rank, p_top_n) t on true;
end $$;

-- Resumen de la vista previa: cuántos llegan al mínimo, cuántas medallas y cuánto bajan los que se reinician
-- (con p_reset_all, los que estaban debajo del piso suben: avg_drop puede ser negativo).
create function public.season_preview_summary(p_top_n integer, p_min_matches integer, p_reset_pct integer, p_reset_floor integer,
                                              p_reset_all boolean default false)
  returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
           'players', count(*),
           'eligible', count(*) filter (where eligible),
           'medals', count(*) filter (where tier is not null),
           'reset', count(*) filter (where reset),
           'avg_drop', coalesce(round(avg(elo - elo_after) filter (where reset), 1), 0),
           'max_drop', coalesce(max(elo - elo_after) filter (where reset), 0))
    from season_preview(p_top_n, p_min_matches, p_reset_pct, p_reset_floor, p_reset_all) $$;

revoke all on function public.season_update(uuid, text, timestamptz, integer, integer, integer, integer, jsonb, boolean),
  public.set_season_config(integer, integer, integer, integer, integer, jsonb, boolean),
  public.season_preview(integer, integer, integer, integer, boolean), public.season_preview_summary(integer, integer, integer, integer, boolean)
  from public, anon;
grant execute on function public.season_update(uuid, text, timestamptz, integer, integer, integer, integer, jsonb, boolean),
  public.set_season_config(integer, integer, integer, integer, integer, jsonb, boolean),
  public.season_preview(integer, integer, integer, integer, boolean), public.season_preview_summary(integer, integer, integer, integer, boolean)
  to authenticated;

notify pgrst, 'reload schema';

commit;
