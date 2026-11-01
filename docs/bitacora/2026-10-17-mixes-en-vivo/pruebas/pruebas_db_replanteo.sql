-- Mixes en vivo e interrumpidos sobre el esquema DESPUÉS del corte (replanteo 01 a 15), en la Supabase LOCAL.
-- Base:   cd web/backend && pnpm db:reset          (carga la migración 20261017120000 y después el replanteo)
-- Correr: docker exec -i supabase_db_v34frag-api psql -U postgres -v ON_ERROR_STOP=1 < pruebas_db_replanteo.sql
-- Todo se deshace al final.

begin;

insert into game_servers (id, name, token_hash)
values ('aaaaaaaa-7000-4000-8000-000000000001', 'servidor de prueba',
        encode(sha256(convert_to('tok-prueba-vivo', 'UTF8')), 'hex'));

create function pg_temp.payload(p_uid text, p_status text, p_a integer, p_b integer, p_seq integer default null)
returns jsonb language sql as $$
  select jsonb_build_object(
    'schema', 1, 'match_uid', p_uid, 'map', 'de_dust2', 'started_at', 1792000000, 'ended_at', 1792003600,
    'max_rounds', 24, 'status', p_status, 'team_names', jsonb_build_object('a', '', 'b', ''), 'demo', false,
    'score', jsonb_build_object('a', p_a, 'b', p_b), 'rounds', '[]'::jsonb,
    'players', (select jsonb_agg(jsonb_build_object('steamid', (76561199900000000 + i)::text, 'name', 'J' || i,
                                                    'team', case when i <= 2 then 'a' else 'b' end,
                                                    'rounds', p_a + p_b, 'kills', 10 + i, 'deaths', 8))
                  from generate_series(1, 4) i))
  || case when p_seq is null then '{}'::jsonb else jsonb_build_object('live_seq', p_seq) end
$$;

create function pg_temp.send(p_uid text, p jsonb) returns uuid language plpgsql as $$
declare
  b64 text := replace(encode(convert_to(p::text, 'UTF8'), 'base64'), E'\n', '');
  n   integer := (length(b64) + 1399) / 1400;
  r   uuid;
begin
  for i in 1..n loop
    r := ingest_server_chunk('tok-prueba-vivo', p_uid, i, n, substr(b64, (i - 1) * 1400 + 1, 1400));
  end loop;
  return r;
end $$;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;

do $$
declare v_id uuid; r record;
begin
  perform pg_temp.send('srv1-corte-0001_v1', pg_temp.payload('srv1-corte-0001', 'live', 6, 3, 1));
  perform pg_temp.ok(exists (select 1 from live_matches where uid = 'srv1-corte-0001' and seq = 1), 'foto en vivo');

  v_id := pg_temp.send('srv1-corte-0001', pg_temp.payload('srv1-corte-0001', 'cancelled', 6, 3) || '{"cancel_reason":"crash"}');
  select * into r from matches where id = v_id;
  perform pg_temp.ok(r.status = 'cancelled' and r.cancel_reason = 'crash' and r.team1 is null and r.side1_name is not null
                     and exists (select 1 from match_crashes where match_id = v_id)
                     and not exists (select 1 from live_matches where uid = 'srv1-corte-0001'), 'caída con bandos en la partida');

  perform elo_crash_apply(v_id);
  select * into r from matches where id = v_id;
  perform pg_temp.ok(r.status = 'finished' and r.end_reason = 'crash' and r.winner_side = 1, 'aprobado: gana el bando 1 (winner_side)');
  perform pg_temp.ok((select count(*) from match_player_stats where match_id = v_id and elo_after is not null) = 4
                     and (select bool_and(elo_delta > 0) from match_player_stats where match_id = v_id and team = 1)
                     and (select bool_and(elo_delta < 0) from match_player_stats where match_id = v_id and team = 2), 'aprobado: ELO con el ganador correcto');
end $$;

rollback;
