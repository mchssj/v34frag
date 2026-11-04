-- 72: medallas automáticas (plan: docs/bitacora/2026-11-04-medallas-automaticas/PLAN.md).
--
-- - player_medals guarda la clave del catálogo (medal_key, el SVG de web/frontend/public/medallas) y de dónde salió
--   (source: admin, auto o temporada). Una medalla dada a mano ya puede tener temporada sin puesto.
-- - medal_rules: una fila por medalla automática de carrera, con la métrica, el umbral y el mínimo de partidas.
-- - medals_award(jugadores): calcula las métricas, las compara con medal_rules y da las que faltan. Nunca quita.
-- - csstv_ingest la llama al final de cada mix y season_close_run da las de temporada al cerrar.
-- - medals_award_all(): la corrida inicial, sin avisos.
-- Necesita la migración 20261029210000_medallas_datos.sql (match_player_extra).

begin;

do $$
begin
  if to_regclass('public.medal_rules') is not null then
    raise exception '72 ya aplicado: existe medal_rules';
  end if;
  if to_regclass('public.match_player_extra') is null then
    raise exception 'falta la migración 20261029210000_medallas_datos.sql (match_player_extra)';
  end if;
  if position('get diagnostics v_medals = row_count;' in pg_get_functiondef('public.season_close_run(uuid,uuid)'::regprocedure)) = 0 then
    raise exception 'season_close_run no tiene el punto donde se engancha (get diagnostics v_medals)';
  end if;
end $$;

-- ---------- player_medals ----------

alter table public.player_medals
  add column medal_key text check (medal_key ~ '^[a-z0-9_]{1,60}$'),
  add column source text not null default 'admin' check (source in ('admin', 'auto', 'temporada'));
comment on column public.player_medals.medal_key is 'Clave del catálogo (web/frontend/public/medallas/catalogo.json). null = medalla vieja, solo con emoji';
comment on column public.player_medals.source is 'admin = dada a mano; auto = medals_award; temporada = cierre de temporada';

-- Las del cierre de temporada (tramos de season_config): puestos 1 a 3 = podio, 4 a 10 = top 10. Del 11 en adelante
-- no hay dibujo y quedan con el emoji.
update public.player_medals set source = 'temporada' where season_id is not null and rank is not null;
update public.player_medals
   set medal_key = case when rank <= 3 then 'podio_puesto_' || rank else 'top10_temporada' end
 where source = 'temporada' and rank between 1 and 10;

-- Antes: temporada, puesto y tramo iban juntos. Ahora una manual puede tener temporada sin puesto ni tramo.
alter table public.player_medals drop constraint player_medals_temporada;
alter table public.player_medals add constraint player_medals_temporada
  check (season_id is not null or (rank is null and tier is null));

-- Una automática no se da dos veces; una de temporada, una vez por temporada.
create unique index player_medals_auto on public.player_medals (player_id, medal_key) where source = 'auto';
create unique index player_medals_temporada_clave on public.player_medals (player_id, medal_key, season_id)
  where source = 'temporada' and medal_key is not null;

-- ---------- reglas ----------

create table public.medal_rules (
  medal_key   text primary key check (medal_key ~ '^[a-z0-9_]{1,60}$'),
  metric      text not null,
  threshold   numeric not null check (threshold > 0),
  title       text not null check (length(btrim(title)) between 1 and 80),
  min_matches integer not null default 0 check (min_matches >= 0),
  icon        text not null default '🏅',
  active      boolean not null default true
);
comment on table public.medal_rules is 'Medallas automáticas de carrera: se dan cuando la métrica del jugador llega al umbral (con al menos min_matches partidas). Se pueden cambiar sin migración';
comment on column public.medal_rules.metric is 'matches, wins, win_streak, kills, damage, hs_pct, kda, adr, first_kills, k4, k5, plants, defuses, bombs_exploded, mvp_mix, peak_elo, clutches, pistol_won, rounds_won_ct, rounds_won_t, eco_won, rounds_survived, seasons_played, founder, pioneer, wk:<arma o grupo>, map_wins:<mapa>';

alter table public.medal_rules enable row level security;
create policy "medal rules: todos ven" on public.medal_rules for select using (true);
create policy "medal rules: admin gestiona" on public.medal_rules for all using (is_admin()) with check (is_admin());

insert into public.medal_rules (medal_key, metric, threshold, title, min_matches, icon) values
  ('aces_100', 'k5', 100, '100 aces', 0, '🂡'),
  ('aces_25', 'k5', 25, '25 aces', 0, '🂡'),
  ('aces_5', 'k5', 5, '5 aces', 0, '🂡'),
  ('adr_100', 'adr', 100, 'ADR 100', 20, '📈'),
  ('adr_70', 'adr', 70, 'ADR 70', 20, '📈'),
  ('adr_85', 'adr', 85, 'ADR 85', 20, '📈'),
  ('awp_100', 'wk:awp', 100, '100 kills con AWP', 0, '🎯'),
  ('awp_1000', 'wk:awp', 1000, '1.000 kills con AWP', 0, '🎯'),
  ('awp_500', 'wk:awp', 500, '500 kills con AWP', 0, '🎯'),
  ('clutch_10', 'clutches', 10, '10 clutchs ganados', 0, '⏳'),
  ('clutch_100', 'clutches', 100, '100 clutchs ganados', 0, '⏳'),
  ('clutch_50', 'clutches', 50, '50 clutchs ganados', 0, '⏳'),
  ('cuchillo_100', 'wk:knife', 100, '100 kills con cuchillo', 0, '🔪'),
  ('cuchillo_25', 'wk:knife', 25, '25 kills con cuchillo', 0, '🔪'),
  ('cuchillo_5', 'wk:knife', 5, '5 kills con cuchillo', 0, '🔪'),
  ('dano_100k', 'damage', 100000, '100.000 de daño', 0, '💥'),
  ('dano_10k', 'damage', 10000, '10.000 de daño', 0, '💥'),
  ('dano_50k', 'damage', 50000, '50.000 de daño', 0, '💥'),
  ('deagle_100', 'wk:deagle', 100, '100 kills con Deagle', 0, '🔫'),
  ('deagle_1000', 'wk:deagle', 1000, '1.000 kills con Deagle', 0, '🔫'),
  ('deagle_500', 'wk:deagle', 500, '500 kills con Deagle', 0, '🔫'),
  ('desactivadas_10', 'defuses', 10, '10 bombas desactivadas', 0, '✂️'),
  ('desactivadas_100', 'defuses', 100, '100 bombas desactivadas', 0, '✂️'),
  ('desactivadas_50', 'defuses', 50, '50 bombas desactivadas', 0, '✂️'),
  ('eco_ganado_100', 'eco_won', 100, '100 ecos ganados', 0, '💵'),
  ('eco_ganado_25', 'eco_won', 25, '25 ecos ganados', 0, '💵'),
  ('eco_ganado_5', 'eco_won', 5, '5 ecos ganados', 0, '💵'),
  ('eco_rifles_100', 'wk:eco_rifles', 100, '100 kills con Famas o Galil', 0, '🔫'),
  ('eco_rifles_1000', 'wk:eco_rifles', 1000, '1.000 kills con Famas o Galil', 0, '🔫'),
  ('eco_rifles_500', 'wk:eco_rifles', 500, '500 kills con Famas o Galil', 0, '🔫'),
  ('elites_10', 'wk:elite', 10, '10 kills con Dual Elites', 0, '🔫'),
  ('elites_100', 'wk:elite', 100, '100 kills con Dual Elites', 0, '🔫'),
  ('elites_50', 'wk:elite', 50, '50 kills con Dual Elites', 0, '🔫'),
  ('elo_1200', 'peak_elo', 1200, 'ELO máximo 1200', 0, '📈'),
  ('elo_1500', 'peak_elo', 1500, 'ELO máximo 1500', 0, '📈'),
  ('elo_1800', 'peak_elo', 1800, 'ELO máximo 1800', 0, '📈'),
  ('elo_2000', 'peak_elo', 2000, 'ELO máximo 2000', 0, '📈'),
  ('entry_250', 'first_kills', 250, '250 entry kills', 0, '⚡'),
  ('entry_50', 'first_kills', 50, '50 entry kills', 0, '⚡'),
  ('entry_500', 'first_kills', 500, '500 entry kills', 0, '⚡'),
  ('escopetas_250', 'wk:shotgun', 250, '250 kills con escopeta', 0, '🔫'),
  ('escopetas_50', 'wk:shotgun', 50, '50 kills con escopeta', 0, '🔫'),
  ('escopetas_500', 'wk:shotgun', 500, '500 kills con escopeta', 0, '🔫'),
  ('explotadas_10', 'bombs_exploded', 10, '10 bombas explotadas', 0, '💥'),
  ('explotadas_100', 'bombs_exploded', 100, '100 bombas explotadas', 0, '💥'),
  ('explotadas_50', 'bombs_exploded', 50, '50 bombas explotadas', 0, '💥'),
  ('fundador', 'founder', 1, 'Fundador: jugó la primera temporada', 0, '🏛️'),
  ('he_100', 'wk:hegrenade', 100, '100 kills con HE', 0, '💥'),
  ('he_25', 'wk:hegrenade', 25, '25 kills con HE', 0, '💥'),
  ('he_250', 'wk:hegrenade', 250, '250 kills con HE', 0, '💥'),
  ('hs_35', 'hs_pct', 35, '35 % de headshots', 20, '🎯'),
  ('hs_45', 'hs_pct', 45, '45 % de headshots', 20, '🎯'),
  ('hs_55', 'hs_pct', 55, '55 % de headshots', 20, '🎯'),
  ('kda_1_2', 'kda', 1.2, 'KDA 1.2', 20, '⚔️'),
  ('kda_1_5', 'kda', 1.5, 'KDA 1.5', 20, '⚔️'),
  ('kda_2_0', 'kda', 2.0, 'KDA 2.0', 20, '⚔️'),
  ('kills_1000', 'kills', 1000, '1.000 kills', 0, '🎯'),
  ('kills_10000', 'kills', 10000, '10.000 kills', 0, '🎯'),
  ('kills_5000', 'kills', 5000, '5.000 kills', 0, '🎯'),
  ('lado_ct_100', 'rounds_won_ct', 100, '100 rondas ganadas de CT', 0, '🛡️'),
  ('lado_ct_1000', 'rounds_won_ct', 1000, '1.000 rondas ganadas de CT', 0, '🛡️'),
  ('lado_ct_500', 'rounds_won_ct', 500, '500 rondas ganadas de CT', 0, '🛡️'),
  ('lado_t_100', 'rounds_won_t', 100, '100 rondas ganadas de T', 0, '💣'),
  ('lado_t_1000', 'rounds_won_t', 1000, '1.000 rondas ganadas de T', 0, '💣'),
  ('lado_t_500', 'rounds_won_t', 500, '500 rondas ganadas de T', 0, '💣'),
  ('mapa_cache_10', 'map_wins:de_cache', 10, '10 victorias en Cache', 0, '🗺️'),
  ('mapa_cache_100', 'map_wins:de_cache', 100, '100 victorias en Cache', 0, '🗺️'),
  ('mapa_cache_50', 'map_wins:de_cache', 50, '50 victorias en Cache', 0, '🗺️'),
  ('mapa_cbble_10', 'map_wins:de_cbble', 10, '10 victorias en Cbble', 0, '🗺️'),
  ('mapa_cbble_100', 'map_wins:de_cbble', 100, '100 victorias en Cbble', 0, '🗺️'),
  ('mapa_cbble_50', 'map_wins:de_cbble', 50, '50 victorias en Cbble', 0, '🗺️'),
  ('mapa_cpl_mirage_10', 'map_wins:de_cpl_mirage', 10, '10 victorias en CPL Mirage', 0, '🗺️'),
  ('mapa_cpl_mirage_100', 'map_wins:de_cpl_mirage', 100, '100 victorias en CPL Mirage', 0, '🗺️'),
  ('mapa_cpl_mirage_50', 'map_wins:de_cpl_mirage', 50, '50 victorias en CPL Mirage', 0, '🗺️'),
  ('mapa_dust2_10', 'map_wins:de_dust2', 10, '10 victorias en Dust2', 0, '🗺️'),
  ('mapa_dust2_100', 'map_wins:de_dust2', 100, '100 victorias en Dust2', 0, '🗺️'),
  ('mapa_dust2_50', 'map_wins:de_dust2', 50, '50 victorias en Dust2', 0, '🗺️'),
  ('mapa_inferno_10', 'map_wins:de_inferno', 10, '10 victorias en Inferno', 0, '🗺️'),
  ('mapa_inferno_100', 'map_wins:de_inferno', 100, '100 victorias en Inferno', 0, '🗺️'),
  ('mapa_inferno_50', 'map_wins:de_inferno', 50, '50 victorias en Inferno', 0, '🗺️'),
  ('mapa_nuke_10', 'map_wins:de_nuke', 10, '10 victorias en Nuke', 0, '🗺️'),
  ('mapa_nuke_100', 'map_wins:de_nuke', 100, '100 victorias en Nuke', 0, '🗺️'),
  ('mapa_nuke_50', 'map_wins:de_nuke', 50, '50 victorias en Nuke', 0, '🗺️'),
  ('mapa_season_10', 'map_wins:de_season', 10, '10 victorias en Season', 0, '🗺️'),
  ('mapa_season_100', 'map_wins:de_season', 100, '100 victorias en Season', 0, '🗺️'),
  ('mapa_season_50', 'map_wins:de_season', 50, '50 victorias en Season', 0, '🗺️'),
  ('mapa_train_10', 'map_wins:de_train', 10, '10 victorias en Train', 0, '🗺️'),
  ('mapa_train_100', 'map_wins:de_train', 100, '100 victorias en Train', 0, '🗺️'),
  ('mapa_train_50', 'map_wins:de_train', 50, '50 victorias en Train', 0, '🗺️'),
  ('mapa_tuscan_10', 'map_wins:de_tuscan', 10, '10 victorias en Tuscan', 0, '🗺️'),
  ('mapa_tuscan_100', 'map_wins:de_tuscan', 100, '100 victorias en Tuscan', 0, '🗺️'),
  ('mapa_tuscan_50', 'map_wins:de_tuscan', 50, '50 victorias en Tuscan', 0, '🗺️'),
  ('multikill_10', 'k4', 10, '10 rondas de 4 kills', 0, '🔫'),
  ('multikill_100', 'k4', 100, '100 rondas de 4 kills', 0, '🔫'),
  ('multikill_50', 'k4', 50, '50 rondas de 4 kills', 0, '🔫'),
  ('mvp_mix_10', 'mvp_mix', 10, 'MVP en 10 mixes', 0, '⭐'),
  ('mvp_mix_100', 'mvp_mix', 100, 'MVP en 100 mixes', 0, '⭐'),
  ('mvp_mix_50', 'mvp_mix', 50, 'MVP en 50 mixes', 0, '⭐'),
  ('pionero_primer_mix', 'pioneer', 1, 'Pionero: jugó el primer mix', 0, '🚀'),
  ('pistolas_100', 'pistol_won', 100, '100 rondas de pistola ganadas', 0, '🔫'),
  ('pistolas_25', 'pistol_won', 25, '25 rondas de pistola ganadas', 0, '🔫'),
  ('pistolas_250', 'pistol_won', 250, '250 rondas de pistola ganadas', 0, '🔫'),
  ('plantadas_100', 'plants', 100, '100 bombas plantadas', 0, '💣'),
  ('plantadas_25', 'plants', 25, '25 bombas plantadas', 0, '💣'),
  ('plantadas_250', 'plants', 250, '250 bombas plantadas', 0, '💣'),
  ('primer_mix', 'matches', 1, 'Primer mix', 0, '🎮'),
  ('primera_victoria', 'wins', 1, 'Primera victoria', 0, '🏆'),
  ('progresion_1000_mixes', 'matches', 1000, '1.000 mixes jugados', 0, '🎮'),
  ('progresion_100_mixes', 'matches', 100, '100 mixes jugados', 0, '🎮'),
  ('progresion_10_mixes', 'matches', 10, '10 mixes jugados', 0, '🎮'),
  ('progresion_250_mixes', 'matches', 250, '250 mixes jugados', 0, '🎮'),
  ('progresion_500_mixes', 'matches', 500, '500 mixes jugados', 0, '🎮'),
  ('progresion_50_mixes', 'matches', 50, '50 mixes jugados', 0, '🎮'),
  ('racha_10', 'win_streak', 10, 'Racha de 10 victorias', 0, '🔥'),
  ('racha_15', 'win_streak', 15, 'Racha de 15 victorias', 0, '🔥'),
  ('racha_5', 'win_streak', 5, 'Racha de 5 victorias', 0, '🔥'),
  ('rifles_2500', 'wk:rifles', 2500, '2.500 kills con AK-47 o M4A1', 0, '🔫'),
  ('rifles_500', 'wk:rifles', 500, '500 kills con AK-47 o M4A1', 0, '🔫'),
  ('rifles_5000', 'wk:rifles', 5000, '5.000 kills con AK-47 o M4A1', 0, '🔫'),
  ('scout_250', 'wk:scout', 250, '250 kills con Scout', 0, '🎯'),
  ('scout_50', 'wk:scout', 50, '50 kills con Scout', 0, '🎯'),
  ('scout_500', 'wk:scout', 500, '500 kills con Scout', 0, '🎯'),
  ('smg_100', 'wk:smg', 100, '100 kills con subfusiles', 0, '🔫'),
  ('smg_1000', 'wk:smg', 1000, '1.000 kills con subfusiles', 0, '🔫'),
  ('smg_500', 'wk:smg', 500, '500 kills con subfusiles', 0, '🔫'),
  ('sobreviviente_100', 'rounds_survived', 100, 'Sobrevivió 100 rondas', 0, '❤️'),
  ('sobreviviente_1000', 'rounds_survived', 1000, 'Sobrevivió 1.000 rondas', 0, '❤️'),
  ('sobreviviente_500', 'rounds_survived', 500, 'Sobrevivió 500 rondas', 0, '❤️'),
  ('veterano_2', 'seasons_played', 2, '2 temporadas jugadas', 0, '🎖️'),
  ('veterano_3', 'seasons_played', 3, '3 temporadas jugadas', 0, '🎖️'),
  ('veterano_5', 'seasons_played', 5, '5 temporadas jugadas', 0, '🎖️'),
  ('victorias_10', 'wins', 10, '10 victorias', 0, '🏆'),
  ('victorias_100', 'wins', 100, '100 victorias', 0, '🏆'),
  ('victorias_250', 'wins', 250, '250 victorias', 0, '🏆'),
  ('victorias_50', 'wins', 50, '50 victorias', 0, '🏆'),
  ('victorias_500', 'wins', 500, '500 victorias', 0, '🏆');

-- ---------- métricas ----------

-- Una fila por jugador y métrica, con la cantidad de partidas (para min_matches). Mismo criterio que la vista
-- player_stats: partidas terminadas con la ficha del jugador. Los datos extra (armas, clutchs, rondas) existen desde
-- el reporter 2.7.0.
create function public.medals_metrics(p_players uuid[])
returns table (player_id uuid, metric text, value numeric, matches integer)
language sql stable security definer set search_path = public as $$
  with base as (
    select s.player_id, s.match_id, s.steam_id, s.kills, s.deaths, s.assists, s.headshots, s.damage, s.rounds,
           s.first_kills, s.k4, s.k5, s.plants, s.defuses, s.rating,
           m.map, coalesce(m.played_at, m.starts_at) as at, (m.winner_side = s.team) as won
      from match_player_stats s
      join matches m on m.id = s.match_id
     where s.player_id = any(p_players) and m.status = 'finished'
  ),
  agg as (
    select b.player_id, count(*)::integer as n,
           count(*) filter (where b.won) as wins,
           coalesce(sum(b.kills), 0) as kills, coalesce(sum(b.deaths), 0) as deaths,
           coalesce(sum(b.assists), 0) as assists, coalesce(sum(b.headshots), 0) as hs,
           coalesce(sum(b.damage), 0) as damage, coalesce(sum(b.rounds), 0) as rounds,
           coalesce(sum(b.first_kills), 0) as first_kills, coalesce(sum(b.k4), 0) as k4,
           coalesce(sum(b.k5), 0) as k5, coalesce(sum(b.plants), 0) as plants, coalesce(sum(b.defuses), 0) as defuses
      from base b group by b.player_id
  ),
  racha as (   -- la racha más larga de victorias seguidas
    select g.player_id, max(g.len) as best
      from (select x.player_id, count(*) as len
              from (select b.player_id, b.won,
                           row_number() over (partition by b.player_id order by b.at, b.match_id)
                         - row_number() over (partition by b.player_id, b.won order by b.at, b.match_id) as grp
                      from base b) x
             where x.won group by x.player_id, x.grp) g
     group by g.player_id
  ),
  mvp as (     -- partidas en las que tuvo el mejor rating (los empates cuentan para todos)
    select b.player_id, count(*) as n
      from base b
     where b.rating is not null
       and b.rating = (select max(t.rating) from match_player_stats t where t.match_id = b.match_id)
     group by b.player_id
  ),
  extra as (
    select b.player_id,
           sum(coalesce(e.clutch_1v1, 0) + coalesce(e.clutch_1v2, 0) + coalesce(e.clutch_1v3, 0)
             + coalesce(e.clutch_1v4, 0) + coalesce(e.clutch_1v5, 0)) as clutches,
           sum(coalesce(e.pistol_won, 0)) as pistol_won, sum(coalesce(e.eco_won, 0)) as eco_won,
           sum(coalesce(e.bombs_exploded, 0)) as bombs_exploded, sum(coalesce(e.rounds_survived, 0)) as rounds_survived,
           sum(coalesce(e.rounds_won_ct, 0)) as rounds_won_ct, sum(coalesce(e.rounds_won_t, 0)) as rounds_won_t
      from base b join match_player_extra e on e.match_id = b.match_id and e.steam_id = b.steam_id
     group by b.player_id
  ),
  armas as (   -- kills por arma, como las nombra el reporter
    select b.player_id, w.key as arma, sum((w.value #>> '{}')::integer) as kills
      from base b
      join match_player_extra e on e.match_id = b.match_id and e.steam_id = b.steam_id
      cross join lateral jsonb_each(coalesce(e.weapon_kills, '{}'::jsonb)) w
     group by b.player_id, w.key
  ),
  grupos as (  -- las medallas de varias armas suman su grupo
    select a.player_id, g.grupo, sum(a.kills) as kills
      from armas a
      join (values ('awp', 'awp'), ('scout', 'scout'), ('deagle', 'deagle'), ('knife', 'knife'),
                   ('hegrenade', 'hegrenade'), ('elite', 'elite'), ('ak47', 'rifles'), ('m4a1', 'rifles'),
                   ('mp5navy', 'smg'), ('p90', 'smg'), ('ump45', 'smg'), ('tmp', 'smg'), ('mac10', 'smg'),
                   ('m3', 'shotgun'), ('xm1014', 'shotgun'), ('famas', 'eco_rifles'), ('galil', 'eco_rifles'))
           as g(arma, grupo) on g.arma = a.arma
     group by a.player_id, g.grupo
  ),
  mapas as (
    select b.player_id, b.map, count(*) filter (where b.won) as wins
      from base b where b.map ~ '^de_[a-z0-9_]+$' group by b.player_id, b.map
  ),
  elo as (     -- el ELO máximo entre todos los SteamID del jugador
    select o.player_id, max(pe.peak_elo) as peak
      from (select p.id as player_id, p.steam_id from players p where p.id = any(p_players) and p.steam_id is not null
            union
            select x.player_id, x.steam_id from player_extra_steam_ids x where x.player_id = any(p_players)) o
      join player_elo pe on pe.steam_id = o.steam_id
     group by o.player_id
  ),
  temporadas as (
    select b.player_id, count(distinct se.id) as n, bool_or(se.number = (select min(number) from seasons)) as fundador
      from base b
      join seasons se on b.at >= se.starts_at and b.at < coalesce(se.closed_at, 'infinity'::timestamptz)
     group by b.player_id
  ),
  primero as (
    select m.id from matches m where m.status = 'finished'
     order by coalesce(m.played_at, m.starts_at), m.id limit 1
  )
  select a.player_id, v.metric, v.value, a.n
    from agg a
    left join racha r on r.player_id = a.player_id
    left join mvp on mvp.player_id = a.player_id
    left join extra x on x.player_id = a.player_id
    left join elo on elo.player_id = a.player_id
    left join temporadas t on t.player_id = a.player_id
    cross join lateral (values
      ('matches', a.n::numeric), ('wins', a.wins), ('win_streak', coalesce(r.best, 0)),
      ('kills', a.kills), ('damage', a.damage), ('first_kills', a.first_kills), ('k4', a.k4), ('k5', a.k5),
      ('plants', a.plants), ('defuses', a.defuses),
      ('hs_pct', case when a.kills > 0 then round(a.hs * 100.0 / a.kills, 2) end),
      ('kda', round((a.kills + a.assists)::numeric / greatest(a.deaths, 1), 2)),
      ('adr', case when a.rounds > 0 then round(a.damage::numeric / a.rounds, 2) end),
      ('mvp_mix', coalesce(mvp.n, 0)), ('peak_elo', elo.peak),
      ('clutches', x.clutches), ('pistol_won', x.pistol_won), ('eco_won', x.eco_won),
      ('bombs_exploded', x.bombs_exploded), ('rounds_survived', x.rounds_survived),
      ('rounds_won_ct', x.rounds_won_ct), ('rounds_won_t', x.rounds_won_t),
      ('seasons_played', t.n), ('founder', case when t.fundador then 1 end),
      ('pioneer', case when exists (select 1 from base b join primero p on p.id = b.match_id
                                     where b.player_id = a.player_id) then 1 end)
    ) as v(metric, value)
   where v.value is not null
  union all
  select g.player_id, 'wk:' || g.grupo, g.kills, a.n from grupos g join agg a on a.player_id = g.player_id
  union all
  select mp.player_id, 'map_wins:' || mp.map, mp.wins, a.n from mapas mp join agg a on a.player_id = mp.player_id
$$;
revoke all on function public.medals_metrics(uuid[]) from public, anon, authenticated;

-- ---------- dar las que faltan ----------

create function public.medals_award(p_players uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  insert into player_medals (player_id, title, icon, medal_key, source)
  select mm.player_id, r.title, r.icon, r.medal_key, 'auto'
    from medals_metrics(p_players) mm
    join medal_rules r on r.metric = mm.metric and r.active
   where mm.value >= r.threshold and mm.matches >= r.min_matches
  on conflict (player_id, medal_key) where source = 'auto' do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.medals_award(uuid[]) from public, anon, authenticated;

-- Al final de cada mix. Nunca hace fallar el resultado.
create function public.medals_award_match(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform medals_award(array(select distinct s.player_id from match_player_stats s
                               where s.match_id = p_match and s.player_id is not null));
exception when others then
  raise warning 'medals_award_match %: %', p_match, sqlerrm;
end $$;
revoke all on function public.medals_award_match(uuid) from public, anon, authenticated;

-- La corrida inicial (y la de después de cambiar medal_rules): todos los jugadores, sin avisos.
create function public.medals_award_all()
returns integer language plpgsql security definer set search_path = public as $$
begin
  perform set_config('medals.silencio', 'on', true);
  return medals_award(array(select id from players));
end $$;
revoke all on function public.medals_award_all() from public, anon, authenticated;
grant execute on function public.medals_award_all() to service_role;

-- Lo mismo desde Administración › Medallas (después de cambiar una regla). Solo admin.
create function public.admin_medals_recalculate()
returns integer language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin puede recalcular las medallas' using errcode = '42501'; end if;
  return medals_award_all();
end $$;
revoke all on function public.admin_medals_recalculate() from public, anon;
grant execute on function public.admin_medals_recalculate() to authenticated;

-- El aviso de "medalla nueva": suma la clave y se calla en la corrida inicial.
create or replace function public.tg_notify_player_medals()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.season_id is null and coalesce(current_setting('medals.silencio', true), '') <> 'on' then
    perform notify(users_of_players(array[new.player_id]), 'medal_granted',
                   jsonb_build_object('title', new.title, 'icon', new.icon, 'medal_key', new.medal_key));
  end if;
  return null;
end $$;

-- ---------- temporada ----------

-- Al cerrar una temporada, después de las medallas por puesto (los tramos de season_config, que ya se dan): les pone
-- la clave (1 a 3 = podio, 4 a 10 = top 10) y suma MVP (mejor rating), top fragger, rey del HS, mejor AWP y el que
-- más ELO subió. Estas últimas, solo entre los jugadores con el mínimo de mixes de la temporada.
create function public.medals_award_season(p_season uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  s seasons%rowtype;
  n integer;
begin
  select * into s from seasons where id = p_season;
  if s.id is null then return 0; end if;

  update player_medals
     set medal_key = case when rank <= 3 then 'podio_puesto_' || rank else 'top10_temporada' end
   where season_id = s.id and source = 'temporada' and rank between 1 and 10 and medal_key is null;

  with base as (
    select st.player_id, st.kills, st.deaths, st.headshots, st.rounds, st.k1, st.k2, st.k3, st.k4, st.k5,
           st.elo_delta, st.match_id, st.steam_id
      from match_player_stats st
      join matches m on m.id = st.match_id
     where st.player_id is not null and m.status = 'finished'
       and coalesce(m.played_at, m.starts_at) >= s.starts_at
       and coalesce(m.played_at, m.starts_at) < coalesce(s.closed_at, now())
  ),
  jug as (
    select b.player_id, count(*) as n, sum(b.kills) as kills,
           csstv_rating(sum(b.kills)::numeric, sum(b.deaths)::numeric, sum(b.rounds)::numeric, sum(b.k1)::numeric,
                        sum(b.k2)::numeric, sum(b.k3)::numeric, sum(b.k4)::numeric, sum(b.k5)::numeric) as rating,
           case when sum(b.kills) > 0 then sum(b.headshots)::numeric / sum(b.kills) end as hs,
           sum(coalesce(b.elo_delta, 0)) as subida
      from base b group by b.player_id
     having count(*) >= s.min_matches
  ),
  awp as (
    select b.player_id, sum(coalesce((e.weapon_kills ->> 'awp')::integer, 0)) as kills
      from base b join match_player_extra e on e.match_id = b.match_id and e.steam_id = b.steam_id
     where b.player_id in (select player_id from jug)
     group by b.player_id
  ),
  ganadores as (
    select player_id, 'mvp_temporada' as clave, 'Mejor jugador' as titulo, '⭐' as icono
      from jug where rating = (select max(rating) from jug)
    union all select player_id, 'top_fragger_temporada', 'Top fragger', '🎯' from jug where kills = (select max(kills) from jug)
    union all select player_id, 'rey_hs_temporada', 'Rey del HS', '👑' from jug where hs = (select max(hs) from jug)
    union all select player_id, 'mejor_awp_temporada', 'Mejor AWP', '🎯' from awp where kills > 0 and kills = (select max(kills) from awp)
    union all select player_id, 'mas_mejorado_temporada', 'Más mejorado', '📈' from jug where subida > 0 and subida = (select max(subida) from jug)
  )
  insert into player_medals (player_id, title, icon, medal_key, source, season_id)
  select g.player_id, s.name || ' · ' || g.titulo, g.icono, g.clave, 'temporada', s.id from ganadores g
  on conflict (player_id, medal_key, season_id) where source = 'temporada' and medal_key is not null do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.medals_award_season(uuid) from public, anon, authenticated;

-- ---------- enganches ----------

-- csstv_ingest: una línea después de la de los datos extra, sobre la definición instalada (como en 20261029210000).
do $$
declare
  d text := pg_get_functiondef('public.csstv_ingest(uuid, jsonb)'::regprocedure);
  ancla text := E'(perform csstv_match_extra\\(v_id, p\\);)';
begin
  if position('medals_award_match' in d) > 0 then
    raise notice 'csstv_ingest ya llama a medals_award_match';
    return;
  end if;
  if (select count(*) from regexp_matches(d, ancla, 'g')) <> 1 then
    raise exception 'medallas: csstv_ingest no tiene una sola vez la llamada a csstv_match_extra';
  end if;
  execute regexp_replace(d, ancla, E'\\1\n  perform medals_award_match(v_id);   -- (72) medallas automáticas');
end $$;

-- season_close_run: después de dar el podio.
do $$
declare
  d text := pg_get_functiondef('public.season_close_run(uuid,uuid)'::regprocedure);
begin
  execute replace(d, 'get diagnostics v_medals = row_count;',
                  'get diagnostics v_medals = row_count;' || E'\n  v_medals := v_medals + medals_award_season(s.id);   -- (72)');
end $$;

commit;
