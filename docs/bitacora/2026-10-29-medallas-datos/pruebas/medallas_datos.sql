-- Pruebas de supabase/migrations/20261029210000_medallas_datos.sql (correr con la migración aplicada, en la base LOCAL).
-- Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;

insert into public.game_servers(id, name, token_hash, active)
values ('eeeeeeee-2100-4000-8000-000000000001', 'Prueba medallas', encode(sha256(convert_to('token-medallas', 'UTF8')), 'hex'), true);

-- Un resultado del reporter 2.7.0 y uno del 2.6.1 (sin las claves nuevas).
create function pg_temp.payload(uid text, extra boolean) returns jsonb language sql as $$
  select jsonb_build_object(
    'schema', 1, 'plugin_version', case when extra then '2.7.0' else '2.6.1' end, 'match_uid', uid, 'map', 'de_dust2',
    'started_at', 1793000000, 'ended_at', 1793002000, 'max_rounds', 30, 'overtimes', 0, 'status', 'finished',
    'team_names', jsonb_build_object('a', 'Uno', 'b', 'Dos'), 'demo', false,
    'score', jsonb_build_object('a', 2, 'b', 1),
    'rounds', case when extra then
      '[{"n":1,"winner":"a","a_side":"CT","reason":8,"a_eq":850,"b_eq":800},
        {"n":2,"winner":"b","a_side":"CT","reason":9,"a_eq":4700,"b_eq":1200},
        {"n":3,"winner":"a","a_side":"CT","reason":8,"a_eq":-1,"b_eq":99999999,"basura":"x"},
        "no es un objeto"]'::jsonb
    else '[{"n":1,"winner":"a","a_side":"CT","reason":8}]'::jsonb end,
    'players', jsonb_build_array(
      jsonb_build_object('steamid', 'STEAM_0:1:2100001', 'name', 'Uno', 'team', 'a', 'rounds', 3, 'kills', 5, 'deaths', 1,
        'assists', 0, 'headshots', 2, 'damage', 500, 'k1', 1, 'k2', 2, 'k3', 0, 'k4', 0, 'k5', 0,
        'first_kills', 1, 'first_deaths', 0, 'plants', 0, 'defuses', 0, 'teamkills', 0, 'suicides', 0)
      || case when extra then jsonb_build_object(
        'survived', 2, 'won_ct', 2, 'won_t', 0, 'pistol_won', 1, 'eco_won', 0, 'bombs_exploded', 0,
        'clutches', jsonb_build_object('1v1', 1, '1v2', 0, '1v3', 1, '1v4', 0, '1v5', 0), 'clutch_tries', 3,
        'weapon_kills', jsonb_build_object('awp', 3, 'deagle', 2, 'NO VALE', 4, 'cero', 0),
        'weapon_hs', jsonb_build_object('deagle', 2)) else '{}'::jsonb end,
      jsonb_build_object('steamid', 'STEAM_0:0:2100002', 'name', 'Dos', 'team', 'b', 'rounds', 3, 'kills', 1, 'deaths', 5,
        'assists', 0, 'headshots', 0, 'damage', 150, 'k1', 1, 'k2', 0, 'k3', 0, 'k4', 0, 'k5', 0,
        'first_kills', 0, 'first_deaths', 1, 'plants', 1, 'defuses', 0, 'teamkills', 0, 'suicides', 0)
      || case when extra then jsonb_build_object(
        'survived', 'mucho', 'won_ct', 0, 'won_t', 1, 'pistol_won', 0, 'eco_won', 1, 'bombs_exploded', 1,
        'clutches', '"no es objeto"'::jsonb, 'clutch_tries', -2, 'weapon_kills', jsonb_build_object('ak47', 1),
        'weapon_hs', '{}'::jsonb) else '{}'::jsonb end));
$$;

create temp table m as
select public.csstv_ingest('eeeeeeee-2100-4000-8000-000000000001', pg_temp.payload('prueba-medallas-270', true)) as nuevo,
       public.csstv_ingest('eeeeeeee-2100-4000-8000-000000000001', pg_temp.payload('prueba-medallas-261', false)) as viejo;

-- ---------- 2.7.0 ----------
select pg_temp.ok((select jsonb_array_length(rounds) = 3 from public.match_round_log where match_id = (select nuevo from m)),
  'round_log: 3 rondas (sin lo que no es un objeto)');
select pg_temp.ok((select rounds -> 1 = '{"n":2,"winner":"b","a_side":"CT","reason":9,"a_eq":4700,"b_eq":1200}'::jsonb
                     from public.match_round_log where match_id = (select nuevo from m)), 'round_log: ronda con equipamiento');
select pg_temp.ok((select rounds -> 2 = '{"n":3,"winner":"a","a_side":"CT","reason":8,"a_eq":-1}'::jsonb
                     from public.match_round_log where match_id = (select nuevo from m)),
  'round_log: -1 se guarda, un equipamiento fuera de rango y las claves desconocidas no');
select pg_temp.ok((select rounds_survived = 2 and rounds_won_ct = 2 and rounds_won_t = 0 and pistol_won = 1 and eco_won = 0
                          and bombs_exploded = 0 and clutch_1v1 = 1 and clutch_1v3 = 1 and clutch_1v5 = 0 and clutch_tries = 3
                     from public.match_player_extra where match_id = (select nuevo from m) and steam_id = csstv_steam64('STEAM_0:1:2100001')),
  'contadores del jugador');
select pg_temp.ok((select weapon_kills = '{"awp":3,"deagle":2}'::jsonb and weapon_hs = '{"deagle":2}'::jsonb
                     from public.match_player_extra where match_id = (select nuevo from m) and steam_id = csstv_steam64('STEAM_0:1:2100001')),
  'armas: sin claves inválidas ni ceros');
select pg_temp.ok((select rounds_survived is null and eco_won = 1 and bombs_exploded = 1 and clutch_1v1 is null
                          and clutch_tries is null and weapon_kills = '{"ak47":1}'::jsonb and weapon_hs = '{}'::jsonb
                     from public.match_player_extra where match_id = (select nuevo from m) and steam_id = csstv_steam64('STEAM_0:0:2100002')),
  'un valor inválido queda en null sin afectar al resto');
select pg_temp.ok((select kills = 5 and headshots = 2 from public.match_player_stats
                     where match_id = (select nuevo from m) and steam_id = csstv_steam64('STEAM_0:1:2100001')),
  'las stats de siempre no cambian');

-- ---------- 2.6.1 (sin claves nuevas) ----------
select pg_temp.ok((select rounds = '[{"n":1,"winner":"a","a_side":"CT","reason":8}]'::jsonb
                     from public.match_round_log where match_id = (select viejo from m)), 'plugin viejo: el registro de rondas se guarda igual');
select pg_temp.ok(not exists (select 1 from public.match_player_extra where match_id = (select viejo from m))
                  and (select count(*) = 2 from public.match_player_stats where match_id = (select viejo from m)),
  'plugin viejo: sin fila en match_player_extra (sin dato)');

-- ---------- un error en los datos nuevos no hace fallar el resultado ----------
select pg_temp.ok(public.csstv_ingest('eeeeeeee-2100-4000-8000-000000000001',
  jsonb_set(pg_temp.payload('prueba-medallas-roto', true), '{rounds}', '[{"n":"x"}]')) is not null, 'un n inválido no hace fallar el resultado');
select pg_temp.ok((select l.rounds = '[{}]'::jsonb from public.match_round_log l join public.matches mm on mm.id = l.match_id
                    where mm.external_id = 'prueba-medallas-roto'),
  'n inválido: la ronda queda sin esa clave');

-- ---------- la web vieja no ve columnas nuevas ----------
select pg_temp.ok(not exists (select 1 from information_schema.columns where table_schema = 'public'
                    and ((table_name = 'matches' and column_name = 'round_log')
                      or (table_name = 'match_player_stats' and column_name in ('weapon_kills', 'rounds_survived', 'clutch_tries')))),
  'matches y match_player_stats no tienen columnas nuevas');
delete from public.matches where id = (select nuevo from m);
select pg_temp.ok(not exists (select 1 from public.match_round_log where match_id = (select nuevo from m))
                  and not exists (select 1 from public.match_player_extra where match_id = (select nuevo from m)),
  'al borrar el mix se borran sus datos nuevos');
create temp table m2 as select public.csstv_ingest('eeeeeeee-2100-4000-8000-000000000001', pg_temp.payload('prueba-medallas-270b', true)) as nuevo;
update m set nuevo = (select nuevo from m2);

-- ---------- reenvío y permisos ----------
select pg_temp.ok(public.csstv_ingest('eeeeeeee-2100-4000-8000-000000000001', pg_temp.payload('prueba-medallas-270b', true)) = (select nuevo from m)
                  and (select count(*) = 2 from public.match_player_extra where match_id = (select nuevo from m)),
  'un reenvío devuelve la misma partida');
select pg_temp.ok(not has_function_privilege('anon', 'public.csstv_match_extra(uuid, jsonb)', 'execute')
                  and not has_function_privilege('authenticated', 'public.csstv_match_extra(uuid, jsonb)', 'execute'),
  'anon y authenticated no pueden llamar a csstv_match_extra');
select pg_temp.ok((select count(*) = 1 from regexp_matches(pg_get_functiondef('public.csstv_ingest(uuid, jsonb)'::regprocedure), 'csstv_match_extra', 'g')),
  'csstv_ingest llama una sola vez a csstv_match_extra (re-ejecutable)');
select pg_temp.ok((select count(*) = 4 from pg_policies where tablename in ('match_round_log', 'match_player_extra')),
  'RLS: todos leen, solo los admins cambian');

select pg_temp.ok(true, 'fin');
rollback;
