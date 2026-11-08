-- Lleva una base que ya tiene la 79 vieja (la local del 2026-11-05) a la 79 con las stats de la BETA fuera
-- (Daniel, 2026-11-06). Solo para bases de prueba: staging y producción reciben la 79 entera, que ya lo trae.
-- Borra las medallas del motor (source = 'auto'), que salieron de partidas de la BETA. Sale de la 79 actual.
begin;
-- Las stats de la temporada BETA (la número 1) no cuentan para las medallas (Daniel, 2026-11-06): cuentan desde el
-- inicio de la primera temporada después de la BETA. null mientras dure la BETA: el motor no da ninguna.
create or replace function public.medal_stats_since() returns timestamptz language sql stable security definer set search_path = public as $$
  select min(starts_at) from seasons where number > 1 $$;
comment on function public.medal_stats_since() is 'Desde cuándo cuentan las stats para las medallas: el inicio de la temporada 2 (null durante la BETA)';

-- Valor de una métrica para cada jugador (p_players null = todos). Mismas partidas que player_stats: terminadas y con la
-- ficha del jugador, desde medal_stats_since(). Las del reporter 2.7.0 salen de match_player_extra: un mix sin fila no
-- suma (sin dato, no cero). Las de recuerdo de la BETA (first_match: Pionero; played_season: Fundador) miran todas las
-- partidas, pero también esperan a que empiece la temporada 2.
create or replace function public.medal_metric_values(p_metric text, p_aggregation text, p_filters jsonb, p_players uuid[] default null)
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

-- Al abrirse la primera temporada después de la BETA, todos los que jugaron entran a la cola: así Fundador y Pionero
-- (y lo que ya cumplan) llegan aunque no vuelvan a jugar. Los reparte el cron (medals:tick), de a 500.
create or replace function public.tg_medal_stats_start() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.number > 1 and not exists (select 1 from seasons s where s.number > 1 and s.id <> new.id) then
    perform medal_enqueue(array(select distinct player_id from match_player_stats where player_id is not null));
  end if;
  return null;
end $$;
drop trigger if exists seasons_medal_stats_start on public.seasons;
create trigger seasons_medal_stats_start after insert on public.seasons
  for each row execute function public.tg_medal_stats_start();

revoke all on function public.medal_metric_values(text, text, jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.medal_stats_since() to anon, authenticated;
delete from public.player_medals where source = 'auto';
delete from public.medal_queue;
commit;
notify pgrst, 'reload schema';
