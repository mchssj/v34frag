-- 79: medallas configurables (plan docs/bitacora/2026-11-04-medallas-configurables/PLAN.md, secciones 4 y 8).
--
-- - medal_definitions: cada medalla es una plantilla (un SVG de Kyan, del manifiesto web/frontend/src/features/medals/
--   templates.json) con un objetivo, una condición (métrica, agregación y filtros) y lo que la plantilla deja cambiar
--   del dibujo (`design`: número, etiqueta, banda, metal y acento).
-- - El motor: un trigger anota en medal_queue a los jugadores de cada partida guardada y medals_evaluate_pending()
--   (cron del VPS, pnpm medals:tick) les da las medallas activas que ya cumplen. Si el motor falla, el mix se guarda igual.
-- - Temporadas sin emoji: cada tramo lleva `definition`, la clave de una definición de temporada.
-- - Las medallas viejas con emoji (las que dio un admin a mano) pasan a la definición manual «Campeón de torneo».
-- Va después de la 78. Necesita la 24 (temporadas), la 27 (mix_list), la 28 (avisos), la 37 (cierre) y match_player_extra (20261029210000).
-- Inversa: docs/bitacora/2026-11-04-medallas-configurables/pruebas/79_inversa.sql.
begin;

do $$
begin
  if to_regclass('public.medal_definitions') is not null then
    raise exception 'replanteo 79: medal_definitions ya existe (¿ya se aplicó?)';
  end if;
  if to_regclass('public.seasons') is null or to_regclass('public.match_player_extra') is null
     or to_regprocedure('public.tg_notify_player_medals()') is null or to_regclass('public.mix_list') is null then
    raise exception 'replanteo 79: faltan la 24, la 27, la 28 o la migración de match_player_extra';
  end if;
end $$;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 79: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- =====================================================================================================
-- 1. Definiciones
-- =====================================================================================================
create table public.medal_definitions (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique check (key ~ '^[a-z0-9_]{2,60}$'),
  template     text not null check (template ~ '^[a-z0-9_]{2,40}$'),
  scope        text not null default 'player' check (scope in ('player', 'team')),
  title        text not null check (length(btrim(title)) between 1 and 80),
  description  text check (length(btrim(description)) between 1 and 200),
  design       jsonb not null default '{}'::jsonb,
  metric       text not null check (metric ~ '^[a-z0-9_]{2,40}$'),
  aggregation  text not null check (aggregation in ('total', 'avg_min_matches', 'max', 'streak', 'once', 'season_rank', 'manual')),
  filters      jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object'),
  target       numeric not null check (target > 0),
  series       text check (series ~ '^[a-z0-9_]{1,40}$'),
  series_order integer check (series_order between 1 and 100),
  status       text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  retroactive  boolean not null default true,
  data_since   timestamptz,
  activated_at timestamptz,
  created_at   timestamptz not null default now(),
  created_by   uuid,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  check ((status = 'draft') = (activated_at is null)),
  -- design: solo lo que dibuja <Medal>, con textos cortos y uno de los cinco metales.
  check (jsonb_typeof(design) = 'object'),
  check (coalesce(design->>'metal', 'oro') in ('bronce', 'plata', 'oro', 'platino', 'diamante')),
  check (length(coalesce(design->>'number', '')) <= 5 and length(coalesce(design->>'label', '')) <= 14
         and length(coalesce(design->>'band', '')) <= 14 and coalesce(design->>'accent', 'x') ~ '^[a-z0-9_]{1,40}$')
);
create index medal_definitions_series on public.medal_definitions (series, series_order) where series is not null;
comment on table public.medal_definitions is 'Medallas configurables: plantilla (SVG del manifiesto), condición (métrica, agregación, filtros y objetivo) y dibujo. Replanteo 79';
comment on column public.medal_definitions.template is 'Id de la plantilla en web/frontend/src/features/medals/templates.json';
comment on column public.medal_definitions.design is '{number, label, band, metal, accent}: lo que la plantilla deja cambiar del SVG';
comment on column public.medal_definitions.filters is '{weapons: [...]}, {maps: [...]}, {min_matches: n}, {season: n}, {from, to} (puestos de temporada)';
comment on column public.medal_definitions.series is 'Agrupa los escalones de una misma progresión (hs_pct 35/45/55) para mostrar "siguiente"';
comment on column public.medal_definitions.data_since is 'Desde cuándo hay datos de la métrica (2026-10-29 para las del reporter 2.7.0)';

-- design solo con las claves que dibuja <Medal> (un check no admite subconsultas).
create function public.tg_medal_definitions() returns trigger language plpgsql set search_path = public as $$
begin
  if exists (select 1 from jsonb_object_keys(new.design) k where k not in ('number', 'label', 'band', 'metal', 'accent')) then
    raise exception 'El diseño solo admite number, label, band, metal y accent';
  end if;
  new.updated_at := now();
  -- La condición de una definición ya otorgada no cambia: se archiva y se crea otra (pregunta 13 del plan).
  if tg_op = 'UPDATE' and old.status <> 'draft'
     and (new.template, new.metric, new.aggregation, new.filters, new.target, new.key)
         is distinct from (old.template, old.metric, old.aggregation, old.filters, old.target, old.key) then
    raise exception 'La plantilla, la condición y el objetivo solo se cambian en un borrador: archiva esta medalla y crea otra';
  end if;
  return new;
end $$;
create trigger medal_definitions_cambios before insert or update on public.medal_definitions
  for each row execute function public.tg_medal_definitions();

-- El dibujo de una medalla, igual en la API y en los avisos. Las de temporada llevan el puesto y la etiqueta S<número>.
create function public.medal_design(d public.medal_definitions, p_rank integer default null, p_season integer default null)
  returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', d.id, 'key', d.key, 'template', d.template, 'title', d.title,
    'number', case when d.template = 'podio' and p_rank is not null then p_rank::text else d.design->>'number' end,
    'label', case when d.aggregation = 'season_rank' then 'S' || coalesce(p_season::text, '') else d.design->>'label' end,
    'band', d.design->>'band', 'metal', d.design->>'metal', 'accent', d.design->>'accent') $$;

alter table public.medal_definitions enable row level security;
create policy "medal definitions: todos ven las publicadas" on public.medal_definitions for select using (status <> 'draft' or is_admin());
create policy "medal definitions: admin gestiona" on public.medal_definitions for all using (is_admin()) with check (is_admin());

-- =====================================================================================================
-- 2. player_medals
-- =====================================================================================================
alter table public.player_medals
  add column definition_id uuid references public.medal_definitions(id) on delete restrict,
  add column source text not null default 'admin' check (source in ('admin', 'auto', 'season'));
comment on column public.player_medals.definition_id is 'La definición (replanteo 79): de ahí sale el dibujo';
comment on column public.player_medals.source is 'admin = dada a mano; auto = el motor; season = el cierre de temporada';
update public.player_medals set source = 'season' where season_id is not null;
-- El motor no da dos veces la misma; una manual sí se puede repetir (dos torneos ganados).
create unique index player_medals_auto on public.player_medals (player_id, definition_id) where source = 'auto';

create view public.medal_holders with (security_invoker = true) as
select definition_id, count(distinct player_id)::integer as holders
  from public.player_medals
 where definition_id is not null
 group by definition_id;

-- =====================================================================================================
-- 3. Catálogo de métricas (el mismo que web/frontend/src/features/medals/templates.json)
-- =====================================================================================================
-- Las stats de la temporada BETA (la número 1) no cuentan para las medallas (Daniel, 2026-11-06): cuentan desde el
-- inicio de la primera temporada después de la BETA. null mientras dure la BETA: el motor no da ninguna.
create function public.medal_stats_since() returns timestamptz language sql stable security definer set search_path = public as $$
  select min(starts_at) from seasons where number > 1 $$;
comment on function public.medal_stats_since() is 'Desde cuándo cuentan las stats para las medallas: el inicio de la temporada 2 (null durante la BETA)';

-- Valor de una métrica para cada jugador (p_players null = todos). Mismas partidas que player_stats: terminadas y con la
-- ficha del jugador, desde medal_stats_since(). Las del reporter 2.7.0 salen de match_player_extra: un mix sin fila no
-- suma (sin dato, no cero). Las de recuerdo de la BETA (first_match: Pionero; played_season: Fundador) miran todas las
-- partidas, pero también esperan a que empiece la temporada 2.
create function public.medal_metric_values(p_metric text, p_aggregation text, p_filters jsonb, p_players uuid[] default null)
  returns table (player_id uuid, value numeric) language plpgsql stable security definer set search_path = public as $$
declare
  v_min  integer := coalesce((p_filters->>'min_matches')::integer, 0);
  v_maps text := (select string_agg(lower(m), '|') from jsonb_array_elements_text(coalesce(p_filters->'maps', '[]')) m);
  v_extra boolean := p_metric in ('weapon_kills', 'clutches', 'pistol_won', 'eco_won', 'bombs_exploded',
                                  'rounds_survived', 'rounds_won_ct', 'rounds_won_t');
  v_since timestamptz := medal_stats_since();
  v_beta boolean := p_metric in ('first_match', 'played_season');
begin
  if p_aggregation in ('season_rank', 'manual') then return; end if;
  if v_since is null then return; end if;   -- temporada BETA: todavía no se gana ninguna

  if p_metric = 'mvp_mixes' then
    return query
      select ml.mvp_player_id, count(*)::numeric
        from mix_list ml
       where ml.status = 'finished' and ml.mvp_player_id is not null and (p_players is null or ml.mvp_player_id = any(p_players))
         and ml.at >= v_since
       group by ml.mvp_player_id;
    return;
  elsif p_metric = 'first_match' then
    return query
      select distinct s.player_id, 1::numeric
        from match_player_stats s
       where s.match_id = (select m.id from matches m where m.status = 'finished' order by coalesce(m.played_at, m.starts_at), m.id limit 1)
         and s.player_id is not null and (p_players is null or s.player_id = any(p_players));
    return;
  end if;

  return query
  with base as (
    select s.player_id, s.match_id, s.steam_id, s.kills, s.deaths, s.assists, s.headshots, s.damage, s.rounds,
           s.first_kills, s.k4, s.k5, s.plants, s.defuses, s.elo_after, m.map, coalesce(m.played_at, m.starts_at) as at,
           (m.winner_side = s.team) as won
      from match_player_stats s
      join matches m on m.id = s.match_id and m.status = 'finished'
     where s.player_id is not null and (p_players is null or s.player_id = any(p_players))
       and (v_beta or coalesce(m.played_at, m.starts_at) >= v_since)
  ),
  extra as (
    select b.player_id,
           sum(case p_metric
                 when 'weapon_kills' then (select coalesce(sum((e.weapon_kills->>w)::numeric), 0)
                                             from jsonb_array_elements_text(coalesce(p_filters->'weapons', '[]')) w
                                            where jsonb_typeof(e.weapon_kills->w) = 'number')
                 when 'clutches' then coalesce(e.clutch_1v1, 0) + coalesce(e.clutch_1v2, 0) + coalesce(e.clutch_1v3, 0)
                                      + coalesce(e.clutch_1v4, 0) + coalesce(e.clutch_1v5, 0)
                 when 'pistol_won' then e.pistol_won
                 when 'eco_won' then e.eco_won
                 when 'bombs_exploded' then e.bombs_exploded
                 when 'rounds_survived' then e.rounds_survived
                 when 'rounds_won_ct' then e.rounds_won_ct
                 when 'rounds_won_t' then e.rounds_won_t
               end)::numeric as v
      from base b join match_player_extra e on e.match_id = b.match_id and e.steam_id = b.steam_id
     where v_extra
     group by b.player_id
  ),
  agg as (
    select b.player_id, count(*) as n,
           (case p_metric
              when 'mixes_played' then count(*)
              when 'mixes_won' then count(*) filter (where b.won)
              when 'kills' then sum(b.kills)
              when 'damage' then sum(b.damage)
              when 'headshots' then sum(b.headshots)
              when 'first_kills' then sum(b.first_kills)
              when 'plants' then sum(b.plants)
              when 'defuses' then sum(b.defuses)
              when 'k4' then sum(b.k4)
              when 'k5' then sum(b.k5)
              when 'elo_peak' then max(b.elo_after)   -- el pico desde la temporada 2, no el histórico de player_elo
              when 'map_wins' then count(*) filter (where b.won and v_maps is not null
                                                     and regexp_replace(lower(b.map), '^de_', '') ~ ('^(' || v_maps || ')(_|$)'))
            end)::numeric as v,
           case when p_metric = 'hs_pct' and sum(b.kills) > 0 then round(100.0 * sum(b.headshots) / sum(b.kills), 1)
                when p_metric = 'kda' then round((sum(b.kills) + sum(b.assists))::numeric / greatest(sum(b.deaths), 1), 2)
                when p_metric = 'adr' and sum(b.rounds) > 0 then round(sum(b.damage)::numeric / sum(b.rounds), 1) end as avg
      from base b group by b.player_id
  ),
  temporadas as (   -- temporadas en las que jugó al menos un mix
    select b.player_id, se.number
      from base b join seasons se on b.at >= se.starts_at and b.at < coalesce(se.closed_at, 'infinity')
     group by b.player_id, se.number
  ),
  racha as (   -- la racha más larga de victorias seguidas
    select g.player_id, max(g.len)::numeric as v
      from (select x.player_id, count(*) as len
              from (select b.player_id, b.won,
                           row_number() over (partition by b.player_id order by b.at, b.match_id)
                         - row_number() over (partition by b.player_id, b.won order by b.at, b.match_id) as grp
                      from base b) x
             where x.won group by x.player_id, x.grp) g
     group by g.player_id
  )
  select a.player_id,
         case when p_metric = 'win_streak' then coalesce((select r.v from racha r where r.player_id = a.player_id), 0)
              when v_extra then (select e.v from extra e where e.player_id = a.player_id)
              when p_metric in ('hs_pct', 'kda', 'adr') then a.avg
              when p_metric = 'seasons_played' then (select count(*)::numeric from temporadas t where t.player_id = a.player_id)
              when p_metric = 'played_season' then (select count(*)::numeric from temporadas t
                                                     where t.player_id = a.player_id and t.number = (p_filters->>'season')::integer)
              else a.v end
    from agg a
   where a.n >= v_min;
end $$;

-- Da las medallas activas del motor que cada jugador ya cumple. Nunca quita ni repite (pregunta 11 del plan).
-- p_players null = todos; p_defs null = todas las activas. Devuelve cuántas dio.
create function public.medals_award(p_players uuid[], p_defs uuid[] default null) returns integer
  language plpgsql security definer set search_path = public as $$
declare
  d medal_definitions%rowtype;
  n integer := 0;
  k integer;
begin
  for d in select * from medal_definitions
            where status = 'active' and scope = 'player' and aggregation not in ('season_rank', 'manual')
              and (p_defs is null or id = any(p_defs))
            order by series nulls last, series_order, key loop
    insert into player_medals(player_id, title, icon, definition_id, source)
    select v.player_id, d.title, null, d.id, 'auto'
      from medal_metric_values(d.metric, d.aggregation, d.filters, p_players) v
     where v.value is not null and v.value >= d.target
    on conflict (player_id, definition_id) where source = 'auto' do nothing;
    get diagnostics k = row_count;
    n := n + k;
  end loop;
  return n;
end $$;

-- ---------- cola del motor ----------
create table public.medal_queue (
  player_id uuid primary key references public.players(id) on delete cascade,
  queued_at timestamptz not null default now()
);
alter table public.medal_queue enable row level security;   -- sin políticas: solo las funciones internas
comment on table public.medal_queue is 'Jugadores con partidas nuevas que el motor (medals_evaluate_pending) todavía no revisó';

-- Anota a los jugadores. Nunca hace fallar el guardado del mix.
create function public.medal_enqueue(p_players uuid[]) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into medal_queue(player_id)
  select distinct x from unnest(p_players) x where x is not null
  on conflict (player_id) do nothing;
exception when others then
  raise warning 'medallas: no se pudo anotar en la cola: %', sqlerrm;
end $$;

-- Da las medallas apenas termina el mix (Daniel, 2026-11-05: "al guardar cada mix", no ronda a ronda). Unos 60 ms para
-- los 10 jugadores con 136 medallas activas. Si falla, se deshace solo esto (bloque con excepción): el mix se guarda
-- igual y los jugadores quedan en la cola para la próxima vuelta del cron (medals:tick, de respaldo).
create function public.medal_evaluate_now(p_players uuid[]) returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(cardinality(p_players), 0) = 0 then return; end if;
  begin
    perform medals_award(p_players);
    delete from medal_queue where player_id = any(p_players);
  exception when others then
    raise warning 'medallas: quedan en la cola para el cron: %', sqlerrm;
  end;
end $$;

-- En lugar de parchar csstv_ingest (la parchan la 04, la 06, la 07 y la 15), un trigger sobre las stats del mix: anota a
-- los jugadores en la cola y, si el mix ya está terminado, les da las medallas en el acto.
create function public.tg_medal_queue_stats() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform medal_enqueue(array(select player_id from nuevas));
  perform medal_evaluate_now(array(select distinct n.player_id from nuevas n
                                     join matches m on m.id = n.match_id and m.status = 'finished'
                                    where n.player_id is not null));
  return null;
end $$;
create trigger medal_queue_stats_ins after insert on public.match_player_stats
  referencing new table as nuevas for each statement execute function public.tg_medal_queue_stats();
create trigger medal_queue_stats_upd after update on public.match_player_stats
  referencing new table as nuevas for each statement execute function public.tg_medal_queue_stats();

-- Una partida que pasa a terminada (las stats pueden haber llegado antes, en vivo).
create function public.tg_medal_queue_match() returns trigger language plpgsql security definer set search_path = public as $$
declare v_players uuid[];
begin
  if new.status = 'finished' and old.status is distinct from 'finished' then
    v_players := array(select distinct player_id from match_player_stats where match_id = new.id and player_id is not null);
    perform medal_enqueue(v_players);
    perform medal_evaluate_now(v_players);
  end if;
  return null;
end $$;
create trigger medal_queue_match after update of status on public.matches
  for each row execute function public.tg_medal_queue_match();

-- El respaldo (cron del VPS, pnpm medals:tick): saca hasta p_limit jugadores de la cola y les da lo que cumplen.
-- Si algo falla, la transacción se deshace y los jugadores siguen en la cola para la próxima vuelta.
create function public.medals_evaluate_pending(p_limit integer default 500) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_players uuid[];
  v_n       integer;
begin
  with q as (
    delete from medal_queue
     where player_id in (select player_id from medal_queue order by queued_at limit greatest(p_limit, 1) for update skip locked)
    returning player_id)
  select array_agg(player_id) into v_players from q;
  if v_players is null then
    return jsonb_build_object('players', 0, 'medals', 0);
  end if;
  v_n := medals_award(v_players);
  return jsonb_build_object('players', cardinality(v_players), 'medals', v_n);
end $$;

-- La retroactiva de una definición: todos los jugadores.
create function public.medals_evaluate_all(p_def uuid) returns integer
  language sql security definer set search_path = public as $$ select medals_award(null, array[p_def]) $$;

-- ---------- admin ----------
-- Activa una definición (borrador o archivada). Con p_retro, se la da ya a quienes la cumplen.
create function public.medal_activate(p_id uuid, p_retro boolean) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  d medal_definitions%rowtype;
  n integer := 0;
begin
  if not is_admin() then raise exception 'Solo un admin activa medallas' using errcode = '42501'; end if;
  select * into d from medal_definitions where id = p_id for update;
  if d.id is null then raise exception 'No existe esa medalla' using errcode = 'P0002'; end if;
  if d.status = 'active' then raise exception 'Esa medalla ya está activa'; end if;
  update medal_definitions set status = 'active', activated_at = coalesce(activated_at, now()),
                               retroactive = coalesce(p_retro, false), updated_by = auth.uid()
   where id = p_id;
  if coalesce(p_retro, false) then
    n := medals_evaluate_all(p_id);
  end if;
  return jsonb_build_object('id', p_id, 'awarded', n);
end $$;

-- Archiva: deja de otorgarse; quien la tiene la conserva. No se archiva una que usa un tramo de temporada.
create function public.medal_archive(p_id uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare d medal_definitions%rowtype;
begin
  if not is_admin() then raise exception 'Solo un admin archiva medallas' using errcode = '42501'; end if;
  select * into d from medal_definitions where id = p_id for update;
  if d.id is null then raise exception 'No existe esa medalla' using errcode = 'P0002'; end if;
  if d.status = 'draft' then raise exception 'Un borrador no se archiva: se borra'; end if;
  if d.status = 'archived' then return; end if;
  if exists (select 1 from season_config c, jsonb_array_elements(c.tiers) t where t->>'definition' = d.key)
     or exists (select 1 from seasons s, jsonb_array_elements(s.tiers) t where s.status = 'active' and t->>'definition' = d.key) then
    raise exception 'Esa medalla está en los tramos de la temporada: cámbiala ahí antes de archivarla';
  end if;
  update medal_definitions set status = 'archived', updated_by = auth.uid() where id = p_id;
end $$;

-- Cuántos jugadores la recibirían hoy, sin otorgar. null en las de temporada y las manuales.
create function public.medal_preview(p_metric text, p_aggregation text, p_filters jsonb, p_target numeric) returns integer
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin' using errcode = '42501'; end if;
  if p_aggregation in ('season_rank', 'manual') then return null; end if;
  return (select count(*) from medal_metric_values(p_metric, p_aggregation, p_filters, null) v where v.value >= p_target);
end $$;

-- Valor actual de un jugador en cada definición activa del motor, para las bloqueadas de Logros.
create function public.medal_progress(p_player uuid)
  returns table (definition_id uuid, value numeric) language sql stable security definer set search_path = public as $$
  select d.id, coalesce((select v.value from medal_metric_values(d.metric, d.aggregation, d.filters, array[p_player]) v), 0)
    from medal_definitions d
   where d.status = 'active' and d.scope = 'player' and d.aggregation not in ('season_rank', 'manual') $$;

-- Al abrirse la primera temporada después de la BETA, todos los que jugaron entran a la cola: así Fundador y Pionero
-- (y lo que ya cumplan) llegan aunque no vuelvan a jugar. Los reparte el cron (medals:tick), de a 500.
create function public.tg_medal_stats_start() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.number > 1 and not exists (select 1 from seasons s where s.number > 1 and s.id <> new.id) then
    perform medal_enqueue(array(select distinct player_id from match_player_stats where player_id is not null));
  end if;
  return null;
end $$;
create trigger seasons_medal_stats_start after insert on public.seasons
  for each row execute function public.tg_medal_stats_start();

grant execute on function public.medal_stats_since() to anon, authenticated;   -- solo una fecha; la API la muestra en Logros
revoke all on function public.medal_metric_values(text, text, jsonb, uuid[]) from public, anon, authenticated;
revoke all on function public.medals_award(uuid[], uuid[]) from public, anon, authenticated;
revoke all on function public.medal_enqueue(uuid[]) from public, anon, authenticated;
revoke all on function public.medal_evaluate_now(uuid[]) from public, anon, authenticated;
revoke all on function public.medals_evaluate_pending(integer) from public, anon, authenticated;
revoke all on function public.medals_evaluate_all(uuid) from public, anon, authenticated;
grant execute on function public.medals_evaluate_pending(integer) to service_role;
revoke all on function public.medal_activate(uuid, boolean) from public, anon;
revoke all on function public.medal_archive(uuid) from public, anon;
revoke all on function public.medal_preview(text, text, jsonb, numeric) from public, anon;
grant execute on function public.medal_activate(uuid, boolean), public.medal_archive(uuid),
                          public.medal_preview(text, text, jsonb, numeric) to authenticated;
grant execute on function public.medal_progress(uuid) to anon, authenticated;

-- =====================================================================================================
-- 4. Avisos con el dibujo
-- =====================================================================================================
create or replace function public.tg_notify_player_medals() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.season_id is null then
    perform notify(users_of_players(array[new.player_id]), 'medal_granted',
                   jsonb_build_object('title', new.title)
                   || coalesce((select jsonb_build_object('medal', medal_design(d)) from medal_definitions d where d.id = new.definition_id),
                               jsonb_build_object('icon', new.icon)));
  end if;
  return null;
end $$;

-- =====================================================================================================
-- 5. Temporadas sin emoji: definición por tramo
-- =====================================================================================================
-- Tramos: [{from, to, name, definition?, icon?}]. `definition` es la clave de una definición de temporada; con ella el
-- emoji ya no hace falta (queda solo en los tramos viejos).
create or replace function public.season_tiers_ok(p jsonb) returns boolean language plpgsql immutable as $$
declare
  t      jsonb;
  v_next integer := 1;
  v_open boolean := false;
begin
  if p is null or jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p) not between 1 and 20 then return false; end if;
  for t in select value from jsonb_array_elements(p) loop
    if v_open then return false; end if;   -- después del tramo abierto no puede haber otro
    if jsonb_typeof(t) is distinct from 'object'
       or exists (select 1 from jsonb_object_keys(t) k where k not in ('from', 'to', 'name', 'icon', 'definition'))
       or jsonb_typeof(t->'from') is distinct from 'number' or (t->>'from')::numeric is distinct from v_next
       or jsonb_typeof(t->'name') is distinct from 'string' or length(btrim(t->>'name')) not between 1 and 40
       or (coalesce(jsonb_typeof(t->'definition'), 'null') <> 'null'
           and (jsonb_typeof(t->'definition') <> 'string' or t->>'definition' !~ '^[a-z0-9_]{2,60}$'))
       or (coalesce(jsonb_typeof(t->'icon'), 'null') = 'null' and coalesce(jsonb_typeof(t->'definition'), 'null') = 'null')
       or (coalesce(jsonb_typeof(t->'icon'), 'null') <> 'null'
           and (jsonb_typeof(t->'icon') <> 'string' or length(btrim(t->>'icon')) not between 1 and 8)) then
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

-- Clave de la definición del tramo de un puesto, si está dentro del top N.
create function public.season_tier_definition(p_tiers jsonb, p_rank integer, p_top_n integer) returns text language sql immutable as $$
  select nullif(t->>'definition', '')
    from jsonb_array_elements(p_tiers) t
   where p_rank is not null and p_rank <= p_top_n
     and p_rank >= (t->>'from')::integer and p_rank <= coalesce((t->>'to')::integer, p_top_n)
   limit 1 $$;

-- La definición de un tramo tiene que existir, ser de temporada y no estar en borrador.
create function public.tg_season_tier_definitions() returns trigger language plpgsql set search_path = public as $$
begin
  if exists (select 1 from jsonb_array_elements(new.tiers) t
              where coalesce(jsonb_typeof(t->'definition'), 'null') <> 'null'
                and not exists (select 1 from medal_definitions d where d.key = t->>'definition'
                                                                  and d.aggregation = 'season_rank' and d.status <> 'draft')) then
    raise exception 'La medalla de un tramo tiene que ser una medalla de temporada activa';
  end if;
  return new;
end $$;
create trigger season_config_tier_definitions before insert or update of tiers on public.season_config
  for each row execute function public.tg_season_tier_definitions();
create trigger seasons_tier_definitions before insert or update of tiers on public.seasons
  for each row when (new.status = 'active') execute function public.tg_season_tier_definitions();

-- El cierre guarda la definición de cada puesto.
select pg_temp.reemplazar('public.season_close_run(uuid, uuid)', array[
  [E'insert into player_medals(player_id, title, icon, season_id, rank, tier)\n  select player_id, s.name || '' · #'' || rank, icon, s.id, rank, tier\n',
   E'insert into player_medals(player_id, title, icon, season_id, rank, tier, definition_id, source)\n  select player_id, s.name || '' · #'' || rank, icon, s.id, rank, tier, (select d.id from medal_definitions d where d.key = season_tier_definition(s.tiers, rank, s.top_n)), ''season'' -- (replanteo 79)\n']
]);

-- El aviso del cierre lleva el dibujo de la medalla, sin emoji.
select pg_temp.reemplazar('public.tg_notify_season_standings()', array[
  ['jsonb_build_object(''name'', new.tier, ''icon'', new.icon)',
   'jsonb_build_object(''name'', new.tier, ''design'', (select medal_design(d, new.rank, s.number) from medal_definitions d where d.key = season_tier_definition(s.tiers, new.rank, s.top_n)))']
]);

-- ---------- definiciones iniciales: las de temporada y la manual de torneos ----------
insert into public.medal_definitions (key, template, title, design, metric, aggregation, filters, target, series, series_order, status, activated_at, retroactive) values
  ('season_podio_1', 'podio', 'Podio · puesto 1', '{"number":"1","metal":"oro"}', 'season_rank', 'season_rank', '{"from":1,"to":1}', 1, 'season_podio', 1, 'active', now(), false),
  ('season_podio_2', 'podio', 'Podio · puesto 2', '{"number":"2","metal":"plata"}', 'season_rank', 'season_rank', '{"from":2,"to":2}', 2, 'season_podio', 2, 'active', now(), false),
  ('season_podio_3', 'podio', 'Podio · puesto 3', '{"number":"3","metal":"bronce"}', 'season_rank', 'season_rank', '{"from":3,"to":3}', 3, 'season_podio', 3, 'active', now(), false),
  ('season_top10', 'top_temporada', 'Top 10 de la temporada', '{"band":"TOP 10","metal":"plata","accent":"top10"}', 'season_rank', 'season_rank', '{"from":4,"to":10}', 10, 'season_top', 1, 'active', now(), false),
  -- Sin diseño propio (pregunta 1 del plan): el círculo del Top 10 en bronce con la banda TOP 20, hasta que Kyan lo diseñe.
  ('season_top20', 'top_temporada', 'Top 20 de la temporada', '{"band":"TOP 20","metal":"bronce","accent":"top10"}', 'season_rank', 'season_rank', '{"from":11,"to":20}', 20, 'season_top', 2, 'active', now(), false),
  ('campeon_torneo', 'campeon_torneo', 'Campeón de torneo', '{"label":"CM LEAGUE","band":"CAMPEÓN","metal":"oro","accent":"campeon"}', 'manual', 'manual', '{}', 1, null, null, 'active', now(), false);

-- Los tramos que se parecen a los de siempre (1, 2, 3, 4 a 10 y 11 en adelante) toman su definición.
create function pg_temp.con_definiciones(p jsonb) returns jsonb language sql as $$
  select coalesce(jsonb_agg(
           case
             when t->>'from' = '1' and t->>'to' = '1' then t || '{"definition":"season_podio_1"}'
             when t->>'from' = '2' and t->>'to' = '2' then t || '{"definition":"season_podio_2"}'
             when t->>'from' = '3' and t->>'to' = '3' then t || '{"definition":"season_podio_3"}'
             when t->>'from' = '4' then t || '{"definition":"season_top10"}'
             when t->>'from' = '11' then t || '{"definition":"season_top20"}'
             else t
           end order by ord), p)
    from jsonb_array_elements(p) with ordinality as x(t, ord) $$;
update public.season_config set tiers = pg_temp.con_definiciones(tiers);
update public.seasons set tiers = pg_temp.con_definiciones(tiers) where status = 'active';

-- Medallas que ya existen: las de temporadas cerradas toman la de su puesto; las dadas a mano con emoji (títulos de
-- torneos, pregunta 6 del plan) pasan a «Campeón de torneo» y conservan su título.
update public.player_medals pm
   set definition_id = d.id
  from public.medal_definitions d
 where pm.season_id is not null and pm.definition_id is null and pm.rank is not null
   and d.key = case when pm.rank <= 3 then 'season_podio_' || pm.rank when pm.rank <= 10 then 'season_top10'
                    when pm.rank <= 20 then 'season_top20' end;
update public.player_medals
   set definition_id = (select id from public.medal_definitions where key = 'campeon_torneo')
 where season_id is null and definition_id is null;

commit;
