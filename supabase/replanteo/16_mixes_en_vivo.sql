-- Replanteo 16: mixes en vivo y mixes interrumpidos en la API nueva (plan docs/bitacora/2026-10-17-api-mixes-en-vivo).
--   - live_match_list y live_match_players: lo que la API lee de las fotos de live_matches (bandos, búsqueda,
--     jugadores con su ficha y la partida de torneo o PCW vinculada con !match).
--   - match_list suma cancel_reason y el estado de la revisión de un mix interrumpido.
--   - Un interrumpido con !match se vincula a su partida cuando un admin aprueba el ELO.
-- Necesita la migración 20261017120000_mixes_en_vivo.sql.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.claim_codes') is null then
    raise exception 'replanteo 16: falta claim_codes (aplicar antes 15_claim.sql)';
  end if;
  if to_regclass('public.live_matches') is null then
    raise exception 'replanteo 16: falta live_matches (aplicar antes supabase/migrations/20261017120000_mixes_en_vivo.sql)';
  end if;
  if to_regclass('public.live_match_list') is not null then
    raise exception 'replanteo 16: live_match_list ya existe (¿ya se aplicó?)';
  end if;
end $$;

-- ---------- 1. un interrumpido con !match se vincula al aprobarlo ----------
alter table public.match_crashes
  add column link_code   text,
  add column link_side_a smallint check (link_side_a in (1, 2));
comment on column public.match_crashes.link_code is 'Código de !match que traía la foto: al aprobar el ELO, el juego se vincula a esa partida';
comment on column public.match_crashes.link_side_a is 'Bando de la partida de la web que era el equipo A del mix (null: se deduce por mayoría)';

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $f$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 16: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $f$;

select pg_temp.reemplazar('public.csstv_after_ingest(uuid, jsonb, text)', array[
  [E'      insert into match_crashes(match_id, max_rounds, source)\n      values (p_match, greatest(csstv_jint(p, ''max_rounds'', 200), 1), p_source)\n',
   E'      -- (replanteo 16) con el código de !match, para vincularlo si se aprueba\n      insert into match_crashes(match_id, max_rounds, source, link_code, link_side_a)\n      values (p_match, greatest(csstv_jint(p, ''max_rounds'', 200), 1), p_source,\n              nullif(upper(trim(p->>''link_code'')), ''''), case when p->>''link_side_a'' in (''1'', ''2'') then (p->>''link_side_a'')::smallint end)\n']
]);

select pg_temp.reemplazar('public.elo_crash_apply(uuid)', array[
  [E'  -- (replanteo 06) las stats de los jugadores salen de la vista player_stats\n  perform elo_apply_match(p_match);\n',
   E'  -- (replanteo 06) las stats de los jugadores salen de la vista player_stats\n  -- (replanteo 16) !match: el juego se vincula a su partida de torneo o PCW, como en la ingesta\n  if c.link_code is not null then\n    perform csstv_link_game(p_match, c.link_code, c.link_side_a);\n  end if;\n  perform elo_apply_match(p_match);\n']
]);

-- ---------- 2. mixes en vivo ----------
-- Corre con los permisos de su dueño (sin security_invoker): necesita matches.link_code, que el público no ve,
-- para encontrar la partida vinculada. Solo expone su id. live_matches ya es pública.
create view public.live_match_list as
select l.uid, l.server_id, l.server_name, l.seq, l.map, l.score_a as score1, l.score_b as score2,
       l.score_a + l.score_b as rounds_played, l.max_rounds, l.started_at, l.updated_at,
       l.updated_at < now() - interval '10 minutes' as stale,
       -- Mismos nombres que pone la ingesta al guardar el mix.
       coalesce('Equipo ' || left(nullif(trim(l.payload #>> '{team_names,a}'), ''), 20), 'Mix de ' || coalesce(ta.name, 'A')) as side1_name,
       coalesce('Equipo ' || left(nullif(trim(l.payload #>> '{team_names,b}'), ''), 20), 'Mix de ' || coalesce(tb.name, 'B')) as side2_name,
       par.id as parent_match_id,
       case when par.id is null then null when l.payload->>'link_side_a' = '2' then 2 else 1 end::smallint as parent_side1,
       search_norm(concat_ws(' ', l.payload #>> '{team_names,a}', l.payload #>> '{team_names,b}', l.map, l.server_name,
                             (select string_agg(e->>'name', ' ') from jsonb_array_elements(l.payload->'players') e))) as search,
       array(select distinct steam_owner(csstv_steam64(e->>'steamid'))
               from jsonb_array_elements(l.payload->'players') e
              where steam_owner(csstv_steam64(e->>'steamid')) is not null) as player_ids
  from live_matches l
  left join lateral (select left(coalesce(nullif(trim(e->>'name'), ''), 'A'), 17) as name from jsonb_array_elements(l.payload->'players') e
                      where e->>'team' = 'a' order by csstv_jint(e, 'kills') desc limit 1) ta on true
  left join lateral (select left(coalesce(nullif(trim(e->>'name'), ''), 'B'), 17) as name from jsonb_array_elements(l.payload->'players') e
                      where e->>'team' = 'b' order by csstv_jint(e, 'kills') desc limit 1) tb on true
  left join matches par on nullif(trim(l.payload->>'link_code'), '') is not null
                       and par.link_code = upper(trim(l.payload->>'link_code'))
                       and par.kind <> 'mix' and par.status in ('upcoming', 'live');
comment on view public.live_match_list is 'Mixes en vivo (última foto de cada uno): bandos, búsqueda, jugadores y partida vinculada con !match';
revoke all on public.live_match_list from anon, authenticated;
grant select on public.live_match_list to anon, authenticated;

-- Un jugador por fila, con sus stats parciales. player_id con steam_owner (incluye los SteamID adicionales).
create view public.live_match_players as
select l.uid, case e->>'team' when 'a' then 1 when 'b' then 2 end::smallint as side,
       csstv_steam64(e->>'steamid') as steam_id,
       steam_owner(csstv_steam64(e->>'steamid')) as player_id,
       left(coalesce(nullif(trim(e->>'name'), ''), '?'), 32) as game_nick,
       csstv_jint(e, 'rounds', 200) as rounds, csstv_jint(e, 'kills', 999) as kills, csstv_jint(e, 'deaths', 999) as deaths,
       csstv_jint(e, 'assists', 999) as assists, csstv_jint(e, 'headshots', 999) as headshots, csstv_jint(e, 'damage', 99999) as damage,
       csstv_rating(csstv_jint(e, 'kills', 999), csstv_jint(e, 'deaths', 999), csstv_jint(e, 'rounds', 200),
                    csstv_jint(e, 'k1', 200), csstv_jint(e, 'k2', 200), csstv_jint(e, 'k3', 200),
                    csstv_jint(e, 'k4', 200), csstv_jint(e, 'k5', 200)) as rating
  from live_matches l cross join lateral jsonb_array_elements(l.payload->'players') e;
comment on view public.live_match_players is 'Jugadores de cada mix en vivo con su ficha (si tienen) y sus stats parciales';
revoke all on public.live_match_players from anon, authenticated;
grant select on public.live_match_players to anon, authenticated;

-- ---------- 3. match_list: motivo de cancelación y revisión de los interrumpidos ----------
-- Igual que en la 11, con tres columnas más al final.
create or replace view public.match_list with (security_invoker = true) as
select m.id, m.kind, m.status, m.event_id, e.name as event_name, m.stage, m.phase, m.grp, m.round, m.pos, m.bye,
       m.best_of, m.map, m.starts_at, m.played_at, coalesce(m.played_at, m.starts_at) as at, m.score1, m.score2, m.winner_side, m.side1_name, m.side2_name,
       m.team1 as team1_id, t1.name as team1_name, t1.tag as team1_tag,
       m.team2 as team2_id, t2.name as team2_name, t2.tag as team2_tag,
       m.end_reason, m.demo_status, m.parent_match_id,
       max(m.round) over (partition by m.event_id, m.stage, m.phase) as last_round,
       case m.stage when 'swiss' then 0 when 'group' then 0 when 'upper' then 1 when 'ko' then 1 when 'lower' then 2
                    when 'third' then 3 when 'grand' then 4 end as stage_order,
       search_norm(concat_ws(' ', t1.name, t1.tag, t2.name, t2.tag, m.side1_name, m.side2_name, e.name)) as search,
       array(select distinct s.player_id from match_player_stats s
              where s.player_id is not null
                and (s.match_id = m.id or s.match_id in (select c.id from matches c where c.parent_match_id = m.id))) as player_ids,
       m.cancel_reason,
       case when mc.match_id is null then null when mc.decision is null then 'pending' else mc.decision end as review,
       mc.max_rounds as review_max_rounds
  from matches m
  left join teams t1 on t1.id = m.team1
  left join teams t2 on t2.id = m.team2
  left join events e on e.id = m.event_id
  left join match_crashes mc on mc.match_id = m.id;

commit;
