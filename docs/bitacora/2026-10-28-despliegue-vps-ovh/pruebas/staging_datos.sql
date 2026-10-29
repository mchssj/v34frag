-- Datos de prueba INVENTADOS para la Supabase de staging (ensayo del VPS, plan sección 7). Nunca en producción.
-- Decidido por Daniel el 2026-10-28 (opción 1: datos inventados, sin datos reales de jugadores).
--
-- Carga:
--   - 1 servidor (`Staging Mix #1`, token que no sirve para nada).
--   - 20 fichas con SteamID falsos (765611990000001NN), sin cuenta: se reclaman en el ensayo.
--   - 2 equipos oficiales de 5.
--   - La temporada BETA abierta, con inicio antes del primer mix.
--   - 40 mixes en las últimas dos semanas y 1 cancelado.
--     Cada ficha tiene un nivel oculto: los mejores ganan más, así el ELO y el ranking tienen sentido.
--     8 fichas juegan casi todos los mixes, así que llegan a los 20 que pide la temporada para tener puesto.
--
-- Los mixes entran por el mismo camino que el plugin (ingest_server_chunk): csstv_ingest, csstv_after_ingest
-- y elo_apply_match, en orden cronológico. setseed: el resultado es siempre el mismo.
-- Si staging ya tiene fichas o partidas, aborta sin tocar nada.
--
-- Uso (desde la raíz, con las variables STAGING_PG_* y el usuario postgres.<ref>):
--   psql -v ON_ERROR_STOP=1 -f docs/bitacora/2026-10-28-despliegue-vps-ovh/pruebas/staging_datos.sql

begin;

do $$
begin
  if exists (select 1 from public.players) or exists (select 1 from public.matches) or exists (select 1 from public.seasons) then
    raise exception 'staging ya tiene fichas, partidas o temporadas: este script es solo para una base recién cargada';
  end if;
end $$;

select setseed(0.28);

-- Servidor: el token_hash no corresponde a ningún token, así que ningún plugin puede mandar con él.
insert into public.game_servers (id, name, token_hash, license_expires_at, mode, region, plugin_version)
values ('5ea9e000-0000-4000-8000-000000000001', 'Staging Mix #1', 'staging-sin-token', now() + interval '1 year',
        'mix', 'Argentina', 'staging');

-- Fichas: nick, SteamID falso y nivel oculto (solo para generar los mixes; no queda guardado).
create temp table seed_players (n int primary key, id uuid, nick text, steam text, skill numeric) on commit drop;
insert into seed_players
select n, ('5ea9e000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid, nick,
       '765611990000001' || lpad(n::text, 2, '0'), skill
  from (values
    (1, 'Tornado', 1.35), (2, 'Quimera', 1.25), (3, 'Pampa', 1.20), (4, 'Sombra', 1.15), (5, 'Neon', 1.10),
    (6, 'Brasa', 1.05), (7, 'Kiwi', 1.00), (8, 'Toro', 0.95), (9, 'Flecha', 1.10), (10, 'Mate', 1.00),
    (11, 'Chispa', 0.95), (12, 'Rayo', 0.90), (13, 'Zorro', 0.90), (14, 'Lince', 0.85), (15, 'Cobra', 0.85),
    (16, 'Halcon', 0.80), (17, 'Bruma', 0.80), (18, 'Yeti', 0.75), (19, 'Coyote', 0.75), (20, 'Puma', 0.70)
  ) v(n, nick, skill);

insert into public.players (id, nick, steam_id, steam_added_at, bio)
select id, nick, steam, now() - interval '30 days', 'Ficha de prueba (staging)' from seed_players;

-- Equipos: Los Pibes (fichas 1 a 5) y Fenix (9 a 13). Sin capitán: captain_id es la CUENTA del capitán, y estas
-- fichas no tienen cuenta. Se asigna desde el admin cuando alguien reclame una ficha en el ensayo.
insert into public.teams (id, name, tag, kind) values
  ('5ea9e000-0000-4000-8000-000000000201', 'Los Pibes', 'LPB', 'official'),
  ('5ea9e000-0000-4000-8000-000000000202', 'Fenix', 'FNX', 'official');
insert into public.team_members (team_id, player_id, joined_at)
select case when n <= 5 then '5ea9e000-0000-4000-8000-000000000201'::uuid else '5ea9e000-0000-4000-8000-000000000202'::uuid end,
       id, now() - interval '20 days'
  from seed_players where n between 1 and 5 or n between 9 and 13;

-- Temporada BETA, como en el corte (2026-10-24-frontend-ranking/pruebas/temporada_beta_local.sql): empieza antes del
-- primer mix, así cuentan todos.
insert into public.seasons (number, name, starts_at, ends_at, top_n, min_matches, reset_pct, reset_floor, tiers)
select 1, 'BETA', now() - interval '15 days', season_default_end(now(), c.duration_days),
       c.top_n, c.min_matches, c.reset_pct, c.reset_floor, c.tiers
  from public.season_config c where c.id = 1;

-- Mixes.
do $$
declare
  total   constant int := 40;
  i       int;
  t_end   timestamptz;
  mapas   text[] := array(select name from public.map_pool where active and mixes order by name);
  mapa    text;
  equipo  int[];
  fuerza_a numeric; fuerza_b numeric;
  gana_a  boolean;
  sa int; sb int; rondas int;
  jug     jsonb;
  pl      record;
  k int; d int; hs int; dmg int; ast int; fk int; fd int;
  payload jsonb;
  v_id    uuid;
begin
  for i in 1..total + 1 loop
    -- De hace 14 días hasta ayer, uno cada ~8 horas.
    t_end := date_trunc('minute', now() - interval '14 days' + (i - 1) * interval '8 hours 10 minutes');
    mapa := mapas[1 + floor(random() * array_length(mapas, 1))::int];

    -- 10 jugadores: los 8 primeros salen casi siempre, el resto rota.
    select array_agg(n order by orden) into equipo from (
      select n, random() * case when n <= 8 then 0.25 else 1 end as orden from seed_players order by 2 limit 10
    ) x;
    -- Bandos: alternados por nivel, con algo de azar, para que no gane siempre el mismo.
    select array_agg(n order by random()) into equipo from unnest(equipo) n;

    select sum(skill) into fuerza_a from seed_players where n = any(equipo[1:5]);
    select sum(skill) into fuerza_b from seed_players where n = any(equipo[6:10]);
    gana_a := random() < fuerza_a / (fuerza_a + fuerza_b) + (fuerza_a - fuerza_b) * 0.15;
    if gana_a then sa := 13; sb := floor(random() * 12)::int; else sb := 13; sa := floor(random() * 12)::int; end if;
    rondas := sa + sb;

    jug := '[]';
    for pl in select s.*, (s.n = any(equipo[1:5])) as en_a from seed_players s where s.n = any(equipo) loop
      k   := greatest(0, round(rondas * (0.45 + 0.35 * pl.skill) * (case when pl.en_a = gana_a then 1.12 else 0.9 end)
                           * (0.7 + random() * 0.6))::int);
      d   := greatest(1, round(rondas * (0.95 - 0.25 * pl.skill) * (case when pl.en_a = gana_a then 0.85 else 1.1 end)
                           * (0.75 + random() * 0.5))::int);
      d   := least(d, rondas);
      hs  := round(k * (0.3 + random() * 0.35))::int;
      dmg := round(k * (85 + random() * 30) + random() * 200)::int;
      ast := floor(random() * 6)::int;
      fk  := least(k, floor(random() * (2 + 3 * pl.skill))::int);
      fd  := floor(random() * 4)::int;
      jug := jug || jsonb_build_object(
        'team', case when pl.en_a then 'a' else 'b' end, 'name', pl.nick, 'steamid', pl.steam,
        'rounds', rondas, 'kills', k, 'deaths', d, 'assists', ast, 'headshots', hs, 'damage', dmg,
        'k2', least(k / 2, floor(random() * 5)::int), 'k3', least(k / 3, floor(random() * 3)::int),
        'k4', case when random() < 0.15 then 1 else 0 end, 'k5', case when random() < 0.04 then 1 else 0 end,
        'first_kills', fk, 'first_deaths', fd,
        'plants', case when pl.en_a then floor(random() * 3)::int else 0 end,
        'defuses', case when not pl.en_a then floor(random() * 2)::int else 0 end);
    end loop;

    payload := jsonb_build_object(
      'schema', '1', 'match_uid', 'staging-mix-' || lpad(i::text, 3, '0'), 'map', mapa,
      'score', jsonb_build_object('a', sa, 'b', sb), 'players', jug,
      'started_at', extract(epoch from t_end - interval '38 minutes')::int,
      'ended_at', extract(epoch from t_end)::int);
    -- El último sale cancelado por abandono, a mitad de partida.
    if i = total + 1 then
      payload := payload || jsonb_build_object('status', 'cancelled', 'cancel_reason', 'abandoned',
                                               'score', jsonb_build_object('a', 4, 'b', 3));
    else
      payload := payload || jsonb_build_object('status', 'finished');
    end if;

    v_id := public.csstv_ingest('5ea9e000-0000-4000-8000-000000000001', payload);
    perform public.csstv_after_ingest(v_id, payload, 'plugin');
    perform public.elo_apply_match(v_id);
  end loop;
end $$;

update public.game_servers set last_seen_at = now() - interval '1 day' where id = '5ea9e000-0000-4000-8000-000000000001';

commit;

-- Verificación.
select count(*) filter (where status = 'finished') as mixes, count(*) filter (where status = 'cancelled') as cancelados
  from public.matches where kind = 'mix';
select count(*) as fichas_con_elo from public.player_elo;
select count(*) as en_temporada, count(*) filter (where eligible) as con_puesto from public.season_live_standings;

-- Para deshacerlo (staging): borrar en este orden.
--   delete from public.matches where external_id like 'staging-mix-%';  -- y después recalcular: select elo_recompute_all();
--   delete from public.team_members where team_id::text like '5ea9e000-%';
--   delete from public.teams where id::text like '5ea9e000-%';
--   delete from public.player_elo; delete from public.players where id::text like '5ea9e000-%';
--   delete from public.seasons where number = 1 and name = 'BETA';
--   delete from public.game_servers where id = '5ea9e000-0000-4000-8000-000000000001';
-- Más simple: volver a crear el esquema (borrar el esquema public y cargar todo de nuevo, GUIA_IMPLEMENTACION.md).
