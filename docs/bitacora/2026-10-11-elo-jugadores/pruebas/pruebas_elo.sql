\set ON_ERROR_STOP 1
set client_min_messages = notice;
insert into game_servers(name, token_hash) values ('test', encode(sha256('tok'::bytea), 'hex'));

-- Payload de un mix 5v5 entre los SteamID base+1..5 (a) y base+6..10 (b).
create function t_payload(uid text, a int, b int, ts int, base bigint default 76561198000000000) returns jsonb language sql as $$
  select jsonb_build_object('schema','1','match_uid',uid,'map','de_dust2','started_at',ts,'ended_at',ts+1800,
    'score', jsonb_build_object('a',a,'b',b),
    'players', (select jsonb_agg(jsonb_build_object('team', case when i<=5 then 'a' else 'b' end, 'name','p'||i,
       'steamid', (base+i)::text, 'rounds', a+b, 'kills', 10+i*2, 'deaths', 18-i, 'assists',3,'headshots',5,'damage',2000,
       'k1',6,'k2',2,'k3',case when i%3=0 then 1 else 0 end,'k4',0,'k5',0)) from generate_series(1,10) i))
$$;
create function t_exp(res numeric, p numeric, rating numeric) returns int language sql as $$
  select case when res=1 then greatest(d,1) when res=0 then least(d,-1) else d end
  from (select round(60*(res-p))::int + greatest(-5, least(5, round((coalesce(rating,1)-1)*10)::int)) d) x
$$;

-- T1: primer mix, todos nuevos -> prob 0.5, base ±30 + bonus
select ingest_server_match('tok', t_payload('mix-0001', 16, 10, 1000)) as m1 \gset
do $$ declare bad int; begin
  select count(*) into bad from match_player_stats s join matches m on m.id=s.match_id where m.external_id='mix-0001'
   and (s.win_prob <> 0.5 or s.elo_before <> 1000 or s.elo_delta <> t_exp(case when s.team=1 then 1 else 0 end, 0.5, s.rating) or s.elo_after <> 1000 + s.elo_delta);
  if bad > 0 or (select count(*) from player_elo) <> 10 then raise exception 'T1 falla (%)', bad; end if;
  raise notice 'T1 OK: 5v5 parejo da ±30 + bonus';
end $$;
select s.team, s.nick, s.rating, s.win_prob, s.elo_delta, s.elo_after from match_player_stats s join matches m on m.id=s.match_id where m.external_id='mix-0001' order by s.team, s.nick;

-- T2: reenviar el mismo mix no aplica de nuevo
select ingest_server_match('tok', t_payload('mix-0001', 16, 10, 1000)) = :'m1' as mismo_id;
do $$ begin
  if exists (select 1 from player_elo where matches <> 1) then raise exception 'T2 falla'; end if;
  raise notice 'T2 OK: reenvío idempotente';
end $$;

-- T3: segundo mix por partes (System2). Los ganadores anteriores ahora son favoritos y ganan de nuevo.
do $$ declare b64 text := replace(encode(convert_to(t_payload('mix-0002', 16, 12, 5000)::text,'UTF8'),'base64'), E'\n',''); h int; r uuid; bad int;
begin
  h := length(b64)/2;
  r := ingest_server_chunk('tok','mix-0002',1,2,left(b64,h));
  if r is not null then raise exception 'T3: no debía completar con 1 parte'; end if;
  r := ingest_server_chunk('tok','mix-0002',2,2,substr(b64,h+1));
  if r is null then raise exception 'T3: no completó'; end if;
  select count(*) into bad from match_player_stats s where s.match_id=r
   and (s.elo_delta <> t_exp(case when s.team=1 then 1 else 0 end, s.win_prob, s.rating)
        or (s.team=1 and s.win_prob <= 0.5) or (s.team=2 and s.win_prob >= 0.5)
        or s.elo_before <> (select elo_after from match_player_stats x join matches m on m.id=x.match_id where m.external_id='mix-0001' and x.steam_id=s.steam_id));
  if bad > 0 then raise exception 'T3 falla (%)', bad; end if;
  raise notice 'T3 OK: por partes; favorito con prob % gana menos', (select round(win_prob,3) from match_player_stats where match_id=r and team=1 limit 1);
end $$;
select s.team, s.win_prob, min(s.elo_delta) mn, max(s.elo_delta) mx from match_player_stats s join matches m on m.id=s.match_id where m.external_id='mix-0002' group by 1,2;

-- Mix armado a mano 2v2 con ratings exactos
create function t_manual(uid text, sa text, sb text, sc text, sd text, ra numeric, rb numeric, rc numeric, rd numeric, win int, ts timestamptz) returns uuid language plpgsql as $$
declare t1 uuid; t2 uuid; mid uuid; begin
  insert into teams(name,kind) values ('A','mix') returning id into t1;
  insert into teams(name,kind) values ('B','mix') returning id into t2;
  insert into matches(kind,status,team1,team2,winner,external_id,played_at) values ('mix','finished',t1,t2,case win when 1 then t1 when 2 then t2 end,uid,ts) returning id into mid;
  insert into match_player_stats(match_id,steam_id,team,rounds,rating) values (mid,sa,1,24,ra),(mid,sb,1,24,rb),(mid,sc,2,24,rc),(mid,sd,2,24,rd);
  perform elo_apply_match(mid); return mid; end $$;

-- T4: ejemplos del plan
do $$ declare mid uuid := t_manual('man-0001','76561198100000001','76561198100000002','76561198100000003','76561198100000004',1.40,0.60,1.50,0.50,1,'2026-01-01'::timestamptz + interval '3 hours');
  got int[]; begin
  select array_agg(elo_delta order by steam_id) into got from match_player_stats where match_id=mid;
  if got <> array[34,26,-25,-35] then raise exception 'T4 falla: %', got; end if;
  raise notice 'T4 OK: +34 +26 -25 -35';
end $$;

-- T5: empate -> μ no cambia, solo bonus
do $$ declare mid uuid := t_manual('man-0002','76561198200000001','76561198200000002','76561198200000003','76561198200000004',1.30,1.00,0.80,1.00,0,'2026-01-01'::timestamptz + interval '4 hours');
  got int[]; begin
  select array_agg(elo_delta order by steam_id) into got from match_player_stats where match_id=mid;
  if got <> array[3,0,-2,0] then raise exception 'T5 falla: %', got; end if;
  if exists (select 1 from player_elo where steam_id like '765611982%' and mu <> 25) then raise exception 'T5: μ cambió'; end if;
  raise notice 'T5 OK: empate solo aplica bonus y μ queda en 25';
end $$;

-- T6: bots y jugadores sin rondas no cuentan
do $$ declare t1 uuid; t2 uuid; mid uuid; begin
  insert into teams(name,kind) values ('A','mix') returning id into t1;
  insert into teams(name,kind) values ('B','mix') returning id into t2;
  insert into matches(kind,status,team1,team2,winner,external_id,played_at) values ('mix','finished',t1,t2,t1,'man-0003','2026-01-01'::timestamptz + interval '5 hours') returning id into mid;
  insert into match_player_stats(match_id,steam_id,team,rounds,rating) values (mid,'BOT',1,24,1),(mid,'76561198300000002',1,24,1),(mid,'76561198300000003',2,24,1),(mid,'76561198300000004',2,0,1);
  perform elo_apply_match(mid);
  if exists (select 1 from match_player_stats where match_id=mid and steam_id in ('BOT','76561198300000004') and elo_after is not null)
     or exists (select 1 from player_elo where steam_id in ('BOT','76561198300000004'))
     or (select count(*) from match_player_stats where match_id=mid and elo_after is not null) <> 2 then raise exception 'T6 falla'; end if;
  raise notice 'T6 OK: bots y jugadores con 0 rondas no reciben ELO';
end $$;

-- T7: recalcular todo reproduce el mismo estado
create temp table snap as select steam_id, elo, peak_elo, round(mu::numeric,9) mu, round(sigma::numeric,9) sigma, matches from player_elo;
select elo_recompute_all() as aplicados;
do $$ begin
  if exists (select * from snap except select steam_id, elo, peak_elo, round(mu::numeric,9), round(sigma::numeric,9), matches from player_elo)
     or (select count(*) from snap) <> (select count(*) from player_elo) then raise exception 'T7 falla'; end if;
  raise notice 'T7 OK: elo_recompute_all reproduce el mismo resultado';
end $$;

-- T8: un usuario que no es admin no puede recalcular
do $$ begin
  perform set_config('test.uid', gen_random_uuid()::text, true);
  begin perform elo_recompute_all(); raise exception 'T8 falla';
  exception when insufficient_privilege then raise notice 'T8 OK: no admin rechazado'; end;
  perform set_config('test.uid', '', true);
end $$;

-- T9: gana el gran no favorito (t < -4) y piso de 100
do $$ declare mid uuid; got record; begin
  insert into player_elo(steam_id, elo, mu, sigma) values ('76561198400000001',2500,60,1),('76561198400000002',2500,60,1),('76561198400000003',110,5,1),('76561198400000004',110,5,1);
  mid := t_manual('man-0004','76561198400000001','76561198400000002','76561198400000003','76561198400000004',0.2,0.2,1,1,2,now());
  select min(elo_delta) filter (where team=1) l, max(elo_delta) filter (where team=2) w, min(win_prob) p into got from match_player_stats where match_id=mid;
  if got.w <> 60 or got.l <> -65 or exists (select 1 from player_elo where mu = 'NaN' or sigma = 'NaN' or sigma <= 0) then raise exception 'T9 falla: %', got; end if;
  insert into player_elo(steam_id, elo) values ('76561198500000001',120),('76561198500000002',120),('76561198500000003',1000),('76561198500000004',1000);
  mid := t_manual('man-0005','76561198500000001','76561198500000002','76561198500000003','76561198500000004',0.2,0.2,1,1,2,now());
  if exists (select 1 from player_elo where steam_id in ('76561198500000001','76561198500000002') and elo <> 100) then raise exception 'T9: piso'; end if;
  raise notice 'T9 OK: no favorito (p=%) gana +%, sin NaN; piso de 100', got.p, got.w;
end $$;

-- T10: permisos
do $$ begin
  if has_function_privilege('anon','elo_apply_match(uuid)','execute') or has_function_privilege('authenticated','elo_apply_match(uuid)','execute')
     or has_function_privilege('anon','elo_recompute_all()','execute') or has_table_privilege('anon','player_elo','update')
     or not has_table_privilege('anon','player_elo','select') or not has_function_privilege('anon','ingest_server_match(text,jsonb)','execute')
  then raise exception 'T10 falla'; end if;
  raise notice 'T10 OK: permisos';
end $$;
