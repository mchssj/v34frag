-- Replanteo 06: las stats de los jugadores salen solo de las partidas (plan, sección 2.3).
-- Vistas player_stats (por jugador) y player_map_stats (por jugador y mapa), calculadas desde
-- match_player_stats de las partidas terminadas: mixes, PCW y torneos. Se borran la carga manual
-- (columnas de players y stats_auto), la tabla player_map_stats y recompute_player_stats.
-- Consecuencia aceptada por Daniel: se pierden las stats cargadas a mano de jugadores sin partidas
-- (quedan en el respaldo previo al corte).
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.player_stats') is not null then
    raise exception 'replanteo 06: player_stats ya existe (¿ya se aplicó?)';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'matches' and column_name = 'winner_side') then
    raise exception 'replanteo 06: falta winner_side (aplicar antes 04_mixes_bandos.sql)';
  end if;
  if exists (select 1 from public.player_map_stats) then
    raise exception 'replanteo 06: player_map_stats tiene filas cargadas a mano; revisar antes de borrarla';
  end if;
end $$;

-- ---------- 1. funciones: sin recálculo (la vista siempre está al día) ----------
create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 06: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.csstv_ingest(uuid, jsonb)', array[
  [E'  -- Una cancelada no cambia las estadísticas de nadie.\n  if v_status = ''finished'' then\n    foreach x in array array(select distinct unnest(affected)) loop\n      perform recompute_player_stats(x);\n    end loop;\n  end if;\n',
   E'  -- Las stats de cada jugador salen de la vista player_stats (replanteo 06): no hay nada que recalcular.\n']
]);

-- Cada reemplazo deja un comentario único, para que la inversa encuentre exactamente el mismo lugar.
select pg_temp.reemplazar('public.link_steam_id(text, uuid)', array[
  ['    perform recompute_player_stats(cur);',
   '    -- (replanteo 06) las stats de cur salen de la vista player_stats'],
  ['  perform recompute_player_stats(p_player);',
   '  -- (replanteo 06) las stats de p_player salen de la vista player_stats']
]);

drop function public.recompute_player_stats(uuid);

-- ---------- 2. sacar la carga manual ----------
drop table public.player_map_stats;
alter table public.players
  drop column rating, drop column kd, drop column hs, drop column adr,
  drop column maps, drop column wins, drop column losses, drop column stats_auto;

-- ---------- 3. vistas ----------
-- Mismas fórmulas que usaba recompute_player_stats. security_invoker: aplican las RLS de quien consulta
-- (match_player_stats y matches son de lectura pública).
create view public.player_stats with (security_invoker = true) as
select s.player_id,
       count(*)::integer                                                   as maps,
       coalesce(sum(s.rounds), 0)::integer                                 as rounds,
       coalesce(sum(s.kills), 0)::integer                                  as kills,
       coalesce(sum(s.deaths), 0)::integer                                 as deaths,
       coalesce(sum(s.assists), 0)::integer                                as assists,
       coalesce(sum(s.damage), 0)::integer                                 as damage,
       public.csstv_rating(sum(s.kills), sum(s.deaths), sum(s.rounds),
                           sum(s.k1), sum(s.k2), sum(s.k3), sum(s.k4), sum(s.k5)) as rating,
       round(sum(s.kills)::numeric / greatest(sum(s.deaths), 1), 2)        as kd,
       case when sum(s.kills) > 0 then round(sum(s.headshots) * 100.0 / sum(s.kills), 1) end as hs,
       case when sum(s.rounds) > 0 then round(sum(s.damage)::numeric / sum(s.rounds), 1) end as adr,
       count(*) filter (where m.winner_side = s.team)::integer             as wins,
       count(*) filter (where m.winner_side is not null and m.winner_side <> s.team)::integer as losses
  from public.match_player_stats s
  join public.matches m on m.id = s.match_id
 where s.player_id is not null and m.status = 'finished'
 group by s.player_id;
comment on view public.player_stats is 'Stats de cada jugador calculadas desde sus partidas terminadas (mixes, PCW y torneos)';

create view public.player_map_stats with (security_invoker = true) as
select s.player_id,
       m.map                                                               as map_name,
       count(*)::integer                                                   as maps,
       public.csstv_rating(sum(s.kills), sum(s.deaths), sum(s.rounds),
                           sum(s.k1), sum(s.k2), sum(s.k3), sum(s.k4), sum(s.k5)) as rating,
       round(sum(s.kills)::numeric / greatest(sum(s.deaths), 1), 2)        as kd,
       case when sum(s.rounds) > 0 then round(sum(s.damage)::numeric / sum(s.rounds), 1) end as adr,
       count(*) filter (where m.winner_side = s.team)::integer             as wins,
       count(*) filter (where m.winner_side is not null and m.winner_side <> s.team)::integer as losses
  from public.match_player_stats s
  join public.matches m on m.id = s.match_id
 where s.player_id is not null and m.status = 'finished' and m.map is not null
 group by s.player_id, m.map;
comment on view public.player_map_stats is 'Stats de cada jugador por mapa, calculadas desde sus partidas terminadas';

grant select on public.player_stats, public.player_map_stats to anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and prosrc ~* 'recompute_player_stats|stats_auto') then
    raise exception 'replanteo 06: todavía hay funciones que usan recompute_player_stats o stats_auto';
  end if;
end $$;

commit;
