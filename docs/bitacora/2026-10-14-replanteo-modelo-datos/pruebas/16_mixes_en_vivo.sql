-- Pruebas de supabase/replanteo/16_mixes_en_vivo.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
grant execute on function pg_temp.ok(boolean, text) to anon, authenticated;

insert into public.game_servers(id, name, token_hash)
values ('bbbbbbbb-1600-4000-8000-000000000001', 'Servidor 16', encode(sha256(convert_to('tok-16', 'UTF8')), 'hex'));

-- Dos equipos de 3 con SteamID (los bandos de la PCW) y una PCW BO1 abierta.
insert into public.players(id, nick, steam_id)
select ('dddddddd-1600-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'Jug16_' || i, (76561199916000000 + i)::text
  from generate_series(1, 6) i;
insert into public.teams(id, name, tag, kind) values
  ('eeeeeeee-1600-4000-8000-000000000001', 'Alfa16', 'A16', 'official'),
  ('eeeeeeee-1600-4000-8000-000000000002', 'Beta16', 'B16', 'official');
insert into public.team_members(team_id, player_id)
select case when i <= 3 then 'eeeeeeee-1600-4000-8000-000000000001' else 'eeeeeeee-1600-4000-8000-000000000002' end::uuid,
       ('dddddddd-1600-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid
  from generate_series(1, 6) i;
insert into public.matches(id, team1, team2, kind, status, best_of) values
  ('ffffffff-1600-4000-8000-000000000001', 'eeeeeeee-1600-4000-8000-000000000001', 'eeeeeeee-1600-4000-8000-000000000002', 'pcw', 'upcoming', 1);
create temp table codigo on commit drop as select link_code from public.matches where id = 'ffffffff-1600-4000-8000-000000000001';
grant select on codigo to anon, authenticated;

-- Foto o resultado de un mix 3v3: a = Alfa16 (jugadores 1 a 3), b = Beta16.
create function pg_temp.payload(p_uid text, p_status text, p_a int, p_b int, p_seq int default null, p_link boolean default true)
returns jsonb language sql as $$
  select jsonb_build_object(
    'schema', 1, 'match_uid', p_uid, 'map', 'de_inferno', 'started_at', 1792000000, 'ended_at', 1792003600,
    'max_rounds', 24, 'status', p_status, 'team_names', jsonb_build_object('a', 'Alfa16', 'b', ''), 'demo', false,
    'score', jsonb_build_object('a', p_a, 'b', p_b), 'rounds', '[]'::jsonb,
    'players', (select jsonb_agg(jsonb_build_object('steamid', (76561199916000000 + i)::text, 'name', 'Nick' || i,
                                                    'team', case when i <= 3 then 'a' else 'b' end,
                                                    'rounds', p_a + p_b, 'kills', 10 + i, 'deaths', 8, 'k1', 5))
                  from generate_series(1, 6) i))
  || case when p_seq is null then '{}'::jsonb else jsonb_build_object('live_seq', p_seq) end
  || case when p_link then jsonb_build_object('link_code', lower((select link_code from codigo)), 'link_side_a', 1) else '{}'::jsonb end
$$;

create function pg_temp.send(p_uid text, p jsonb) returns uuid language plpgsql as $$
declare
  b64 text := replace(encode(convert_to(p::text, 'UTF8'), 'base64'), E'\n', '');
  n   integer := (length(b64) + 1399) / 1400;
  r   uuid;
begin
  for i in 1..n loop
    r := public.ingest_server_chunk('tok-16', p_uid, i, n, substr(b64, (i - 1) * 1400 + 1, 1400));
  end loop;
  return r;
end $$;

do $$
declare r record; v_id uuid;
begin
  perform pg_temp.ok((select link_code from codigo) is not null, 'la PCW tiene código de !match');

  -- 1. Foto en vivo vinculada.
  perform pg_temp.send('r16-vivo-0001_v1', pg_temp.payload('r16-vivo-0001', 'live', 9, 4, 1));
  select * into r from public.live_match_list where uid = 'r16-vivo-0001';
  perform pg_temp.ok(r.score1 = 9 and r.score2 = 4 and r.rounds_played = 13 and r.max_rounds = 24 and not r.stale
                     and r.server_name = 'Servidor 16' and r.map = 'inferno', 'live_match_list: marcador, rondas y servidor');
  perform pg_temp.ok(r.side1_name = 'Equipo Alfa16' and r.side2_name = 'Mix de Nick6', 'live_match_list: nombres como la ingesta');
  perform pg_temp.ok(r.parent_match_id = 'ffffffff-1600-4000-8000-000000000001' and r.parent_side1 = 1, 'live_match_list: partida vinculada');
  perform pg_temp.ok(cardinality(r.player_ids) = 6 and r.search like '%nick3%', 'live_match_list: jugadores y búsqueda');
  perform pg_temp.ok((select count(*) from public.live_match_players where uid = 'r16-vivo-0001' and player_id is not null and side in (1, 2)
                        and rating is not null and kills > 0) = 6, 'live_match_players: 6 con ficha, bando y rating');
  update public.live_matches set updated_at = now() - interval '11 minutes' where uid = 'r16-vivo-0001';
  perform pg_temp.ok((select stale from public.live_match_list where uid = 'r16-vivo-0001'), 'stale después de 10 minutos');

  -- 2. Caída: guarda el código; match_list muestra la revisión pendiente.
  v_id := pg_temp.send('r16-vivo-0001', pg_temp.payload('r16-vivo-0001', 'cancelled', 9, 4) || '{"cancel_reason":"crash"}');
  perform pg_temp.ok((select link_code = (select link_code from codigo) and link_side_a = 1 from public.match_crashes where match_id = v_id),
                     'match_crashes guarda el código y el lado');
  select * into r from public.match_list where id = v_id;
  perform pg_temp.ok(r.cancel_reason = 'crash' and r.review = 'pending' and r.review_max_rounds = 24, 'match_list: crash pendiente');
  perform pg_temp.ok(not exists (select 1 from public.live_match_list where uid = 'r16-vivo-0001'), 'la caída saca el mix de en vivo');

  -- 3. Aprobar: terminado, vinculado a la PCW y con ELO.
  perform public.elo_crash_apply(v_id);
  select * into r from public.matches where id = v_id;
  perform pg_temp.ok(r.status = 'finished' and r.end_reason = 'crash' and r.winner_side = 1
                     and r.parent_match_id = 'ffffffff-1600-4000-8000-000000000001', 'aprobado: terminado y vinculado a la PCW');
  select * into r from public.matches where id = 'ffffffff-1600-4000-8000-000000000001';
  perform pg_temp.ok(r.status = 'finished' and r.score1 = 1 and r.score2 = 0, 'la PCW BO1 terminó 1-0 con el mapa aprobado');
  perform pg_temp.ok((select count(*) from public.match_player_stats where match_id = v_id and elo_after is not null) = 6, 'aprobado: ELO aplicado');
  perform pg_temp.ok((select review from public.match_list where id = v_id) = 'applied', 'match_list: applied');

  -- 4. Sin !match: se aprueba sin vincular; descartado se ve en match_list.
  v_id := pg_temp.send('r16-solo-0002', pg_temp.payload('r16-solo-0002', 'cancelled', 4, 9, null, false) || '{"cancel_reason":"crash"}');
  perform public.elo_crash_apply(v_id);
  perform pg_temp.ok((select parent_match_id is null and winner_side = 2 from public.matches where id = v_id), 'sin !match: aprobado sin vincular');
  v_id := pg_temp.send('r16-desc-0003', pg_temp.payload('r16-desc-0003', 'cancelled', 1, 0, null, false) || '{"cancel_reason":"crash"}');
  perform public.elo_crash_discard(v_id);
  perform pg_temp.ok((select review from public.match_list where id = v_id) = 'discarded', 'match_list: discarded');
  perform pg_temp.ok((select review from public.match_list where id = 'ffffffff-1600-4000-8000-000000000001') is null, 'una partida común no tiene revisión');
end $$;

-- 5. Permisos: anon lee las vistas pero no escribe ni ve el código de !match.
insert into public.live_matches(uid, server_id, seq, score_a, score_b, payload)
values ('r16-anon-0004', 'bbbbbbbb-1600-4000-8000-000000000001', 1, 0, 0, pg_temp.payload('r16-anon-0004', 'live', 0, 0, 1));
set local role anon;
do $$
begin
  -- La PCW ya terminó (paso 3): solo se vinculan partidas abiertas.
  perform pg_temp.ok((select parent_match_id is null from public.live_match_list where uid = 'r16-anon-0004')
                     and (select count(*) from public.live_match_players where uid = 'r16-anon-0004') = 6,
                     'anon lee las dos vistas; una PCW terminada ya no aparece vinculada');
  begin
    perform link_code from public.matches limit 1;
    raise exception 'FALLA: anon vio matches.link_code';
  exception when insufficient_privilege then raise notice 'OK: anon no ve matches.link_code';
  end;
  begin
    insert into public.live_match_list(uid) values ('x');
    raise exception 'FALLA: anon escribió en live_match_list';
  exception when insufficient_privilege or object_not_in_prerequisite_state or feature_not_supported then
    raise notice 'OK: anon no escribe en live_match_list (%)', sqlerrm;
  end;
end $$;
reset role;

rollback;
